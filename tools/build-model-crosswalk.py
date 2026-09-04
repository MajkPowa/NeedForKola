"""Map the requested model families to exact names in the pinned ODbL seed.

No vehicle facts are invented here. Empty mappings are actionable coverage gaps.
The source's labels are intentionally retained, including its unusual aliases.
"""
import ast
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def slug(value):
    value = ''.join(c for c in unicodedata.normalize('NFD', value) if not unicodedata.combining(c))
    return re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')


source = json.loads((ROOT / 'data/source/vehicle-makes-models.json').read_text(encoding='utf8'))
code = (ROOT / 'js/vehicles.js').read_text(encoding='utf8')
requested = ast.literal_eval(re.search(r'const catalogue = (\[.*?\n  \]);', code, re.S).group(1))
groups = {g['group']: [m for mk in g['makes'] for m in mk['models']] for g in source['groups']}
brand_groups = {
    'land-rover-range-rover': ['land-rover'],
    'ssangyong-kgm': ['ssangyong', 'kgm'],
    'ds-automobiles': ['ds'],
}


def normalized_model(name, group):
    prefix = {'skoda': 'SKODA ', 'citroen': 'CITROEN ', 'mercedes-benz': 'MERCEDES BENZ ', 'ds': 'AUTOMOBILES '}.get(group, '')
    return slug(name.removeprefix(prefix))


mapping = {}
for brand, models in requested:
    bid = slug(brand)
    for name in models:
        mid = slug(name)
        mapping[f'{bid}/{mid}'] = [
            {'group': group, 'model': m['name']}
            for group in brand_groups.get(bid, [bid])
            for m in groups.get(group, [])
            if normalized_model(m['name'], group) == mid
        ]


def exact(key, group, names, append=False):
    if not append:
        mapping[key] = []
    if isinstance(names, str):
        names = names.split('|')
    available = {m['name'] for m in groups[group]}
    for name in names:
        assert name in available, (key, group, name)
        item = {'group': group, 'model': name}
        if item not in mapping[key]:
            mapping[key].append(item)


def add(key, group, names):
    exact(key, group, names, append=True)


def family(key, group, pattern):
    exact(key, group, [m['name'] for m in groups[group] if re.fullmatch(pattern, m['name'])])


# Body derivatives are separate source models. Do not use unrestricted prefix
# matching: Range Rover Sport, Corolla Cross and Seal U are requested separately.
for n in [1, 2, 3, 4, 5, 7, 8]:
    family(f'bmw/rada-{n}', 'bmw', rf'{n} Series(?: Active Tourer| Gran| Gran Tourer| Compact| Gran Turismo)?')
add('bmw/i5', 'bmw', 'i5')

mb = 'MERCEDES BENZ '
mercedes = {
    'a': ['A-Class', 'A-Klasse', 'A-Klasse Saloon'],
    'b': ['B-Klasse'],
    'c': ['C-Class', 'C-Class EV', 'C-Klasse', 'C-Klasse All-Terrain', 'C-Klasse and predecessors', 'C-Klasse SportCoupe/CLC', 'C-Klasse T-Modell'],
    'e': ['E-Class T-Modell All-Terrain', 'E-Klasse and predecessors', 'E-Klasse Cabriolet and predecessors', 'E-Klasse Coupe and predecessors', 'E-Klasse T-Modell'],
    's': ['S-Class', 'S-Class Maybach', 'S-Klasse', 'S-Klasse and predecessors', 'CL-Klasse and predecessors'],
    'cla': ['CLA Klasse', 'CLA Shooting Brake'],
    'cls': ['CLS-Klasse', 'CLS Shooting Brake'],
    'cle': ['CLE'], 'gla': ['GLA'], 'glb': ['GLB'],
    'glc': ['GLC Class', 'GLK-Klasse'],
    'gle': ['GLE-Class', 'M-Klasse'],
    'gls': ['GLS-Class', 'GL-Klasse', 'GLS Maybach'],
    'g-class': ['G-Klasse', 'G-Klasse Kurz'],
    'sl': ['SL-Klasse'],
    'eqe': ['EQE', 'EQE SUV'],
    'eqs': ['EQS', 'EQS SUV'],
    'v-class': ['V-Class and predecessors', 'VIANO'],
}
for key, names in mercedes.items():
    exact(f'mercedes-benz/{key}', 'mercedes-benz', [mb + n for n in names])
