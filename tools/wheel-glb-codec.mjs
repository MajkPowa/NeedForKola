// Lossless transport encoding for the exact OARTS export. No quantization,
// normal filters, simplification, triangle rotation or vertex reordering.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MeshoptEncoder } from './vendor/meshoptimizer/meshopt_encoder.js';
import { MeshoptDecoder } from '../assets/vendor/meshoptimizer/meshopt_decoder.mjs';

const EXTENSION = 'EXT_meshopt_compression';
const META = 'oartsLosslessCompression';
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
let ready = false;
export const codecReady = Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]).then(() => { ready = true; });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function parseGLB(input) {
  const bytes = Buffer.from(input);
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid wheel GLB header');
  const jsonLength = bytes.readUInt32LE(12), binaryHeader = 20 + jsonLength;
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || binaryHeader + 8 > bytes.length || bytes.readUInt32LE(binaryHeader + 4) !== 0x004e4942) throw new Error('Wheel GLB chunks are invalid');
  const doc = JSON.parse(bytes.subarray(20, binaryHeader)), binary = bytes.subarray(binaryHeader + 8);
  if (binary.length !== bytes.readUInt32LE(binaryHeader)) throw new Error('Wheel GLB binary chunk length differs');
  return { bytes, doc, binary };
}

function emitGLB(doc, binary) {
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
  jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}

/** Reconstruct the complete original GLB and verify its recorded SHA-256. */
export function decodeGLBLossless(input) {
  if (!ready) throw new Error('Await codecReady before decoding');
  const { bytes, doc, binary } = parseGLB(input), meta = doc.extras?.[META];
  if (!doc.extensionsUsed?.includes(EXTENSION)) return bytes;
  if (!meta || meta.package !== 'meshoptimizer@1.3.0' || meta.filter !== 'NONE' || meta.indexMode !== 'INDICES') throw new Error('Wheel lossless codec metadata is missing or incompatible');
  const decodedBinary = Buffer.alloc(meta.originalBuffer.byteLength);
  for (let i = 0; i < doc.bufferViews.length; i++) {
    const view = doc.bufferViews[i], ext = view.extensions?.[EXTENSION];
    if (ext) {
      if (ext.buffer !== 0 || view.buffer !== 1 || ext.filter !== 'NONE' || !['ATTRIBUTES', 'INDICES'].includes(ext.mode) || view.byteLength !== ext.count * ext.byteStride) throw new Error('Invalid wheel compressed buffer view');
      if (ext.mode === 'ATTRIBUTES' && (ext.byteStride % 4 || ext.byteStride > 256)) throw new Error('Invalid attribute codec stride');
      if (ext.mode === 'INDICES' && ![2, 4].includes(ext.byteStride)) throw new Error('Invalid index codec stride');
      const start = ext.byteOffset || 0;
      if (start < 0 || start + ext.byteLength > binary.length) throw new Error('Compressed buffer view exceeds binary chunk');
      const out = new Uint8Array(view.byteLength);
      MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, binary.subarray(start, start + ext.byteLength), ext.mode, 'NONE');
      if ((view.byteOffset || 0) + out.length > decodedBinary.length) throw new Error('Decoded view exceeds original binary chunk');
      Buffer.from(out).copy(decodedBinary, view.byteOffset || 0);
      view.buffer = 0; delete view.extensions[EXTENSION];
      if (!Object.keys(view.extensions).length) delete view.extensions;
    } else {
      const original = meta.rawViews.find(item => item.index === i);
      if (!original || view.buffer !== 0) throw new Error('Unexpected raw buffer view');
      binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength).copy(decodedBinary, original.offset);
      if (original.hadOffset) view.byteOffset = original.offset; else delete view.byteOffset;
    }
  }
  if (sha(decodedBinary) !== meta.originalBinarySha256) throw new Error('Decoded wheel binary SHA-256 differs');
  doc.buffers = [meta.originalBuffer];
  doc.extensionsUsed = doc.extensionsUsed.filter(name => name !== EXTENSION);
  doc.extensionsRequired = (doc.extensionsRequired || []).filter(name => name !== EXTENSION);
  if (!meta.hadExtensionsUsed) delete doc.extensionsUsed;
  if (!meta.hadExtensionsRequired) delete doc.extensionsRequired;
  delete doc.extras[META];
  if (!meta.hadExtras) delete doc.extras;
  const result = emitGLB(doc, decodedBinary);
  if (result.length !== meta.originalGlbBytes || sha(result) !== meta.originalGlbSha256) throw new Error('Decoded complete GLB SHA-256 differs');
  return result;
}

