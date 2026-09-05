"""Offline wheel-face ellipse proposals. Review composites before approving geometry."""
from pathlib import Path
import argparse
import json
import math
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/.cache-wheel-fit/python'))
import cv2
import numpy as np
from scipy.ndimage import map_coordinates
from scipy.optimize import minimize


def dimensions(box):
    return box['xmax'] - box['xmin'], box['ymax'] - box['ymin']


def select_regions(boxes, width, height, photo=None):
    boxes = [b for b in boxes if b.get('candidate') and b['score'] >= .15
        and .15 <= dimensions(b)[0] / max(1, dimensions(b)[1]) <= 1.15
        and dimensions(b)[1] >= height * .035
        and dimensions(b)[1] <= height * .60
        and (b['ymax'] + b['ymin']) / 2 >= height * .38]
    if photo and photo.get('targetRegion'):
        region = photo['targetRegion']
        boxes = [b for b in boxes if region['x0'] <= (b['xmin'] + b['xmax']) / (2 * width) <= region['x1']
            and region['y0'] <= (b['ymin'] + b['ymax']) / (2 * height) <= region['y1']]
    boxes.sort(key=lambda b: dimensions(b)[0] * dimensions(b)[1], reverse=True)
    groups = []
    for box in boxes:
        cx = (box['xmin'] + box['xmax']) / 2
        cy = (box['ymin'] + box['ymax']) / 2
        match = None
        for group in groups:
            region = group[0]
            if region['xmin'] <= cx <= region['xmax'] and region['ymin'] <= cy <= region['ymax']:
                match = group
                break
        if match is None:
            groups.append([box])
        else:
            match.append(box)
    # Main-car wheels are usually the biggest matched pair. Exclude small background cars.
    groups.sort(key=lambda g: dimensions(g[0])[1] ** 1.4 * max(b['score'] for b in g), reverse=True)
    chosen = []
    for group in groups:
        region = group[0]
        cx = (region['xmin'] + region['xmax']) / 2
        cy = (region['ymin'] + region['ymax']) / 2
        if chosen:
            big = chosen[0][0]
            bx = (big['xmin'] + big['xmax']) / 2
            by = (big['ymin'] + big['ymax']) / 2
            if dimensions(region)[1] < dimensions(big)[1] * .30 or abs(cx - bx) < width * .12:
                continue
            if abs(cy - by) > height * .40:
                continue
        chosen.append(group)
        if len(chosen) == 2:
            break
    if photo and photo.get('wheelCenters'):
        manual_groups = []
        for hint in photo['wheelCenters']:
            if not groups:
                continue
            nearest = min(groups, key=lambda g: ((g[0]['xmin'] + g[0]['xmax']) / (2 * width) - hint['x']) ** 2
                + ((g[0]['ymin'] + g[0]['ymax']) / (2 * height) - hint['y']) ** 2)
            if nearest not in manual_groups:
                manual_groups.append(nearest)
        chosen = manual_groups
    return sorted(chosen, key=lambda g: (g[0]['xmin'] + g[0]['xmax']) / 2)