exact('mercedes-benz/amg-gt', 'mercedes-amg', 'GT|GT 4-DOOR')
# Current SL is represented by the separate Mercedes-AMG source make.
add('mercedes-benz/sl', 'mercedes-amg', 'SL-Class')

add('audi/a3', 'audi', 'A3 allstreet')
add('audi/a4', 'audi', 'A4 Avant|A4 Allroad')
add('audi/a5', 'audi', 'A5 Avant')
add('audi/a6', 'audi', 'A6 Avant|Allroad')
exact('audi/q6-e-tron', 'audi', 'Q6')
add('audi/q4-e-tron', 'audi', 'Q4')

add('volkswagen/polo', 'volkswagen', 'Polo Variant')
add('volkswagen/golf', 'volkswagen', 'Golf Variant|Golf Cabrio|Golf Alltrack|Golf Plus|Golf Sportsvan|e-Golf')
add('volkswagen/passat', 'volkswagen', 'Passat Variant|Passat Alltrack')
add('volkswagen/arteon', 'volkswagen', 'Arteon Shooting Brake')
add('volkswagen/tiguan', 'volkswagen', 'Tiguan Allspace')
add('volkswagen/id-7', 'volkswagen', 'ID.7 Tourer')
add('skoda/fabia', 'skoda', 'SKODA Fabia Combi')
add('skoda/octavia', 'skoda', 'SKODA Octavia Combi|SKODA Octavia Scout')
add('skoda/superb', 'skoda', 'SKODA Superb Combi / Scout')

# 718 deliberately starts with the actual 718 designation (2016); earlier
# Boxster/Cayman are not silently presented as 718 generations.
family('porsche/911', 'porsche', r'911 .+')
add('porsche/718-boxster', 'porsche', '718')
add('porsche/macan', 'porsche', 'Macan 4 Electric')
add('porsche/cayenne', 'porsche', 'Cayenne Electric')
add('porsche/panamera', 'porsche', 'Panamera 4 Sport Turismo|Panamera Turbo Sport Turismo')
add('porsche/taycan', 'porsche', 'Taycan Cross Turismo|Taycan Sport Turismo')

exact('toyota/highlander', 'toyota', 'Highlander / Kluger')
exact('toyota/land-cruiser', 'toyota', 'Land Cruiser / Prado|Land Cruiser V8 and predecessors')
add('toyota/hilux', 'toyota', 'Hilux Extra Cab')
exact('toyota/gr86', 'toyota', 'GR 86')
exact('ford/focus', 'ford', 'Focus US|Focus CC')
add('ford/mondeo', 'ford', 'Contour/Mondeo')
add('ford/explorer', 'ford', 'Explorer Electric|Explorer Sport|Explorer Sport Trac')
add('ford/ranger', 'ford', 'Ranger Regular Cab|Ranger Super Cab')
add('ford/tourneo', 'ford', 'E-Tourneo')
exact('ford/transit', 'ford', 'Transit Connect|Transit Custom')
for model in ['s60', 'v60', 'v90']:
    add(f'volvo/{model}', 'volvo', model.upper() + ' Cross Country')

exact('land-rover-range-rover/defender', 'land-rover', 'Defender 90|Defender 110|Defender 130')
add('land-rover-range-rover/range-rover', 'land-rover', 'Range Rover L')
exact('land-rover-range-rover/velar', 'land-rover', 'Range Rover Velar')
exact('land-rover-range-rover/evoque', 'land-rover', 'Range Rover Evoque')
add('jaguar/xf', 'jaguar', 'XF Sportbrake')

