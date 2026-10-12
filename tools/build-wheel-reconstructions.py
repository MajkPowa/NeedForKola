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
NATIVE_CONTOUR_PATH = ROOT / 'data/wheel-reconstruction-native-contours.json'
NATIVE_CONTOURS = ({r['id']: r for r in json.loads(NATIVE_CONTOUR_PATH.read_text('utf-8')).get('records', [])}
                   if NATIVE_CONTOUR_PATH.exists() else {})


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


def deproject_shape(shape, correction):
    if not correction:
        return shape
    dx, dy = correction['centerOffset']
    def point(p):
        x, y = p
        for _ in range(12):
            influence = max(0, 1 - x*x - y*y)
            x, y = p[0] - dx*influence, p[1] - dy*influence
        return [round(x, 7), round(y, 7)]
    return {**shape, 'outer': list(map(point, shape['outer'])),
            'holes': [list(map(point, hole)) for hole in shape.get('holes', [])]}


def reviewed_details(details, metal, correction, recessed=False):
    result = []
    for detail in details:
        transformed = deproject_shape(detail, correction)
        polygon = Polygon(transformed['outer'], transformed.get('holes', [])).buffer(0)
        # Reliefs must lie on observed metal; blind pockets never open into a
        # genuine aperture. Leave a narrow physical wall at the source boundary.
        clipped = polygon.intersection(metal.buffer(-.002 if recessed else -.0008))
        parts = [clipped] if clipped.geom_type == 'Polygon' else list(getattr(clipped, 'geoms', []))
        for index, part in enumerate(parts):
            if part.geom_type != 'Polygon' or part.area < .000025:
                continue
            islands=[]
            if recessed:
                for boundary in part.interiors:
                    island=Polygon(boundary).intersection(metal)
                    island_parts=[island] if island.geom_type=='Polygon' else list(getattr(island,'geoms',[]))
                    for region in island_parts:
                        if region.geom_type=='Polygon' and region.area>.000025:
                            islands.append({'outer':[[round(x,7),round(y,7)] for x,y in list(region.exterior.coords)[:-1]],
                                'holes':[[[round(x,7),round(y,7)] for x,y in list(h.coords)[:-1]] for h in region.interiors]})
            result.append({**detail, 'id': f"{detail.get('id', 'detail')}-{index}",
                'outer': [[round(x, 7), round(y, 7)] for x, y in list(part.exterior.coords)[:-1]],
                'holes': [[[round(x, 7), round(y, 7)] for x, y in list(h.coords)[:-1]] for h in part.interiors],
                **({'preservedIslands':islands} if recessed else {})})
    return result


def crown_field(shapes, hints):
    size = 384
    mask = np.zeros((size, size), np.uint8)
    mid = (size - 1) / 2
    def points(ring):
        return np.array([[(x+1)*mid, (1-y)*mid] for x, y in ring], np.int32)
    for shape in shapes:
        cv2.fillPoly(mask, [points(shape['outer'])], 255)
        for hole in shape['holes']:
            cv2.fillPoly(mask, [points(hole)], 0)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5) / mid
    crown = np.sin(np.clip(distance / .035, 0, 1) * math.pi / 2)
    yy, xx = np.mgrid[0:size, 0:size]
    radius = np.hypot(xx-mid, yy-mid) / mid
    inner = np.clip((radius-.32)/.09, 0, 1)
    outer = np.clip((hints.get('lipInnerRadius', .95)-radius)/.06, 0, 1)
    crown *= inner*inner*(3-2*inner) * outer*outer*(3-2*outer)
    crown = cv2.GaussianBlur(crown, (0, 0), 2.5)
    import base64
    return {'size': size, 'encoding': 'uint8-base64', 'amplitude': min(.0035, hints.get('spokeCrown', .014)*.2),
            'data': base64.b64encode(np.round(crown*255).astype(np.uint8).tobytes()).decode('ascii'),
            'method': 'observed-metal-distance-field-cross-section'}


def polygon_shapes(geometry, lip_region=None):
    parts = [geometry] if geometry.geom_type == 'Polygon' else list(getattr(geometry, 'geoms', []))
    return [{'outer': [[round(x, 8), round(y, 8)] for x, y in list(part.exterior.coords)[:-1]],
             'holes': [[[round(x, 8), round(y, 8)] for x, y in list(h.coords)[:-1]] for h in part.interiors],
             **({'lipRegion': lip_region} if lip_region is not None else {})}
            for part in parts if part.geom_type == 'Polygon' and part.area > 1e-10]


