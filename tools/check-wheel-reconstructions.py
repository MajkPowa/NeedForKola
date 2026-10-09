"""Offline integrity checks for the individual photo meshes and portable GLBs."""
import argparse, hashlib, io, json, struct, sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--deps', type=Path)
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, str(args.deps))
import numpy as np
from PIL import Image
from shapely.geometry import Polygon

root = Path(__file__).resolve().parents[1]
index = json.loads((root / 'assets/wheel-models/index.json').read_text('utf-8'))
baseline = json.loads((root / 'docs/qa/wheel-reconstruction/catalog-baseline.json').read_text('utf-8'))
active = {r['id'] for key in ['designs', 'ready', 'projects'] for r in baseline[key]}
concepts = {'mono5', 'deep7', 'yfork10', 'twist9', 'mesh30', 'split6', 'turbine8', 'blade12', 'star5', 'concave9'}
assert not index['errors']
assert {r['id'] for r in index['models']} == active - concepts
report = []
for entry in index['models']:
    record = json.loads((root / entry['record']).read_text('utf-8'))
    assert record['id'] == entry['id']
    assert record['coordinateSystem'] == 'unit-radius-y-up'
    for source in [record['source'], *([record['surfaceSource']] if record.get('surfaceSource') else [])]:
        assert hashlib.sha256((root / source['src']).read_bytes()).hexdigest() == source['sha256']
        with Image.open(root / source['src']) as picture:
            assert picture.size == (source['width'], source['height'])
    assert record['provenance']['approximateDepth'] and record['provenance']['notManufacturingCAD']
    for shape in record['shapes'] + record.get('surfaceDetails', []):
        assert Polygon(shape['outer'], shape.get('holes', [])).is_valid, entry['id'] + ' invalid contour'
    blob = (root / entry['glb']).read_bytes()
    magic, version, length = struct.unpack_from('<III', blob)
    assert magic == 0x46546c67 and version == 2 and length == len(blob)
    assert length < 25 * 1024 * 1024
    json_size, json_kind = struct.unpack_from('<II', blob, 12)
    assert json_kind == 0x4e4f534a
    doc = json.loads(blob[20:20 + json_size])
    bin_size, bin_kind = struct.unpack_from('<II', blob, 20 + json_size)
    assert bin_kind == 0x004e4942
    binary = blob[28 + json_size:]
    assert bin_size == len(binary) == doc['buffers'][0]['byteLength']
    assert doc['asset']['version'] == '2.0' and doc['extras']['design'] == entry['id']
    def accessor(identity):
        desc = doc['accessors'][identity]
        view = doc['bufferViews'][desc['bufferView']]
        size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[desc['type']]
        dtype = {5126: '<f4', 5125: '<u4'}[desc['componentType']]
        result = np.frombuffer(binary, dtype=dtype, count=desc['count'] * size, offset=view.get('byteOffset', 0) + desc.get('byteOffset', 0)).reshape(-1, size)
        assert np.isfinite(result).all()
        return result
    triangles = 0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            positions = accessor(primitive['attributes']['POSITION'])
            normals = accessor(primitive['attributes']['NORMAL'])
            assert np.max(np.abs(np.linalg.norm(normals, axis=1) - 1)) < .002
            indices = accessor(primitive['indices'])
            assert indices.size % 3 == 0 and np.max(indices) < len(positions)
            assert np.ptp(positions[:, 2]) > .00001
            triangles += indices.size // 3
    for image in doc.get('images', []):
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        with Image.open(io.BytesIO(binary[start:start + view['byteLength']])) as picture:
            expected_size = record['surfaceTextureSize']
            assert picture.size == (expected_size, expected_size)
    assert triangles == entry['trace']['glbTriangles']
    assert hashlib.sha256(blob).hexdigest() == entry['glbSha256']
    report.append({'id': entry['id'], 'triangles': triangles, 'bytes': length, 'holes': record['trace']['holeCount'], 'surfaceDetails': len(record.get('surfaceDetails', []))})
result = {'result': 'PASS', 'activeDesigns': len(active), 'photoMeshes': len(report), 'concepts': len(concepts), 'models': report}
(root / 'docs/qa/wheel-reconstruction/integrity.json').write_text(json.dumps(result, indent=2), 'utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'models'}))
