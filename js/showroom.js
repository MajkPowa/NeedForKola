import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from '../assets/vendor/meshoptimizer/meshopt_decoder.mjs?v=1.3.0';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPhotoWheel } from './wheel-reconstruction.js?v=20261011-wheel-fidelity-v1';
import { PHOTO_WHEEL_MODELS } from './wheel-reconstruction-catalog.js?v=20261011-wheel-fidelity-v1';
import { wheelGLBURL } from './wheel-asset-url.js?v=20261011-wheel-fidelity-v1';
import { addOartsCap } from './wheel-brand-cap.js?v=20261011-wheel-fidelity-v1';
import './vehicle-models.js?v=20261008-no-x5';

// Photo models have individual silhouettes; their hidden depth remains an estimate.
const photoRecords = new Map();
const sourceSurfaces = new Map();
const exportedPhotoWheels = new Map();
export async function prepareWheelGeometry(design, signal, referenceSurface = false, preferExportedGeometry = false) {
  const entry = PHOTO_WHEEL_MODELS[design];
  if (!entry) return;
  if (!photoRecords.has(design)) {
    const response = await fetch(new URL('../' + entry.record + (entry.revision ? '?v=' + entry.revision : ''), import.meta.url), { signal });
    if (!response.ok) throw new Error('Geometrie kola se nepodařila načíst.');
    const record = await response.json();
    if (record.id !== design) throw new Error('Nesouhlasí identita 3D kola.');
    photoRecords.set(design, record);
  }
  const record = photoRecords.get(design);
  if (preferExportedGeometry && !referenceSurface) {
    if (!exportedPhotoWheels.has(design)) {
      const modelURL = wheelGLBURL(entry);
      const response = await fetch(modelURL, { signal });
      if (!response.ok) throw new Error('Detailní 3D model se nepodařil načíst.');
      const bytes = await response.arrayBuffer();
      if (signal?.aborted) throw new DOMException('Náhled byl zrušen.', 'AbortError');
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes, new URL('.', modelURL).href);
      if (signal?.aborted) { disposeObject(gltf.scene); throw new DOMException('Náhled byl zrušen.', 'AbortError'); }
      gltf.scene.traverse(part => {
        if (!part.isMesh) return;
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
          const intensity = material.userData.oartsEnvMapIntensity;
          if (Number.isFinite(intensity) && intensity >= 0 && intensity <= 3) material.envMapIntensity = intensity;
        }
      });
      // Cache CPU-side source data only. Mounted instances own cloned buffers
      // and materials, so disposing a previous view cannot invalidate this LRU.
      if (exportedPhotoWheels.has(design)) disposeObject(gltf.scene);
      else exportedPhotoWheels.set(design, gltf.scene);
    }
    const prepared = exportedPhotoWheels.get(design);
    exportedPhotoWheels.delete(design); exportedPhotoWheels.set(design, prepared);
    while (exportedPhotoWheels.size > 3) {
      const oldest = exportedPhotoWheels.keys().next().value;
      disposeObject(exportedPhotoWheels.get(oldest)); exportedPhotoWheels.delete(oldest);
    }
  }
  if (referenceSurface && !record.provenance.rectificationApproximate && !sourceSurfaces.has(design)) {
    const surfaceSource = record.surfaceSource || record.source;
    const response = await fetch(new URL('../' + surfaceSource.src, import.meta.url), { signal });
    if (!response.ok) throw new Error('Referenční povrch kola se nepodařil načíst.');
    const bitmap = await createImageBitmap(await response.blob());
    if (signal?.aborted) { bitmap.close(); throw new DOMException('Náhled byl zrušen.', 'AbortError'); }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = record.surfaceTextureSize || 1024;
    const ctx = canvas.getContext('2d'), e = surfaceSource.faceEllipse;
    const cx = e.cx * bitmap.width, cy = e.cy * bitmap.height, rx = e.rx * bitmap.width, ry = e.ry * bitmap.height;
    const angle = e.rotationDeg * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const half = canvas.width / 2;
    ctx.setTransform(half*c/rx, -half*s/ry, half*s/rx, half*c/ry, half-half*(cx*c+cy*s)/rx, half-half*(-cx*s+cy*c)/ry);
    ctx.drawImage(bitmap, 0, 0); bitmap.close(); sourceSurfaces.set(design, canvas);
    // Keep the authoring canvas cache bounded; textures are owned by each mesh.
    while (sourceSurfaces.size > 8) sourceSurfaces.delete(sourceSurfaces.keys().next().value);
  }
  return record;
}
const frontPlane = design => photoRecords.get(design)?.profile.frontZ ?? (presets[design]?.bolts ? .23 : .33);
const DRACO_URL = new URL('../assets/vendor/draco/', import.meta.url).href;
const active = new WeakMap();
const TAU = Math.PI * 2;
const DEFAULT_WHEEL_COLOUR = '#b9bcc2';
const hex = (v, fallback) => /^#[\da-f]{6}$/i.test(v || '') ? v : fallback;
const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
const presets = {
  apex10: { count: 10, style: 'straight', width: .038 },
  mono5: { count: 5, style: 'straight', width: .105 },
  deep7: { count: 7, style: 'straight', width: .067 },
  yfork10: { count: 5, style: 'fork', width: .055 },
  twist9: { count: 9, style: 'twist', width: .049 },
  mesh30: { count: 15, style: 'mesh', width: .021 },
  split6: { count: 6, style: 'split', width: .034 },
  turbine8: { count: 8, style: 'turbine', width: .07 },
  blade12: { count: 12, style: 'twist', width: .038 },
  star5: { count: 5, style: 'straight', width: .145 },
  concave9: { count: 9, style: 'straight', width: .05 },
  dish3pc: { count: 5, style: 'straight', width: .115, bolts: true },
  mesh3pc: { count: 15, style: 'mesh', width: .025, bolts: true },
  // Motivo topology was checked against the manufacturer front photographs.
  // Numeric proportions remain a visual interpretation, not manufacturer CAD.
  // Keep these synchronous presets aligned with data/motivo-design-geometry.json.
  'motivo-mb-a': {"style":"fork","count":5,"width":0.052,"centre":-0.065,"forkAt":0.48,"forkAngle":0.31,"branch":0.05,"slots":[{"from":0.3,"to":0.45,"width":0.018,"branch":-1},{"from":0.3,"to":0.45,"width":0.018,"branch":1},{"from":0.82,"to":0.91,"width":0.01,"branch":-1},{"from":0.82,"to":0.91,"width":0.01,"branch":1}],"lugRotation":0,"angular":true},
  'motivo-mb-b': {"style":"straight","count":10,"width":0.034,"centre":-0.105,"channel":true,"rootPockets":true,"lugRotation":0,"spokeRotation":0.3141592653589793},
  'motivo-mb-c': {"style":"straight","count":10,"width":0.031,"centre":-0.09,"endRadius":0.865,"wideLip":true,"rootPockets":true,"lugRotation":0.6283185307179586,"spokeRotation":0.3141592653589793},
  'motivo-mb-d': {"style":"fork","count":5,"width":0.044,"centre":-0.105,"forkAt":0.34,"forkAngle":0.145,"branch":0.05,"lugRotation":0.6283185307179586},
  'motivo-mb-e': {"style":"fork","count":10,"width":0.027,"centre":-0.07,"forkAt":0.52,"forkAngle":0.09,"branch":0.06,"channel":true,"angular":true,"lugRotation":0},
  'motivo-mb-f': {"style":"fork","count":10,"width":0.027,"centre":-0.075,"forkAt":0.52,"forkAngle":0.09,"branch":0.06,"slots":[{"from":0.34,"to":0.44,"width":0.008,"branch":-1},{"from":0.34,"to":0.44,"width":0.008,"branch":1}],"angular":true,"lugRotation":0},
  'motivo-mb-g': {"style":"fork","count":5,"width":0.052,"centre":-0.095,"forkAt":0.43,"forkAngle":0.31,"branch":0.05,"channel":true,"rounded":true,"lugRotation":0},
  'motivo-mb-h': {"style":"fork","count":5,"width":0.047,"centre":-0.06,"forkAt":0.49,"forkAngle":0.31,"branch":0.05,"slots":[{"from":0.31,"to":0.43,"width":0.012,"branch":-1},{"from":0.31,"to":0.43,"width":0.012,"branch":1}],"lugRotation":0.6283185307179586},
  'motivo-mb-j': {"style":"fork","count":5,"width":0.049,"centre":-0.065,"forkAt":0.43,"forkAngle":0.31,"branch":0.05,"channel":true,"lugRotation":0.6283185307179586},
  'motivo-mb-k': {"style":"straight","count":10,"width":0.036,"centre":-0.075,"slots":[{"from":0.57,"to":0.62,"width":0.007},{"from":0.7,"to":0.75,"width":0.007}],"channel":true,"angular":true,"lugRotation":0,"spokeRotation":0.3141592653589793},
  'motivo-mb-l': {"style":"fork","count":5,"width":0.052,"centre":-0.045,"forkAt":0.46,"forkAngle":0.31,"branch":0.05,"slots":[{"from":0.39,"to":0.49,"width":0.014,"branch":-1},{"from":0.39,"to":0.49,"width":0.014,"branch":1},{"from":0.55,"to":0.62,"width":0.011,"branch":-1},{"from":0.55,"to":0.62,"width":0.011,"branch":1}],"angular":true,"centerLock":true,"lugRotation":0},
  'motivo-mb-m': {"style":"straight","count":10,"width":0.068,"centre":-0.06,"slots":[{"from":0.33,"to":0.91,"width":0.022}],"lugRotation":0.6283185307179586,"rootWidthFactor":1.5,"shoulderWidthFactor":1.35,"tipWidthFactor":0.8},
  'motivo-mb-n': {"style":"fork","count":10,"width":0.026,"centre":-0.08,"forkAt":0.54,"forkAngle":0.09,"branch":0.06,"rounded":true,"lugRotation":0},
  'motivo-mb-o': {"style":"straight","count":5,"width":0.155,"centre":0.12,"flatFace":true,"endRadius":0.845,"ventRing":true,"ventCount":16,"lugRotation":0},
  'motivo-mb-p': {"style":"straight","count":10,"width":0.034,"centre":-0.1,"slots":[{"from":0.34,"to":0.43,"width":0.009}],"channel":true,"lugRotation":0,"spokeRotation":0.3141592653589793},
  'motivo-mb-q': {"style":"fork","count":5,"width":0.06,"centre":-0.045,"forkAt":0.49,"forkAngle":0.31,"branch":0.05,"slots":[{"from":0.3,"to":0.39,"width":0.015,"shape":"rectangle"}],"channel":true,"angular":true,"lugRotation":0},
  'motivo-mb-r': {"style":"fork","count":10,"width":0.029,"centre":-0.045,"forkAt":0.54,"forkAngle":0.21,"branch":0.06,"rounded":true,"lugRotation":0},
  'motivo-mb-s': {"style":"straight","count":15,"width":0.03,"centre":-0.075,"channel":true,"lugRotation":0.6283185307179586},
  'motivo-mb-t': {"style":"straight","count":5,"width":0.125,"centre":0.12,"flatFace":true,"lugRotation":0},
  'motivo-mb-z': {"style":"straight","count":5,"width":0.105,"centre":-0.075,"slots":[{"from":0.29,"to":0.42,"width":0.026,"shape":"triangle"}],"rounded":true,"centerLock":true,"lugRotation":0,"rootWidthFactor":1.35,"shoulderWidthFactor":1.35,"tipWidthFactor":0.9},
};

