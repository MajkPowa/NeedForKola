"""Build reviewed, local website media from Drive and supplied photo originals.

Requires Pillow, pillow-heif, ffmpeg and ffprobe. Originals are named <Drive ID>.<ext>
under --originals. Classification is explicit in data/real-wheels-review.json.
User-supplied photographs are named <evidence ID>.jpg under --attachments.
This converts formats/scales images only; it never generates or recolours wheels.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageOps, ImageCms
import pillow_heif

pillow_heif.register_heif_opener()
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--originals', type=Path, default=ROOT / 'tools/.cache-wheel-fit/drive-real-wheels/originals')
parser.add_argument('--attachments', type=Path, default=ROOT / 'tools/.cache-wheel-fit/october-real-wheels/originals')
parser.add_argument('--force', action='store_true')
args = parser.parse_args()
review = json.loads((ROOT / 'data/real-wheels-review.json').read_text(encoding='utf-8'))
collection_map = {c['id']: c for c in review['collections']}
exts = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/heif': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov'}
captions = {
    1: 'Video černého disku na otočném stojanu', 4: 'Čelní pohled na černé dělené paprsky',
    5: 'Fotografie značení na vnitřní straně disku; údaj není dokladem schválení pro konkrétní vůz',
    6: 'Boční pohled na černý ráfek', 7: 'Video bronzové sady v denním světle',
    8: 'Bronzová sada před podložkou Oarts', 9: 'Pohled shora na bronzovou sadu', 11: 'Čtyři bronzová kola v denním světle',
    10: 'Video plného stříbrného disku na stojanu', 12: 'Obrábění disku — dodaný výrobní záběr',
    13: 'Detail obrábění paprsků — dodaný výrobní záběr', 14: 'Video sady dělených paprsků v teplém kovovém odstínu',
    15: 'Video černého desetipaprsku na stojanu', 16: 'Video leštěného desetipaprsku bez krytky',
    36: 'Čelní fotografie plného stříbrného disku — nižší rozlišení originálu',
    37: 'Boční fotografie plného stříbrného disku — nižší rozlišení originálu',
    46: 'Čelní pohled na černý desetipaprsek', 47: 'Černý desetipaprsek ze strany',
    48: 'Černý desetipaprsek z opačné strany', 54: 'Čelní pohled na leštěný desetipaprsek',
    55: 'Leštěný desetipaprsek — detail hloubky ráfku', 58: 'Leštěný desetipaprsek z opačné strany',
}

def run(command):
    return subprocess.check_output(command, text=True, encoding='utf-8')

def write_webp(im, path, limit, quality):
    path.parent.mkdir(parents=True, exist_ok=True)
    resized = im.copy()
    resized.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    # No source EXIF/GPS, no generated changes, no crop, no upscaling.
    resized.save(path, 'WEBP', quality=quality, method=6)
    return list(resized.size)

def web_image(original):
    image = ImageOps.exif_transpose(Image.open(original))
    profile = image.info.get('icc_profile')
    if profile:
        return ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                        ImageCms.createProfile('sRGB'), outputMode='RGB'), True
    return image.convert('RGB'), False

records = []
website_media = {}
for source in review['files']:
    record = dict(source)
    source_root = args.attachments if source.get('sourceType') == 'user-attachment' else args.originals
    original = source_root / (source['id'] + '.' + exts[source['mimeType']])
    if not original.is_file():
        raise FileNotFoundError(f"Missing source {source['originalName']}: {original}")
    if original.stat().st_size != source['sourceBytes']:
        raise ValueError(f"Source byte count mismatch: {source['originalName']}")
    record['sha256'] = hashlib.sha256(original.read_bytes()).hexdigest()
    if source.get('sourceSha256') and record['sha256'] != source['sourceSha256']:
        raise ValueError(f"Source fingerprint mismatch: {source['originalName']}")
    is_video = source['mimeType'].startswith('video/')
    if not is_video:
        im, profile_converted = web_image(original)
        record['originalDimensions'] = list(im.size)
    else:
        probe = json.loads(run(['ffprobe', '-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', str(original)]))
        stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        record['originalDimensions'] = [stream['width'], stream['height']]
        record['durationSeconds'] = float(probe['format']['duration'])
    if source['publish']:
        folder = Path('assets/real-wheels') / (source['collectionId'] or 'production')
        stem = f"asset-{source['number']:03d}"
        (ROOT / folder).mkdir(parents=True, exist_ok=True)
        thumb = folder / (stem + '-thumb.webp')
        media = {'id': source['id'], 'type': 'video' if is_video else 'image'}
        if is_video:
            dest = folder / (stem + '.mp4')
            hdr = stream.get('color_transfer') in ['arib-std-b67', 'smpte2084']
            filters = 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2'
            if hdr:
                filters = ('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,'
                           'tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,' + filters + ',fps=30')
            if args.force or hdr or not (ROOT / dest).exists():
                run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(original), '-map', '0:v:0',
                     '-vf', filters,
                     '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
                     *(['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'] if hdr else []),
                     '-an', '-map_metadata', '-1', '-movflags', '+faststart', '-y', str(ROOT / dest)])
            frame = original.parent.parent / 'previews' / (stem + '-web-poster.png')
            frame.parent.mkdir(exist_ok=True)
            run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(min(2, record['durationSeconds']/2)),
                 '-i', str(ROOT / dest), '-frames:v', '1', '-y', str(frame)])
            im = Image.open(frame).convert('RGB')
            poster = folder / (stem + '-poster.webp')
            dims = write_webp(im, ROOT / poster, 1280, 86)
            media['poster'] = poster.as_posix()
            record['conversion'] = 'H.264 MP4, max 1280px, silent, metadata removed; poster from actual video frame.'
            if hdr:
                record['conversion'] += ' Source HDR HLG/PQ converted to SDR BT.709 with Hable tone mapping at 30 fps for web playback.'
        else:
            dest = folder / (stem + '.webp')
            dims = write_webp(im, ROOT / dest, 1600, 88)
            record['conversion'] = 'EXIF orientation normalized; WebP max 1600px; no crop, recolouring or upscaling; metadata removed.'
            if profile_converted:
                record['conversion'] += ' Embedded ICC colour profile converted to sRGB before export.'
        write_webp(im, ROOT / thumb, 640, 82)
        c = collection_map.get(source['collectionId'])
        media.update(src=dest.as_posix(), thumb=thumb.as_posix(), width=dims[0], height=dims[1],
                     alt=source.get('caption') or captions.get(source['number'], (c['title'] + ' — fotografie skutečného kola') if c else source['originalName']))
        website_media[source['id']] = media
        record['web'] = media
        record['webBytes'] = (ROOT / dest).stat().st_size
    records.append(record)
by_id = {r['id']: r for r in records}
for r in records:
    if r.get('duplicateOf') and r['sha256'] != by_id[r['duplicateOf']]['sha256']:
        raise ValueError('Declared duplicate does not match source bytes')

collections=[]
for c in review['collections']:
    media = [website_media[i] for i in c['mediaIds']]
    first = media[0]
    cover = {k: first[k] for k in ['thumb', 'alt', 'width', 'height']}
    cover['src'] = first.get('poster', first['src'])
    collections.append({k:v for k,v in c.items() if k not in ['mediaIds','sourceNumbers']} | {'cover':cover, 'media':media})
data = {'updatedAt':review['reviewedAt'], 'collections':collections}
(ROOT/'js/real-wheels-data.js').write_text('/* Generated from reviewed real media by tools/build-real-wheels.py. */\nwindow.NFWRealWheels = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
inventory = {'reviewedAt':review['reviewedAt'], 'sourceFolder':review['sourceFolder'],
             'sourceBatches':review.get('sourceBatches', []),
             'summary':{'sourceFiles':len(records),'collections':len(collections),'galleryMedia':sum(len(c['media']) for c in collections),
                        'productionVideos':sum(r['kind']=='manufacturing-video' for r in records)}, 'files':records}
(ROOT/'data/real-wheel-media-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(inventory['summary']))
print('Published media bytes:', sum(r.get('webBytes',0) for r in records))
