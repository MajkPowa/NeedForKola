"""Build individually traced, explicitly approximate 3D wheel references.

No source photograph is overwritten. Front outlines come from the selected
same-product image, not a generic spoke preset. Depth cannot be measured from
a photograph and is recorded separately as an estimate.
Dependencies: Pillow, numpy, opencv-python-headless, shapely; Node.js for exact GLB export.
"""
from __future__ import annotations
import argparse, hashlib, json, math, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--deps', type=Path)
parser.add_argument('--only', nargs='*')
parser.add_argument('--no-glb', action='store_true')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, str(args.deps))
import numpy as np
import cv2
from PIL import Image, ImageDraw
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

OUT = ROOT / 'assets/wheel-models'
QA = ROOT / 'docs/qa/wheel-reconstruction'
OUT.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
SIZE = 1024
MID = (SIZE - 1) / 2
PROJECT_OPTIONS = {
    'bmw-m2-competition-chrome': {'diameter': 19, 'width': 9, 'finish': 'chrome', 'color': '#c0c2c5'},
    'mustang-track-gold': {'diameter': 19, 'width': 9, 'finish': 'gloss', 'color': '#a77b3d'},
    'audi-rs3-drag-race-gloss-black': {'diameter': 18, 'width': 9.5, 'finish': 'gloss', 'color': '#141619'},
    'mustang-gt-50-gloss-black': {'diameter': 20, 'width': 9, 'finish': 'gloss', 'color': '#141619'},
    'lamborghini-urus-matte-tx-gold-machined': {'diameter': 23, 'width': 10, 'finish': 'matte', 'color': '#b2a96c'},
    'rolls-royce-ghost-2017-brushed-silver': {'diameter': 24, 'width': 10, 'finish': 'brushed', 'color': '#9a9ea5'},
    'lamborghini-urus-gloss-black-machined': {'diameter': 23, 'width': 10, 'finish': 'gloss', 'color': '#141619'},
    'ferrari-812-gunmetal-machined': {'diameter': 20, 'width': 10, 'finish': 'brushed', 'color': '#4c525b'},
    'ferrari-812-gloss-black': {'diameter': 21, 'width': 10, 'finish': 'gloss', 'color': '#141619'},
    'apex10': {'diameter': 19, 'width': 9, 'finish': 'gloss', 'color': '#a77b3d'},
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_reference(item):
    item = dict(item)
    item['id'] = item.get('id') or item.get('designId')
    ref = item.get('referenceImage') or item.get('chosenImage')
    item['referenceImage'] = ref
    if not ref or not item['id']:
        raise ValueError('Missing reference identity')
    item['title'] = item.get('title') or item.get('name') or item['id']
    return item


def extra_references():
    baseline = json.loads((QA / 'catalog-baseline.json').read_text('utf-8'))
    refs = []
    for identity, product in baseline['products'].items():
        if not identity.startswith('motivo-') and identity != 'apex10':
            continue
        front = next((i for i in product['images'] if 'Čelní' in i.get('label', '')), product['images'][0])
        src = front.get('original') or front.get('technicalSource') or front['src']
        if identity == 'apex10':
            src = 'assets/reference/bronze-wheel-specification.jpg'
        refs.append({'id': identity, 'group': 'configurator', 'title': product['name'],
                     'referenceImage': {'src': src, 'kind': 'product'},
                     'sourceView': 'front', 'referenceQuality': 'front-photograph',
                     'notes': ['Depth and the hidden back are reconstructed estimates.']})
    return refs


def references():
    refs = []
    for name in ['wheel-reconstruction-e6-references.json', 'wheel-reconstruction-ready-project-references.json', 'wheel-reconstruction-motivo-references.json']:
        path = ROOT / 'data' / name
        if not path.exists():
            continue
        data = json.loads(path.read_text('utf-8-sig'))
        refs.extend(data.get('records', data.get('models', [])))
    identities = {r.get('id') or r.get('designId') for r in refs}
    refs += [r for r in extra_references() if r['id'] not in identities]
    overrides = {}
    for name in ['wheel-reconstruction-e6-trace-overrides.json', 'wheel-reconstruction-ready-project-trace-overrides.json', 'wheel-reconstruction-trace-overrides.json']:
        path = ROOT / 'data' / name
        if path.exists():
            data = json.loads(path.read_text('utf-8-sig'))
            overrides.update(data.get('overrides', data))
    result = []
    surface_file = ROOT / 'data/wheel-reconstruction-project-surfaces.json'
    surfaces = json.loads(surface_file.read_text('utf-8-sig')).get('records', []) if surface_file.exists() else []
    surface_lookup = {s['id']: s for s in surfaces}
    for raw in refs:
        item = normalize_reference(raw)
        item.update(overrides.get(item['id'], {}))
        if item['id'] in surface_lookup:
            item['textureSource'] = surface_lookup[item['id']]
        if not args.only or item['id'] in args.only:
            result.append(item)
    if len({r['id'] for r in result}) != len(result):
        raise ValueError('Duplicate design ID')
    return result


def infer_ellipse(rgba):
    """Find the large rim circle; reject specification text and paired wheels."""
    h, w = rgba.shape[:2]
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    if np.mean(alpha < 10) > .01:
        mask = (alpha > 180).astype(np.uint8) * 255
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        largest = max(contours, key=cv2.contourArea)
        x, y, bw, bh = cv2.boundingRect(largest)
        return {'cx': (x + bw / 2) / w, 'cy': (y + bh / 2) / h,
                'rx': bw / w / 2, 'ry': bh / h / 2, 'rotationDeg': 0}
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    scaled = cv2.resize(gray, (max(1, int(w * min(1, 1000 / w))), max(1, int(h * min(1, 1000 / w)))))
    circles = cv2.HoughCircles(scaled, cv2.HOUGH_GRADIENT, 1.4, min(scaled.shape) * .4,
                              param1=90, param2=45, minRadius=int(min(scaled.shape) * .21),
                              maxRadius=int(min(scaled.shape) * .49))
    if circles is not None:
        c = max(circles[0], key=lambda a: a[2])
        return {'cx': float(c[0] / scaled.shape[1]), 'cy': float(c[1] / scaled.shape[0]),
                'rx': float(c[2] / scaled.shape[1]), 'ry': float(c[2] / scaled.shape[0]), 'rotationDeg': 0}
    raise ValueError('No reliable rim bounds; provide an explicit ellipse')


def rectify(rgba, ellipse, size=SIZE):
    h, w = rgba.shape[:2]
    cx, cy = ellipse['cx'] * w, ellipse['cy'] * h
    rx, ry = ellipse['rx'] * w, ellipse['ry'] * h
    angle = math.radians(ellipse.get('rotationDeg', 0))
    mid = (size - 1) / 2
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    x, y = (xx - mid) / mid, (yy - mid) / mid
    source_x = cx + x * rx * math.cos(angle) - y * ry * math.sin(angle)
    source_y = cy + x * rx * math.sin(angle) + y * ry * math.cos(angle)
    return cv2.remap(rgba, source_x.astype(np.float32), source_y.astype(np.float32),
                     cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255, 0))