def robust_bevel(shape, width, lip_radius=None, curve_steps=1):
    """Valid planar offsets keep thin apertures intact before the 3D loft.

    Three's per-vertex bevel vectors can cross on dense photo contours. The
    separately triangulated inset and edge band use Shapely's valid Boolean
    regions instead. Lip paint is divided on an actual circular boundary.
    """
    if width <= 0:
        return shape
    metal = Polygon(shape['outer'], shape.get('holes', []))
    # Wide, visibly rounded edges receive nested quarter-circle strips. Keep
    # already reviewed narrow bevels within their per-face mobile mesh budget.
    if curve_steps not in (1, 3, 6):
        raise ValueError('Unsupported bounded bevel curve sampling')
    fractions = [1 - math.cos(i * math.pi / (2 * curve_steps)) for i in range(curve_steps + 1)]
    bands = []
    previous = metal
    for fraction in fractions[1:]:
        inset = metal.buffer(-width * fraction, quad_segs=2, join_style='round')
        band = previous.difference(inset)
        if not inset.is_valid or not band.is_valid:
            raise ValueError('Invalid robust bevel cross section')
        bands.append(band)
        previous = inset
    if abs(inset.area + sum(band.area for band in bands) - metal.area) > 1e-8:
        raise ValueError('Robust bevel changed source footprint')
    circle = (Polygon([(lip_radius*math.cos(i*math.tau/512), lip_radius*math.sin(i*math.tau/512))
                       for i in range(512)]) if lip_radius else None)
    def sections(region):
        if circle is None:
            return polygon_shapes(region)
        return polygon_shapes(region.intersection(circle), False) + polygon_shapes(region.difference(circle), True)
    return {**shape, 'bevelSections': {'width': width, 'inset': sections(inset),
                                     'bands': [part for band in bands for part in sections(band)],
                                     'offsetFractions': fractions,
                                     'method': 'valid-inset-and-distance-graded-edge-band'}}


def attach_robust_bevels(record):
    profile = record['profile']
    radius = profile['radius']
    width = min(profile.get('bevel', .0025), profile['faceThickness']/4, .012*radius) / radius
    lip_radius = profile.get('lipInnerRadius', .95)
    curve_steps = profile.get('bevelCurveSegments', 1)
    pockets = record['recessedDetails']
    cuts = unary_union([Polygon(p['outer']) for p in pockets]) if pockets else None
    faces = []
    for source in record['shapes']:
        metal = Polygon(source['outer'], source.get('holes', []))
        if cuts is not None:
            metal = metal.difference(cuts)
        if not metal.is_valid:
            raise ValueError('Invalid pocket-cut face cross section')
        faces.extend(robust_bevel(shape, width, lip_radius, curve_steps) for shape in polygon_shapes(metal))
    record['faceShapes'] = faces
    for detail in record['surfaceDetails']:
        detail_width = min(profile.get('bevel', .0025), detail['height']/4) / radius
        detail.update(robust_bevel(detail, detail_width, curve_steps=curve_steps))
    for pocket in pockets:
        depth = max(.002, min(.12, pocket.get('depth', .012)))
        actual_depth = min(depth*radius, profile['faceThickness']*.72)
        floor_thickness = profile['faceThickness']-actual_depth
        pocket_width = min(profile.get('bevel', .0025), actual_depth/3, floor_thickness/4) / radius
        pocket.update(robust_bevel(pocket, pocket_width, curve_steps=curve_steps))
        if pocket.get('preservedIslands'):
            pocket['preservedIslands'] = [robust_bevel(island, width, curve_steps=curve_steps) for island in pocket['preservedIslands']]
    record['trace']['bevelMethod'] = 'valid-inset-and-distance-graded-edge-band'