export function supports3DDesign(design) {
  return typeof design === 'string' && (Object.hasOwn(PHOTO_WHEEL_MODELS, design) || Object.hasOwn(presets, design));
}

function requireWheelGeometry(input) {
  const design = typeof input.design === 'string' ? input.design : '';
  const catalogueDesign = window.NFW?.DESIGNS?.find(item => item.id === design);
  const sourceBrand = String(input.sourceBrand || catalogueDesign?.sourceBrand || '').trim().toLowerCase();
  if (design && !supports3DDesign(design)) {
    const error = new Error('Pro tento design není registrována geometrie. Vyberte dostupný model nebo fotografii.');
    error.name = 'UnsupportedWheelGeometryError';
    error.code = 'NFW_WHEEL_GEOMETRY_UNAVAILABLE';
    error.design = design;
    error.availablePreview = 'product-photo';
    throw error;
  }
}

function options(input = {}) {
  // Never silently turn a source-only E6 model into an unrelated generic wheel.
  // Keep this check in the shared path used by both 3D and photo-fit renderers.
  requireWheelGeometry(input);
  return {
    ...input, mode: input.mode === 'car' ? 'car' : 'wheel',
    design: supports3DDesign(input.design) ? input.design : 'apex10',
    color: hex(input.color, hex(input.colorHex, DEFAULT_WHEEL_COLOUR)),
    bodyColor: hex(input.bodyColor, '#303f4b'),
    diameter: clamp(input.diameter, 17, 24, 20),
    width: clamp(input.width, 7, 13.5, 10),
    autoRotate: input.autoRotate !== false,
    finish: ['gloss', 'satin', 'matte', 'brushed', 'chrome'].includes(input.finish) ? input.finish : 'satin',
    cap: input.cap || 'black', lip: input.lip || 'same',
    bolts: clamp(input.bolts, 4, 6, 5),
  };
}

function metalSurface(finish) {
  // A deterministic submillimetre grain catches highlights without adding a
  // painted-on texture. The brushed finish follows the radial spoke UVs.
  const size = 256, normal = new Uint8Array(size * size * 4), roughness = new Uint8Array(size * size * 4);
  let seed = 173;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = (seed >>> 24) / 255, line = Math.sin(x * 1.73) * .5 + Math.sin(x * 3.17) * .22;
    const i = (y * size + x) * 4, brushed = finish === 'brushed';
    normal[i] = 128 + Math.round(brushed ? line * 31 : (grain - .5) * 16);
    normal[i + 1] = 128 + Math.round((grain - .5) * (brushed ? 4 : 12));
    normal[i + 2] = 254; normal[i + 3] = 255;
    const value = Math.round(239 + (grain - .5) * 22 + (brushed ? line * 7 : 0));
    roughness[i] = roughness[i + 1] = roughness[i + 2] = value; roughness[i + 3] = 255;
  }
  const maps = [normal, roughness].map(data => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 5);
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
    map.anisotropy = 4; map.needsUpdate = true; return map;
  });
  return { normalMap: maps[0], roughnessMap: maps[1] };
}

function metalMaterial(opts) {
  const finishes = { gloss: [.24, 1, .085], satin: [.34, .42, .26], matte: [.51, .08, .48], brushed: [.29, .25, .23], chrome: [.15, .8, .12] };
  const [roughness, clearcoat, clearcoatRoughness] = finishes[opts.finish];
  const colour = new THREE.Color(opts.color);
  const blackPaint = Math.max(colour.r, colour.g, colour.b) < .045 && opts.finish !== 'chrome';
  const material = new THREE.MeshPhysicalMaterial({
    color: opts.color, metalness: blackPaint ? .24 : opts.finish === 'matte' ? .52 : .96,
    roughness, clearcoat, clearcoatRoughness, envMapIntensity: 1.05, reflectivity: .65,
    ...metalSurface(opts.finish),
  });
  material.normalScale.setScalar(opts.finish === 'brushed' ? .045 : opts.finish === 'chrome' ? .008 : .018);
  if (opts.finish === 'brushed') { material.anisotropy = .35; material.anisotropyRotation = Math.PI / 2; }
  return material;
}

function studioEnvironment(renderer) {
  // A product-photography studio, rather than the generic bright room with
  // visible furniture reflections. The black gaps between real softboxes are
  // what describe machined edges and the depth of a polished lip.
  const room = new THREE.Scene();
  room.background = new THREE.Color('#444951');
  const cards = [
    { position: [-3.4, 1.8, 3.6], size: [1.05, 5.1], colour: '#fff5e9', intensity: 6.2 },
    { position: [3.7, .7, 2.4], size: [.72, 4.7], colour: '#edf3ff', intensity: 5.2 },
    { position: [.2, 4.6, .9], size: [4.6, 1.35], colour: '#ffffff', intensity: 5.4 },
    { position: [-1.7, .6, -3.8], size: [.7, 3.8], colour: '#e8edff', intensity: 3.5 },
    { position: [0, -.9, 3.2], size: [3.4, .38], colour: '#ffffff', intensity: 1.6 },
    // A frontal strip is visible in the actual cap's reflection from both the
    // front view and default 3/4 view. Metallic OARTS letters need reflected
    // light here; a diffuse lamp alone cannot make an unpainted badge legible.
    { position: [.8, -.25, 4.7], size: [3.8, 1.1], colour: '#fffdfa', intensity: 3.6 },
  ];
  for (const card of cards) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(...card.size), new THREE.MeshBasicMaterial({ color: new THREE.Color(card.colour).multiplyScalar(card.intensity), side: THREE.DoubleSide, toneMapped: false }));
    panel.position.fromArray(card.position); panel.lookAt(0, .45, 0); room.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(room, .018, .1, 50);
  room.traverse(item => { item.geometry?.dispose(); item.material?.dispose(); });
  pmrem.dispose(); return environment;
}

function mesh(geometry, material, group) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = object.receiveShadow = true;
  group.add(object); return object;
}

function lathe(profile, material, group, segments = 192) {
  const object = mesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments), material, group);
  object.rotation.x = -Math.PI / 2; return object;
}

function circleShape(radius, holes = []) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, radius, 0, TAU, false);
  for (const [x, y, r] of holes) { const hole = new THREE.Path(); hole.absarc(x, y, r, 0, TAU, true); shape.holes.push(hole); }
  return shape;
}

function beveled(shape, depth = .065, bevelSize = .009) {
  return new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 5, bevelSize, bevelThickness: bevelSize, curveSegments: 32 });
}