def trace_mask(front, item):
    rgb, alpha = front[:, :, :3], front[:, :, 3]
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    radius = np.hypot(xx - MID, yy - MID) / MID
    mode = item.get('segmentationMode', 'auto')
    if mode == 'manual-face':
        mask = radius <= item.get('clipRadius', .997)
        method = 'reviewed-manual-front-reconstruction'
    elif mode == 'alpha' or (mode == 'auto' and item.get('sourceHasAlpha')):
        mask = alpha > item.get('alphaThreshold', 128)
        method = 'source-alpha'
    elif mode == 'gray-background':
        background = np.array(item.get('backgroundRGB', [128, 128, 128]))
        mask = np.linalg.norm(rgb.astype(float) - background, axis=2) > item.get('backgroundTolerance', 28)
        method = 'reviewed-background-separation'
    else:
        threshold = item.get('whiteThreshold', 246)
        mask = np.min(rgb, axis=2) < threshold
        method = 'white-background-separation'
    mask &= radius <= item.get('clipRadius', .997)
    mask = mask.astype(np.uint8) * 255
    closing = item.get('closingPixels', 2)
    if closing:
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((closing + 1, closing + 1), np.uint8))
    # Preserve individually annotated holes in ambiguous angled/background views.
    for hole in item.get('manualHoles', []):
        points = np.array([[(x + 1) * MID, (1 - y) * MID] for x, y in hole], np.int32)
        cv2.fillPoly(mask, [points], 0)
    for face in item.get('manualSolid', []):
        points = np.array([[(x + 1) * MID, (1 - y) * MID] for x, y in face], np.int32)
        cv2.fillPoly(mask, [points], 255)
    # Opaque photographs may contain large background-filled disconnected windows.
    components, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    minimum = item.get('minComponentPixels', 35)
    for component in range(1, components):
        if stats[component, cv2.CC_STAT_AREA] < minimum:
            mask[labels == component] = 0
    return mask, method


