/** Offline solid-mesh, source registration and portable GLB checks.
 * Run: node tools/check-wheel-reconstruction-geometry.mjs [repo-root]
 * Prepare only the synthetic regression fixtures: add --fixtures-only.
 * Staged JSON build: add --skip-projects --json-only; default checks every GLB.
 * Recheck changed designs only: --models=id1,id2 (registry validation is retained).
 * After a complete live check, compare the new exports: --export-parity-only.
 * Uses the checked-in Three module; no browser, network or source mutations.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const exportParityOnly = args.includes('--export-parity-only');
const requestedModels = new Set((args.find(value => value.startsWith('--models='))?.slice(9) || '').split(',').filter(Boolean));
const root = path.resolve(args.find(value => !value.startsWith('--'))
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
for (const flag of args.filter(value => value.startsWith('--'))) {
  assert(['--fixtures-only', '--skip-projects', '--json-only', '--export-parity-only'].includes(flag) || /^--models=[a-z0-9,-]+$/.test(flag), 'Unknown argument: ' + flag);
}
assert(!exportParityOnly || !args.includes('--json-only'), 'Export parity requires portable GLBs.');
const THREE = await import(pathToFileURL(path.join(root, 'assets/vendor/three/three.module.js')));
const { buildPhotoWheel } = await import(pathToFileURL(path.join(root, 'js/wheel-reconstruction.js')));
const { MeshoptDecoder } = await import(pathToFileURL(path.join(root, 'assets/vendor/meshoptimizer/meshopt_decoder.mjs')));
await MeshoptDecoder.ready;
let assertions = 0;
const check = (condition, message) => { assertions++; assert(condition, message); };
const readJSON = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const near = (a, b, tolerance = .000002) => Math.abs(a - b) <= tolerance;
const reflectiveChrome = material => material.metalness === 1
  && material.roughness >= .12 && material.roughness <= .16
  && material.clearcoat === .8 && material.clearcoatRoughness >= .1
  && material.clearcoatRoughness <= .14 && material.anisotropy === 0;

function solidMeshes(wheel) {
  const meshes = [];
  wheel.traverse(part => { if (part.isMesh) meshes.push(part); });
  return meshes;
}

function checkOartsCap(wheel, id) {
  const caps = [];
  wheel.traverse(part => { if (part.name === 'OARTS_center_cap') caps.push(part); });
  check(caps.length === 1 && caps[0].isGroup, `${id}: one actual OARTS cap assembly is required`);
  const cap = caps[0], meshes = solidMeshes(cap);
  check(cap.userData.brand === 'OARTS' && cap.userData.logoSource === 'assets/brand/oarts-logo.png'
    && cap.userData.logoTechnique === 'extruded-approved-alpha-contours', `${id}: approved OARTS emblem missing`);
  const glyphs = meshes.filter(part => part.name.startsWith('OARTS_logo_'));
  check(glyphs.length === 6 && glyphs.some(part => part.name === 'OARTS_logo_star'),
    `${id}: solid OARTS letters or reference star missing`);
  check(['OARTS_cap_turned_shell', 'OARTS_cap_enamel', 'OARTS_cap_polished_bezel', 'OARTS_cap_recess_seal']
    .every(name => meshes.some(part => part.name === name)), `${id}: cap body, enamel, bezel or seal missing`);
  const bounds = new THREE.Box3().setFromObject(cap), size = bounds.getSize(new THREE.Vector3());
  check(near(bounds.min.x + bounds.max.x, 0, .00001) && near(bounds.min.y + bounds.max.y, 0, .00001)
    && size.x > .1 && size.x < .46 && size.z > .02 && size.z < .08,
  `${id}: OARTS badge is not a physical centred cap`);
  check(glyphs.every(part => {
    part.geometry.computeBoundingBox();
    return part.geometry.boundingBox.max.z - part.geometry.boundingBox.min.z > .0005
      && !part.material.map && part.material.metalness > .5;
  }), `${id}: OARTS lettering is a flat image rather than modeled metal`);
  check(new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1))
    .intersectObject(cap, true).length > 0, `${id}: the OARTS cap is invisible or leaves the centre open`);
  check(glyphs.every(glyph => {
    const positions = glyph.geometry.attributes.position, normals = glyph.geometry.attributes.normal;
    const indices = glyph.geometry.index;
    for (let i = 0; i < (indices?.count || positions.count); i += 3) {
      const vertices = [0, 1, 2].map(offset => indices ? indices.getX(i + offset) : i + offset);
      if (!vertices.every(vertex => normals.getZ(vertex) > .99)) continue;
      const point = vertices.reduce((center, vertex) => center.add(new THREE.Vector3().fromBufferAttribute(positions, vertex)), new THREE.Vector3())
        .multiplyScalar(1 / 3).applyMatrix4(glyph.matrixWorld);
      return new THREE.Raycaster(new THREE.Vector3(point.x, point.y, 2), new THREE.Vector3(0, 0, -1))
        .intersectObject(wheel, true)[0]?.object === glyph;
    }
    return false;
  }), `${id}: source metal covers an actual OARTS letter`);
  return { meshes: meshes.length, glyphs: glyphs.length };
}

function isSolidAssembly(wheel) {
  return wheel.children.every(part => part.isMesh || (part.isGroup && part.name === 'OARTS_center_cap'))
    && solidMeshes(wheel).every(part => !['PlaneGeometry', 'CircleGeometry'].includes(part.geometry.type));
}

function fixtures() {
  const circle = (x, y, r, count = 48) => Array.from({ length: count }, (_, i) => [
    x + r * Math.cos(i * Math.PI * 2 / count), y + r * Math.sin(i * Math.PI * 2 / count),
  ]);
  const record = {
    id: 'asymmetric-trace', coordinateSystem: 'unit-radius-y-up',
    shapes: [{ outer: circle(0, 0, 1, 96), holes: [circle(.5, 0, .12, 24), circle(0, 0, .07, 24)] }],
    profile: { radius: 1.032, frontZ: .33, concavity: .12, faceThickness: .06, bevel: .0025 },
    source: { src: 'source-reference.webp', rectificationApproximate: true },
  };
  const objects = [], build = (data = record, opts = {}) => {
    const wheel = buildPhotoWheel(THREE, data, opts); objects.push(wheel); wheel.updateMatrixWorld(true); return wheel;
  };
  const hit = (wheel, x, y, z = 2, direction = [0, 0, -1]) => new THREE.Raycaster(
    new THREE.Vector3(x, y, z), new THREE.Vector3(...direction),
  ).intersectObject(wheel, true);
  const dispose = object => {
    const materials = new Set(); object.traverse(item => {
      item.geometry?.dispose(); (Array.isArray(item.material) ? item.material : item.material ? [item.material] : [])
        .forEach(material => materials.add(material));
    }); materials.forEach(material => material.dispose());
  };

  try {
    const original = JSON.stringify(record), wheel = build(record, { color: '#936243', finish: 'chrome' });
    const mesh = wheel.children[0], geometry = mesh.geometry, positions = geometry.attributes.position, normals = geometry.attributes.normal;
    check(wheel.isGroup && wheel.children.length >= 2, 'Returns a solid assembly');
    check(isSolidAssembly(wheel), 'Solid source geometry and modeled OARTS cap; no photographic billboard');
    check(hit(wheel, .5 * 1.032, 0).length === 0, 'Off-centre source hole goes through the entire wheel');
    check(new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1))
      .intersectObject(mesh, false).length === 0, 'Original centre bore preserved in the actual face');
    checkOartsCap(wheel, record.id);
    check(hit(wheel, -.5 * 1.032, 0).length > 0, 'Solid source metal has an actual 3D front');
    check(hit(wheel, -.5 * 1.032, 0, -2, [0, 0, 1]).length > 0, 'Face solid has a real rear surface');
    check(positions.count / 3 > 1000 && positions.count / 3 < 80000, 'Curved face tessellated within budget');
    let finite = true, unitNormals = true, normalSlope = false;
    for (let i = 0; i < positions.count; i++) {
      finite &&= Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i));
      unitNormals &&= Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < .00001;
      if (normals.getZ(i) > .9 && Math.abs(normals.getX(i)) > .03) normalSlope = true;
    }
    check(finite && unitNormals, 'All positions finite and all normals unit length');
    check(normalSlope, 'Concavity changes the front normals');
    const edges = new Map(), key = i => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
    for (let i = 0; i < positions.count; i += 3) for (let j = 0; j < 3; j++) {
      const pair = [key(i + j), key(i + (j + 1) % 3)].sort();
      if (pair[0] !== pair[1]) { const edge = pair.join('/'); edges.set(edge, (edges.get(edge) || 0) + 1); }
    }
    check([...edges.values()].every(count => count === 2), 'Watertight triangulation, including cap/bevel/hole-wall joints');
    check(Math.abs(geometry.boundingBox.max.z - .33) < .00001, '+Z front matches showroom');
    check(Math.max(Math.abs(geometry.boundingBox.max.x), Math.abs(geometry.boundingBox.min.x)) <= 1.03201, 'Bevel does not grow the source rim silhouette');
    const barrel = wheel.children.find(item => item.geometry?.type === 'LatheGeometry');
    check(!!barrel && barrel.rotation.x === -Math.PI / 2
      && Array.from({ length: barrel.geometry.attributes.normal.count }, (_, i) => {
        const normal = barrel.geometry.attributes.normal;
        return near(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)), 1, .002);
      }).every(Boolean), 'Actual turned rear barrel has unit normals and follows showroom axis');
    const barrelBox = new THREE.Box3().setFromObject(barrel);
    check(Math.abs(barrelBox.min.z - (.33 - .9)) < .00001, 'Width/diameter determines rear plane');
    check(wheel.userData.reconstruction.approximateDepth && wheel.userData.reconstruction.approximateRear, 'Approximate depth metadata retained');
    check(wheel.userData.reconstruction.rectificationApproximate === true, 'Angled-source approximation flag retained');
    check(JSON.stringify(record) === original, 'Caller trace is not mutated');
    check(mesh.material[0].isMeshPhysicalMaterial && mesh.material[0].color.getHexString() === '936243', 'Colourable PBR front');
    check(reflectiveChrome(mesh.material[0]), 'Chrome retains reflective metal with a bounded, stable highlight width');
    check(geometry.groups.length === 2 && geometry.groups[0].materialIndex === 0 && geometry.groups[1].materialIndex === 1, 'Front and cut/rear materials separated');
    const mirrored = build(record, { mirror: true });
    check(hit(mirrored, -.5 * 1.032, 0).length === 0 && hit(mirrored, .5 * 1.032, 0).length > 0, 'Mirroring preserves asymmetric source topology');
    const flat = build({ ...record, profile: { ...record.profile, concavity: 0 } });
    check(hit(flat, -.5 * 1.032, 0)[0].point.z > hit(wheel, -.5 * 1.032, 0)[0].point.z + .02, 'Concavity is geometry rather than shading');
    const wide = build(record, { width: 12, diameter: 20 });
    check(new THREE.Box3().setFromObject(wide).min.z < new THREE.Box3().setFromObject(wheel).min.z - .17, 'Rear barrel actually changes with width');
    for (const [finish, roughness] of Object.entries({ gloss: .19, satin: .3, matte: .56, brushed: .34, chrome: .15 })) {
      const finished = build(record, { finish, colorHex: '#224466' });
      const surface = finished.children[0].material[0];
      check((finish === 'chrome' ? reflectiveChrome(surface) : surface.roughness === roughness)
        && surface.color.getHexString() === '224466', finish + ' and colour option');
    }
    const texture = new THREE.Texture(), textured = build(record, { faceTexture: texture });
    check(textured.children[0].material[0].map === texture && textured.children[0].material[1].map === null, 'Optional source texture only on actual front geometry');
    const sourceColour = build(record, { faceTexture: texture, color: '#936243', preserveSourceColour: true });
    check(sourceColour.children[0].material[0].color.getHexString() === 'ffffff'
      && sourceColour.children[0].material[1].color.getHexString() !== 'ffffff', 'Source front colour retained while cut/barrel keep selected colour');
    const uvs = textured.children[0].geometry.attributes.uv, pp = textured.children[0].geometry.attributes.position;
    check(Math.abs(uvs.getX(0) - (.5 + pp.getX(0) / (2 * 1.032))) < .00001 && Math.abs(uvs.getY(0) - (.5 + pp.getY(0) / (2 * 1.032))) < .00001, 'UVs align to normalized source photo');
    const mirroredTexture = build(record, { faceTexture: texture, mirror: true });
    const mu = mirroredTexture.children[0].geometry.attributes.uv, mp = mirroredTexture.children[0].geometry.attributes.position;
    check(Math.abs(mu.getX(0) - (.5 - mp.getX(0) / (2 * 1.032))) < .00001, 'Mirrored geometry samples matching original source texture coordinates');
    const detailedRecord = { ...record, source: { ...record.source, rectificationApproximate: false },
      provenance: { rectificationApproximate: true }, surfaceDetails: [
        { id: 'rib', outer: [[-.6, -.05], [-.4, -.05], [-.4, .05], [-.6, .05]], holes: [], height: .012, materialHint: 'metal' },
        { id: 'annular-relief', outer: circle(0, 0, .115), holes: [circle(0, 0, .085)], height: .008, materialHint: 'chrome' },
        { id: 'dark-detail', outer: circle(-.72, 0, .015), holes: [], height: .001, materialHint: 'dark' },
      ] };
    const detailed = build(detailedRecord), raised = detailed.children.filter(item => item.userData.surfaceDetail);
    check(raised.length === 3 && detailed.userData.reconstruction.surfaceDetails === 3, 'Optional observed relief creates separate actual solids');
    check(raised.every(item => item.geometry.userData.surfaceDetail && !('throughHoles' in item.geometry.userData)), 'Relief apertures never inflate base through-hole metadata');
    check(new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1))
      .intersectObject(detailed.children[0], false).length === 0 && hit(detailed, .5 * 1.032, 0).length === 0,
    'Observed relief preserves the source centre bore and main window beneath the OARTS cap');
    const lift = hit(detailed, -.5 * 1.032, 0)[0].point.z - hit(wheel, -.5 * 1.032, 0)[0].point.z;
    check(Math.abs(lift - .012) < .002, 'Raised top follows front concavity plus its observed height');
    check(reflectiveChrome(raised[1].material[0]) && raised[2].material[0].color.getHexString() === '141619', 'Chrome/dark detail materials remain separate');
    check(detailed.userData.reconstruction.rectificationApproximate === true, 'Rectification approximation read from provenance');
    const texturedDetails = build(detailedRecord, { faceTexture: texture, color: '#936243', preserveSourceColour: true }).children.filter(item => item.userData.surfaceDetail);
    check(texturedDetails[0].material[0].map === texture && texturedDetails[0].material[0].color.getHexString() === 'ffffff'
      && texturedDetails.slice(1).every(item => item.material[0].map === null),
    'Opt-in source texture affects traced metal; separate chrome/dark details keep physical materials');
    check(texturedDetails.every(item => item.material[1].map === null && item.material[1].color.getHexString() !== 'ffffff') && reflectiveChrome(texturedDetails[1].material[0]) && texturedDetails[2].material[0].roughness === .4, 'Relief cut edges and material roughness hints remain independent');

    // Reproduce a Three extrusion corner with zero normals, plus a truly zero-
    // area triangle. The valid solid itself stays the real local Three output.
    class CornerNormalExtrude extends THREE.ExtrudeGeometry {
      constructor(...args) {
        super(...args);
        const p = this.attributes.position, n = this.attributes.normal;
        let corner = -1;
        for (let i = 0; i < n.count; i += 3) {
          if (Math.abs(n.getZ(i)) > .05 && Math.abs(n.getZ(i)) < .95) { corner = i; break; }
        }
        assert(corner >= 0, 'Regression fixture needs an actual bevel triangle');
        for (let i = corner; i < corner + 3; i++) n.setXYZ(i, 0, 0, 0);
        const point = [p.getX(corner), p.getY(corner), p.getZ(corner)];
        this.setAttribute('position', new THREE.Float32BufferAttribute([...p.array, ...point, ...point, ...point], 3));
        this.setAttribute('normal', new THREE.Float32BufferAttribute([...n.array, ...Array(9).fill(0)], 3));
      }
    }
    const repaired = buildPhotoWheel({ ...THREE, ExtrudeGeometry: CornerNormalExtrude }, record);
    objects.push(repaired); repaired.updateMatrixWorld(true);
    const repairedGeometry = repaired.children[0].geometry, repairedNormals = repairedGeometry.attributes.normal;
    check(repairedGeometry.userData.repairedZeroNormals > 0 && repairedGeometry.userData.removedDegenerateTriangles > 0,
      'Actual zero-normal bevel repaired and zero-area triangle removed');
    check(Array.from({ length: repairedNormals.count }, (_, i) => near(Math.hypot(
      repairedNormals.getX(i), repairedNormals.getY(i), repairedNormals.getZ(i)), 1, .002)).every(Boolean),
    'Repaired bevel normals are finite and unit length');
    check(repairedGeometry.groups.reduce((sum, group) => sum + group.count, 0) === repairedGeometry.attributes.position.count,
      'Removing zero-area triangles preserves complete front/cut material groups');
    check(hit(repaired, .5 * 1.032, 0).length === 0 && hit(repaired, -.5 * 1.032, 0).length > 0,
      'Bevel normal repair preserves independently located opening and solid metal');

    texture.dispose();
    const closed = circle(0, 0, 1, 48); closed.push(closed[0], closed[0]);
    check(build({ ...record, shapes: [{ outer: closed, holes: [] }] }).children.length >= 2, 'Closed/repeated endpoints normalized safely');
    for (const bad of [null, { ...record, shapes: [] }, { ...record, coordinateSystem: 'pixels' },
      { ...record, shapes: [{ outer: [[0, 0], [1, 0], [NaN, 1]] }] },
      { ...record, shapes: [{ outer: circle(0, 0, .5), holes: [circle(.7, 0, .05)] }] },
      { ...detailedRecord, surfaceDetails: [{ ...detailedRecord.surfaceDetails[0], height: 0 }] }]) {
      let failed = false;
      try { buildPhotoWheel(THREE, bad); } catch (error) { failed = error.code === 'NFW_WHEEL_RECONSTRUCTION_INVALID'; }
      check(failed, 'Invalid/absent trace rejects, never substitutes a generic wheel');
    }

    return { checks: assertions, watertightEdges: edges.size, faceTriangles: positions.count / 3 };
  } finally { objects.forEach(dispose); }
}

function disposeWheel(wheel) {
  const materials = new Set();
  wheel.traverse(part => {
    part.geometry?.dispose();
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      if (material) materials.add(material);
    }
  });
  materials.forEach(material => material.dispose());
}

function referenceExpectations() {
  const references = new Map();
  for (const suffix of ['e6-references', 'ready-project-references', 'motivo-references']) {
    for (const record of readJSON(`data/wheel-reconstruction-${suffix}.json`).records) {
      references.set(record.id || record.designId, { ...record });
    }
  }
  for (const suffix of ['e6-trace-overrides', 'ready-project-trace-overrides', 'trace-overrides']) {
    const relative = `data/wheel-reconstruction-${suffix}.json`;
    if (!fs.existsSync(path.join(root, relative))) continue;
    const document = readJSON(relative);
    for (const [id, override] of Object.entries(document.overrides || document)) {
      references.set(id, { ...references.get(id), ...override });
    }
  }
  return references;
}

function area(points) {
  return Math.abs(points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

// A concave opening's centroid can lie on metal. Use an interior point in its
// largest source-polygon triangle, independent of the generated mesh/metadata.
function apertureInterior(points, radius) {
  const polygon = points.map(point => new THREE.Vector2(...point));
  let interior, largest = 0;
  for (const indices of THREE.ShapeUtils.triangulateShape(polygon, [])) {
    const [a, b, c] = indices.map(index => polygon[index]);
    const twiceArea = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (twiceArea > largest) {
      largest = twiceArea;
      interior = new THREE.Vector2((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
    }
  }
  check(!!interior, 'Source aperture has a nondegenerate interior');
  return interior.multiplyScalar(radius);
}

function apertureIsOpen(baseFaces, points, radius) {
  const point = apertureInterior(points, radius);
  return new THREE.Raycaster(new THREE.Vector3(point.x, point.y, 2), new THREE.Vector3(0, 0, -1))
    .intersectObjects(baseFaces, false).length === 0;
}

// A steep photograph's source ellipse is corrected only in the generated trace.
// Independent annotations use the same declared inverse mapping before testing
// the resulting physical face, rather than sampling their original photo frame.
function correctedAnnotation(points, correction, mirror = false) {
  return points.map(point => {
    let [x, y] = point;
    if (correction) {
      const [dx, dy] = correction.centerOffset;
      for (let i = 0; i < 12; i++) {
        const influence = Math.max(0, 1 - x * x - y * y);
        x = point[0] - dx * influence; y = point[1] - dy * influence;
      }
      x = Math.round(x * 1e7) / 1e7; y = Math.round(y * 1e7) / 1e7;
    }
    return [mirror ? -x : x, y];
  });
}

function projectRegistration(record, surface) {
  check(record.source.src === surface.src, `${record.id}: geometry and front surface source differ`);
  assert.deepEqual(record.source.faceEllipse, surface.faceEllipse, `${record.id}: geometry/surface ellipse differs`);
  assert.deepEqual(record.surfaceSource?.faceEllipse, surface.faceEllipse, `${record.id}: surface ellipse missing/different`);
  check(record.surfaceSource?.src === surface.src, `${record.id}: front surface is not registered`);
  check(record.source.kind === surface.kind, `${record.id}: real photo/technical source mislabelled`);
  check(sha256(fs.readFileSync(path.join(root, surface.src))) === surface.sha256,
    `${record.id}: original project photograph changed`);
  check(record.source.width === surface.width && record.source.height === surface.height,
    `${record.id}: native source dimensions differ`);
}

function parseGLB(bytes, id) {
  check(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, `${id}: invalid GLB header`);
  check(bytes.readUInt32LE(8) === bytes.length, `${id}: invalid GLB length`);
  check(bytes.length < 25 * 1024 * 1024, `${id}: GLB exceeds platform file limit`);
  const jsonLength = bytes.readUInt32LE(12);
  check(bytes.readUInt32LE(16) === 0x4e4f534a, `${id}: GLB JSON chunk missing`);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 28 + jsonLength;
  check(bytes.readUInt32LE(24 + jsonLength) === 0x004e4942, `${id}: GLB binary chunk missing`);
  const binary = bytes.subarray(binStart);
  check(bytes.readUInt32LE(20 + jsonLength) === binary.length
    && document.buffers[0].byteLength === binary.length, `${id}: GLB binary length mismatch`);
  const cached = new Map(), views = new Map();
  function bufferView(index) {
    if(views.has(index))return views.get(index);
    const view=document.bufferViews[index], compression=view.extensions?.EXT_meshopt_compression;
    let data;
    if(compression) {
      check(MeshoptDecoder.supported && document.extensionsRequired?.includes('EXT_meshopt_compression'),
        `${id}: required lossless geometry decoder is missing`);
      check(compression.buffer===0 && compression.filter==='NONE'
        && ['ATTRIBUTES','INDICES'].includes(compression.mode), `${id}: geometry compression uses an unreviewed lossy filter or index order`);
      const start=compression.byteOffset||0, count=compression.count, stride=compression.byteStride;
      const validStride = Number.isInteger(stride) && (compression.mode==='ATTRIBUTES'
        ? stride>=4 && stride<=256 && stride%4===0 : [2,4].includes(stride));
      check(Number.isInteger(count) && count>0 && validStride
        && count*stride===view.byteLength && start>=0 && start+compression.byteLength<=binary.length,
        `${id}: compressed geometry buffer exceeds its declared bounds`);
      data=new Uint8Array(view.byteLength);
      MeshoptDecoder.decodeGltfBuffer(data,count,stride,binary.subarray(start,start+compression.byteLength),compression.mode,'NONE');
    }else{
      const start=view.byteOffset||0;
      check(view.buffer===0 && start>=0 && start+view.byteLength<=binary.length,
        `${id}: geometry buffer exceeds the binary chunk`);
      data=binary.subarray(start,start+view.byteLength);
    }
    views.set(index,data);return data;
  }
  function accessor(index) {
    if (cached.has(index)) return cached.get(index);
    const entry = document.accessors[index], view = document.bufferViews[entry.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[entry.type];
    const Type = { 5126: Float32Array, 5125: Uint32Array }[entry.componentType];
    check(!!width && !!Type && !view.byteStride && !entry.sparse && !entry.normalized,
      `${id}: unsupported/malformed mesh accessor`);
    const data=bufferView(entry.bufferView), start=entry.byteOffset||0, count=entry.count*width;
    check(start>=0 && start+count*4<=data.byteLength, `${id}: accessor exceeds binary bounds`);
    const values = new Type(data.buffer, data.byteOffset + start, count);
    check(values.every(Number.isFinite), `${id}: exported accessor contains a nonfinite number`);
    const result = { values, width, count: entry.count, componentType: entry.componentType };
    cached.set(index, result);
    return result;
  }
  return { document, binary, accessor, bufferView };
}

// Read JPEG SOF dimensions without decoding pixels or loading a native library.
function jpegDimensions(bytes) {
  assert(bytes.readUInt16BE(0) === 0xffd8, 'Rectified source is not a JPEG');
  let cursor = 2;
  while (cursor < bytes.length) {
    assert(bytes[cursor++] === 0xff, 'Invalid JPEG marker');
    while (bytes[cursor] === 0xff) cursor++;
    const marker = bytes[cursor++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const length = bytes.readUInt16BE(cursor);
    assert(length >= 2 && cursor + length <= bytes.length, 'Invalid JPEG segment length');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(cursor + 5), height: bytes.readUInt16BE(cursor + 3) };
    }
    cursor += length;
  }
  throw new Error('JPEG source has no frame dimensions');
}

function checkGLB(entry, record, wheel, surfaceBytes) {
  const id = record.id, bytes = fs.readFileSync(path.join(root, entry.glb));
  check(sha256(bytes) === entry.glbSha256, `${id}: exported GLB hash differs from registry`);
  check(entry.glbRevision === entry.glbSha256.slice(0, 16), `${id}: portable model cache key ignores its actual geometry`);
  const { document, binary, accessor } = parseGLB(bytes, id);
  check(document.asset.version === '2.0' && document.extras.design === id, `${id}: exported model identity differs`);
  check(document.extras.approximateDepth && document.extras.notManufacturingCAD, `${id}: GLB overstates measured geometry`);
  const liveMeshes = solidMeshes(wheel);
  check(document.meshes.length === liveMeshes.length, `${id}: exported solid/detail count differs, including the nested OARTS cap`);
  check((document.images?.length || 0) === (surfaceBytes ? 1 : 0), `${id}: unexpected or absent photographic surface`);
  if (surfaceBytes) {
    const image = document.images[0], view = document.bufferViews[image.bufferView];
    check(image.mimeType === 'image/jpeg', `${id}: exported source surface is not JPEG`);
    const embedded = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    check(embedded.equals(surfaceBytes), `${id}: embedded image differs from the reviewed rectified source`);
    const size = record.surfaceTextureSize ?? 1024, dimensions = jpegDimensions(embedded);
    check([1024, 2048].includes(size) && dimensions.width === size && dimensions.height === size,
      `${id}: embedded photograph dimensions differ from surfaceTextureSize`);
    check(document.textures?.length === 1 && document.textures[0].source === 0,
      `${id}: front texture does not reference the embedded source image`);
    const sampler = document.samplers?.[document.textures[0].sampler];
    check(sampler?.wrapS === 33071 && sampler.wrapT === 33071,
      `${id}: photographic surface can repeat across the rim edge`);
  }
  // GLTF permits repeated node/mesh names (for example the five mounting
  // wells). Match the exported traversal by index and check each real solid.
  const expectedMeshes = new Set(liveMeshes);
  check(document.meshes.filter(mesh => mesh.name.startsWith('OARTS_logo_')).length === 6,
    `${id}: portable GLB omits modeled OARTS lettering or reference star`);
  const scene = document.scenes[document.scene ?? 0];
  assert.deepEqual([...scene.nodes].sort((a, b) => a - b), document.nodes.map((_, i) => i),
    `${id}: an exported solid is unreachable from the active scene`);
  check(document.nodes.length === document.meshes.length
    && new Set(document.nodes.map(node => node.mesh)).size === document.meshes.length,
    `${id}: exported scene loses or duplicates a wheel solid`);
  for (const node of document.nodes) {
    const live = liveMeshes[node.mesh];
    check(!!live && node.matrix?.length === 16
      && document.meshes[node.mesh]?.name === live.name
      && node.matrix.every((value, i) => near(value, live.matrixWorld.elements[i])),
    `${id}: exported position/rotation/scale differs, including the rear barrel axis`);
  }
  let triangles = 0, sourceUVs = 0;
  for (const [meshIndex, mesh] of document.meshes.entries()) {
    const live = liveMeshes[meshIndex];
    check(!!live && mesh.name === live.name, `${id}: exported mesh has no corresponding actual solid`);
    expectedMeshes.delete(live);
    const geometry = live.geometry, position = geometry.attributes.position;
    const normal = geometry.attributes.normal, uv = geometry.attributes.uv;
    const sourceCount = geometry.index?.count ?? position.count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: sourceCount, materialIndex: 0 }];
    check(mesh.primitives.length === groups.length, `${id}: front/cut groups lost during export`);
    for (let groupIndex = 0; groupIndex < mesh.primitives.length; groupIndex++) {
      const primitive = mesh.primitives[groupIndex], group = groups[groupIndex];
      const material = document.materials[primitive.material];
      const expected = Array.isArray(live.material) ? live.material[group.materialIndex] : live.material;
      const pbr = material.pbrMetallicRoughness;
      check(pbr.baseColorFactor.length === 4 && pbr.baseColorFactor[3] === 1
        && (!material.alphaMode || material.alphaMode === 'OPAQUE'),
      `${id}/${mesh.name}: solid metal is invisible or unexpectedly transparent`);
      check(!!pbr.baseColorTexture === !!expected.map, `${id}/${mesh.name}: front texture assigned to the wrong surface`);
      check(pbr.baseColorFactor.slice(0, 3).every((value, i) => near(value, expected.color.toArray()[i])),
        `${id}/${mesh.name}: source colour or cut colour changed`);
      check(near(pbr.metallicFactor, expected.metalness) && near(pbr.roughnessFactor, expected.roughness),
        `${id}/${mesh.name}: PBR finish changed during export`);
      if (expected.clearcoat > 0) {
        const coat = material.extensions?.KHR_materials_clearcoat;
        check(near(coat?.clearcoatFactor, expected.clearcoat)
          && near(coat?.clearcoatRoughnessFactor, expected.clearcoatRoughness), `${id}: physical clearcoat lost`);
      }
      if (expected.anisotropy > 0) {
        const brushing = material.extensions?.KHR_materials_anisotropy;
        check(near(brushing?.anisotropyStrength, expected.anisotropy)
          && near(brushing?.anisotropyRotation, expected.anisotropyRotation), `${id}: physical brushed reflection direction lost`);
      }
      check(near(material.extras?.oartsEnvMapIntensity, expected.envMapIntensity),
        `${id}: studio reflection intensity lost from the portable material`);
      const p = accessor(primitive.attributes.POSITION), n = accessor(primitive.attributes.NORMAL);
      const t = accessor(primitive.attributes.TEXCOORD_0), indexAccessor = accessor(primitive.indices);
      const indices = indexAccessor.values;
      check(p.width === 3 && n.width === 3 && t.width === 2
        && [p, n, t].every(attribute => attribute.componentType === 5126)
        && indexAccessor.width === 1 && indexAccessor.componentType === 5125,
        `${id}: float attributes or integer indices use the wrong GLB component type`);
      check(primitive.mode === 4 && indices.length === group.count && indices.length % 3 === 0,
        `${id}: exported triangle topology/count differs from the solid`);
      check(p.count === n.count && p.count === t.count, `${id}: exported vertex attributes differ in length`);
      let mapping = true, normalsFiniteAndUnit = true;
      for (let i = 0; i < n.values.length; i += 3) {
        normalsFiniteAndUnit &&= near(Math.hypot(n.values[i], n.values[i + 1], n.values[i + 2]), 1, .002);
      }
      check(normalsFiniteAndUnit, `${id}: exported normals are not unit length`);
      for (let i = 0; i < indices.length; i++) {
        const target = indices[i], source = geometry.index?.array[group.start + i] ?? group.start + i;
        if (target >= p.count) { mapping = false; break; }
        for (let axis = 0; axis < 3; axis++) {
          mapping &&= near(p.values[target * 3 + axis], position.array[source * 3 + axis])
            && near(n.values[target * 3 + axis], normal.array[source * 3 + axis]);
        }
        mapping &&= near(t.values[target * 2], uv?.getX(source) || 0)
          && near(t.values[target * 2 + 1], 1 - (uv?.getY(source) || 0));
      }
      check(mapping, `${id}: GLB changes real triangle geometry, normals or texture orientation`);
      if (expected.map) {
        check(pbr.baseColorTexture.index === 0 && (pbr.baseColorTexture.texCoord ?? 0) === 0
          && pbr.baseColorFactor.slice(0, 3).every(value => value === 1),
          `${id}: actual source surface is tinted or samples another image`);
        const transform = pbr.baseColorTexture.extensions?.KHR_texture_transform;
        check(!transform || ((transform.offset || [0, 0]).every(value => value === 0)
          && (transform.scale || [1, 1]).every(value => value === 1)
          && (transform.rotation || 0) === 0 && (transform.texCoord ?? 0) === 0),
        `${id}: texture extension shifts, flips or rotates the actual source image`);
        // The source bitmap is Y-down. Verify that convention independently of
        // the live UV buffer so a matching double-flip cannot pass this guard.
        let projection = true;
        for (let i = 0; i < p.count; i++) {
          projection &&= near(t.values[i * 2], .5 + p.values[i * 3] / (2 * record.profile.radius))
            && near(t.values[i * 2 + 1], .5 - p.values[i * 3 + 1] / (2 * record.profile.radius));
        }
        check(projection, `${id}: source photograph is vertically inverted or misregistered in GLB`);
        sourceUVs += p.count;
      }
      triangles += indices.length / 3;
    }
  }
  check(expectedMeshes.size === 0, `${id}: actual solid omitted from GLB`);
  check(triangles === entry.trace.glbTriangles, `${id}: triangle report differs from the portable file`);
  return { triangles, sourceUVs, bytes: bytes.length };
}

async function catalogue() {
  const baseline = readJSON('docs/qa/wheel-reconstruction/catalog-baseline.json');
  // These ten legacy concepts have no photographic source. They must not be
  // counted as photo reconstructions or substituted for a real product mesh.
  const concepts = new Set(['mono5', 'deep7', 'yfork10', 'twist9', 'mesh30', 'split6', 'turbine8', 'blade12', 'star5', 'concave9']);
  const expectedIDs = [...new Set(['designs', 'ready', 'projects'].flatMap(group => baseline[group].map(item => item.id)))]
    .filter(id => !concepts.has(id)).sort();
  const index = readJSON('assets/wheel-models/index.json');
  for (const id of requestedModels) check(index.models.some(model => model.id === id), 'Unknown requested design: ' + id);
  check(index.errors.length === 0, 'Reconstruction build has unresolved errors');
  assert.deepEqual(index.models.map(entry => entry.id).sort(), expectedIDs, 'Registry loses or adds a source design');
  const { PHOTO_WHEEL_MODELS } = await import(pathToFileURL(path.join(root, 'js/wheel-reconstruction-catalog.js')));
  assert.deepEqual(Object.keys(PHOTO_WHEEL_MODELS).sort(), expectedIDs, 'Browser model registry differs from the source catalogue');
  const references = referenceExpectations();
  const surfaces = new Map(readJSON('data/wheel-reconstruction-project-surfaces.json').records.map(item => [item.id, item]));
  const report = { models: 0, projectSources: 0, sourceApertures: 0, majorApertures: 0,
    independentManualApertures: 0, reliefs: 0, repairedZeroNormals: 0, removedDegenerateTriangles: 0,
    oartsCaps: 0, oartsGlyphs: 0, sculptedProfiles: 0, radialProfiles: 0, mountingWells: 0, recessedDetails: 0,
    glbTriangles: 0, glbSourceUVs: 0, glbBytes: 0, failures: [] };
  for (const entry of index.models) {
    if (requestedModels.size && !requestedModels.has(entry.id)) continue;
    if (args.includes('--skip-projects') && entry.group === 'project') continue;
    let wheel, texture;
    try {
      const record = readJSON(entry.record), expectation = references.get(entry.id);
      check(record.id === entry.id && record.coordinateSystem === 'unit-radius-y-up', `${entry.id}: wrong trace identity/frame`);
      check(record.schemaVersion === 2 && (!record.profile.centerBrand || record.profile.centerBrand === 'OARTS'), `${entry.id}: reviewed OARTS profile metadata invalid`);
      const sculpt = record.profile.sculptMap, radius = record.profile.radius;
      check(sculpt?.encoding === 'uint8-base64' && [192, 384].includes(sculpt.size)
        && sculpt.method === 'observed-metal-distance-field-cross-section'
        && Number.isFinite(sculpt.amplitude) && sculpt.amplitude >= 0 && sculpt.amplitude <= .09,
      `${entry.id}: actual observed forging cross-section map missing or invalid`);
      const crossSection = Buffer.from(sculpt.data || '', 'base64');
      check(crossSection.length === sculpt.size ** 2 && crossSection.some(value => value > 0),
        `${entry.id}: observed cross-section map is empty or malformed`);
      check(Number.isFinite(radius) && radius > .9 && radius < 1.2
        && record.profile.lipInnerRadius > .65 && record.profile.lipInnerRadius < 1
        && record.profile.lipDepth > 0 && record.profile.lipDepth < .5
        && record.profile.capRadius > .04 && record.profile.capRadius <= .22,
      `${entry.id}: individually reviewed lip or cap dimensions invalid`);
      report.sculptedProfiles++;
      if (record.profile.radialProfile) {
        const profile = record.profile.radialProfile;
        check(Array.isArray(profile) && profile.length >= 3 && profile.length < 64
          && profile.every((p, i) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
            && p[0] >= 0 && p[0] <= 1 && (!i || p[0] > profile[i - 1][0]) && Math.abs(p[1]) < .5),
        `${entry.id}: individual measured-view radial depth profile invalid`);
        report.radialProfiles++;
      }
      check(PHOTO_WHEEL_MODELS[entry.id].record === entry.record && PHOTO_WHEEL_MODELS[entry.id].glb === entry.glb,
        `${entry.id}: browser entry points at another wheel asset`);
      if (!args.includes('--json-only')) check(PHOTO_WHEEL_MODELS[entry.id].glbRevision === entry.glbRevision,
        `${entry.id}: browser portable model revision differs from the actual asset registry`);
      for (const source of [record.source, ...(record.surfaceSource ? [record.surfaceSource] : [])]) {
        check(sha256(fs.readFileSync(path.join(root, source.src))) === source.sha256, `${entry.id}: source photograph changed`);
      }
      if (surfaces.has(record.id)) { projectRegistration(record, surfaces.get(record.id)); report.projectSources++; }
      const surfacePath = path.join(root, 'docs/qa/wheel-reconstruction', `${entry.id}-surface.jpg`);
      const surfaceBytes = !record.provenance.rectificationApproximate && fs.existsSync(surfacePath)
        ? fs.readFileSync(surfacePath) : null;
      if (surfaceBytes) {
        const dimensions = jpegDimensions(surfaceBytes), size = record.surfaceTextureSize ?? 1024;
        check([1024, 2048].includes(size) && dimensions.width === size && dimensions.height === size,
          `${entry.id}: rectified source size differs from the runtime texture size`);
      }
      // The editable studio and portable GLB use actual colored PBR geometry.
      // Rectified source pixels stay a separate opt-in comparison, not default albedo.
      wheel = buildPhotoWheel(THREE, record, { ...record.defaultOptions });
      wheel.updateMatrixWorld(true);
      if (exportParityOnly) {
        // The preceding complete live run already checked source apertures,
        // bevel topology and cap visibility. Rebuild once for exact portable
        // position/normal/index/material parity without repeating raycasts.
        const caps = [], glyphs = solidMeshes(wheel).filter(part => part.name.startsWith('OARTS_logo_'));
        wheel.traverse(part => { if (part.name === 'OARTS_center_cap') caps.push(part); });
        check(caps.length === 1 && caps[0].isGroup && glyphs.length === 6,
          `${entry.id}: portable parity needs the complete modeled OARTS assembly`);
        report.oartsCaps++; report.oartsGlyphs += glyphs.length;
        const glb = checkGLB(entry, record, wheel, null);
        report.glbTriangles += glb.triangles; report.glbSourceUVs += glb.sourceUVs; report.glbBytes += glb.bytes;
        report.models++; continue;
      }
      check(isSolidAssembly(wheel), `${entry.id}: a photo plane replaced actual source geometry or the physical OARTS cap`);
      const cap = checkOartsCap(wheel, entry.id); report.oartsCaps++; report.oartsGlyphs += cap.glyphs;
      check(wheel.userData.reconstruction.brand === 'OARTS', `${entry.id}: runtime assembly loses OARTS branding`);
      check(solidMeshes(wheel).every(part => (Array.isArray(part.material) ? part.material : [part.material])
        .every(material => !material.map && material.isMeshStandardMaterial)), `${entry.id}: default surface is a photograph instead of editable physical material`);
      let finite = true, unitNormals = true;
      wheel.traverse(part => {
        const geometry = part.geometry;
        if (!geometry) return;
        report.repairedZeroNormals += geometry.userData.repairedZeroNormals || 0;
        report.removedDegenerateTriangles += geometry.userData.removedDegenerateTriangles || 0;
        for (const attribute of Object.values(geometry.attributes)) finite &&= attribute.array.every(Number.isFinite);
        const normals = geometry.attributes.normal;
        for (let i = 0; i < normals.count; i++) unitNormals &&= near(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)), 1, .002);
      });
      check(finite, `${entry.id}: nonfinite live vertex/normal/UV data`);
      check(unitNormals, `${entry.id}: live normals are not unit length`);
      const reliefs = wheel.children.filter(part => part.geometry?.userData.surfaceDetail);
      check(reliefs.length === (record.surfaceDetails?.length || 0), `${entry.id}: actual raised detail lost`);
      check(reliefs.every(part => !('throughHoles' in part.geometry.userData)), `${entry.id}: relief counted as a through-aperture`);
      report.reliefs += reliefs.length;
      const recesses = wheel.children.filter(part => part.geometry?.userData.recessedDetail);
      check(recesses.length === (record.recessedDetails?.length || 0)
        && wheel.userData.reconstruction.recessedDetails === recesses.length, `${entry.id}: observed blind pockets missing`);
      report.recessedDetails += recesses.length;
      const baseFaces = wheel.children.filter(part => part.name.startsWith('Photo_traced_face_')), blocked = [];
      check(!record.faceShapes || baseFaces.every(part => part.geometry.userData.robustBevel),
        `${entry.id}: validated polygon bevel sections were replaced by an unconstrained cap offset`);
      const wells = wheel.children.filter(part => part.geometry?.userData.observedMountingWell);
      const openFaceSolids = [...baseFaces, ...wells]; report.mountingWells += wells.length;
      for (const shape of record.shapes) {
        const sorted = [...shape.holes].sort((a, b) => area(b) - area(a));
        for (let i = 0; i < sorted.length; i++) {
          if (!apertureIsOpen(openFaceSolids, sorted[i], record.profile.radius)) blocked.push(i);
          report.sourceApertures++;
          if (i < 2) report.majorApertures++;
        }
      }
      check(blocked.length === 0, `${entry.id}: ${blocked.length} source apertures are blocked by the generated face`);
      // Reviewed annotations are independent input, rather than mesh metadata:
      // a lost source window cannot pass simply because it vanished from JSON.
      if (expectation?.segmentationMode === 'manual-face' && Array.isArray(expectation.manualHoles)) {
        const expectedCount = expectation.reviewedHoleCount ?? expectation.manualHoles.length;
        check(record.shapes.reduce((sum, shape) => sum + shape.holes.length, 0) === expectedCount,
          `${entry.id}: reviewed source aperture count changed`);
        const correction = record.provenance?.perspectiveCorrection || expectation.perspectiveCorrection;
        check(expectation.manualHoles.every(hole => apertureIsOpen(openFaceSolids,
          correctedAnnotation(hole, correction, record.defaultOptions?.mirror === true), record.profile.radius)),
          `${entry.id}: independently annotated aperture was filled`);
        report.independentManualApertures += expectation.manualHoles.length;
      }
      if (!args.includes('--json-only')) {
        const glb = checkGLB(entry, record, wheel, null);
        report.glbTriangles += glb.triangles; report.glbSourceUVs += glb.sourceUVs; report.glbBytes += glb.bytes;
      }
      report.models++;
    } catch (error) {
      report.failures.push({ id: entry.id, message: error.message });
    } finally {
      if (wheel) disposeWheel(wheel);
      texture?.dispose();
    }
  }
  if (report.failures.length) {
    const error = new Error(`${report.failures.length} wheel models failed geometry/export checks`);
    error.details = report;
    throw error;
  }
  const expectedProjects = [...surfaces.keys()].filter(id => !requestedModels.size || requestedModels.has(id)).length;
  check(report.projectSources === (args.includes('--skip-projects') ? 0 : expectedProjects),
    'Not every expected project photograph was checked');
  check(report.oartsCaps === report.models && report.oartsGlyphs === report.models * 6
    && report.sculptedProfiles === report.models, 'Every model must retain modeled OARTS branding and its reviewed forging profile');
  return report;
}

const started = performance.now();
try {
  const fixture = exportParityOnly ? undefined : fixtures();
  const models = args.includes('--fixtures-only') ? undefined : await catalogue();
  console.log(JSON.stringify({ status: 'PASS', three: THREE.REVISION, assertions,
    mode: { scope: args.includes('--fixtures-only') ? 'fixtures' : requestedModels.size ? 'selected-models' : 'catalogue',
      projects: args.includes('--fixtures-only') ? 'not-run' : args.includes('--skip-projects') ? 'skipped' : 'included',
      glb: args.includes('--fixtures-only') ? 'not-run' : args.includes('--json-only') ? 'skipped' : 'included',
      liveRaycasts: exportParityOnly ? 'already-checked-separately' : 'included' }, ...(fixture ? {fixture} : {}),
    ...(models ? { catalogue: models } : {}), milliseconds: Math.round(performance.now() - started) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', assertions, message: error.message,
    ...(error.details ? { catalogue: error.details } : {}) }, null, 2));
  process.exitCode = 1;
}