function spokeGeometry({ width, start, end, bend, centre, face, channel = false, rootPockets = false }) {
  // Sweep a rounded, solid forging cross-section along both original outlines.
  // Longitudinal stations give the concave face real curvature instead of
  // bending a few large triangles from a flat extrusion.
  const side = sign => new THREE.CubicBezierCurve(new THREE.Vector2(sign * width * 2.15, start),
    new THREE.Vector2(sign * width * 1.6, .32), new THREE.Vector2(bend + sign * width * .54, .55),
    new THREE.Vector2(bend + sign * width * .49, end));
  const left = side(-1), right = side(1), stations = 28;
  const section = [[-1, .012], [-.96, .037], [-.83, .052], [-.28, .055], [0, .056], [.28, .055], [.83, .052], [.96, .037],
    [1, .012], [.96, -.009], [.8, -.02], [0, -.024], [-.8, -.02], [-.96, -.009]];
  const positions = [], uvs = [], indices = [], colours = [], ring = section.length;
  for (let step = 0; step <= stations; step++) {
    const t = step / stations, a = left.getPoint(t), b = right.getPoint(t);
    const y = a.y, radius = Math.hypot((a.x + b.x) / 2, y);
    const dish = THREE.MathUtils.smoothstep(radius, .22, .98);
    // A restrained shoulder adds structural section to the roots of the forging.
    const z = centre + (face - centre - .06) * dish;
    for (let point = 0; point < ring; point++) {
      const [cross, rawHeight] = section[point], x = THREE.MathUtils.lerp(a.x, b.x, (cross + 1) / 2);
      const channelDepth = channel && Math.abs(cross) < .29 ? .012 * (1 - Math.abs(cross) / .29) * THREE.MathUtils.smoothstep(y, .27, .38) * (1 - THREE.MathUtils.smoothstep(y, end - .09, end - .025)) : 0;
      const pocketDepth = rootPockets && rawHeight > .045 ? .01 * Math.max(0, 1 - Math.abs(cross) / .5) * THREE.MathUtils.smoothstep(y, .28, .32) * (1 - THREE.MathUtils.smoothstep(y, .38, .43)) : 0;
      const height = rawHeight - channelDepth - pocketDepth;
      positions.push(x, y, z + height);
      uvs.push((cross + 1) / 2, t);
      const occlusion = (.84 + dish * .16) * (height < 0 ? .8 : .94 + Math.max(0, height) * 1.07);
      colours.push(occlusion, occlusion, occlusion);
    }
  }
  for (let step = 0; step < stations; step++) for (let point = 0; point < ring; point++) {
    const a = step * ring + point, b = step * ring + (point + 1) % ring, c = a + ring, d = b + ring;
    indices.push(a, b, c, b, d, c);
  }
  // End caps disappear into the hub and bead seat, but keep the forging closed.
  for (let i = 1; i < ring - 1; i++) {
    indices.push(0, i + 1, i);
    const last = stations * ring; indices.push(last, last + i, last + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.userData.wheelSpoke = true;
  return geometry;
}

function subdivideSurface(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const attributes = ['position', 'normal', 'uv'], output = attributes.map(() => []);
  const read = index => attributes.map(name => Array.from(source.attributes[name].array.slice(index * source.attributes[name].itemSize, (index + 1) * source.attributes[name].itemSize)));
  const distance = (a, b) => a[0].reduce((sum, value, index) => sum + (value - b[0][index]) ** 2, 0);
  const split = (a, b, c, level = 0) => {
    const lengths = [distance(a, b), distance(b, c), distance(c, a)], longest = Math.max(...lengths);
    if (longest <= .065 ** 2 || level >= 9) {
      for (const vertex of [a, b, c]) for (let i = 0; i < attributes.length; i++) output[i].push(...vertex[i]);
      return;
    }
    const points = [a, b, c], edge = lengths.indexOf(longest), first = points[edge], second = points[(edge + 1) % 3], opposite = points[(edge + 2) % 3];
    const middle = first.map((values, i) => values.map((value, j) => (value + second[i][j]) / 2));
    split(first, middle, opposite, level + 1); split(middle, second, opposite, level + 1);
  };
  for (let index = 0; index < source.attributes.position.count; index += 3) split(read(index), read(index + 1), read(index + 2));
  const refined = new THREE.BufferGeometry();
  attributes.forEach((name, i) => refined.setAttribute(name, new THREE.Float32BufferAttribute(output[i], source.attributes[name].itemSize)));
  const welded = mergeVertices(refined, .00001);
  refined.dispose(); if (source !== geometry) source.dispose(); geometry.dispose(); return welded;
}

function perforatedSpokeGeometry({ width, start, end, bend, centre, face, slots = [], forkAt, forkAngle, branch = .05, angular = false, channel = false, rounded = false, flatFace = false, rootWidthFactor, shoulderWidthFactor, tipWidthFactor }) {
  const rootWidth = width * (rootWidthFactor ?? (flatFace ? 1.12 : 2.15)), tipWidth = width * (tipWidthFactor ?? (flatFace ? .88 : .49));
  const outline = new THREE.Shape(); outline.moveTo(-rootWidth, start);
  if (forkAt) {
    const fork = forkAt, tip = Math.sin(forkAngle) * end, tipY = Math.cos(forkAngle) * end, tipWidth = width * .49;
    const neck = width * 1.25;
    outline.bezierCurveTo(-width * 1.85, .29, -neck, fork - .13, -neck, fork - .025);
    if (angular) { outline.lineTo(-tip - tipWidth, tipY); }
    else outline.quadraticCurveTo(-tip - tipWidth * 1.3, fork + .12, -tip - tipWidth, tipY);
    outline.lineTo(-tip + tipWidth, tipY);
    if (angular) {
      outline.lineTo(-.008, fork + .016); outline.quadraticCurveTo(0, fork, .008, fork + .016); outline.lineTo(tip - tipWidth, tipY);
    } else {
      outline.quadraticCurveTo(-tip + tipWidth * 1.3, fork + .14, 0, fork);
      outline.quadraticCurveTo(tip - tipWidth * 1.3, fork + .14, tip - tipWidth, tipY);
    }
    outline.lineTo(tip + tipWidth, tipY);
    if (angular) outline.lineTo(neck, fork - .025);
    else outline.quadraticCurveTo(tip + tipWidth * 1.3, fork + .12, neck, fork - .025);
    outline.bezierCurveTo(neck, fork - .13, width * 1.85, .29, width * 2.15, start);
  } else {
    const midWidth = width * (flatFace ? .94 : rounded ? 1.15 : .54), shoulderWidth = width * (shoulderWidthFactor ?? (flatFace ? 1.02 : 1.6));
    outline.bezierCurveTo(-shoulderWidth, .32, bend - midWidth, .55, bend - tipWidth, end);
    outline.lineTo(bend + tipWidth, end);
    outline.bezierCurveTo(bend + midWidth, .55, shoulderWidth, .32, rootWidth, start);
  }
  outline.quadraticCurveTo(0, start - .045, -rootWidth, start);
  const curve = new THREE.CubicBezierCurve(new THREE.Vector2(0, start), new THREE.Vector2(0, .32), new THREE.Vector2(bend, .55), new THREE.Vector2(bend, end));
  const atY = y => {
    let min = 0, max = 1;
    for (let i = 0; i < 16; i++) { const middle = (min + max) / 2; if (curve.getPoint(middle).y < y) min = middle; else max = middle; }
    return curve.getPoint((min + max) / 2);
  };
  const forkAxisCache = new Map();
  const forkAxis = y => {
    const stem = Math.min(width * .68, branch * .65);
    if (!forkAt || y < forkAt) return stem;
    const key = y.toFixed(5); if (forkAxisCache.has(key)) return forkAxisCache.get(key);
    const tip = Math.sin(forkAngle) * end, tipY = Math.cos(forkAngle) * end, tipWidth = width * .49, neck = width * 1.25;
    const inner = new THREE.QuadraticBezierCurve(new THREE.Vector2(0, forkAt),
      new THREE.Vector2(angular ? (tip - tipWidth) / 2 : tip - tipWidth * 1.3, angular ? (forkAt + tipY) / 2 : forkAt + .14), new THREE.Vector2(tip - tipWidth, tipY));
    const outer = new THREE.QuadraticBezierCurve(new THREE.Vector2(neck, forkAt - .025),
      new THREE.Vector2(angular ? (neck + tip + tipWidth) / 2 : tip + tipWidth * 1.3, angular ? (forkAt - .025 + tipY) / 2 : forkAt + .12), new THREE.Vector2(tip + tipWidth, tipY));
    const pointAtY = curve => {
      let min = 0, max = 1;
      for (let i = 0; i < 16; i++) { const middle = (min + max) / 2; if (curve.getPoint(middle).y < y) min = middle; else max = middle; }
      return curve.getPoint((min + max) / 2).x;
    };
    const value = (pointAtY(inner) + pointAtY(outer)) / 2; forkAxisCache.set(key, value); return value;
  };
  for (const slot of slots) {
    const from = Math.max(start + .075, slot.from), to = Math.min(end - .045, slot.to);
    if (to <= from) continue;
    if (slot.shape === 'triangle') {
      const a = atY(from), b = atY(to), halfWidth = Math.min(slot.width || .018, width * .4), hole = new THREE.Path();
      hole.moveTo(a.x - halfWidth, from); hole.lineTo(b.x, to); hole.lineTo(a.x + halfWidth, from); hole.closePath();
      outline.holes.push(hole); continue;
    }
    const points = [], count = 20;
    for (let i = 0; i <= count; i++) {
      const t = i / count, point = atY(THREE.MathUtils.lerp(from, to, t));
      if (slot.branch && forkAt) point.x = slot.branch * forkAxis(point.y);
      point.x += slot.offset || 0;
      const rounding = slot.shape === 'triangle' ? Math.sin(Math.PI * t) * (1 - t) * 2 : slot.shape === 'rectangle' ? Math.min(1, Math.sin(Math.PI * t) * 5) : Math.sqrt(Math.sin(Math.PI * t));
      const halfWidth = Math.min(slot.width || .012, width * .4) * rounding;
      points.push([point.x - halfWidth, point.y, point.x + halfWidth]);
    }
    const hole = new THREE.Path(); hole.moveTo(points[0][0], points[0][1]);
    for (const [left, y] of points.slice(1)) hole.lineTo(left, y);
    for (let i = points.length - 2; i >= 0; i--) hole.lineTo(points[i][2], points[i][1]);
    hole.closePath(); outline.holes.push(hole);
  }
  const blank = new THREE.ExtrudeGeometry(outline, { depth: .055, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: .004, bevelThickness: .004, curveSegments: 14 });
  const geometry = subdivideSurface(blank), positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const colours = new Float32Array(positions.count * 3);
  const heightAt = (x, y) => {
    const radius = Math.hypot(x, y);
    let channelDepth = 0;
    if (channel) {
      const axis = forkAt && y > forkAt ? Math.sign(x) * forkAxis(y) : bend;
      channelDepth = .009 * Math.max(0, 1 - Math.abs(x - axis) / Math.max(.012, width * .25)) * THREE.MathUtils.smoothstep(radius, .28, .4) * (1 - THREE.MathUtils.smoothstep(radius, end - .09, end));
    }
    return centre + (face - centre - .061) * THREE.MathUtils.smoothstep(radius, flatFace ? .2 : .22, flatFace ? .6 : .98) - channelDepth;
  };
  const normal = new THREE.Vector3(), epsilon = .0005;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), radius = Math.hypot(x, y), dish = THREE.MathUtils.smoothstep(radius, .22, .98);
    positions.setZ(i, positions.getZ(i) + heightAt(x, y));
    // Transform the original extrusion normal by the deformation Jacobian.
    // This preserves bevel seams and continuous reflections on wide faces,
    // rather than showing a tessellation pattern in a glossy highlight.
    const dx = (heightAt(x + epsilon, y) - heightAt(x - epsilon, y)) / (2 * epsilon);
    const dy = (heightAt(x, y + epsilon) - heightAt(x, y - epsilon)) / (2 * epsilon);
    normal.set(normals.getX(i) - normals.getZ(i) * dx, normals.getY(i) - normals.getZ(i) * dy, normals.getZ(i)).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
    colours.fill(.84 + dish * .16, i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3)); geometry.userData.wheelSpoke = true;
  return geometry;
}

// The approved OARTS emblem is part of the solid cap geometry. No delayed
// font/image loading can leave a wheel blank, or leak a source vehicle badge.
const capLogoRevision = 2;
export function ensureCapLogo() { return Promise.resolve(true); }
function waitForCapLogo(signal) {
  return signal?.aborted
    ? Promise.reject(new DOMException('Náhled byl zrušen.', 'AbortError'))
    : ensureCapLogo();
}