def contours(mask, item):
    if item.get('segmentationMode') == 'manual-face':
        # Preserve the measured vector edges. Rasterizing them first creates
        # staircase cut walls and false highlights on bevels at close range.
        radius = item.get('clipRadius', .997)
        boundary = Polygon([(radius * math.cos(i * math.tau / 512),
                             radius * math.sin(i * math.tau / 512)) for i in range(512)])
        def reviewed_polygon(points):
            shape = Polygon(points)
            if not shape.is_valid:
                repaired = shape.buffer(0)
                if abs(repaired.area - shape.area) > 4 / MID ** 2:
                    raise ValueError('Invalid reviewed vector contour')
                shape = repaired
            # The annotations may themselves have come from a pixel contour.
            # A sub-bevel tolerance removes those sampling stairs while keeping
            # every aperture and the topology of each measured region.
            return shape.simplify(item.get('vectorSimplifyPixels', 1.2) / MID, preserve_topology=True)
        openings = [reviewed_polygon(p) for p in item.get('manualHoles', [])]
        metal = boundary.difference(unary_union(openings)) if openings else boundary
        solids = [reviewed_polygon(p) for p in item.get('manualSolid', [])]
        if solids:
            metal = metal.union(unary_union(solids)).intersection(boundary)
        parts = [metal] if metal.geom_type == 'Polygon' else list(metal.geoms)
        result = [{'outer': [[x, y] for x, y in list(p.exterior.coords)[:-1]],
                   'holes': [[[x, y] for x, y in list(h.coords)[:-1]] for h in p.interiors]}
                  for p in parts if p.geom_type == 'Polygon' and p.area >= item.get('minShapeAreaPixels', 45) / MID ** 2]
        if not result or not all(Polygon(p['outer'], p['holes']).is_valid for p in result):
            raise ValueError('No valid reviewed vector metal regions')
        item['vectorContours'] = True
        return sorted(result, key=lambda s: abs(Polygon(s['outer']).area), reverse=True)
    paths, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        raise ValueError('Empty silhouette')
    hierarchy = hierarchy[0]
    shapes = []
    epsilon = item.get('simplifyPixels', 1.2)
    def points(contour):
        simplified = cv2.approxPolyDP(contour, epsilon, True)[:, 0, :]
        return [[round((float(x) - MID) / MID, 5), round((MID - float(y)) / MID, 5)] for x, y in simplified]
    for i, contour in enumerate(paths):
        if hierarchy[i][3] != -1 or cv2.contourArea(contour) < item.get('minShapeAreaPixels', 45):
            continue
        outer = points(contour)
        holes = []
        child = hierarchy[i][2]
        while child != -1:
            if cv2.contourArea(paths[child]) >= item.get('minHoleAreaPixels', 16):
                holes.append(points(paths[child]))
            child = hierarchy[child][0]
        if len(outer) >= 3:
            boundary = Polygon(outer)
            checked_holes = []
            for hole in holes:
                if len(hole) < 3:
                    continue
                opening = Polygon(hole)
                if not boundary.contains(opening):
                    # Independent contour simplification can move a shared edge
                    # less than a pixel. Keep a tiny metal bridge, not an invalid
                    # hole crossing the rim; reject larger registration errors.
                    if max(boundary.distance(Polygon(hole).boundary), max(boundary.distance(Point(p)) for p in hole)) > .002:
                        raise ValueError('Opening crosses the traced metal outline')
                    opening = opening.intersection(boundary.buffer(-.0008))
                    if opening.geom_type != 'Polygon' or opening.is_empty:
                        raise ValueError('Opening cannot be simplified safely')
                    hole = [[round(x, 7), round(y, 7)] for x, y in list(opening.exterior.coords)[:-1]]
                checked_holes.append(hole)
            shapes.append({'outer': outer, 'holes': checked_holes})
    if not shapes:
        raise ValueError('No usable contours')
    cleaned = []
    for shape in shapes:
        polygon = Polygon(shape['outer'], shape['holes'])
        if not polygon.is_valid:
            corrected = polygon.buffer(0)
            # Raster contours can touch themselves at a diagonal pixel or repeat
            # a zero-area kink. Repair only subpixel area, never a missing spoke.
            if corrected.is_empty or abs(corrected.area - polygon.area) > 4 / MID ** 2:
                raise ValueError('Contour topology needs individual review')
            item['topologyCleaned'] = True
            parts = [corrected] if corrected.geom_type == 'Polygon' else list(corrected.geoms)
            for part in parts:
                if part.area < item.get('minShapeAreaPixels', 45) / MID ** 2:
                    continue
                cleaned.append({'outer': [[x, y] for x, y in list(part.exterior.coords)[:-1]],
                                'holes': [[[x, y] for x, y in list(h.coords)[:-1]] for h in part.interiors]})
        else:
            cleaned.append(shape)
    return sorted(cleaned, key=lambda s: abs(Polygon(s['outer']).area), reverse=True)