def fit_region(gray, group, detail_boxes=None):
    outer = group[0]
    x0, y0, x1, y1 = [outer[key] for key in ('xmin', 'ymin', 'xmax', 'ymax')]
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(gray.shape[1] - 1, x1), min(gray.shape[0] - 1, y1)
    width, height = x1 - x0, y1 - y0
    roi = gray[y0:y1, x0:x1]
    seeds = []
    nested = []
    detail_reference = None
    if detail_boxes:
        valid = []
        for box in detail_boxes:
            bw, bh = dimensions(box)
            bx, by = (box['xmin'] + box['xmax']) / 2, (box['ymin'] + box['ymax']) / 2
            if .62 <= bh / height <= .90 and .35 <= bw / width <= 1.10 and abs(by - (y0 + y1) / 2) <= height * .075:
                valid.append((box['score'], [bx, by, bw / 2, bh / 2, 0.0]))
        if valid:
            valid.sort(reverse=True)
            detail_reference = valid[0][1]
            seeds.append((detail_reference, 'detail-detection'))
            nested.append(detail_reference)
    for box in group[1:]:
        bw, bh = dimensions(box)
        rim_cy = (box['ymin'] + box['ymax']) / 2
        if .62 <= bh / height <= .90 and .35 <= bw / width <= .95 and abs(rim_cy - (y0 + y1) / 2) <= height * .075:
            seed = [(box['xmin'] + box['xmax']) / 2, (box['ymin'] + box['ymax']) / 2, bw / 2, bh / 2, 0.0]
            if detail_reference is None:
                seeds.append((seed, 'nested-detection'))
                nested.append(seed)
    # Fit closed and partial rims; spoke contours are rejected by boundary scoring below.
    for thresholds in ((35, 100), (70, 160)):
        contours, _ = cv2.findContours(cv2.Canny(roi, *thresholds), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        for contour in contours:
            if len(contour) < 20:
                continue
            (cx, cy), (dw, dh), angle = cv2.fitEllipse(contour)
            angle = math.radians(angle if angle <= 90 else angle - 180)
            if .35 * width <= dw <= 1.10 * width and .62 * height <= dh <= .90 * height \
                and .10 * width <= cx <= .95 * width and .425 * height <= cy <= .575 * height and abs(angle) < .55:
                proposal = [cx + x0, cy + y0, dw / 2, dh / 2, angle]
                if detail_reference is None or (abs(proposal[0] - detail_reference[0]) < height * .05
                    and abs(proposal[1] - detail_reference[1]) < height * .04
                    and .72 < proposal[2] / detail_reference[2] < 1.12
                    and .90 < proposal[3] / detail_reference[3] < 1.10):
                    seeds.append((proposal, 'detail-edge' if detail_reference else 'edge-ellipse'))
    # A geometry fallback is a draft only, never marked as a verified rim.
    if not seeds:
        seeds.append(([(x0 + x1) / 2, (y0 + y1) / 2, width * .34, height * .39, 0.0], 'geometry-fallback'))

    blurred = cv2.GaussianBlur(gray, (3, 3), .55).astype(np.float32)
    gx = cv2.Sobel(blurred, cv2.CV_32F, 1, 0, ksize=3) / 8
    gy = cv2.Sobel(blurred, cv2.CV_32F, 0, 1, ksize=3) / 8
    theta = np.linspace(0, 2 * np.pi, 144, endpoint=False)
    cost, sint = np.cos(theta), np.sin(theta)

    def sample(array, xx, yy):
        return map_coordinates(array, [yy, xx], order=1, mode='nearest')

    def score(values):
        cx, cy, rx, ry, angle = values
        ca, sa = math.cos(angle), math.sin(angle)
        xx = cx + rx * cost * ca - ry * sint * sa
        yy = cy + rx * cost * sa + ry * sint * ca
        nx, ny = cost / rx, sint / ry
        length = np.sqrt(nx * nx + ny * ny)
        nx, ny = nx / length, ny / length
        nx, ny = nx * ca - ny * sa, nx * sa + ny * ca
        inward = sample(blurred, xx - nx * 2.5, yy - ny * 2.5)
        outward = sample(blurred, xx + nx * 2.5, yy + ny * 2.5)
        contrast = np.clip((inward - outward) / 70, -1, 1)
        radial_gradient = np.abs(sample(gx, xx, yy) * nx + sample(gy, xx, yy) * ny)
        edge = np.clip(radial_gradient / 32, 0, 1)
        # Bright rim inside / dark tyre outside rejects the tyre's outer silhouette.
        value = float(1.7 * np.mean(np.maximum(contrast, 0)) + .60 * np.mean(edge)
            - .48 * np.mean(np.maximum(-contrast, 0)))
        # Keep the fitted face near its actual detected centre if a nested rim exists.
        if nested:
            distance = min(((cx - s[0]) / width) ** 2 + ((cy - s[1]) / height) ** 2 for s in nested)
            value -= distance * 3.0
        if detail_reference:
            dcx, dcy, drx, dry, _ = detail_reference
            value -= 25 * (((cx - dcx) / (dry * 2)) ** 2 + ((cy - dcy) / (dry * 2)) ** 2)
            value -= .15 * abs(ry / dry - 1)
        value -= .50 * abs(2 * ry / height - .79)
        return value

    bounds = [(x0 + width * .10, x1 - width * .03), (y0 + height * .425, y0 + height * .575),
        (max(3, width * .175), width * .55), (height * .31, height * .45), (-.50, .50)]
    if detail_reference:
        dcx, dcy, drx, dry, _ = detail_reference
        detail_bounds = [(dcx - max(2, dry * .08), dcx + max(2, dry * .08)),
            (dcy - max(2, dry * .06), dcy + max(2, dry * .06)),
            (drx * .75, drx * 1.08), (dry * .94, dry * 1.06), (-.45, .45)]
        bounds = [(max(a[0], b[0]), min(a[1], b[1])) for a, b in zip(bounds, detail_bounds)]
    candidates = []
    for seed, method in seeds:
        seed = [min(max(value, bound[0]), bound[1]) for value, bound in zip(seed, bounds)]
        candidates.append((score(seed), seed, method))
    candidates.sort(reverse=True)
    optimized = []
    for _, seed, method in candidates[:5]:
        # Local search avoids jumping to another wheel or to the bumper.
        limits = [width * .07, height * .05, width * .08, height * .06, .12]
        local_bounds = [(max(bound[0], value - limit), min(bound[1], value + limit)) for value, limit, bound in zip(seed, limits, bounds)]
        fit = minimize(lambda v: -score(v), seed, method='Powell', bounds=local_bounds,
            options={'maxiter': 16, 'xtol': .15, 'ftol': .003})
        optimized.append((score(fit.x), fit.x.tolist(), method))
    best_score, best, method = max(candidates[:5] + optimized, key=lambda item: item[0])
    return best, {'method': method, 'boundaryScore': round(best_score, 4),
        'detectionScore': max(b['score'] for b in group), 'candidateCount': len(seeds),
        'reviewRequired': True}, sorted(candidates + optimized, reverse=True)[:5]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ids', help='Comma-separated photo IDs to rebuild')
    parser.add_argument('--apply-overrides', action='store_true', help='Merge visual-QA corrections without refitting images')
    parser.add_argument('--prepare-crops', action='store_true', help='Prepare regions for a second high-resolution detector pass')
    args = parser.parse_args()
    raw = json.loads((ROOT / 'data/wheel-fit-detections.json').read_text(encoding='utf8'))
    detail_path = ROOT / 'data/wheel-fit-crops.json'
    detail = json.loads(detail_path.read_text(encoding='utf8')).get('photos', {}) if detail_path.exists() else {}
    inventory = json.loads((ROOT / 'data/wheel-photo-inventory.json').read_text(encoding='utf8'))
    if args.prepare_crops:
        prepared = []
        for photo in inventory['photos']:
            det = raw['photos'].get(photo['id'])
            if not det or not det.get('boxes'):
                continue
            groups = select_regions(det['boxes'], photo['width'], photo['height'], photo)
            regions = []
            for group in groups:
                b = group[0]
                regions.append({'outer': b, 'crop': [max(0, b['xmin'] - 15), max(0, b['ymin'] - 15),
                    min(photo['width'] - 1, b['xmax'] + 15), min(photo['height'] - 1, b['ymax'] + 15)]})
            prepared.append({**photo, 'regions': regions})
        (ROOT / 'tools/.cache-wheel-fit/crop-inventory.json').write_text(json.dumps(prepared), encoding='utf8')
        print('Prepared', len(prepared), 'images and', sum(len(p['regions']) for p in prepared), 'wheel regions.')
        return
    output = ROOT / 'data/wheel-fitments.json'
    existing = json.loads(output.read_text(encoding='utf8')) if (args.ids or args.apply_overrides) and output.exists() else {'schemaVersion': 1, 'photos': {}}
    fitments = existing['photos']
    selected = set(args.ids.split(',')) if args.ids else None
    qa = ROOT / 'tools/.cache-wheel-fit/ellipse-review'
    qa.mkdir(parents=True, exist_ok=True)
    diagnostics = {}
    started = time.time()
    for index, photo in enumerate(inventory['photos']):
        if args.apply_overrides:
            break
        if selected and photo['id'] not in selected:
            continue
        det = raw['photos'].get(photo['id'])
        if not det or det.get('status') == 'error' or det.get('localSha256') != photo['localSha256']:
            print('SKIP stale/missing detection:', photo['id'], flush=True)
            continue
        image = cv2.imread(str(ROOT / photo['src']))
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        groups = select_regions(det['boxes'], photo['width'], photo['height'], photo)
        wheels, details = [], []
        for group in groups:
            detail_boxes = None
            if photo['id'] in detail and detail[photo['id']].get('localSha256') == photo['localSha256']:
                outer = group[0]
                matching = [r for r in detail[photo['id']]['regions'] if r['outer']['xmin'] == outer['xmin'] and r['outer']['ymin'] == outer['ymin']]
                detail_boxes = matching[0]['boxes'] if matching else None
            ellipse, confidence, alternatives = fit_region(gray, group, detail_boxes)
            cx, cy, rx, ry, angle = ellipse
            wheels.append({'cx': round(cx / photo['width'], 6), 'cy': round(cy / photo['height'], 6),
                'rx': round(rx / photo['width'], 6), 'ry': round(ry / photo['height'], 6),
                'rotation': round(angle, 6), **confidence})
            details.append({'ellipsePixels': ellipse, 'alternatives': alternatives, 'boxes': group})
            cv2.ellipse(image, ((cx, cy), (rx * 2, ry * 2), math.degrees(angle)), (80, 255, 60), 2)
        fitments[photo['src']] = {'sourceSha1': photo.get('sourceSha1', ''), 'width': photo['width'], 'height': photo['height'],
            'wheels': wheels, 'photoId': photo['id'], 'localSha256': photo['localSha256'], 'status': 'draft-awaiting-visual-review'}
        diagnostics[photo['id']] = details
        cv2.imwrite(str(qa / (photo['id'] + '.jpg')), image)
        if index % 20 == 0 or selected:
            print(photo['id'], f'{len(wheels)} rims; {time.time()-started:.1f}s', flush=True)
    for override_path in sorted((ROOT / 'tools').glob('wheel-fit-overrides*.json')):
        overrides = json.loads(override_path.read_text(encoding='utf-8-sig'))
        for src, override in overrides.items():
            if src not in fitments or not isinstance(override, dict) or 'wheels' not in override:
                continue
            for wheel in override['wheels']:
                for field in ('cx', 'cy', 'rx', 'ry', 'rotation'):
                    if not isinstance(wheel.get(field), (int, float)) or not math.isfinite(wheel[field]):
                        raise ValueError('Invalid manual ellipse: ' + src + ' ' + field)
                if not 0 <= wheel['cx'] <= 1 or not 0 <= wheel['cy'] <= 1 or wheel['rx'] <= 0 or wheel['ry'] <= 0:
                    raise ValueError('Manual ellipse lies outside image: ' + src)
            fitments[src]['wheels'] = override['wheels']
            fitments[src]['status'] = 'manually-reviewed'
            fitments[src]['reviewNote'] = override.get('note', override.get('reviewNote', 'Visual QA correction'))
            fitments[src]['reviewSource'] = override_path.name
    payload = {'schemaVersion': 1, 'coordinateSystem': 'normalized-image', 'rotationUnit': 'radians',
        'status': 'draft-awaiting-visual-review', 'photos': fitments}
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    (qa / 'candidates.json').write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding='utf8')
    print('Saved', len(fitments), 'photo fits in', round(time.time()-started, 1), 'seconds.', flush=True)


if __name__ == '__main__':
    main()