/** One 2.06-unit diameter wheel, with its face looking down +Z and its centre at the origin. */
export function createWheel(input = {}) {
  const photoEntry = PHOTO_WHEEL_MODELS[input.design];
  if (photoEntry) {
    const record = photoRecords.get(input.design);
    if (!record) throw new Error('Nejprve načtěte individuální geometrii kola.');
    const opts = options(input);
    if (opts.preferExportedGeometry && !opts.referenceSurface && exportedPhotoWheels.has(opts.design)) {
      const wheel = exportedPhotoWheels.get(opts.design).clone(true), geometries = new Map(), materials = new Map();
      const ownMaterial = material => {
        if (!materials.has(material)) materials.set(material, material.clone());
        return materials.get(material);
      };
      wheel.traverse(part => {
        if (!part.isMesh) return;
        if (!geometries.has(part.geometry)) geometries.set(part.geometry, part.geometry.clone());
        part.geometry = geometries.get(part.geometry);
        part.material = Array.isArray(part.material) ? part.material.map(ownMaterial) : ownMaterial(part.material);
        part.castShadow = part.receiveShadow = true;
      });
      wheel.name = `NFW_photo_${opts.design}`; wheel.userData.options = opts;
      return wheel;
    }
    const surface = opts.referenceSurface && sourceSurfaces.get(opts.design);
    const texture = surface ? new THREE.CanvasTexture(surface) : null;
    if (texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; }
    return buildPhotoWheel(THREE, record, {...opts, faceTexture: texture, preserveSourceColour: !!texture});
  }
  const opts = options(input), preset = presets[opts.design];
  const group = new THREE.Group(); group.name = `NFW_${opts.design}`;
  const material = metalMaterial(opts);
  const polished = new THREE.MeshPhysicalMaterial({ color: '#c8c8c4', metalness: 1, roughness: .12, clearcoat: .65, clearcoatRoughness: .08, envMapIntensity: 1.05 });
  const inner = material.clone(); inner.roughness = Math.min(.65, inner.roughness + .12); inner.color.multiplyScalar(.68);
  const dark = new THREE.MeshStandardMaterial({ color: '#141619', metalness: .6, roughness: .35 });
  const machined = polished.clone(); machined.roughness = .28; machined.normalMap = material.normalMap; machined.normalScale.setScalar(.045);
  const spokeMaterial = material.clone(); spokeMaterial.vertexColors = true;
  const cutMetal = material.clone(); cutMetal.color.multiplyScalar(.63); cutMetal.roughness = Math.min(.62, material.roughness + .14);
  const lipMat = opts.lip === 'polished' || opts.lip === 'chrome' ? polished : opts.lip === 'machined' ? machined : opts.lip === 'black' ? dark : material;
  const depth = opts.width / opts.diameter * 1.8;
  const face = preset.bolts ? .23 : .33;
  const centre = preset.centre ?? (['deep7', 'concave9'].includes(opts.design) ? -.12 : -.045);

  // A closed, turned-aluminium barrel profile includes bead seats and both rolled lips.
  lathe([[.958, -face + .046], [1.005, -face + .046], [1.025, -face + .05], [1.029, -face + .055],
    [1.012, -face + .06], [.978, -face + .066], [.964, -face + .11],
    [.952, depth - face - .1], [.97, depth - face - .045], [1.004, depth - face - .035],
    [1.011, depth - face - .012], [1.001, depth - face + .012], [.947, depth - face + .012],
    [.933, depth - face - .04], [.921, -face + .15], [.936, -face + .064], [.958, -face + .046]], inner, group);
  lathe([[.957, -face], [1.008, -face], [1.028, -face + .012], [1.024, -face + .038], [.96, -face + .04], [.957, -face]], lipMat, group);
  lathe([[.952, depth - face - .025], [1.005, depth - face - .025], [1.009, depth - face], [.954, depth - face], [.952, depth - face - .025]], material, group);

  // The turned lip has narrow tooling grooves and a rounded inner shoulder.
  // These stay inside the measured 1.032-unit rim silhouette used for photo fit.
  for (const radius of [.969, .989, 1.015]) {
    const groove = mesh(new THREE.TorusGeometry(radius, .00125, 6, 192), cutMetal, group);
    groove.position.z = face + .0006; groove.castShadow = false;
  }
  const lipShoulder = mesh(new THREE.TorusGeometry(.953, .0055, 10, 192), lipMat, group);
  lipShoulder.position.z = face - .035;
  for (const distance of [.1, Math.max(.16, depth - .1)]) {
    const rib = mesh(new THREE.TorusGeometry(.934, .007, 10, 128), inner, group);
    rib.position.z = face - distance;
  }
  if (preset.wideLip) {
    const radius = preset.endRadius - .012;
    lathe([[radius, -face + .045], [radius, -face + .01], [radius + .025, -face], [.957, -face], [.957, -face + .045], [radius, -face + .045]], lipMat, group);
    for (const radius of [.886, .918, .947]) {
      const tooling = mesh(new THREE.TorusGeometry(radius, .0012, 6, 160), cutMetal, group); tooling.position.z = face + .0006; tooling.castShadow = false;
    }
  }
  if (preset.ventRing) {
    const annulus = circleShape(.976, [[0, 0, preset.endRadius - .012]]), vents = preset.ventCount || 16;
    for (let i = 0; i < vents; i++) {
      const angle = i * TAU / vents, hole = new THREE.Path();
      const width = .26, bottom = preset.endRadius + .025, top = .95, rounding = .006;
      const path = new THREE.Path();
      path.moveTo(-width / 2 + rounding, bottom); path.lineTo(width / 2 - rounding, bottom);
      path.quadraticCurveTo(width / 2, bottom, width / 2, bottom + rounding); path.lineTo(width / 2, top - rounding);
      path.quadraticCurveTo(width / 2, top, width / 2 - rounding, top); path.lineTo(-width / 2 + rounding, top);
      path.quadraticCurveTo(-width / 2, top, -width / 2, top - rounding); path.lineTo(-width / 2, bottom + rounding);
      path.quadraticCurveTo(-width / 2, bottom, -width / 2 + rounding, bottom);
      path.getPoints(6).forEach((point, index) => {
        const x = point.x * Math.cos(angle) - point.y * Math.sin(angle), y = point.x * Math.sin(angle) + point.y * Math.cos(angle);
        if (index === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
      });
      hole.closePath(); annulus.holes.push(hole);
    }
    const ring = mesh(beveled(annulus, .041, .004), material, group); ring.position.z = face - .047; ring.name = 'Perforated_outer_ring';
  }

  const spokeGeometries = new Map();
  const spoke = (angle, branch = 0, style = preset.style) => {
    const end = preset.endRadius || (preset.bolts ? .84 : .969);
    const width = preset.width;
    const start = style === 'split' ? .21 : .18;
    const bend = ['twist', 'turbine'].includes(style) ? (opts.mirror ? -.15 : .15) : branch;
    const key = [start, bend].join(',');
    if (!spokeGeometries.has(key)) {
      const parameters = { ...preset, width, start, end, bend, centre, face };
      spokeGeometries.set(key, preset.forkAt || preset.slots?.length || preset.rounded || preset.flatFace ? perforatedSpokeGeometry(parameters) : spokeGeometry(parameters));
    }
    const item = mesh(spokeGeometries.get(key), spokeMaterial, group); item.rotation.z = angle; item.name = 'Forged_spoke';
  };

  for (let i = 0; i < preset.count; i++) {
    const angle = i * TAU / preset.count + (preset.spokeRotation || 0);
    if (preset.forkAt) spoke(angle);
    else if (preset.style === 'fork' || preset.style === 'split') { spoke(angle - .09, -.06); spoke(angle + .09, .06); }
    else if (preset.style === 'mesh') { spoke(angle, -.18, 'mesh'); spoke(angle, .18, 'mesh'); }
    else spoke(angle);
  }

  // Through-drilled mounting holes and machined bevels around each seat.
  const holePositions = Array.from({ length: preset.centerLock ? 0 : Math.round(opts.bolts) }, (_, i) => {
    const a = i * TAU / opts.bolts + (preset.lugRotation ?? Math.PI / opts.bolts);
    return [Math.sin(a) * .22, Math.cos(a) * .22, .051];
  });
  const hubShape = new THREE.Shape();
  const hubPoints = Array.from({ length: 100 }, (_, i) => {
    const a = i * TAU / 100, radius = preset.centerLock ? .205 - .003 * Math.cos(a * 12) : .285 - .013 * Math.cos(a * Math.round(opts.bolts));
    return new THREE.Vector2(Math.sin(a) * radius, Math.cos(a) * radius);
  });
  hubShape.moveTo(hubPoints[0].x, hubPoints[0].y);
  for (let i = 1; i <= hubPoints.length; i++) { const p = hubPoints[i % hubPoints.length]; hubShape.lineTo(p.x, p.y); }
  for (const [x, y, r] of [[0, 0, .102], ...holePositions]) { const hole = new THREE.Path(); hole.absarc(x, y, r, 0, TAU, false); hubShape.holes.push(hole); }
  const hub = mesh(beveled(hubShape, .074, .015), material, group);
  hub.position.z = centre - .004;
  const hubRelief = mesh(new THREE.TorusGeometry(.146, .0018, 8, 96), cutMetal, group);
  hubRelief.position.z = centre + .084; hubRelief.castShadow = false;
  if (preset.centerLock) {
    const lockShape = new THREE.Shape();
    for (let i = 0; i <= 12; i++) {
      const angle = i * TAU / 12, x = Math.cos(angle) * .137, y = Math.sin(angle) * .137;
      if (i === 0) lockShape.moveTo(x, y); else lockShape.lineTo(x, y);
    }
    const bore = new THREE.Path(); bore.absarc(0, 0, .106, 0, TAU, true); lockShape.holes.push(bore);
    const lockNut = mesh(beveled(lockShape, .023, .004), machined, group); lockNut.position.z = centre + .083; lockNut.name = 'Centre_lock_nut';
  }
  const lugShape = circleShape(.033), socket = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const angle = -i * TAU / 6 + Math.PI / 6, x = Math.cos(angle) * .014, y = Math.sin(angle) * .014;
    if (i === 0) socket.moveTo(x, y); else socket.lineTo(x, y);
  }
  lugShape.holes.push(socket);
  const lugGeometry = holePositions.length ? beveled(lugShape, .018, .003) : null;
  for (const [x, y] of holePositions) {
    const seat = lathe([[.046, 0], [.057, 0], [.060, -.014], [.052, -.024], [.046, -.019], [.046, 0]], lipMat, group, 48);
    seat.position.set(x, y, centre + .079);
    const recess = mesh(new THREE.CylinderGeometry(.043, .043, .018, 32), dark, group);
    recess.rotation.x = Math.PI / 2; recess.position.set(x, y, centre + .077);
    const lug = mesh(lugGeometry, polished, group); lug.position.set(x, y, centre + .077); lug.name = 'Recessed_hex_lug';
    const washer = mesh(new THREE.TorusGeometry(.0375, .0024, 8, 40), machined, group);
    washer.position.set(x, y, centre + .083);
  }
  addOartsCap(THREE, group, { ...opts, frontZ: centre + .101, radius: .111 });

  // Valve stem and anodised cap are separately modelled.
  const valve = mesh(new THREE.CylinderGeometry(.013, .019, .074, 20), dark, group);
  valve.rotation.x = Math.PI / 2; valve.position.set(.13, -.91, face + .01);
  const valveCap = mesh(new THREE.CylinderGeometry(.017, .017, .028, 12), polished, group);
  valveCap.rotation.x = Math.PI / 2; valveCap.position.set(.13, -.91, face + .048);
  const valveThreads = new THREE.InstancedMesh(new THREE.TorusGeometry(.018, .0011, 6, 20), dark, 3);
  const valveTransform = new THREE.Object3D();
  for (let i = 0; i < 3; i++) {
    valveTransform.position.set(.13, -.91, face + .034 + i * .006); valveTransform.updateMatrix(); valveThreads.setMatrixAt(i, valveTransform.matrix);
  }
  group.add(valveThreads);
  if (preset.bolts) {
    lathe([[.84, -face], [.96, -face], [.96, -face + .05], [.84, -face + .05], [.84, -face]], lipMat, group);
    const boltGeometry = new THREE.CylinderGeometry(.019, .019, .022, 12);
    const bolts = new THREE.InstancedMesh(boltGeometry, polished, 32), dummy = new THREE.Object3D();
    for (let i = 0; i < 32; i++) { const a = i * TAU / 32; dummy.position.set(Math.sin(a) * .896, Math.cos(a) * .896, face + .009); dummy.rotation.x = Math.PI / 2; dummy.updateMatrix(); bolts.setMatrixAt(i, dummy.matrix); }
    bolts.castShadow = true; group.add(bolts);
    const sockets = new THREE.InstancedMesh(new THREE.CircleGeometry(.007, 6), dark, 32);
    for (let i = 0; i < 32; i++) {
      const a = i * TAU / 32; dummy.position.set(Math.sin(a) * .896, Math.cos(a) * .896, face + .0205);
      dummy.rotation.set(0, 0, a); dummy.updateMatrix(); sockets.setMatrixAt(i, dummy.matrix);
    }
    group.add(sockets);
  }
  group.userData.options = opts; return group;
}