exact('hyundai/tucson', 'hyundai', 'ix35 / Tucson')
add('hyundai/kona', 'hyundai', 'Kona Electric')
add('hyundai/i20', 'hyundai', 'i20 Active')
exact('kia/ceed', 'kia', "cee'd|cee'd SW|Ceed")
exact('kia/proceed', 'kia', "Pro cee'd")
add('peugeot/308', 'peugeot', '308 SW|308 CC')
add('peugeot/508', 'peugeot', '508 SW|508 RXH')
add('renault/megane', 'renault', 'Megane E-Tech')
add('renault/scenic', 'renault', 'Grand Scenic|SCENIC XMOD')
add('renault/kangoo', 'renault', 'Grand Kangoo')
add('opel/astra', 'opel', 'Astra Caravan|Astra GTC|Astra Sports Tourer|Astra Twin Top /')
add('seat/ibiza', 'seat', 'Ibiza ST')
add('seat/leon', 'seat', 'Leon SC|Leon ST|Leon X-Perience')
add('cupra/leon', 'cupra', 'Leon Sportstourer')
add('nissan/micra', 'nissan', 'Micra C+C')
exact('nissan/navara', 'nissan', 'Navara / Frontier')
exact('mazda/mazda2', 'mazda', '2 / Demio')
exact('mazda/mazda3', 'mazda', '3 / Axela')
exact('mazda/mazda6', 'mazda', '6 / Atenza')
exact('mazda/mx-5', 'mazda', 'MX-5 / Miata')
exact('honda/jazz', 'honda', 'Jazz / City|Jazz / Fit')
add('honda/civic', 'honda', 'Civic Aero Deck|Civic Tourer|Civic Shuttle')
add('dacia/sandero', 'dacia', 'Sandero Stepway')
add('dacia/logan', 'dacia', 'Logan MCV|Logan MCV Stepway|Logan Pick-Up|Logan Van')
add('dacia/duster', 'dacia', 'Duster Pick-Up')
add('jeep/cherokee', 'jeep', 'Cherokee/Liberty')
add('jeep/wrangler', 'jeep', 'Wrangler Unlimited')

add('fiat/500', 'fiat', '500e|500 3+1|500 K / Giardiniera')
add('fiat/500l', 'fiat', '500L Living|500L Trekking|500L Urban')
add('fiat/panda', 'fiat', 'Panda 4X4|Panda City Cross|Panda Cross')
add('fiat/tipo', 'fiat', 'Tipo Station|Tipo Cross')
add('suzuki/vitara', 'suzuki', 'Escudo / Vitara')
exact('mitsubishi/asx', 'mitsubishi', 'ASX / RVR / Outlander Sport')
exact('mitsubishi/outlander', 'mitsubishi', 'Outlander / Airtrek')
exact('mitsubishi/l200', 'mitsubishi', 'L 200')
add('mitsubishi/colt', 'mitsubishi', 'Colt CZC')
add('subaru/crosstrek', 'subaru', 'XV')
exact('mini/cooper', 'mini', 'Hatch|Convertible|Classic|Coupe|Roadster')

exact('ferrari/f8-tributo', 'ferrari', 'F8')
add('ferrari/296-gtb', 'ferrari', '296 GTS')
add('bentley/continental-gt', 'bentley', 'Continental GTC')
add('bentley/flying-spur', 'bentley', 'Continental Flying Spur')
add('aston-martin/vantage', 'aston-martin', 'V8 Vantage|V12 Vantage')
for model in ['db11', 'db12', 'dbs', 'vanquish']:
    name = model.upper() if model != 'vanquish' else 'Vanquish'
    add(f'aston-martin/{model}', 'aston-martin', name + ' Volante')

exact('chevrolet/spark', 'chevrolet', 'Matiz / Spark|Spark EV')
add('chevrolet/malibu', 'chevrolet', 'Malibu Maxx')
add('chevrolet/silverado', 'chevrolet', 'Silverado 2500HD|Silverado 3500HD')
for n in ['1500', '2500', '3500']:
    exact(f'ram/{n}', 'ram', 'Trucks ' + n)
add('cadillac/escalade', 'cadillac', 'Escalade ESV|Escalade EXT|Escalade IQL')
add('gmc/sierra', 'gmc', 'Sierra 2500HD|Sierra 3500HD')
add('gmc/yukon', 'gmc', 'Yukon XL')
add('gmc/canyon', 'gmc', 'Canyon Regular Cab')
add('gmc/hummer-ev', 'gmc', 'Hummer EV SUV')
add('genesis/g70', 'genesis', 'G70 Shooting Brake')
exact('polestar/polestar-2', 'polestar', '2')
for n in ['3', '4', '5']:
    exact(f'mg/mg{n}', 'mg', 'MG ' + n)
add('ds-automobiles/ds-3', 'ds', 'AUTOMOBILES DS 3 Cabrio|AUTOMOBILES DS 3 Crossback')
# DS first appeared under Citroen before becoming a separate marque.
add('ds-automobiles/ds-3', 'citroen', 'CITROEN DS3')
add('ds-automobiles/ds-4', 'citroen', 'CITROEN DS4')
add('lancia/delta', 'lancia', 'Delta HPE')
add('smart/fortwo', 'smart', 'fortwo Cabrio')
add('ssangyong-kgm/tivoli', 'ssangyong', 'Tivoli XLV')
add('ssangyong-kgm/musso', 'ssangyong', 'Musso Sports')
exact('isuzu/d-max', 'isuzu', 'Rodeo / D-Max')

