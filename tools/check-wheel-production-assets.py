"""Verify the deployed public wheel files before the Pages mirror drops its copies."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://majkpowa.github.io'
BASE_URL = 'https://oarts.cz/'
MIME = 'model/gltf-binary'
DEFAULT_OUTPUT = ROOT / 'docs/qa/wheel-fidelity-production-assets-2026-10-12.json'


def file_sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def remote_sha(url):
    request = Request(url, headers={'Origin': ORIGIN, 'Accept-Encoding': 'identity',
                                   'User-Agent': 'OARTS-wheel-asset-integrity/1.0'})
    with urlopen(request, timeout=60) as response:
        if response.geturl() != url:
            raise ValueError('Production wheel asset unexpectedly redirects')
        if response.headers.get('Content-Encoding', '').lower() not in ('', 'identity'):
            raise ValueError('Expected identity transport for exact deployed-file hashing')
        digest = hashlib.sha256()
        size = 0
        for block in iter(lambda: response.read(1024 * 1024), b''):
            digest.update(block)
            size += len(block)
        return response.status, digest.hexdigest(), size, response.headers


def check_model(entry):
    record = {'id': entry['id'], 'url': urljoin(BASE_URL, entry['glb']) + '?' +
              urlencode({'v': entry['glbRevision']}), 'result': 'FAIL'}
    errors = []
    try:
        local = (ROOT / entry['glb']).resolve()
        if not local.is_relative_to((ROOT / 'assets/wheel-models').resolve()) or local.suffix != '.glb':
            raise ValueError('Wheel path leaves its intended model directory')
        if entry['glbRevision'] != entry['glbSha256'][:16] or file_sha(local) != entry['glbSha256']:
            raise ValueError('Local final export hash/revision differs from its index')
        status, digest, size, headers = remote_sha(record['url'])
        record.update(status=status, sha256=digest, bytes=size,
                      accessControlAllowOrigin=headers.get('Access-Control-Allow-Origin', ''),
                      accessControlExposeHeaders=headers.get('Access-Control-Expose-Headers', ''),
                      contentType=headers.get('Content-Type', ''),
                      contentDisposition=headers.get('Content-Disposition', ''))
        if status != 200:
            errors.append('GET status is not 200')
        if digest != entry['glbSha256'] or size != local.stat().st_size:
            errors.append('Deployed GET body differs from the exact final export')
        if record['accessControlAllowOrigin'] != ORIGIN:
            errors.append('Public wheel CORS does not permit the exact Pages origin')
        if record['contentType'].split(';', 1)[0].strip().lower() != MIME:
            errors.append('GLB MIME type differs')
        if record['contentDisposition'].split(';', 1)[0].strip().lower() != 'attachment':
            errors.append('Cross-origin wheel download is not an attachment')
        exposed = {name.strip().lower() for name in record['accessControlExposeHeaders'].split(',')}
        if not {'content-type', 'content-length', 'content-disposition', 'etag'} <= exposed:
            errors.append('Expected download/cache response headers are not exposed')
    except Exception as error:
        errors.append(str(error))
    record['errors'] = errors
    record['result'] = 'PASS' if not errors else 'FAIL'
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deployment-id', required=True)
    parser.add_argument('--workers', type=int, choices=range(1, 7), default=6)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not args.deployment_id.strip():
        parser.error('--deployment-id must identify the completed production deployment')
    index_path = ROOT / 'assets/wheel-models/index.json'
    index_sha = file_sha(index_path)
    index = json.loads(index_path.read_text(encoding='utf-8'))
    if index.get('errors') or len(index['models']) != 147 or len({row['id'] for row in index['models']}) != 147:
        raise ValueError('Expected the final complete index of 147 individual wheel models')
    started = datetime.now(timezone.utc).isoformat()
    index_check = {'url': urljoin(BASE_URL, 'assets/wheel-models/index.json') + '?' +
                   urlencode({'v': index_sha[:16]}), 'result': 'FAIL'}
    try:
        status, digest, size, _ = remote_sha(index_check['url'])
        index_check.update(status=status, sha256=digest, bytes=size)
        if status != 200 or digest != index_sha or size != index_path.stat().st_size:
            raise ValueError('Deployed index differs from the current final local index')
        index_check['result'] = 'PASS'
    except Exception as error:
        index_check['error'] = str(error)
    rows = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(check_model, entry): entry['id'] for entry in index['models']}
        for future in as_completed(pending):
            row = future.result()
            rows[row['id']] = row
            if row['result'] != 'PASS' or len(rows) % 10 == 0 or len(rows) == 147:
                print(json.dumps({'checked': len(rows), 'models': 147, 'latest': row['id'],
                                  'result': row['result'], 'errors': row['errors']}), flush=True)
    models = [rows[entry['id']] for entry in index['models']]
    unchanged_index = file_sha(index_path) == index_sha
    passed = unchanged_index and index_check['result'] == 'PASS' and all(row['result'] == 'PASS' for row in models)
    report = {'schemaVersion': 1, 'result': 'PASS' if passed else 'FAIL',
              'deploymentId': args.deployment_id, 'startedAtUtc': started,
              'checkedAtUtc': datetime.now(timezone.utc).isoformat(), 'requestOrigin': ORIGIN,
              'indexSha256': index_sha, 'indexUnchangedDuringVerification': unchanged_index,
              'remoteIndex': index_check, 'modelCount': 147, 'workers': args.workers,
              'totalBytes': sum(row.get('bytes', 0) for row in models), 'models': models}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key not in ('models', 'remoteIndex')}))
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