def build(item):
    source = ROOT / item['referenceImage']['src']
    rgba = np.array(Image.open(source).convert('RGBA'))
    item['sourceHasAlpha'] = bool(np.mean(rgba[:, :, 3] < 10) > .01)
    ellipse = item.get('faceEllipse') or item.get('rimEllipse') or infer_ellipse(rgba)
    front = rectify(rgba, ellipse)
    mask, method = trace_mask(front, item)
    shapes = contours(mask, item)
    reconstruction = {'schemaVersion': 1, 'id': item['id'], 'title': item['title'],
        'coordinateSystem': 'unit-radius-y-up', 'shapes': shapes,
        'profile': {'radius': 1.032, 'frontZ': .33, 'concavity': item.get('concavity', item.get('geometryHints', {}).get('concavity', .10)),
                    'faceThickness': .06, 'bevel': .0025},
        'source': {'src': item['referenceImage']['src'], 'sha256': digest(source),
                   'width': rgba.shape[1], 'height': rgba.shape[0], 'kind': item['referenceImage'].get('kind', 'product'),
                   'faceEllipse': ellipse, 'sourceView': item.get('sourceView', 'front')},
        'provenance': {'method': method, 'approximateDepth': True, 'approximateBack': True,
                      'notManufacturingCAD': True,
                      'rectificationApproximate': item.get('sourceView') == 'angled',
                      'notes': item.get('notes', [])},
        'surfaceDetails': item.get('surfaceDetails', []),
        'defaultOptions': PROJECT_OPTIONS.get(item['id'], {'diameter': 20, 'width': 10, 'finish': 'satin', 'color': '#b9bcc2'}),
        'trace': {'resolution': SIZE, 'shapeCount': len(shapes),
                  'contourMethod': 'reviewed-source-vector' if item.get('vectorContours') else 'source-image-contour',
                  'contourTolerancePixels': item.get('vectorSimplifyPixels', 1.2) if item.get('vectorContours') else item.get('simplifyPixels', 1.2),
                  'subpixelTopologyCleaned': item.get('topologyCleaned', False),
                  'holeCount': sum(len(s['holes']) for s in shapes),
                  'vertices': sum(len(s['outer']) + sum(map(len, s['holes'])) for s in shapes)}}
    surface_front = front
    if item.get('textureSource'):
        surface_ref = item['textureSource']
        surface_path = ROOT / surface_ref['src']
        surface_rgba = np.array(Image.open(surface_path).convert('RGBA'))
        surface_front = rectify(surface_rgba, surface_ref['faceEllipse'])
        reconstruction['surfaceSource'] = {**surface_ref, 'sha256': digest(surface_path), 'width': surface_rgba.shape[1], 'height': surface_rgba.shape[0]}
    if item['id'] not in PROJECT_OPTIONS:
        metal_pixels = surface_front[:, :, :3][(mask > 0) & (surface_front[:, :, 3] > 180) & (np.min(surface_front[:, :, :3], axis=2) < 244)]
        if len(metal_pixels):
            colour = np.clip(np.percentile(metal_pixels, 55, axis=0), 14, 220).astype(int)
            reconstruction['defaultOptions']['color'] = '#' + ''.join(f'{v:02x}' for v in colour)
            if float(np.mean(colour)) < 65:
                reconstruction['defaultOptions']['finish'] = 'gloss'
    texture_ref = reconstruction.get('surfaceSource', reconstruction['source'])
    native_span = 2 * max(texture_ref['faceEllipse']['rx'] * texture_ref['width'],
                          texture_ref['faceEllipse']['ry'] * texture_ref['height'])
    reconstruction['surfaceTextureSize'] = 2048 if native_span > 1024 else 1024
    (OUT / (item['id'] + '.json')).write_text(json.dumps(reconstruction, separators=(',', ':')), 'utf-8')
    if not reconstruction['provenance']['rectificationApproximate']:
        # Bake the rectified source onto the actual front mesh in GLB exports.
        baked = rectify(surface_rgba if item.get('textureSource') else rgba,
                        texture_ref['faceEllipse'], reconstruction['surfaceTextureSize'])
        Image.fromarray(baked).convert('RGB').save(QA / (item['id'] + '-surface.jpg'), quality=96, subsampling=0)
    # Technical QA overlay only: selected photo alongside the derived silhouette.
    photo = Image.fromarray(front).convert('RGB').resize((240, 240))
    silhouette = Image.fromarray(mask).convert('RGB').resize((240, 240))
    tile = Image.new('RGB', (480, 285), '#202426')
    tile.paste(photo, (0, 0)); tile.paste(silhouette, (240, 0))
    draw = ImageDraw.Draw(tile)
    draw.text((6, 244), item['id'], fill='white')
    draw.text((6, 262), f"{method} / holes {reconstruction['trace']['holeCount']}", fill='#c0c0b8')
    tile.save(QA / (item['id'] + '-trace.jpg'), quality=88)
    return {'id': item['id'], 'title': item['title'], 'group': item.get('group', 'e6'),
            'record': 'assets/wheel-models/' + item['id'] + '.json',
            'revision': digest(OUT / (item['id'] + '.json'))[:16],
            'glb': 'assets/wheel-models/' + item['id'] + '.glb',
            'source': reconstruction['source'], 'provenance': reconstruction['provenance'],
            'trace': reconstruction['trace']}