def build(item):
    source = ROOT / item['referenceImage']['src']
    rgba = np.array(Image.open(source).convert('RGBA'))
    item['sourceHasAlpha'] = bool(np.mean(rgba[:, :, 3] < 10) > .01)
    ellipse = item.get('faceEllipse') or item.get('rimEllipse') or infer_ellipse(rgba)
    front = rectify(rgba, ellipse)
    mask, method = trace_mask(front, item)
    correction = item.get('perspectiveCorrection')
    shapes = [deproject_shape(s, correction) for s in contours(mask, item)]
    for shape in shapes:
        radii = [math.hypot(x,y) for x,y in shape['outer']]
        if min(radii) > .95 and np.std(radii) < .012 and Polygon(shape['outer']).area > 2.8:
            radius = min(1.0, max(radii))
            shape['outer'] = [[radius*math.cos(i*math.tau/512),radius*math.sin(i*math.tau/512)] for i in range(512)]
            item['circularRimRefined'] = True
    native_fit = NATIVE_CONTOURS.get(item['id'])
    if native_fit:
        # Reviewed native-photo curves replace raster stairs only for the exact
        # image/registration they were fitted to; no generic spoke substitution.
        if (native_fit['sourceSha256'] != digest(source)
                or native_fit['faceEllipse'] != ellipse
                or item.get('sourceView') == 'angled'):
            raise ValueError('Native-photo contour fit has a stale source registration')
        fitted = native_fit['shapes']
        if (len(fitted) != len(shapes)
                or sorted(len(s.get('holes', [])) for s in fitted)
                != sorted(len(s.get('holes', [])) for s in shapes)
                or not all(Polygon(s['outer'], s.get('holes', [])).is_valid for s in fitted)):
            raise ValueError('Native-photo contour fit changed source topology')
        shapes = fitted
    metal = unary_union([Polygon(s['outer'], s['holes']) for s in shapes])
    if not metal.is_valid:
        raise ValueError('Deprojected source contours need individual review')
    hints = item.get('geometryHints', {})
    profile = {'radius': 1.032, 'frontZ': .33, 'concavity': item.get('concavity', .10),
               'faceThickness': .055, 'bevel': .005,
               'bevelCurveSegments': 6 if native_fit else 1, **hints}
    profile['sculptMap'] = crown_field(shapes, hints)
    if correction and hints.get('hardwarePositions'):
        positions = []
        for x, y in hints['hardwarePositions']:
            p = deproject_shape({'outer': [[x,y],[x,y],[x,y]], 'holes': []}, correction)['outer'][0]
            positions.append(p)
        profile['hardwarePositions'] = positions
    reconstruction = {'schemaVersion': 2, 'id': item['id'], 'title': item['title'],
        'coordinateSystem': 'unit-radius-y-up', 'shapes': shapes,
        'profile': profile,
        'source': {'src': item['referenceImage']['src'], 'sha256': digest(source),
                   'width': rgba.shape[1], 'height': rgba.shape[0], 'kind': item['referenceImage'].get('kind', 'product'),
                   'faceEllipse': ellipse, 'sourceView': item.get('sourceView', 'front')},
        'provenance': {'method': method, 'approximateDepth': True, 'approximateBack': True,
                      'notManufacturingCAD': True,
                      'rectificationApproximate': item.get('sourceView') == 'angled',
                      'notes': item.get('notes', []), 'visualReview': item.get('visualReview'),
                      'perspectiveCorrection': correction},
        'surfaceDetails': reviewed_details(item.get('surfaceDetails', []), metal, correction),
        'recessedDetails': reviewed_details(item.get('recessedDetails', []), metal, correction, True),
        'defaultOptions': dict(PROJECT_OPTIONS.get(item['id'], {'diameter': 20, 'width': 10, 'finish': 'satin', 'color': '#b9bcc2'})),
        'trace': {'resolution': SIZE, 'shapeCount': len(shapes),
                  'contourMethod': ('reviewed-native-photo-curve' if native_fit else
                                    'reviewed-source-vector' if item.get('vectorContours') else 'source-image-contour'),
                  **({'nativeContourFit': {k: native_fit[k] for k in
                     ['method', 'maximumNativePixelError', 'edgeEvidence'] if k in native_fit}}
                     if native_fit else {}),
                  'contourTolerancePixels': item.get('vectorSimplifyPixels', 1.2) if item.get('vectorContours') else item.get('simplifyPixels', 1.2),
                  'subpixelTopologyCleaned': item.get('topologyCleaned', False),
                  'circularRimRefined': item.get('circularRimRefined', False),
                  'holeCount': sum(len(s['holes']) for s in shapes),
                  'vertices': sum(len(s['outer']) + sum(map(len, s['holes'])) for s in shapes)}}
    surface_front = front
    if item.get('textureSource'):
        surface_ref = item['textureSource']
        surface_path = ROOT / surface_ref['src']
        surface_rgba = np.array(Image.open(surface_path).convert('RGBA'))
        surface_front = rectify(surface_rgba, surface_ref['faceEllipse'])
        reconstruction['surfaceSource'] = {**surface_ref, 'sha256': digest(surface_path), 'width': surface_rgba.shape[1], 'height': surface_rgba.shape[0]}
    if item['id'] not in PROJECT_OPTIONS and not item.get('defaultOptions'):
        metal_pixels = surface_front[:, :, :3][(mask > 0) & (surface_front[:, :, 3] > 180) & (np.min(surface_front[:, :, :3], axis=2) < 244)]
        if len(metal_pixels):
            colour = np.clip(np.percentile(metal_pixels, 55, axis=0), 14, 220).astype(int)
            reconstruction['defaultOptions']['color'] = '#' + ''.join(f'{v:02x}' for v in colour)
            if float(np.mean(colour)) < 65:
                reconstruction['defaultOptions']['finish'] = 'gloss'
    reconstruction['defaultOptions'].update(item.get('defaultOptions', {}))
    attach_robust_bevels(reconstruction)
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
