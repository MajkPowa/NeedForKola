"""Build explicitly reviewed generation/body references; never infer identity from year alone."""
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('vehicle_visual_build', ROOT / 'tools/build-vehicle-visuals.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def main():
    picks = json.loads((ROOT / 'tools/vehicle-visual-variant-picks.json').read_text(encoding='utf8'))
    catalogue = json.loads((ROOT / 'data/vehicle-variants.json').read_text(encoding='utf8'))['models']
    metadata = build.commons_metadata([p['file'] for p in picks.values()])
    variants, failures = {}, {}
    for key, pick in picks.items():
        family, variant_id = key.rsplit('/', 1)
        rows = [g for g in catalogue[family] if g['id'] == variant_id]
        assert len(rows) == 1, key
        row = rows[0]
        target = ROOT / 'assets/vehicles/variants' / (key.replace('/', '--') + '.webp')
        try:
            photo = build.process_model(key, pick['article'], {'title': pick['article']},
                {'label': pick['label']}, metadata[pick['file']], target)
            photo.update(id='variant-' + key.replace('/', '-'), match='variant',
                title=pick['label'], alt=pick['label'],
                depicted={'label': pick['label'], 'body': row['body'], 'from': row['from'], 'to': row['to']},
                evidenceUrl='https://en.wikipedia.org/wiki/' + quote(pick['article'].replace(' ', '_'), safe='()_'),
                evidenceNote='Explicit photograph selected from the model generation article/gallery; phase and body reviewed individually. Trim and wheels may differ.')
            variants[key] = photo
            print('OK ' + key, flush=True)
        except Exception as error:
            failures[key] = str(error)
            print('REVIEW ' + key + ': ' + str(error), flush=True)
    output = {'schemaVersion': 1, 'builtOn': '2026-09-05', 'variants': variants,
        'scope': 'Only explicit generation, phase and body matches. Unmapped variants must use a labelled model-family reference.'}
    (ROOT / 'data/vehicle-visual-variants.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    (ROOT / 'tools/.cache-vehicle-visuals/variant-review.json').write_text(json.dumps(failures, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    if variants:
        sheet = Image.new('RGB', (1250, ((len(variants) + 4) // 5) * 180), '#eeece8')
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
        for i, (key, photo) in enumerate(variants.items()):
            x, y = i % 5 * 250, i // 5 * 180
            with Image.open(ROOT / photo['src']) as image:
                image.thumbnail((240, 135), Image.Resampling.LANCZOS)
                sheet.paste(image, (x + (250 - image.width) // 2, y + (140 - image.height) // 2))
            draw.text((x+4, y+141), photo['title'][:40], fill='#111', font=font)
            draw.text((x+4, y+158), str(photo['depicted']['from']) + '–' + str(photo['depicted']['to']) + ' / ' + photo['depicted']['body'], fill='#555', font=font)
        sheet.save(ROOT / 'docs/qa/vehicle-variant-references.jpg', quality=90)
    print(json.dumps({'mapped': len(variants), 'review': failures}, ensure_ascii=True))


if __name__ == '__main__':
    main()