def main():
    result, errors = [], []
    for item in references():
        try:
            result.append(build(item))
            print(item['id'], result[-1]['trace'], flush=True)
        except Exception as e:
            errors.append({'id': item['id'], 'error': str(e)})
            print(item['id'], 'FAILED', str(e), flush=True)
    index = OUT / 'index.json'
    if args.only and index.exists():
        previous = json.loads(index.read_text('utf-8'))['models']
        replace = set(args.only)
        result = [r for r in previous if r['id'] not in replace] + result
    result.sort(key=lambda r: r['id'])
    index.write_text(json.dumps({'schemaVersion': 1, 'models': result, 'errors': errors}, indent=2), 'utf-8')
    catalog = {r['id']: {k: r[k] for k in ['title', 'record', 'revision', 'glb', 'group']} for r in result}
    (ROOT / 'js/wheel-reconstruction-catalog.js').write_text(
        '// Generated individual photo-derived model registry; depth is an estimate.\n'
        'export const PHOTO_WHEEL_MODELS = Object.freeze(' + json.dumps(catalog, separators=(',', ':')) + ');\n', 'utf-8')
    (ROOT / 'js/wheel-reconstruction-data.js').write_text(
        '// Individual photo-derived meshes; depth and rear surfaces are visual estimates.\n'
        'window.NFWPhotoWheelModels = Object.freeze(' + json.dumps(catalog, separators=(',', ':')) + ');\n', 'utf-8')
    # Contact sheets include every record, retaining distinct shapes for review.
    for page in range(math.ceil(len(result) / 20)):
        batch = result[page * 20:(page + 1) * 20]
        sheet = Image.new('RGB', (1920, 285 * math.ceil(len(batch) / 4)), '#202426')
        for i, record in enumerate(batch):
            sheet.paste(Image.open(QA / (record['id'] + '-trace.jpg')), ((i % 4) * 480, (i // 4) * 285))
        sheet.save(QA / f'trace-contact-{page + 1:02d}.jpg', quality=90)
    print(json.dumps({'completed': len(result), 'errors': errors}), flush=True)
    if errors:
        raise SystemExit(1)
    if not args.no_glb:
        subprocess.run(['node', str(ROOT / 'tools/export-wheel-models.mjs')], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
