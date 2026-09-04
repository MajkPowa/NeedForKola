"""Rebuild the local raster automobile identification marks (no runtime CDN)."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import json
import re
import unicodedata
import urllib.request

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'brands'
REVISION = 'bb2d661f28ce617dba8a51bdfc2069a3381a23b0'
REPO = 'https://github.com/filippofilip95/car-logos-dataset'
RAW = f'https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/{REVISION}/'
ALIASES = {'land-rover-range-rover': 'land-rover', 'ssangyong-kgm': 'ssangyong', 'ds-automobiles': 'ds'}


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'NeedForWheels-asset-build'})
    return urllib.request.urlopen(request, timeout=45).read()


def slug(value):
    value = ''.join(c for c in unicodedata.normalize('NFD', value) if not unicodedata.combining(c))
    return re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')


def build(entry):
    name, catalogue_id, record = entry
    source_path = f'logos/optimized/{record["slug"]}.png'
    image = Image.open(BytesIO(fetch(RAW + source_path))).convert('RGBA')
    # Remove only empty canvas margin. The mark and its original colours remain intact.
    if image.getextrema()[3][0] < 255:
        bbox = image.getchannel('A').getbbox()
    else:
        background = Image.new('RGB', image.size, image.getpixel((0, 0))[:3])
        bbox = ImageChops.difference(image.convert('RGB'), background).getbbox()
    if bbox:
        image = image.crop(bbox)
    image.thumbnail((144, 96), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (160, 112))
    canvas.alpha_composite(image, ((160 - image.width) // 2, (112 - image.height) // 2))
    canvas.save(DEST / f'{catalogue_id}.png', optimize=True)
    return catalogue_id, {
        'src': f'assets/brands/{catalogue_id}.png',
        'name': name,
        'source': f'{REPO}/blob/{REVISION}/{source_path}',
        'upstreamSource': record['image']['source'] if record['image']['source'].startswith('https://') else f'{REPO}/blob/{REVISION}/local-logos/{record["slug"]}.png',
        'markName': record['name'].replace('\ufffdkoda', 'Škoda'),
    }


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    catalogue = re.findall(r"^\s*\['([^']+)', \[", (ROOT / 'js/vehicles.js').read_text(encoding='utf-8'), re.M)
    records = {row['slug']: row for row in json.loads(fetch(RAW + 'logos/data.json'))}
    jobs = [(name, slug(name), records[ALIASES.get(slug(name), slug(name))]) for name in catalogue]
    with ThreadPoolExecutor(max_workers=8) as pool:
        mapping = dict(pool.map(build, jobs))
    assert len(mapping) == 53
    manifest = {'revision': REVISION, 'repository': REPO, 'logos': mapping}
    (DEST / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    runtime = {key: {field: value[field] for field in ('src', 'name', 'source')} for key, value in mapping.items()}
    (ROOT / 'js/brand-logos.js').write_text(
        '/* Local raster brand identifiers. Provenance: docs/brand-logos.md. */\n'
        '(function (global) {\n  "use strict";\n  const logos = ' + json.dumps(runtime, ensure_ascii=False, indent=2)
        + ';\n  Object.values(logos).forEach(Object.freeze);\n  global.NFWBrandLogos = Object.freeze(logos);\n})(window);\n', encoding='utf-8')
    # A local contact sheet makes visual checks reproducible; it is not used in the UI.
    sheet = Image.new('RGB', (800, ((len(mapping) + 4) // 5) * 150), '#f6f5f2')
    draw = ImageDraw.Draw(sheet)
    for index, (brand_id, value) in enumerate(mapping.items()):
        x, y = (index % 5) * 160, (index // 5) * 150
        icon = Image.open(DEST / f'{brand_id}.png')
        sheet.paste(icon, (x, y), icon)
        draw.text((x + 5, y + 117), value['name'], fill='#161719')
    sheet.save(DEST / 'contact-sheet.jpg', quality=92)
    print(f'Built {len(mapping)} local logos, {sum(p.stat().st_size for p in DEST.glob("*.png")):,} bytes.')


if __name__ == '__main__':
    main()