function disposeObject(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse(item => {
    if (item.geometry) geometries.add(item.geometry);
    for (const material of Array.isArray(item.material) ? item.material : item.material ? [item.material] : []) {
      materials.add(material); Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  textures.forEach(texture => { texture.source?.data?.close?.(); texture.dispose(); });
  materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
}

function contactShadow() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
  gradient.addColorStop(0, 'rgba(0,0,0,.52)'); gradient.addColorStop(.45, 'rgba(0,0,0,.25)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export async function mount(container, input = {}) {
  if (!(container instanceof Element)) throw new TypeError('3D showroom potřebuje platný kontejner.');
  if (input.signal?.aborted) throw new DOMException('Náhled byl zrušen.', 'AbortError');
  // Validate before waiting for textures or replacing an existing valid viewer.
  const initialOptions = options(input);
  await waitForCapLogo(input.signal);
  if (input.signal?.aborted) throw new DOMException('Náhled byl zrušen.', 'AbortError');
  active.get(container)?.dispose();
  let opts = initialOptions, disposed = false, model = null, carModel = null, generation = 0;
  let asset = null, modelMetadata = null, paintMaterials = [], installedWheels = [];
  let loadAbort = null, parsing = null;
  const registeredAsset = () => window.NFWVehicleModels.get(opts.vehicleAsset?.id || opts.vehicleAsset);
  let renderer;
  const scene = new THREE.Scene();
  const transparent = input.thumbnail === true && input.transparent === true;
  scene.background = transparent ? null : new THREE.Color(input.background || '#191d22');
  if (!transparent) scene.fog = new THREE.Fog(scene.background, 7, 22);
  const camera = new THREE.PerspectiveCamera(32, 1, .03, 70);
  const status = document.createElement('div'); status.className = 'showroom-status'; status.setAttribute('role', 'status');
  status.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:24px;color:#c8c4bc;font:13px/1.6 Arial;pointer-events:none;z-index:2';
  status.textContent = 'Připravuji 3D studio…'; container.append(status);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch (error) {
    status.textContent = '3D náhled není na tomto zařízení dostupný. Prohlédněte si fotografie produktu.';
    input.onError?.(error); throw error;
  }
  const mobileStudio = container.clientWidth < 650 || matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(input.thumbnail ? 1 : Math.min(mobileStudio ? 1.75 : 2, Math.max(input.highQuality && !mobileStudio ? 2 : 1, window.devicePixelRatio || 1)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .97;
  renderer.shadowMap.enabled = !input.thumbnail || input.shadows === true;
  renderer.shadowMap.type = !mobileStudio && opts.mode === 'wheel' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  renderer.domElement.setAttribute('aria-label', 'Interaktivní 3D model. Tažením otáčejte, kolečkem přibližujte.');
  renderer.domElement.tabIndex = 0; container.append(renderer.domElement);
  const environment = studioEnvironment(renderer); scene.environment = environment.texture;
  scene.environmentIntensity = 1.1;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .075; controls.enablePan = false;
  controls.minPolarAngle = .13; controls.maxPolarAngle = Math.PI * .49;
  controls.rotateSpeed = .65; controls.zoomSpeed = .75;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  controls.autoRotate = opts.autoRotate && !reduced.matches; controls.autoRotateSpeed = .55;
  const motionChange = () => { controls.autoRotate = opts.autoRotate && !reduced.matches; };
  reduced.addEventListener('change', motionChange);
  const key = new THREE.DirectionalLight('#fff7ed', 2.2); key.position.set(-3.8, 5.5, 5); key.castShadow = renderer.shadowMap.enabled;
  // VSM blurs a real area-like product shadow with two bounded 2048px targets.
  // Mobile keeps the cheaper depth-only PCF map and reduced contact shadow.
  const shadowSize = mobileStudio ? 1024 : opts.mode === 'wheel' ? 2048 : input.highQuality ? 4096 : 2048;
  const shadowBounds = opts.mode === 'car' ? 4.5 : 2.1;
  key.shadow.mapSize.set(shadowSize, shadowSize); key.shadow.camera.left = key.shadow.camera.bottom = -shadowBounds;
  key.shadow.camera.right = key.shadow.camera.top = shadowBounds; key.shadow.normalBias = .014; key.shadow.bias = .0002;
  key.shadow.camera.near = .5; key.shadow.camera.far = 18; key.shadow.radius = mobileStudio ? 3 : 12; key.shadow.blurSamples = 8;
  key.target.position.set(0, .75, 0); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#e1eaff', .58); fill.position.set(4, 2.2, 3); scene.add(fill);
  const rimLight = new THREE.DirectionalLight('#ffffff', 1.1); rimLight.position.set(2, 4, -4); scene.add(rimLight);
  // A charcoal cyclorama and soft contact shadow keep the studio free of hard sun shadows.
  const floor = mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#12161c', roughness: .8, metalness: .05, envMapIntensity: .15 }), scene);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; floor.position.y = -.015;
  const shadow = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, opacity: .85 }), scene);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.009; shadow.castShadow = shadow.receiveShadow = false;
  if (transparent) floor.visible = shadow.visible = false;
  const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_URL); draco.setWorkerLimit(2);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);
  let visible = true, fitScale = 1;
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; }, { rootMargin: '100px' });
  intersection.observe(container);
  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    const nextScale = Math.max(1, (opts.mode === 'car' ? 1.25 : .85) / camera.aspect);
    camera.position.sub(controls.target).multiplyScalar(nextScale / fitScale).add(controls.target);
    controls.minDistance *= nextScale / fitScale; controls.maxDistance *= nextScale / fitScale; fitScale = nextScale;
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    render();
  };
  const observer = new ResizeObserver(resize); observer.observe(container);
  const render = () => { if (!disposed) renderer.render(scene, camera); };
  const capLogoLoaded = event => { if (event.detail?.loaded) render(); };
  window.addEventListener('nfw:cap-logo-ready', capLogoLoaded);
  const onContextLost = event => { event.preventDefault(); status.style.display = 'grid'; status.textContent = '3D náhled byl pozastaven. Obnovte stránku pro opětovné načtení.'; input.onError?.(new Error('WebGL context lost')); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  const onKey = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '0'].includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? -.14 : .14);
    else if (event.key === '+' || event.key === 'ArrowUp') offset.multiplyScalar(.9);
    else if (event.key === '-' || event.key === 'ArrowDown') offset.multiplyScalar(1.1);
    else { resetCamera(); return; }
    offset.clampLength(controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(offset); controls.update(); render();
  };
  renderer.domElement.addEventListener('keydown', onKey);
  renderer.domElement.addEventListener('dblclick', resetCamera);
  function resetCamera() {
    if (opts.mode === 'car') {
      const view = (asset || registeredAsset())?.camera;
      camera.position.fromArray(view?.position || [-5.8, 2.65, 6.1]); controls.target.fromArray(view?.target || [0, .85, 0]);
      controls.minDistance = view?.minDistance || 3; controls.maxDistance = view?.maxDistance || 12;
    }
    else { camera.position.set(-2.05, 1.58, 3.8); controls.target.set(0, 1.03, -.075); controls.minDistance = 2.6; controls.maxDistance = 7; }
    fitScale = Math.max(1, (opts.mode === 'car' ? 1.25 : .85) / camera.aspect);
    camera.position.sub(controls.target).multiplyScalar(fitScale).add(controls.target);
    controls.minDistance *= fitScale; controls.maxDistance *= fitScale;
    controls.update(); render();
  }
  function changeWheelsOnCar() {
    if (!carModel) return;
    installedWheels.forEach(wheel => { wheel.removeFromParent(); disposeObject(wheel); }); installedWheels = [];
    for (const binding of modelMetadata.wheels) {
      const anchor = carModel.getObjectByName(binding.anchor);
      if (!anchor) throw new Error(`Chybí montážní bod ${binding.anchor}`);
      // Anchors are measured in the source model, +Z outwards at the outer rim plane.
      // Keep its tyres and brakes. Order dimensions are not a physical fitment simulation.
      const scale = binding.rimRadius / 1.032;
      const wheel = createWheel({ ...opts, width: binding.widthInches || 10, diameter: binding.diameterInches || 21,
        mirror: binding.side === 'right' ? !opts.mirror : opts.mirror });
      wheel.scale.setScalar(scale); wheel.position.z = -frontPlane(opts.design) * scale;
      wheel.name = `NFW_mounted_${binding.id}`;
      anchor.add(wheel); installedWheels.push(wheel);
    }
    paintMaterials.forEach(material => material.color.set(opts.bodyColor));
  }
  async function build(modeChanged = false) {
    const token = ++generation;
    const lightBounds = opts.mode === 'car' ? 4.5 : 2.1;
    const shadowType = !mobileStudio && opts.mode === 'wheel' ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
    const desiredShadowSize = mobileStudio ? 1024 : opts.mode === 'wheel' ? 2048 : input.highQuality ? 4096 : 2048;
    if (renderer.shadowMap.type !== shadowType || key.shadow.mapSize.x !== desiredShadowSize) {
      renderer.shadowMap.type = shadowType;
      key.shadow.map?.dispose(); key.shadow.map = null;
      key.shadow.mapPass?.dispose(); key.shadow.mapPass = null;
      key.shadow.mapSize.set(desiredShadowSize, desiredShadowSize);
      key.shadow.needsUpdate = true;
      floor.material.needsUpdate = true;
    }
    key.shadow.radius = mobileStudio || opts.mode === 'car' ? 3 : 12;
    key.shadow.camera.left = key.shadow.camera.bottom = -lightBounds;
    key.shadow.camera.right = key.shadow.camera.top = lightBounds;
    key.shadow.camera.updateProjectionMatrix();
    loadAbort?.abort(); loadAbort = new AbortController();
    const signal = loadAbort.signal;
    try {
    await prepareWheelGeometry(opts.design, signal, opts.referenceSurface, opts.preferExportedGeometry);
    if (disposed || generation !== token) return;
    if (model) { model.removeFromParent(); disposeObject(model); model = null; carModel = null; }
    installedWheels = []; paintMaterials = [];
    status.style.display = 'grid';
    if (opts.mode === 'car') {
      asset = registeredAsset();
      status.textContent = `Načítám ${asset?.name || '3D vůz'}…`;
      try {
        if (!asset) throw new Error('Tento 3D model není v registru.');
        const metadataResponse = await fetch(new URL('../' + asset.metadata, import.meta.url), { signal });
        if (!metadataResponse.ok) throw new Error('Metadata modelu nejsou dostupná.');
        const metadata = await metadataResponse.json();
        if (disposed || generation !== token) return;
        const bindings = metadata.wheels;
        if (metadata.schemaVersion !== 1 || metadata.id !== asset.id || metadata.src !== asset.src ||
          !Array.isArray(bindings) || bindings.length !== 4 ||
          new Set(bindings.map(w => w?.anchor)).size !== 4 || new Set(bindings.map(w => w?.id)).size !== 4 ||
          !bindings.every(w => typeof w.anchor === 'string' && w.anchor && typeof w.id === 'string' && w.id &&
            Number.isFinite(w.rimRadius) && w.rimRadius >= .15 && w.rimRadius <= .4 &&
            Number.isFinite(w.widthInches) && w.widthInches >= 5 && w.widthInches <= 16 &&
            Number.isFinite(w.diameterInches) && w.diameterInches >= 12 && w.diameterInches <= 30 &&
            ['left', 'right'].includes(w.side)) ||
          !Array.isArray(metadata.paintMaterials) || !metadata.paintMaterials.length ||
          !metadata.paintMaterials.every(name => typeof name === 'string' && name)) {
          throw new Error('Neplatná identita nebo montážní body modelu.');
        }
        const modelURL = new URL('../' + asset.src, import.meta.url);
        const response = await fetch(modelURL, { signal });
        if (!response.ok) throw new Error('Model vozu není dostupný.');
        const bytes = await response.arrayBuffer();
        if (disposed || generation !== token) return;
        const parseJob = loader.parseAsync(bytes, new URL('.', modelURL).href); parsing = parseJob;
        const gltf = await parseJob.finally(() => { if (parsing === parseJob) parsing = null; });
        if (disposed || generation !== token) { disposeObject(gltf.scene); return; }
        carModel = gltf.scene; model = carModel; modelMetadata = metadata;
        carModel.traverse(item => {
          if (!item.isMesh) return;
          item.castShadow = item.receiveShadow = true;
          for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
            material.envMapIntensity = 1.1;
            if (metadata.paintMaterials?.includes(material.name) && !paintMaterials.includes(material)) {
              material.metalness = .7; material.roughness = .24;
              if ('clearcoat' in material) { material.clearcoat = 1; material.clearcoatRoughness = .12; }
              paintMaterials.push(material);
            }
          }
        });
        // Add before wheel installation so any malformed asset is disposed on failure.
        scene.add(carModel); changeWheelsOnCar();
        const bounds = new THREE.Box3().setFromObject(carModel), size = bounds.getSize(new THREE.Vector3());
        shadow.scale.set(size.x * 1.18, size.z * 1.3, 1);
        container.dataset.vehicleAsset = asset.id; container.dataset.mountedWheels = installedWheels.length;
      } catch (error) {
        throw error;
      }
    } else {
      asset = null; modelMetadata = null; delete container.dataset.vehicleAsset; delete container.dataset.mountedWheels;
      model = createWheel(opts); model.position.y = 1.033; scene.add(model); shadow.scale.set(3.6, 2.2, 1);
    }
    if (disposed || generation !== token) return;
    status.style.display = 'none'; if (modeChanged) resetCamera(); render();
    input.onReady?.(controller);
    } catch (error) {
      if (disposed || generation !== token || error.name === 'AbortError') return;
      controller.dispose();
      status.textContent = '3D model se nepodařilo načíst. Opakujte načtení nebo zvolte jiný design.';
      status.style.display = 'grid'; container.append(status);
      input.onError?.(error); throw error;
    }
  }
  const controller = {
    get options() { return { ...opts }; },
    get renderer() { return renderer; },
    async update(patch = {}) {
      if (disposed) return;
      const previous = opts; opts = options({ ...opts, ...patch }); motionChange();
      const changed = previous.mode !== opts.mode || (opts.mode === 'car' && asset?.id !== registeredAsset()?.id);
      const wheelChanged = ['design','color','finish','lip','cap','mirror','bolts','referenceSurface','preferExportedGeometry', ...(opts.mode === 'wheel' ? ['width','diameter'] : [])].some(key => previous[key] !== opts[key]);
      if (changed || !model || (wheelChanged && opts.mode === 'wheel') || previous.design !== opts.design) await build(changed);
      else if (opts.mode === 'car') {
        if (wheelChanged) changeWheelsOnCar();
        else paintMaterials.forEach(material => material.color.set(opts.bodyColor));
        render();
      }
      else if (wheelChanged) { const old = model; model = createWheel(opts); model.position.y = 1.033; scene.add(model); old.removeFromParent(); disposeObject(old); render(); }
      return controller;
    },
    reset: resetCamera,
    setView(preset) {
      if (disposed) return;
      const views = { front: [-8, 1.6, 0], side: [0, 1.55, 8], rear: [8, 1.7, 0], detail: [-2.55, .68, 2.8] };
      if (preset === 'perspective') { resetCamera(); return; }
      if (opts.mode === 'wheel') {
        const wheelViews = {front:[0,1.033,4.5], side:[4.2,1.033,0], rear:[0,1.033,-4.5]};
        if (!wheelViews[preset]) return;
        controls.autoRotate = false; controls.target.set(0,1.033,-.075); camera.position.fromArray(wheelViews[preset]);
        camera.position.sub(controls.target).multiplyScalar(fitScale).add(controls.target);
        controls.update(); render(); return;
      }
      if (opts.mode !== 'car' || !views[preset]) return;
      controls.target.fromArray(preset === 'detail' ? [-1.35, .5, .7] : asset.camera.target);
      camera.position.fromArray(views[preset]);
      camera.position.sub(controls.target).multiplyScalar(fitScale).add(controls.target); controls.update(); render();
    },
    get view() { return { assetId: asset?.id || null, mountedWheels: installedWheels.length, camera: camera.position.toArray(), target: controls.target.toArray() }; },
    capture(type = 'image/webp', quality = .92) { render(); return renderer.domElement.toDataURL(type, quality); },
    captureHighResolution(width = 4096) {
      const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = camera.aspect;
      const w = Math.min(4096, Math.max(1024, width)), h = Math.round(w / aspect);
      try {
        renderer.setPixelRatio(1); renderer.setSize(w, Math.min(4096,h), false);
        camera.aspect = w / Math.min(4096,h); camera.updateProjectionMatrix(); render();
        return renderer.domElement.toDataURL('image/png');
      } finally {
        camera.aspect = aspect; camera.updateProjectionMatrix(); renderer.setPixelRatio(ratio); renderer.setSize(size.x,size.y,false); render();
      }
    },
    dispose() {
      if (disposed) return; disposed = true; generation++;
      loadAbort?.abort(); input.signal?.removeEventListener('abort', cancelMount);
      renderer.setAnimationLoop(null); observer.disconnect(); intersection.disconnect(); controls.dispose();
      window.removeEventListener('nfw:cap-logo-ready', capLogoLoaded);
      reduced.removeEventListener('change', motionChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.domElement.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('dblclick', resetCamera);
      // Finish an in-flight CPU decode, then release workers; the WebGL context is released now.
      if (parsing) parsing.then(() => draco.dispose(), () => draco.dispose()); else draco.dispose();
      scene.traverse(item => { item.shadow?.map?.dispose(); item.shadow?.mapPass?.dispose(); });
      disposeObject(scene); environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); status.remove(); if (active.get(container) === controller) active.delete(container);
      delete container.dataset.vehicleAsset; delete container.dataset.mountedWheels;
    },
  };
  const cancelMount = () => controller.dispose();
  input.signal?.addEventListener('abort', cancelMount, { once: true });
  active.set(container, controller); resetCamera(); resize();
  let last = 0;
  renderer.setAnimationLoop(time => {
    if (disposed || !visible || document.hidden || input.thumbnail) return;
    const delta = Math.min((time - last) / 1000 || .016, .05); last = time;
    if (controls.update(delta)) render();
  });
  await build(); return controller;
}

