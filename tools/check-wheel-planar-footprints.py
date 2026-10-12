"""Independent, read-only source/section footprint audit; writes fresh QA JSON.

python tools/check-wheel-planar-footprints.py --deps tools/.cache-wheel-fit/python \
  --report docs/qa/wheel-fidelity-builder-audit-2026-10-12.json
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import math
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--deps', type=Path)
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--models', nargs='*')
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, str((ROOT / args.deps).resolve()))
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.validation import explain_validity


def read(filename):
    return json.loads((ROOT / filename).read_text(encoding='utf-8'))


def digest(filename):
    return hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()


def tolerance(polygon):
    # Stored section coordinates round to eight decimal places. Bound their
    # resulting area error by boundary length times one coordinate unit.
    return max(2e-8, polygon.length * 1e-8 + 1e-9)


started = time.perf_counter()
started_at = datetime.now(timezone.utc).isoformat()
index = read('assets/wheel-models/index.json')
entries = [entry for entry in index['models'] if not args.models or entry['id'] in args.models]
native_path = 'data/wheel-reconstruction-native-contours.json'
native = {record['id']: record for record in read(native_path).get('records', [])} if (ROOT / native_path).exists() else {}
inputs = ['assets/wheel-models/index.json', 'tools/build-wheel-reconstructions.py',
          'tools/check-wheel-planar-footprints.py', 'js/wheel-reconstruction.js']
if (ROOT / native_path).exists():
    inputs.append(native_path)
inputs.extend(entry['record'] for entry in entries)
inputs.extend(read(entry['record'])['source']['src'] for entry in entries)
inputs = list(dict.fromkeys(inputs))
before = {filename: digest(filename) for filename in inputs}
errors = []
records = []
sections_checked = 0
apertures_checked = 0
band_layers_checked = 0
layer_counts = {'1': 0, '3': 0, '6': 0}


def issue(model, label, reason, **details):
    errors.append({'id': model, 'label': label, 'reason': reason, **details})


if not args.models and len(entries) != 147:
    issue('catalogue', 'scope', 'The complete source catalogue must contain all 147 photographed designs', actual=len(entries))
if args.models:
    missing = set(args.models).difference(entry['id'] for entry in entries)
    if missing:
        issue('catalogue', 'scope', 'Requested source records missing', models=sorted(missing))


def polygon(shape, model, label):
    for ring in [shape['outer'], *shape.get('holes', [])]:
        if len(ring) < 3 or not all(len(point) == 2 and all(math.isfinite(value) for value in point) for point in ring):
            issue(model, label, 'Invalid or non-finite contour coordinates')
            return None
    result = Polygon(shape['outer'], shape.get('holes', []))
    if not result.is_valid or result.area <= 1e-16:
        issue(model, label, 'Invalid or empty planar polygon', validity=explain_validity(result), area=result.area)
        return None
    return result


def audit_sections(shape, model, label, expected_width, curve_steps, lip_radius=None):
    global sections_checked, band_layers_checked
    source = polygon(shape, model, label)
    if source is None:
        return 0
    sections = shape.get('bevelSections')
    if expected_width <= 0:
        if sections:
            issue(model, label, 'Unexpected positive-width bevel sections')
        return 0
    if not sections:
        issue(model, label, 'Validated bevel sections missing')
        return 0
    width = sections.get('width', 0)
    if not math.isfinite(width) or abs(width - expected_width) > 1e-12:
        issue(model, label, 'Bevel width does not match the physical section', expected=expected_width, actual=width)
    if sections.get('method') != 'valid-inset-and-distance-graded-edge-band':
        issue(model, label, 'Unknown valid-offset method')
    fractions = sections.get('offsetFractions', [])
    expected_fractions = [1 - math.cos(i * math.pi / (2 * curve_steps)) for i in range(curve_steps + 1)]
    if len(fractions) != len(expected_fractions) or any(abs(a - b) > 1e-12 for a, b in zip(fractions, expected_fractions)):
        issue(model, label, 'Quarter-circle cross-section samples do not match the bounded profile', actual=fractions)
    circle = Polygon([(lip_radius * math.cos(i * math.tau / 512), lip_radius * math.sin(i * math.tau / 512))
                      for i in range(512)]) if lip_radius else None
    regions = {'inset': [], 'bands': []}
    layer_regions = [[] for _ in range(curve_steps)]
    previous = source
    expected_layers = []
    for fraction in expected_fractions[1:]:
        inner = source.buffer(-width * fraction, quad_segs=2, join_style='round')
        expected_layers.append(previous.difference(inner))
        previous = inner
    expected_inset = previous
    tol = tolerance(source)
    for kind in ['inset', 'bands']:
        for n, part in enumerate(sections.get(kind, [])):
            region = polygon(part, model, f'{label}.{kind}[{n}]')
            if region is None:
                continue
            sections_checked += 1
            regions[kind].append(region)
            if circle is not None:
                flag = part.get('lipRegion')
                if not isinstance(flag, bool):
                    issue(model, label, 'Lip material partition flag missing')
                else:
                    wrong_area = region.intersection(circle).area if flag else region.difference(circle).area
                    if wrong_area > tol:
                        issue(model, label, 'Lip material region crosses its actual circular boundary', area=wrong_area)
            elif 'lipRegion' in part:
                issue(model, label, 'Unexpected lip material partition on a detail')
            if kind == 'bands':
                intersections = [region.intersection(layer).area for layer in expected_layers]
                layer = max(range(curve_steps), key=intersections.__getitem__)
                outside = region.difference(expected_layers[layer]).area
                if outside > tol:
                    issue(model, label, 'One edge strip crosses separate quarter-circle layers', outsideArea=outside)
                layer_regions[layer].append(region)
    inset = unary_union(regions['inset'])
    band = unary_union(regions['bands'])
    combined = unary_union([inset, band])
    footprint_error = combined.symmetric_difference(source).area
    overlap = sum(region.area for region in [*regions['inset'], *regions['bands']]) - combined.area
    if footprint_error > tol or overlap > tol:
        issue(model, label, 'Inset and edge strips do not tile the exact source footprint',
              footprintDifference=footprint_error, overlapArea=overlap, roundingAreaTolerance=tol)
    if inset.symmetric_difference(expected_inset).area > tol:
        issue(model, label, 'Final inset does not match the declared full bevel width')
    for n, expected in enumerate(expected_layers):
        band_layers_checked += 1
        actual = unary_union(layer_regions[n])
        difference = actual.symmetric_difference(expected).area
        if difference > tol:
            issue(model, label, 'A quarter-circle layer is missing or duplicated', layer=n, differenceArea=difference)
    return footprint_error


for entry in entries:
    model = entry['id']
    first_error = len(errors)
    try:
        record = read(entry['record'])
        profile = record['profile']
        radius, thickness = profile['radius'], profile['faceThickness']
        steps = profile.get('bevelCurveSegments', 1)
        if steps not in (1, 3, 6):
            raise ValueError('Unsupported bounded bevel curve sampling')
        layer_counts[str(steps)] += 1
        source_polygons = [polygon(shape, model, f'source[{i}]') for i, shape in enumerate(record['shapes'])]
        if any(part is None for part in source_polygons):
            raise ValueError('Invalid source footprint')
        metal = unary_union(source_polygons)
        source_sha = digest(record['source']['src'])
        if source_sha != record['source']['sha256']:
            issue(model, 'source', 'Original photograph SHA mismatch')
        if before[entry['record']][:16] != entry['revision']:
            issue(model, 'registry', 'JSON record revision does not match its exact bytes')
        fit = native.get(model)
        if fit:
            if (fit['sourceSha256'] != source_sha or fit['faceEllipse'] != record['source']['faceEllipse']
                    or fit['shapes'] != record['shapes'] or record['source'].get('sourceView') == 'angled'
                    or record['trace'].get('contourMethod') != 'reviewed-native-photo-curve'):
                issue(model, 'nativeFit', 'Native source fit has a stale SHA, registration, geometry or provenance')
        for shape in record['shapes']:
            for hole in shape.get('holes', []):
                opening = Polygon(hole)
                filled = opening.intersection(metal).area
                if filled > tolerance(opening):
                    issue(model, 'source aperture', 'Source aperture filled by a separate source solid', area=filled)
                apertures_checked += 1
        pocket_polygons = [polygon(part, model, 'pocket ' + part['id']) for part in record.get('recessedDetails', [])]
        if any(part is None for part in pocket_polygons):
            raise ValueError('Invalid pocket footprint')
        pocket_shells = unary_union([Polygon(part['outer']) for part in record.get('recessedDetails', [])])
        expected_base = metal.difference(pocket_shells)
        base_shapes = record.get('faceShapes', [])
        actual_base = unary_union([polygon(part, model, f'face[{i}]') for i, part in enumerate(base_shapes)])
        base_error = actual_base.symmetric_difference(expected_base).area
        if base_error > tolerance(metal):
            issue(model, 'base', 'Pocket-cut base differs from the observed metal', differenceArea=base_error)
        width = min(profile.get('bevel', .0025), thickness / 4, .012 * radius) / radius
        section_errors = [audit_sections(shape, model, f'face[{i}]', width, steps, profile.get('lipInnerRadius', .95))
                          for i, shape in enumerate(base_shapes)]
        islands = []
        for detail in record.get('surfaceDetails', []):
            part = polygon(detail, model, 'relief ' + detail['id'])
            if part is not None and part.difference(metal).area > tolerance(part):
                issue(model, detail['id'], 'Raised detail crosses a source opening')
            detail_width = min(profile.get('bevel', .0025), detail['height'] / 4) / radius
            section_errors.append(audit_sections(detail, model, 'relief ' + detail['id'], detail_width, steps))
        for pocket in record.get('recessedDetails', []):
            depth = min(max(.002, min(.12, pocket.get('depth', .012))) * radius, thickness * .72)
            floor_thickness = thickness - depth
            pocket_width = min(profile.get('bevel', .0025), depth / 3, floor_thickness / 4) / radius
            if floor_thickness <= 0 or abs((-depth - floor_thickness) - (-thickness)) > 1e-12:
                issue(model, pocket['id'], 'Blind pocket does not retain the shared solid rear plane')
            section_errors.append(audit_sections(pocket, model, 'pocket ' + pocket['id'], pocket_width, steps))
            for i, island in enumerate(pocket.get('preservedIslands', [])):
                part = polygon(island, model, pocket['id'] + f'.island[{i}]')
                if part is not None:
                    islands.append(part)
                section_errors.append(audit_sections(island, model, pocket['id'] + f'.island[{i}]', width, steps))
        backing = unary_union([actual_base, *pocket_polygons, *islands])
        backing_error = backing.symmetric_difference(metal).area
        if backing_error > tolerance(metal):
            issue(model, 'backing', 'Base, pocket floors and islands do not restore the source backing', differenceArea=backing_error)
        max_radius = max(math.hypot(*point) for shape in record['shapes']
                         for ring in [shape['outer'], *shape.get('holes', [])] for point in ring)
        if max_radius > 1.035:
            issue(model, 'source', 'Source contour exceeds the observed rim bounds', maximumRadius=max_radius)
        records.append({'id': model, 'status': 'PASS' if len(errors) == first_error else 'FAIL',
                        'recordSha256': before[entry['record']], 'sourceSha256': source_sha,
                        'sourceApertures': sum(len(shape.get('holes', [])) for shape in record['shapes']),
                        'bevelCurveSegments': steps, 'nativeContourFit': bool(fit),
                        'baseFootprintDifference': base_error, 'backingFootprintDifference': backing_error,
                        'maximumSectionFootprintDifference': max(section_errors, default=0), 'maximumRadius': max_radius})
    except Exception as error:
        issue(model, 'record', str(error))
        records.append({'id': model, 'status': 'FAIL', 'recordSha256': before[entry['record']]})

after = {filename: digest(filename) for filename in inputs}
stable = before == after
if not stable:
    issue('catalogue', 'evidence', 'Geometry inputs changed during the audit')
report = {'schemaVersion': 2, 'status': 'FAIL' if errors else 'PASS', 'pass': not errors,
          'scope': 'Fresh, read-only independent audit of source, pocket-cut base, restored backing and nested valid bevel sections.',
          'startedAt': started_at, 'completedAt': datetime.now(timezone.utc).isoformat(),
          'recordCount': len(records), 'elapsedSeconds': round(time.perf_counter() - started, 3),
          'totals': {'sectionsChecked': sections_checked, 'quarterCircleLayersChecked': band_layers_checked,
                     'sourceApertures': apertures_checked, 'boundedLayerProfileCounts': layer_counts,
                     'nativeFittedRecords': sum(record.get('nativeContourFit', False) for record in records),
                     'maximumBaseFootprintDifference': max((record.get('baseFootprintDifference', 0) for record in records), default=0),
                     'maximumBackingFootprintDifference': max((record.get('backingFootprintDifference', 0) for record in records), default=0),
                     'maximumSectionFootprintDifference': max((record.get('maximumSectionFootprintDifference', 0) for record in records), default=0)},
          'evidence': {'freshRun': True, 'inputsStable': stable, 'inputSha256': before},
          'records': records, 'errors': errors}
output = (ROOT / args.report).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
temporary = output.with_suffix(output.suffix + '.tmp')
temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
temporary.replace(output)
print(json.dumps({key: report[key] for key in ['status', 'recordCount', 'elapsedSeconds', 'totals']}))
if errors:
    print(json.dumps(errors, ensure_ascii=False), file=sys.stderr)
    raise SystemExit(1)