/** Encode each original buffer view, then verify the complete GLB byte roundtrip. */
export function compressGLBLossless(input) {
  if (!ready) throw new Error('Await codecReady before encoding');
  const { bytes, doc: original, binary } = parseGLB(input);
  if (original.buffers.length !== 1 || original.buffers[0].uri || original.buffers[0].byteLength !== binary.length || original.extensionsUsed?.includes(EXTENSION)) throw new Error('Expected an uncompressed self-contained wheel GLB');
  const doc = structuredClone(original), chunks = [], rawViews = [];
  let offset = 0, encodedViews = 0, originalViewBytes = 0;
  for (let i = 0; i < doc.bufferViews.length; i++) {
    const view = doc.bufferViews[i], accessors = doc.accessors.filter(item => item.bufferView === i);
    if (view.buffer !== 0) throw new Error('Wheel source view is not in its binary chunk');
    const start = view.byteOffset || 0, source = binary.subarray(start, start + view.byteLength);
    if (source.length !== view.byteLength) throw new Error('Wheel source view exceeds binary chunk');
    let encoded = source;
    if (accessors.length) {
      if (accessors.some(item => item.sparse || (item.byteOffset || 0) !== 0)) throw new Error('Unsupported wheel accessor layout');
      const stride = view.byteStride || BYTES[accessors[0].componentType] * WIDTH[accessors[0].type];
      const count = source.length / stride;
      if (!Number.isInteger(count) || accessors.some(item => item.count !== count || (view.byteStride || BYTES[item.componentType] * WIDTH[item.type]) !== stride)) throw new Error('Ambiguous wheel buffer view layout');
      const mode = view.target === 34963 ? 'INDICES' : 'ATTRIBUTES';
      encoded = mode === 'ATTRIBUTES'
        ? MeshoptEncoder.encodeVertexBufferLevel(source, count, stride, 3, 0)
        : MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode, 0);
      const decoded = new Uint8Array(source.length);
      MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, mode, 'NONE');
      if (sha(decoded) !== sha(source) || !Buffer.from(decoded).equals(source)) throw new Error('Wheel buffer view byte roundtrip differs');
      view.buffer = 1;
      (view.extensions ||= {})[EXTENSION] = { buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: stride, count, mode, filter: 'NONE' };
      encodedViews++; originalViewBytes += source.length;
    } else {
      rawViews.push({ index: i, offset: start, hadOffset: Object.hasOwn(view, 'byteOffset') });
      view.byteOffset = offset;
    }
    chunks.push(Buffer.from(encoded));
    const padding = (4 - encoded.length % 4) % 4;
    if (padding) chunks.push(Buffer.alloc(padding));
    offset += encoded.length + padding;
  }
  doc.buffers = [{ byteLength: offset }, { byteLength: binary.length, extensions: { [EXTENSION]: { fallback: true } } }];
  doc.extensionsUsed = [...new Set([...(doc.extensionsUsed || []), EXTENSION])];
  doc.extensionsRequired = [...new Set([...(doc.extensionsRequired || []), EXTENSION])];
  (doc.extras ||= {})[META] = {
    package: 'meshoptimizer@1.3.0', filter: 'NONE', indexMode: 'INDICES', attributeLevel: 3, codecVersion: 0,
    originalGlbBytes: bytes.length, originalGlbSha256: sha(bytes), originalBinarySha256: sha(binary),
    originalBuffer: original.buffers[0], rawViews,
    hadExtensionsUsed: Object.hasOwn(original, 'extensionsUsed'), hadExtensionsRequired: Object.hasOwn(original, 'extensionsRequired'), hadExtras: Object.hasOwn(original, 'extras'),
  };
  const output = emitGLB(doc, Buffer.concat(chunks)), decoded = decodeGLBLossless(output);
  if (!decoded.equals(bytes)) throw new Error('Complete wheel GLB byte roundtrip differs');
  return { bytes: output, stats: { package: 'meshoptimizer@1.3.0', extension: EXTENSION, originalBytes: bytes.length, compressedBytes: output.length, originalGlbSha256: sha(bytes), compressedGlbSha256: sha(output), encodedViews, originalViewBytes, byteExact: true, filter: 'NONE', indexMode: 'INDICES', attributeLevel: 3, codecVersion: 0 } };
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  await codecReady;
  if (process.argv[2] !== '--decode-to-stdout' || !process.argv[3]) throw new Error('Use --decode-to-stdout <wheel.glb>');
  process.stdout.write(decodeGLBLossless(fs.readFileSync(process.argv[3])));
}