// Thumbnail work is serialized through one shared temporary context, keeping catalogues cheap.
let thumbnailQueue = Promise.resolve();
let thumbnailHost, thumbnailController, thumbnailIdleTimer, thumbnailSettings;
function disposeThumbnails() {
  clearTimeout(thumbnailIdleTimer); thumbnailController?.dispose(); thumbnailHost?.remove();
  thumbnailController = null; thumbnailHost = null; thumbnailSettings = null;
}
/** Rasterize a wheel in the shared studio. Existing calls keep their opaque 400 px output. */
export function renderThumbnail(input = {}) {
  const job = thumbnailQueue.then(async () => {
    await ensureCapLogo();
    clearTimeout(thumbnailIdleTimer);
    try {
      const size = Math.round(clamp(input.size, 128, 1600, 400));
      const settings = JSON.stringify([size, input.transparent === true, input.background || '#191d22', input.shadows === true]);
      if (thumbnailController && thumbnailSettings !== settings) disposeThumbnails();
      if (!thumbnailController) {
        thumbnailHost = document.createElement('div'); thumbnailHost.style.cssText = `position:fixed;left:-4000px;top:0;width:${size}px;height:${size}px;`;
        document.body.append(thumbnailHost);
        thumbnailController = await mount(thumbnailHost, { ...input, mode: 'wheel', thumbnail: true, autoRotate: false });
        thumbnailSettings = settings;
      } else await thumbnailController.update({ ...input, mode: 'wheel', autoRotate: false });
      const type = input.type === 'image/png' ? 'image/png' : 'image/webp';
      const result = thumbnailController.capture(type, clamp(input.quality, .5, 1, .92));
      thumbnailIdleTimer = setTimeout(disposeThumbnails, 2500);
      return result;
    } catch (error) { disposeThumbnails(); throw error; }
  });
  thumbnailQueue = job.catch(() => {}); return job;
}

