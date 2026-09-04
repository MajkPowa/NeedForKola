"""Build a reproducible, attributed vehicle catalogue without engine/trim products.

Source periods remain source periods: an unlabeled update is never promoted to a
verified chassis generation or facelift. No body/year Cartesian products.
"""
from __future__ import annotations
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from vehicle_bodies import classify_body, BODY_NAMES, normalise

ROOT = Path(__file__).resolve().parents[1]
THROUGH = 2026
BODY_NAMES = {**BODY_NAMES, 'van-double': 'Dodávka · dvojkabina', 'van-window': 'Prosklená dodávka', 'minibus': 'Minibus',
              'flatbed': 'Valník', 'flatbed-double': 'Valník · dvojkabina', 'chassis': 'Podvozek s kabinou', 'chassis-double': 'Podvozek s dvojkabinou'}


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8-sig'))


def slug(value):
    value = unicodedata.normalize('NFD', str(value))
    value = ''.join(c for c in value if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def body_from_label(label):
    n = normalise(label)
    for key, value in BODY_NAMES.items():
        if normalise(value) == n:
            return key
    if 'hatchback' in n:
        return 'hatchback-3' if '3' in n else 'hatchback-5' if '5' in n else 'hatchback'
    if 'suv' in n or 'crossover' in n:
        return 'suv-coupe' if 'kupe' in n or 'coupe' in n else 'suv'
    if 'podvozek' in n: return 'chassis-double' if 'dvoj' in n else 'chassis'
    if 'valnik' in n: return 'flatbed-double' if 'dvoj' in n else 'flatbed'
    if 'minibus' in n: return 'minibus'
    if 'pick' in n:
        return 'pickup-double' if 'dvoj' in n or 'double' in n else 'pickup-single' if 'jednod' in n or 'single' in n else 'pickup-extended' if 'extra' in n else 'pickup'
    if 'dvojkabina' in n: return 'van-double'
    if 'prosklena' in n: return 'van-window'
    if any(x in n for x in ['kabrio', 'roadster', 'spider', 'cabrio']): return 'cabriolet'
    if any(x in n for x in ['kombi', 'tourer', 'shooting brake']): return 'wagon'
    if 'liftback' in n: return 'liftback'
    if 'sedan' in n or 'limuz' in n: return 'sedan'
    if 'kupe' in n or 'coupe' in n: return 'coupe'
    if 'mpv' in n or 'osobni' in n: return 'mpv'
    if 'dodavka' in n or 'van' in n or 'furgon' in n: return 'van'
    raise ValueError(f'Unmapped curated body label: {label}')


def clean_name(name, year):
    name = re.sub(r'^.*?MERCEDES BENZ\s+', '', name, flags=re.I)
    name = re.sub(r'^(?:SKODA|ŠKODA|VOLKSWAGEN|BMW|AUDI|FORD|RENAULT|PEUGEOT|TOYOTA|CITRO.N)\s+', '', name, flags=re.I)
    name = re.sub(r'\s*\(\d{4}\)\s*$', '', name)
    return f'{name.strip()} · {year}'


def build():
    source = read('data/source/vehicle-makes-models.json')
    crosswalk = read('data/model-crosswalk.json')
    lookup = {(group['group'], model['name']): model
              for group in source['groups'] for make in group['makes'] for model in make['models']}
    result = {key: [] for key in crosswalk}
    rejected = []
    for family, links in crosswalk.items():
        brand, model = family.split('/')
        seen = set()
        for link in links:
            source_model = lookup[(link['group'], link['model'])]
            for gen in source_model['generations']:
                start, end = gen['yearStart'], gen['yearEnd']
                if not isinstance(start, int) or start > THROUGH or (end is not None and end < start):
                    rejected.append({'family': family, 'sourceName': gen['name'], 'from': start, 'to': end})
                    continue
                body = classify_body(brand, model, link['model'], gen['name'], start)
                signature = (gen['name'], start, body['id'])
                if signature in seen: continue
                seen.add(signature)
                identity = '|'.join([family, link['group'], link['model'], gen['name'], str(start), body['id']])
                result[family].append({
                    'id': 'v-' + hashlib.sha1(identity.encode()).hexdigest()[:12],
                    'name': clean_name(gen['name'], start),
                    'from': start, 'to': min(end or THROUGH, THROUGH), 'sourceTo': end,
                    'body': body['id'], 'bodyName': body['name'], 'bodyBasis': body['basis'],
                    'facelift': True if re.search(r'facelift|\blci\b', gen['name'], re.I) else None,
                    'confidence': 'imported', 'endBasis': 'source' if end else 'open',
                    'status': 'catalogued', 'market': 'Zdroj nerozlišuje trhy',
                    'source': f'https://github.com/gor3a/vehicle-makes-models/tree/{source["revision"]}',
                    'sourceTitle': 'vehicle-makes-models / autoevolution.com',
                    'sourceName': gen['name'], 'sourceModel': link['model'],
                })

    supplements = []
    for filename in ['data/curated-vehicles.json', 'data/recent-vehicles.json']:
        if (ROOT / filename).exists(): supplements.extend(read(filename))
    curated_count = 0
    for item in supplements:
        brand = slug(item['brand'])
        aliases = {'land-rover': 'land-rover-range-rover', 'kgm': 'ssangyong-kgm', 'ssangyong': 'ssangyong-kgm', 'ds': 'ds-automobiles'}
        brand = aliases.get(brand, brand)
        model = slug(item['model'])
        if brand == 'polestar' and model == '2': model = 'polestar-2'
        family = f'{brand}/{model}'
        if family not in result: raise ValueError(f'Curated unknown family {family}')
        if family == 'bmw/x5': continue  # Dedicated, stable, reviewed chronology below.
        for label in item['bodyStyles']:
            body_id = body_from_label(label)
            start, end = item['from'], item.get('to')
            if start > THROUGH: continue
            # Explicit, reviewed source names replace imports; launch-year similarity
            # must never erase coexisting Scout, Alltrack or regional bodies.
            def same_body(a, b):
                return a == b or {a, b} <= {'hatchback', 'hatchback-5'} or {a, b} <= {'suv', 'suv-5'}
            result[family] = [old for old in result[family] if not (old['confidence'] == 'imported' and old.get('sourceName') in item.get('replacesSourceNames', []) and same_body(old['body'], body_id))]
            identity = '|'.join([family, item['name'], str(start), body_id])
            row = {
                'id': 'v-' + hashlib.sha1(identity.encode()).hexdigest()[:12],
                'name': item['name'], 'generationCode': item.get('generation', ''),
                'from': start, 'to': min(end or THROUGH, THROUGH), 'sourceTo': end,
                'body': body_id, 'bodyName': BODY_NAMES[body_id], 'bodyBasis': 'manufacturer',
                'facelift': item.get('facelift'), 'confidence': 'verified',
                'endBasis': 'source' if end else 'open', 'status': item.get('status', 'catalogued'),
                'market': item.get('market', 'Dle zdroje'),
                'source': item['sourceUrl'], 'sourceTitle': item.get('sourceTitle', 'Podklady výrobce'),
                'notes': item.get('notes', ''), 'startBasis': item.get('startBasis', ''),
                'verifiedOn': item.get('verifiedOn', '2026-09-05'),
                'bodyVariants': item.get('bodyVariants', []), 'additionalSources': item.get('additionalSources', []),
            }
            if not any(x['confidence'] == 'verified' and (x['from'], x['to'], x['body'], x.get('facelift'), x.get('generationCode')) == (row['from'], row['to'], row['body'], row.get('facelift'), row.get('generationCode')) for x in result[family]):
                result[family].append(row)
                curated_count += 1

    # Existing bookmarked X5 choices retain their IDs and their exact render mapping.
    x5 = [
        ('e53', 'E53 · před faceliftem', 1999, 2003, False, 'https://www.press.bmwgroup.com/usa/article/detail/T0018144EN_US/unstoppable-success%3A-10-years-of-the-bmw-x5'),
        ('e53-lci', 'E53 · facelift', 2003, 2006, True, 'https://www.press.bmwgroup.com/usa/article/detail/T0020641EN_US/the-new-bmw-x5'),
        ('e70', 'E70 · před faceliftem', 2006, 2010, False, 'https://www.press.bmwgroup.com/usa/article/detail/T0018144EN_US/unstoppable-success%3A-10-years-of-the-bmw-x5'),
        ('e70-lci', 'E70 · facelift', 2010, 2013, True, 'https://www.press.bmwgroup.com/united-kingdom/article/detail/T0080219EN_GB/the-new-bmw-x5?language=en_GB'),
        ('f15', 'F15', 2013, 2018, False, 'https://www.bmw.ca/content/bmw/marketCA/bmw_ca/en_CA/all-models/x-series.html'),
        ('g05', 'G05 · před faceliftem', 2018, 2023, False, 'https://www.press.bmwgroup.com/global/article/detail/T0281455EN/the-all-new-bmw-x5%3A-the-prestige-sav-with-the-most-innovative-technologies/1000'),
        ('g05-lci', 'G05 · facelift', 2023, 2026, True, 'https://www.press.bmwgroup.com/global/article/detail/T0408159EN/the-new-bmw-x5-and-the-new-bmw-x6'),
        ('generation-5', 'G65 · 5. generace', 2026, 2026, False, 'https://www.press.bmwgroup.com/czech/article/detail/T0459006CS/nove-bmw-x5-startuje-na-cene-2-239-900-kc-objednavky-spusteny'),
    ]
    result['bmw/x5'] = []
    for ident, name, start, end, facelift, url in x5:
        row = dict(id=ident, name=name, from_=start, to=end, sourceTo=end, body='suv', bodyName=BODY_NAMES['suv'],
                   bodyBasis='manufacturer', facelift=facelift, confidence='verified', endBasis='source',
                   source=url, sourceTitle='BMW Group', status='catalogued', market='Evropa')
        row['from'] = row.pop('from_')
        if ident in ['e70', 'g05']: row.update(asset=f'assets/cars/bmw-x5-{ident}.webp', kind='render')
        if ident == 'generation-5':
            row.update(status='announced', sourceTo=None, endBasis='open', startBasis='Výroba od srpna 2026. Český trh od listopadu 2026.', notes='Objednávky od června 2026; zákaznické dodávky v ČR jsou plánované na listopad.')
        result['bmw/x5'].append(row)

    # A missing end date is not proof that a car is still made in 2026. For a
    # source model/body sequence, bound it by the next release, retaining the
    # inference flag and original open end. Never bridge gaps in closed ranges.
    for family, rows in result.items():
        for row in rows:
            if row['endBasis'] != 'open': continue
            next_starts = [other['from'] for other in rows if other['from'] > row['from']
                           and other['body'] == row['body']
                           and (other.get('sourceModel') == row.get('sourceModel')
                                or other['confidence'] == 'verified')]
            if next_starts:
                row['to'] = min(next_starts)
                row['endBasis'] = 'inferred'
        rows.sort(key=lambda r: (r['from'], r['bodyName'], r['name'], r['id']))
        assert len({x['id'] for x in rows}) == len(rows), family

    all_rows = [row for rows in result.values() for row in rows]
    stats = {
        'families': len(result), 'familiesWithVariants': sum(bool(x) for x in result.values()),
        'variants': len(all_rows), 'manufacturerRecords': sum(x['confidence'] == 'verified' for x in all_rows),
        'unresolvedBodies': sum(x['body'] == 'unknown' for x in all_rows),
        'inferredEnds': sum(x['endBasis'] == 'inferred' for x in all_rows),
        'openEnds': sum(x['endBasis'] == 'open' for x in all_rows),
    }
    payload = {
        'schemaVersion': 1, 'through': THROUGH, 'builtOn': '2026-09-05',
        'license': 'ODbL-1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'attribution': 'Adapted from vehicle-makes-models and autoevolution.com; family mapping, body classification and manufacturer supplements by Need For Wheels.',
        'sourceRevision': source['revision'], 'stats': stats, 'models': result,
    }
    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'data/vehicle-variants.json').write_text(encoded + '\n', encoding='utf-8')
    (ROOT / 'js/vehicle-data.js').write_text('/* Generated by tools/build-vehicle-data.py. Data: ODbL-1.0. See data/LICENSE-DATA.txt. */\nwindow.NFW_VEHICLE_DATA = ' + encoded + ';\n', encoding='utf-8')
    report = dict(stats=stats, missingFamilies=[key for key, rows in result.items() if not rows], rejectedSourceRows=rejected,
                  coverage='All requested families; historical phases and bodies are not claimed exhaustive or independently verified.')
    (ROOT / 'data/coverage-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
