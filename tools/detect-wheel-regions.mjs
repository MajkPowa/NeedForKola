/* Offline draft annotation only. Model and dependencies stay in an ignored cache. */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const cache = resolve(root, 'tools/.cache-vehicle-visuals/wheel-detector');
const { pipeline, env } = await import(pathToFileURL(resolve(cache, 'node_modules/@huggingface/transformers/dist/transformers.node.mjs')));
env.cacheDir = resolve(cache, 'models');

const MODEL = 'onnx-community/grounding-dino-tiny-ONNX';
const PROMPT = 'metal car wheel rim. car wheel hubcap.';
const THRESHOLD = .12;
const inventory = JSON.parse(readFileSync(resolve(root, 'data/wheel-photo-inventory.json'), 'utf8'));
const output = resolve(root, 'data/wheel-fit-detections.json');
const prior = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {};
const photos = prior.prompt === PROMPT && prior.threshold === THRESHOLD ? (prior.photos || {}) : {};
const targetIds = process.argv.slice(2);
const selected = inventory.photos.filter(photo => !targetIds.length || targetIds.includes(photo.id));
const remaining = selected.filter(photo => photos[photo.id]?.localSha256 !== photo.localSha256 || photos[photo.id]?.status === 'error');

function save() {
  const payload = {
    schemaVersion: 1, builtOn: new Date().toISOString(), coordinateSystem: 'source-image-pixels',
    status: 'machine-draft-needs-review', model: MODEL, modelLicense: 'Apache-2.0',
    modelSource: 'https://huggingface.co/onnx-community/grounding-dino-tiny-ONNX',
    originalModelSource: 'https://huggingface.co/IDEA-Research/grounding-dino-tiny',
    device: 'DirectML', dtype: 'q8', prompt: PROMPT, threshold: THRESHOLD,
    warning: 'The detector can label the entire tyre as a rim. Boxes are candidates, not approved rim ellipses. Background cars must be excluded in visual review.',
    count: Object.keys(photos).length, requested: inventory.photos.length, photos,
  };
  const temp = output + '.tmp';
  writeFileSync(temp, JSON.stringify(payload, null, 2) + '\n');
  renameSync(temp, output);
}

console.log(`Detecting ${remaining.length} new/changed photos of ${inventory.photos.length}.`);
if (remaining.length) {
  const detector = await pipeline('zero-shot-object-detection', MODEL, { dtype: 'q8', device: 'dml' });
  for (let index = 0; index < remaining.length; index++) {
    const photo = remaining[index];
    const start = Date.now();
    try {
      const detections = await detector(resolve(root, photo.src), [PROMPT], { threshold: THRESHOLD });
      const boxes = detections.map((result, id) => {
        const { xmin, ymin, xmax, ymax } = result.box;
        const width = xmax - xmin, height = ymax - ymin;
        const areaRatio = width * height / (photo.width * photo.height);
        return { id, label: result.label, score: Number(result.score.toFixed(4)), xmin, ymin, xmax, ymax,
          candidate: width >= 10 && height >= 18 && areaRatio <= .22 && height <= photo.height * .75,
          normalized: { x: xmin / photo.width, y: ymin / photo.height, width: width / photo.width, height: height / photo.height } };
      });
      photos[photo.id] = { id: photo.id, key: photo.key, src: photo.src, width: photo.width, height: photo.height,
        localSha256: photo.localSha256, status: 'machine-draft-needs-review', seconds: (Date.now() - start) / 1000, boxes };
    } catch (error) {
      photos[photo.id] = { id: photo.id, src: photo.src, localSha256: photo.localSha256, status: 'error', error: String(error.message || error) };
    }
    if ((index + 1) % 20 === 0 || index === remaining.length - 1) {
      save();
      console.log(`Processed ${index + 1}/${remaining.length}; total ${Object.keys(photos).length}; last ${photo.id}.`);
    }
  }
  await detector.dispose();
} else {
  save();
}