// A separate transparent renderer supplies actual wheel geometry for photo fitting.
// Cached snapshots are independent of this GPU context and must be treated as read-only.
const FACE_CACHE_LIMIT = 30, FACE_CACHE_PIXELS = 8 * 1024 * 1024, FACE_IDLE_MS = 10000;
const faceCache = new Map();
let faceQueue = Promise.resolve(), faceStudio = null, faceIdleTimer;

function photoLightOptions(input = {}) {
  const value = (name, min, max, fallback) => Number(clamp(input[name], min, max, fallback).toFixed(3));
  return Object.freeze({
    exposure: value('exposure', .45, 1.5, .92),
    environmentIntensity: value('environmentIntensity', .15, 1.4, .78),
    keyIntensity: value('keyIntensity', .2, 5, 2.4),
    keyAzimuth: value('keyAzimuth', -Math.PI, Math.PI, -.9),
    keyElevation: value('keyElevation', .1, 1.4, .95),
    warmth: value('warmth', -1, 1, 0),
    // An optional caliper is shown only when the caller has observed one in the
    // source photo. The default rotor intentionally makes no claim about brakes.
    caliper: input.caliper === true,
    brakeColor: hex(input.brakeColor, '#3b4146'),
    brakeSide: input.brakeSide === -1 ? -1 : 1,
  });
}

function faceOptions(input) {
  const opts = options({ ...input, color: hex(input.colorHex, hex(input.color, DEFAULT_WHEEL_COLOUR)), autoRotate: false });
  return {
    design: opts.design, color: opts.color, finish: opts.finish,
    lip: ['same', 'polished', 'chrome', 'machined', 'black'].includes(opts.lip) ? opts.lip : 'same',
    cap: ['none', 'same', 'body', 'silver', 'black', 'carbon'].includes(opts.cap) ? opts.cap : 'black',
    diameter: opts.diameter, width: opts.width, bolts: Math.round(opts.bolts), mirror: Boolean(input.mirror),
    size: Math.round(clamp(input.size, 256, 1024, 512)),
    yaw: Number(clamp(input.yaw, -1.2, 1.2, 0).toFixed(4)),
    pitch: Number(clamp(input.pitch, -.8, .8, 0).toFixed(4)),
    photoLight: photoLightOptions(input.photoLight && typeof input.photoLight === 'object' ? input.photoLight : {}),
  };
}

function outdoorFaceEnvironment(renderer) {
  // A linear HDR sky hemisphere supplies broad outdoor reflections. The lower
  // hemisphere is deliberately darker: a wheel mounted on a car sees the road
  // and wheel well, not the surrounding white softboxes of the product studio.
  const width = 512, height = 256, pixels = new Float32Array(width * height * 4);
  const sky = new THREE.Color(), reflection = new THREE.Color(), ground = new THREE.Color(.17, .18, .17);
  const direction = new THREE.Vector3(), sun = new THREE.Vector3(-.66, .71, .24).normalize();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = (x + .5) / width * TAU, latitude = (y + .5) / height * Math.PI;
    // DataTexture row zero is v=0; Three's equirectangular sampling maps that
    // row to the lower hemisphere, so elevation increases with the row index.
    direction.set(Math.sin(latitude) * Math.cos(longitude), -Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude));
    const elevation = direction.y, upper = THREE.MathUtils.smoothstep(elevation, -.09, .8);
    // A metal face reflects the horizon almost directly. Keep that hemisphere
    // bright enough to represent daylight radiance; an LDR-looking value of .1
    // would turn silver aluminium almost black after exposure and tone mapping.
    sky.setRGB(1.35 + upper * .45, 1.39 + upper * .48, 1.46 + upper * .54);
    reflection.copy(sky);
    if (elevation < .28) {
      const landscape = .78 + .1 * Math.sin(longitude * 5.1) + .07 * Math.cos(longitude * 13.7);
      const horizon = THREE.MathUtils.smoothstep(elevation, -.75, .28);
      reflection.copy(ground).multiplyScalar(landscape).lerp(sky, horizon);
    }
    // A broad highlight represents a bright patch of sky, not a sharp studio
    // strip. Actual light direction and strength are adjusted per photograph.
    const brightSky = 2.3 * Math.exp((direction.dot(sun) - 1) * 24);
    const index = (y * width + x) * 4;
    pixels[index] = reflection.r + brightSky;
    pixels[index + 1] = reflection.g + brightSky;
    pixels[index + 2] = reflection.b + brightSky * .96;
    pixels[index + 3] = 1;
  }
  const skyTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyTexture.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(skyTexture);
  skyTexture.dispose(); pmrem.dispose(); return environment;
}

function createFaceStudio() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.052, 1.052, 1.052, -1.052, .01, 15);
  camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
  const environment = outdoorFaceEnvironment(renderer);
  scene.environment = environment.texture; scene.environmentIntensity = .58;
  // A side-biased key reveals the spoke dishes; restrained fill preserves depth.
  const key = new THREE.DirectionalLight('#fffdf7', 3.1); key.position.set(-4.5, 5.5, 2.8);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.65, right: 1.65, top: 1.65, bottom: -1.65, near: .1, far: 14 });
  key.shadow.normalBias = .01; key.shadow.bias = .00015; scene.add(key);
  const fill = new THREE.DirectionalLight('#e0e8f1', .32); fill.position.set(4, .5, 2.5); scene.add(fill);
  const edge = new THREE.DirectionalLight('#ffffff', 1); edge.position.set(3, 4, -3); scene.add(edge);
  return { renderer, scene, camera, environment, key, fill, edge };
}

function setFaceLight(studio, light) {
  studio.renderer.toneMappingExposure = light.exposure;
  studio.scene.environmentIntensity = light.environmentIntensity;
  studio.scene.environmentRotation.y = light.keyAzimuth + .9;
  const horizontal = Math.cos(light.keyElevation) * 7;
  studio.key.position.set(Math.sin(light.keyAzimuth) * horizontal, Math.sin(light.keyElevation) * 7, Math.cos(light.keyAzimuth) * horizontal);
  studio.key.intensity = light.keyIntensity;
  const tint = new THREE.Color('#f7f7f4');
  tint.lerp(new THREE.Color(light.warmth >= 0 ? '#ffe5bf' : '#d8e8ff'), Math.abs(light.warmth) * .35);
  studio.key.color.copy(tint);
  studio.fill.intensity = Math.min(.5, .19 + light.environmentIntensity * .16);
  studio.edge.intensity = .32;
}

function rotorSurface() {
  const size = 512, pixels = new Uint8Array(size * size * 4);
  let seed = 317;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const radius = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2;
    const turning = Math.sin(radius * 1450) * 7 + Math.sin(radius * 293) * 3;
    const grain = ((seed >>> 24) / 255 - .5) * 8;
    const value = Math.round(188 + turning + grain), index = (y * size + x) * 4;
    pixels[index] = value; pixels[index + 1] = value; pixels[index + 2] = value; pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; return texture;
}

