"""Build local, licensed model photographs from curated Wikipedia/Commons identities.

No search-first-result matching: the title crosswalk and optional exact-file overrides
are curated separately. This database identifies a model family, never every variant.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from hashlib import sha256
from html import unescape
from io import BytesIO
from pathlib import Path
import argparse
import json
import re
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools' / '.cache-vehicle-visuals'
DEST = ROOT / 'assets' / 'vehicles'
OUTPUT = ROOT / 'data' / 'vehicle-visuals.json'
USER_AGENT = 'NeedForWheels/1.0 (vehicle photograph build; https://majkpowa.github.io/NeedForKola/)'
META_KEYS = 'Artist|Credit|ImageDescription|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Restrictions|Copyrighted|License'


def plain(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', str(value or '')))).strip()


def short_description(value):
    """Use an English description where supplied, with a concise plain-text caption."""
    value = str(value or '')
    english = re.search(r'<div[^>]*(?:lang=[\"\']en[\"\']|class=[\"\'][^\"\']*description en[^\"\']*[\"\'])[^>]*>(.*?)</div>', value, re.I | re.S)
    text = plain(english.group(1) if english else value).replace('_', ' ')
    if 'English:' in text:
        text = text.split('English:', 1)[1].strip()
    text = re.split(r'\s+(?:Deutsch|Français|Italiano|Español|Čeština|Polski|Nederlands):', text)[0]
    text = re.sub(r'^English\s*:\s*', '', text)
    return text if len(text) <= 180 else text[:177].rsplit(' ', 1)[0] + '…'


def request(url, binary=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (sha256(url.encode()).hexdigest() + ('.bin' if binary else '.json'))
    if path.exists():
        data = path.read_bytes()
        return data if binary else json.loads(data)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(req, timeout=45) as response:
                data = response.read()
            parsed = None if binary else json.loads(data)
            if isinstance(parsed, dict) and parsed.get('error'):
                raise RuntimeError(str(parsed['error']))
            path.write_bytes(data)
            time.sleep(.8 if not binary else .15)
            return data if binary else parsed
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def api(host, params):
    params = {'action': 'query', 'format': 'json', 'formatversion': 2, 'maxlag': 5, **params}
    return request('https://' + host + '/w/api.php?' + urllib.parse.urlencode(params))


def batches(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def article_images(titles):
    results = {}
    for batch in batches(list(dict.fromkeys(titles)), 20):
        data = api('en.wikipedia.org', {'titles': '|'.join(batch), 'prop': 'pageimages', 'piprop': 'name|original', 'redirects': 1})['query']
        aliases = {row['from']: row['to'] for key in ('normalized', 'redirects') for row in data.get(key, [])}
        pages = {row['title']: row for row in data['pages']}
        for title in batch:
            canonical = title
            seen = set()
            while canonical in aliases and canonical not in seen:
                seen.add(canonical)
                canonical = aliases[canonical]
            results[title] = pages.get(canonical, {'title': canonical, 'missing': True})
    return results


def commons_metadata(files):
    results = {}
    for batch in batches(list(dict.fromkeys(files)), 5):
        data = api('commons.wikimedia.org', {'titles': '|'.join(batch), 'prop': 'imageinfo',
            'iiprop': 'url|extmetadata|size|mime|sha1', 'iiurlwidth': 960,
            'iiextmetadatafilter': META_KEYS, 'redirects': 1})['query']
        aliases = {row['from']: row['to'] for key in ('normalized', 'redirects') for row in data.get(key, [])}
        pages = {row['title']: row for row in data['pages']}
        for filename in batch:
            canonical = filename
            seen = set()
            while canonical in aliases and canonical not in seen:
                seen.add(canonical)
                canonical = aliases[canonical]
            results[filename] = pages.get(canonical, {'title': canonical, 'missing': True})
    return results


def licence_of(metadata):
    short = plain(metadata.get('LicenseShortName', {}).get('value'))
    url = plain(metadata.get('LicenseUrl', {}).get('value'))
    if re.fullmatch(r'CC BY(?:-SA)? [\d.]+(?: [a-z]{2})?', short) and re.match(r'https?://creativecommons.org/licenses/by(?:-sa)?/[\d.]+/(?:[a-z]{2}/)?(?:deed\.[a-z-]+)?$', url + ('/' if url.rsplit('/', 1)[-1].replace('.', '').isdigit() else '')):
        return short, url.replace('http://', 'https://')
    if short == 'CC0':
        return short, 'https://creativecommons.org/publicdomain/zero/1.0/'
    if short == 'Public domain':
        return short, url if url.startswith('https://creativecommons.org/') else 'https://creativecommons.org/publicdomain/mark/1.0/'
    raise ValueError('Unsupported/unverified licence: ' + short + ' ' + url)


def process_model(key, article, page, override, file_page, target_path=None):
    if file_page.get('imagerepository') != 'local' or not file_page.get('imageinfo'):
        raise ValueError('File is not available as a local Commons image')
    info = file_page['imageinfo'][0]
    if info.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'):
        raise ValueError('Not an accepted raster photograph: ' + info.get('mime', 'unknown'))
    filename = file_page['title']
    if re.search(r'\b(?:logo|icon|coat of arms|diagram)\b', filename, re.I):
        raise ValueError('File title indicates a non-photographic identifier')
    metadata = info.get('extmetadata', {})
    licence, licence_url = licence_of(metadata)
    author = plain(metadata.get('Artist', {}).get('value'))
    if not author:
        raise ValueError('Missing author attribution')
    if plain(metadata.get('Restrictions', {}).get('value')):
        raise ValueError('Image carries restrictions requiring individual review')
    original_description = plain(metadata.get('ImageDescription', {}).get('value'))
    label = short_description(override.get('label') or metadata.get('ImageDescription', {}).get('value') or filename.removeprefix('File:').rsplit('.', 1)[0])
    image_url = info.get('thumburl') or info['url']
    if urllib.parse.urlparse(image_url).hostname not in ('upload.wikimedia.org', 'thumb.wikimedia.org'):
        raise ValueError('Unexpected image download host')
    target = Path(target_path) if target_path else DEST / (key.replace('/', '--') + '.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    raw = request(image_url, binary=True)
    with Image.open(BytesIO(raw)) as decoded:
        image = ImageOps.exif_transpose(decoded).convert('RGB')
        if image.width < 480 or image.height < 240:
            raise ValueError(f'Image resolution is too small: {image.size}')
        if image.width > 960:
            image.resize((960, round(image.height * 960 / image.width)), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=84, method=6)
        else:
            image.save(target, 'WEBP', quality=84, method=6)
    with Image.open(target) as built:
        width, height = built.size
    src = target.relative_to(ROOT).as_posix()
    return {
        'id': 'model-' + key.replace('/', '-'), 'src': src, 'thumb': src, 'kind': 'photo', 'match': 'model',
        'title': short_description(override.get('label')) or page['title'], 'alt': label, 'depicted': {'label': label},
        'sourceUrl': info['descriptionurl'],
        'articleUrl': 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(override.get('article') or page['title'].replace(' ', '_'), safe='()_'),
        'author': author, 'license': licence, 'licenseUrl': licence_url, 'width': width, 'height': height,
        'sourceFile': filename, 'sourceSha1': info.get('sha1', ''),
        'sourceDescription': original_description,
        'processing': 'Resized to at most 960 pixels wide and encoded as WebP; full frame retained.'
    }


def obtain_image(file_title, target_path, title='', label=''):
    """Shared helper for separately curated exact-variant photographs.

    target_path is an absolute workspace WebP filename; title is the related article
    title. The caller must establish identity before calling this download helper.
    """
    filename = file_title if file_title.startswith('File:') else 'File:' + file_title
    metadata = commons_metadata([filename])[filename]
    return process_model(Path(target_path).stem, title, {'title': title or filename},
        {'label': label} if label else {}, metadata, target_path)


def contact_sheets(models):
    qa = DEST / 'qa'
    qa.mkdir(exist_ok=True)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15)
    except OSError:
        font = ImageFont.load_default()
    for number, batch in enumerate(batches(list(models.items()), 40), 1):
        sheet = Image.new('RGB', (1200, ((len(batch) + 4) // 5) * 175), '#eeece8')
        draw = ImageDraw.Draw(sheet)
        for index, (key, value) in enumerate(batch):
            x, y = (index % 5) * 240, (index // 5) * 175
            picture = Image.open(ROOT / value['src'])
            picture.thumbnail((230, 140), Image.Resampling.LANCZOS)
            sheet.paste(picture, (x + (240 - picture.width) // 2, y + (140 - picture.height) // 2))
            draw.text((x + 4, y + 146), key, fill='#131517', font=font)
        sheet.save(qa / f'models-{number:02}.jpg', quality=88)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int)
    parser.add_argument('--models', help='Comma-separated model keys; rebuilds only these records')
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    titles = json.loads((ROOT / 'tools/vehicle-wiki-titles.json').read_text(encoding='utf-8-sig'))
    override_path = ROOT / 'tools/vehicle-wiki-image-overrides.json'
    overrides = json.loads(override_path.read_text(encoding='utf-8-sig')) if override_path.exists() else {}
    keys = list(titles)
    if args.models:
        keys = [key for key in args.models.split(',') if key in titles]
    if args.limit:
        keys = keys[:args.limit]
    articles = article_images([titles[key] for key in keys])
    candidates, failures = {}, {}
    for key in keys:
        override = overrides.get(key, {})
        if isinstance(override, str):
            override = {'file': override}
        if override.get('skip'):
            failures[key] = override.get('reason', 'Identity needs review')
            continue
        page = articles[titles[key]]
        filename = override.get('file') or ('File:' + page['pageimage'] if page.get('pageimage') else '')
        if not filename:
            failures[key] = 'No Commons page image for ' + page['title']
            continue
        if not filename.startswith('File:'):
            filename = 'File:' + filename
        candidates[key] = (titles[key], page, override, filename)
    print(f'Curated candidates: {len(candidates)}/{len(keys)}. Fetching Commons provenance.', flush=True)
    metadata = commons_metadata([entry[3] for entry in candidates.values()])
    models = json.loads(OUTPUT.read_text(encoding='utf-8'))['models'] if args.models and OUTPUT.exists() else {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(process_model, key, article, page, override, metadata[filename]): key for key, (article, page, override, filename) in candidates.items()}
        for index, future in enumerate(as_completed(futures), 1):
            key = futures[future]
            try:
                models[key] = future.result()
            except Exception as error:
                models.pop(key, None)
                failures[key] = str(error)
            if index % 40 == 0:
                print(f'Processed {index}/{len(futures)} photographs.', flush=True)
    for key in failures:
        models.pop(key, None)
    ordered = {key: models[key] for key in titles if key in models}
    for key, visual in ordered.items():
        caption = short_description(visual.get('depicted', {}).get('label') or visual.get('alt'))
        visual['depicted'] = {'label': caption}
        visual['alt'] = caption
        if isinstance(overrides.get(key), dict) and overrides[key].get('label'):
            visual['title'] = short_description(overrides[key]['label'])
    data = {'schemaVersion': 1, 'builtOn': date.today().isoformat(), 'models': ordered,
        'coverage': {'requested': len(titles), 'available': len(ordered), 'missing': {key: failures.get(key, 'Not built') for key in titles if key not in ordered}}}
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    contact_sheets(ordered)
    print(f'Coverage: {len(ordered)}/{len(titles)}. Missing this run: ' + json.dumps(failures, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