notes = {
    'mercedes-benz/glc': 'Includes GLK, the directly preceding nameplate; source names retained.',
    'mercedes-benz/gle': 'Includes M-Class, the directly preceding nameplate; source names retained.',
    'mercedes-benz/gls': 'Includes GL-Class, the directly preceding nameplate; source names retained.',
    'mercedes-benz/s': 'Includes source S-Class predecessors and its historical CL coupe branch.',
    'porsche/718-boxster': '718-designation cars only; source 718 is the Spyder body derivative. Pre-2016 Boxster is excluded.',
    'porsche/718-cayman': '718-designation cars only; pre-2016 Cayman is excluded.',
    'toyota/gr86': 'GR86 only; earlier GT86 is a separately named predecessor, not silently relabelled.',
    'toyota/gr-supra': 'GR Supra only; prior Supra generations are not silently relabelled.',
    'ford/focus': 'The source incorrectly buckets international wagon/hatch/sedan records under Focus US. Individual generation names preserve the actual styles.',
    'ford/transit': 'Source contains only Connect/Custom samples; full-size Transit and many historical phases are missing.',
    'ford/tourneo': 'Source collapses multiple Tourneo derivatives into identical names; identification requires further curation.',
    'citroen/c4-x': 'The source has ambiguous duplicated C4 records and no independently named C4 X. Do not duplicate C4 into this family.',
    'volvo/ex40': 'Rebranding of XC40 Recharge requires a source-linked supplement; do not silently relabel combustion XC40 records.',
    'mini/cooper': 'Cooper family includes Hatch/Convertible/Classic and the Coupe/Roadster body branches; engine grades are not imported.',
    'ssangyong-kgm/musso': 'SsangYong Musso and Musso Sports are available; KGM Musso is missing in this seed.',
    'cadillac/escalade': 'Includes extended ESV, EXT pickup and electric long-wheelbase IQL; standard electric IQ absent as a separate source family.',
    'isuzu/d-max': 'The source stops at 2019. Current generation is absent and requires a sourced supplement.',
    'bmw/rada-8': 'Source 8 Series Gran body branch stops at 2022; its later phase is absent.',
    'ferrari/f8-tributo': 'Two source F8 records share identical labels and periods. Body identity is lost in this export; coupe and Spider must be independently verified.',
    'ferrari/sf90': 'Multiple source records share labels but may represent distinct bodies or derivatives. Do not infer body from record order.',
}

missing = []
coverage = []
for brand, models in requested:
    for model in models:
        key = f'{slug(brand)}/{slug(model)}'
        rows = []
        for item in mapping[key]:
            src_model = next(m for m in groups[item['group']] if m['name'] == item['model'])
            rows.extend(src_model['generations'])
        valid = [r for r in rows if isinstance(r.get('yearStart'), int) and r['yearStart'] <= 2026]
        record = {'id': key, 'brand': brand, 'model': model, 'sourceModels': len(mapping[key]), 'sourcePeriods': len(valid)}
        signatures = [(r['name'], r['yearStart'], r['yearEnd'], r.get('bodyType')) for r in valid]
        duplicates = len(signatures) - len(set(signatures))
        if duplicates:
            record['ambiguousDuplicatePeriods'] = duplicates
        if key in notes:
            record['note'] = notes[key]
        if not valid:
            missing.append(record)
        coverage.append(record)

report = {
    'sourceRevision': source['revision'],
    'requestedFamilies': len(mapping),
    'mappedFamilies': sum(bool(c['sourcePeriods']) for c in coverage),
    'sourcePeriodsBeforeDeduplication': sum(c['sourcePeriods'] for c in coverage),
    'missingFamilies': missing,
    'notes': notes,
    'coverage': coverage,
    'scope': 'Exact source-name crosswalk. Counts measure imported presence, not historical completeness or verification. Source body types and chassis/facelift metadata may be absent.',
}
(ROOT / 'data/model-crosswalk.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
(ROOT / 'data/mapping-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({k: v for k, v in report.items() if k not in ['coverage', 'notes']}, ensure_ascii=False, indent=2))