function addFaceBrakes(group, face, light) {
  // This black backing is drawn first, without writing depth. Its projection follows
  // the outer rim exactly, so the original photograph's spokes never shine through.
  // The 0.004-unit black perimeter is only a rim edge, not an added tyre.
  const backing = mesh(new THREE.CircleGeometry(1.032, 192), new THREE.MeshBasicMaterial({ color: '#090c0e', side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false }), group);
  backing.position.z = face; backing.renderOrder = -100;
  // This compositing seal must never cast a solid-disc shadow onto the real brake.
  backing.castShadow = backing.receiveShadow = false;
  // The brake is deliberately neutral: this is a wheel-design illustration, not a
  // claim that the photographed vehicle has these particular brake components.
  const brake = new THREE.MeshStandardMaterial({ color: '#686a67', roughness: .72, metalness: .65, envMapIntensity: .42 });
  const rotor = mesh(new THREE.CylinderGeometry(.79, .79, .045, 160), brake, group);
  rotor.rotation.x = Math.PI / 2; rotor.position.z = -.2;
  const wornFace = mesh(new THREE.CircleGeometry(.788, 160), brake.clone(), group);
  wornFace.material.map = rotorSurface(); wornFace.position.z = -.177;
  const hat = mesh(new THREE.CylinderGeometry(.3, .3, .034, 96), new THREE.MeshStandardMaterial({ color: '#171816', metalness: .5, roughness: .6, envMapIntensity: .2 }), group);
  hat.rotation.x = Math.PI / 2; hat.position.z = -.164;
  const grooves = new THREE.MeshStandardMaterial({ color: '#242623', metalness: .55, roughness: .79, envMapIntensity: .12 });
  for (const radius of [.48, .55, .62, .69, .765]) {
    const ring = mesh(new THREE.TorusGeometry(radius, .0016, 6, 160), grooves, group);
    ring.position.z = -.176; ring.castShadow = false;
  }
  if (light.caliper) {
    const profile = new THREE.Shape();
    profile.moveTo(-.11, -.28); profile.quadraticCurveTo(-.16, -.27, -.16, -.2);
    profile.lineTo(-.16, .2); profile.quadraticCurveTo(-.16, .27, -.11, .28);
    profile.lineTo(.11, .28); profile.quadraticCurveTo(.16, .27, .16, .2);
    profile.lineTo(.16, -.2); profile.quadraticCurveTo(.16, -.27, .11, -.28); profile.closePath();
    const caliper = mesh(beveled(profile, .105, .024), new THREE.MeshPhysicalMaterial({ color: light.brakeColor, metalness: .55, roughness: .38, clearcoat: .3, clearcoatRoughness: .24 }), group);
    caliper.position.set(light.brakeSide * .61, .13, -.16);
    caliper.rotation.z = light.brakeSide * -.16;
    const bridge = mesh(new THREE.BoxGeometry(.22, .09, .11), caliper.material, group);
    bridge.position.set(light.brakeSide * .61, .13, -.12);
  }
}

/** Release only the temporary face renderer; existing wheel/car showrooms are untouched. */
export function disposeWheelFaces({ clearCache = false } = {}) {
  clearTimeout(faceIdleTimer); faceIdleTimer = null;
  if (faceStudio) {
    const studio = faceStudio; faceStudio = null;
    studio.scene.traverse(object => { object.shadow?.map?.dispose(); object.shadow?.mapPass?.dispose(); });
    disposeObject(studio.scene); studio.environment.dispose();
    studio.renderer.dispose(); studio.renderer.forceContextLoss(); studio.renderer.domElement.remove();
  }
  // Do not resize cached canvases: callers may still be displaying their snapshots.
  if (clearCache) faceCache.clear();
}

/**
 * Return a PNG and independent 2D canvas of a centred, transparent-background wheel.
 * yaw/pitch are radians. For the default straight-on face, `radius` is the outer rim
 * radius in pixels. `rimBasis` is the projected front-plane circle basis [a,b,c,d]
 * in raster coordinates (x right, y down), with the rim-face centre as origin.
 * Fit that basis to the target ellipse to preserve parallax without foreshortening twice.
 * Optional photoLight sets exposure, environmentIntensity, keyIntensity,
 * keyAzimuth/keyElevation (radians) and warmth (-1 cool, +1 warm). An observed
 * caliper can be enabled with caliper:true, brakeColor and brakeSide (-1/+1).
 * Output is capped at 1024 px; all light values participate in the bounded cache.
 */
export function renderWheelFace(input = {}) {
  const opts = faceOptions(input);
  const job = faceQueue.then(async () => {
    await ensureCapLogo();
    await prepareWheelGeometry(opts.design, input.signal);
    const cacheKey = JSON.stringify([capLogoRevision, opts]);
    clearTimeout(faceIdleTimer);
    if (faceCache.has(cacheKey)) {
      const cached = faceCache.get(cacheKey);
      faceCache.delete(cacheKey); faceCache.set(cacheKey, cached);
      if (faceStudio) faceIdleTimer = setTimeout(disposeWheelFaces, FACE_IDLE_MS);
      return cached;
    }
    let assembly;
    try {
      faceStudio ||= createFaceStudio();
      const { renderer, scene, camera } = faceStudio;
      setFaceLight(faceStudio, opts.photoLight);
      if (renderer.getContext().isContextLost()) throw new Error('Kontext 3D náhledu kola není dostupný.');
      assembly = new THREE.Group();
      const wheel = createWheel(opts), face = frontPlane(opts.design);
      // The recessed barrel receives less open-room reflection than the exposed
      // machined face. Keep it a rougher, shaded cavity instead of a bright bowl.
      const barrel = wheel.children.find(item => item.geometry?.type === 'LatheGeometry');
      if (barrel?.material) {
        barrel.material.color.multiplyScalar(.22);
        barrel.material.envMapIntensity *= .22;
        barrel.material.roughness = Math.max(.58, barrel.material.roughness);
      }
      // The exposed lip sees the sky, but recessed spoke roots and bevel sides
      // receive less light inside the wheel well. This affects only this temporary
      // photo wheel, never the editable studio or its selected material colour.
      const occludedMaterials = new Map(), shadedGeometries = new Set();
      for (const part of wheel.children) {
        if (part.geometry?.type !== 'ExtrudeGeometry' && !part.geometry?.userData.wheelSpoke) continue;
        const positions = part.geometry.attributes.position, normals = part.geometry.attributes.normal;
        if (!shadedGeometries.has(part.geometry)) {
          const colours = new Float32Array(positions.count * 3), originalColours = part.geometry.attributes.color;
          for (let index = 0; index < positions.count; index++) {
            const depth = THREE.MathUtils.smoothstep(positions.getZ(index) + part.position.z, -.08, face);
            const front = THREE.MathUtils.smoothstep(Math.abs(normals.getZ(index)), .25, .96);
            const ambientOcclusion = (.7 + depth * .3) * (.78 + front * .22);
            for (let channel = 0; channel < 3; channel++) colours[index * 3 + channel] = ambientOcclusion * (originalColours ? originalColours.array[index * 3 + channel] : 1);
          }
          part.geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
          shadedGeometries.add(part.geometry);
        }
        // The original material also belongs to lips and seats without a colour
        // attribute. Only these extruded faces use the ambient-occlusion variant.
        const shade = originalMaterial => {
          if (!occludedMaterials.has(originalMaterial)) {
            const material = originalMaterial.clone(); material.vertexColors = true;
            occludedMaterials.set(originalMaterial, material);
          }
          return occludedMaterials.get(originalMaterial);
        };
        part.material = Array.isArray(part.material) ? part.material.map(shade) : shade(part.material);
      }
      // A spoke-only source material may no longer be referenced after the
      // shaded variant replaces it; texture ownership remains with the clones.
      for (const originalMaterial of occludedMaterials.keys()) {
        if (!wheel.children.some(part => (Array.isArray(part.material) ? part.material : [part.material]).includes(originalMaterial))) originalMaterial.dispose();
      }
      addFaceBrakes(wheel, face, opts.photoLight);
      // Pitch/yaw pivot about the rim face, preserving the centre of its ellipse.
      wheel.position.z = -face; assembly.add(wheel);
      assembly.rotation.set(opts.pitch, opts.yaw, 0, 'YXZ');
      scene.add(assembly); assembly.updateMatrixWorld(true);
      let extent = 1.052;
      if (opts.yaw || opts.pitch) {
        const box = new THREE.Box3().setFromObject(assembly);
        extent = Math.max(extent, Math.abs(box.min.x) + .02, Math.abs(box.max.x) + .02, Math.abs(box.min.y) + .02, Math.abs(box.max.y) + .02);
      }
      camera.left = camera.bottom = -extent; camera.right = camera.top = extent;
      camera.updateProjectionMatrix(); renderer.setSize(opts.size, opts.size, false);
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) throw new Error('3D náhled kola se nepodařilo dokončit.');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = opts.size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Rastrový náhled kola není dostupný.');
      context.drawImage(renderer.domElement, 0, 0);
      const radius = opts.size * 1.032 / (2 * extent), rotation = assembly.matrixWorld.elements;
      const rimBasis = Object.freeze([radius * rotation[0], -radius * rotation[1], -radius * rotation[4], radius * rotation[5]]);
      const snapshot = Object.freeze({
        canvas, src: canvas.toDataURL('image/png'), width: opts.size, height: opts.size,
        centerX: opts.size / 2, centerY: opts.size / 2, radius, rimBasis,
        yaw: opts.yaw, pitch: opts.pitch, options: Object.freeze({ ...opts })
      });
      faceCache.set(cacheKey, snapshot);
      let cachedPixels = [...faceCache.values()].reduce((sum, image) => sum + image.width * image.height, 0);
      while (faceCache.size > FACE_CACHE_LIMIT || cachedPixels > FACE_CACHE_PIXELS) {
        const oldest = faceCache.keys().next().value, removed = faceCache.get(oldest);
        faceCache.delete(oldest); cachedPixels -= removed.width * removed.height;
      }
      assembly.removeFromParent(); disposeObject(assembly); assembly = null;
      faceIdleTimer = setTimeout(disposeWheelFaces, FACE_IDLE_MS);
      return snapshot;
    } catch (error) {
      if (assembly) { assembly.removeFromParent(); disposeObject(assembly); }
      disposeWheelFaces(); throw error;
    }
  });
  faceQueue = job.catch(() => {}); return job;
}

window.NFWShowroom = { mount, createWheel, prepareWheelGeometry, supports3DDesign, renderThumbnail, disposeThumbnails, renderWheelFace, disposeWheelFaces, ensureCapLogo, get capLogoReady() { return ensureCapLogo(); }, version: '2.0.0', threeVersion: THREE.REVISION };
window.dispatchEvent(new CustomEvent('nfw:showroom-ready'));
