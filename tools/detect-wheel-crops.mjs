/* Offline detail pass; cropped buffers are used only for detection, never published. */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const cache = resolve('tools/.cache-vehicle-visuals/wheel-detector');
const { pipeline, env, RawImage } = await import(pathToFileURL(resolve(cache, 'node_modules/@huggingface/transformers/dist/transformers.node.mjs')));
env.cacheDir = resolve(cache, 'models');
const MODEL = 'onnx-community/grounding-dino-tiny-ONNX';
const PROMPT = 'metal wheel rim. hubcap.';
const inventory = JSON.parse(readFileSync('tools/.cache-wheel-fit/crop-inventory.json', 'utf8'));
const output = resolve('data/wheel-fit-crops.json');
const prior = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {};
const photos = prior.photos || {};
const detector = await pipeline('zero-shot-object-detection', MODEL, { dtype: 'q8', device: 'dml' });
function save() {
  writeFileSync(output + '.tmp', JSON.stringify({ schemaVersion: 1, coordinateSystem: 'source-image-pixels',
    model: MODEL, prompt: PROMPT, threshold: .1, status: 'machine-candidates', photos }, null, 2));
  renameSync(output + '.tmp', output);
}
for (let i = 0; i < inventory.length; i++) {
  const photo = inventory[i];
  const regionKey = JSON.stringify(photo.regions.map(r => r.crop));
  if (photos[photo.id]?.localSha256 === photo.localSha256 && photos[photo.id]?.regionKey === regionKey) continue;
  const original = await RawImage.read(resolve(photo.src));
  const regions = [];
  for (const region of photo.regions) {
    const crop = await original.crop(region.crop);
    const candidates = await detector(crop, [PROMPT], { threshold: .1 });
    regions.push({ outer: region.outer, crop: region.crop, boxes: candidates.map((d, id) => ({ id,
      label: d.label, score: +d.score.toFixed(4),
      xmin: d.box.xmin + region.crop[0], ymin: d.box.ymin + region.crop[1],
      xmax: d.box.xmax + region.crop[0], ymax: d.box.ymax + region.crop[1] })) });
  }
  photos[photo.id] = { localSha256: photo.localSha256, regionKey, regions };
  if ((i + 1) % 30 === 0 || i === inventory.length - 1) {
    save(); console.log(`Detailed ${i + 1}/${inventory.length}.`);
  }
}
save();
await detector.dispose();
