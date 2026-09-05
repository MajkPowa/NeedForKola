import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './vehicle-models.js?v=20260905-360';

// All wheel surfaces below are real, chamfered 3D geometry. No SVG or flat wheel images.
const DRACO_URL = new URL('../assets/vendor/draco/', import.meta.url).href;
const active = new WeakMap();
const TAU = Math.PI * 2;
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
};

function options(input = {}) {
  return {
    ...input, mode: input.mode === 'car' ? 'car' : 'wheel',
    design: presets[input.design] ? input.design : 'apex10',
    color: hex(input.color || input.colorHex, '#967044'),
    bodyColor: hex(input.bodyColor, '#303f4b'),
    diameter: clamp(input.diameter, 18, 24, 20),
    width: clamp(input.width, 7, 13.5, 10),
    autoRotate: input.autoRotate !== false,
    finish: ['gloss', 'satin', 'matte', 'brushed', 'chrome'].includes(input.finish) ? input.finish : 'satin',
    cap: input.cap || 'black', lip: input.lip || 'same',
    bolts: clamp(input.bolts, 4, 6, 5),
  };
}

function metalMaterial(opts) {
  const finishes = { gloss: [.2, 1, .1], satin: [.32, .48, .25], matte: [.57, .06, .45], brushed: [.37, .2, .25], chrome: [.09, .8, .05] };
  const [roughness, clearcoat, clearcoatRoughness] = finishes[opts.finish];
  const material = new THREE.MeshPhysicalMaterial({
    color: opts.color, metalness: 1, roughness, clearcoat, clearcoatRoughness,
    envMapIntensity: .92, reflectivity: .8,
  });
  if (opts.finish === 'brushed') {
    // Fine machining lines in a generated normal texture, never an image of the wheel.
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = 128; data[i + 1] = 128 + Math.round(Math.sin(y * 2.34) * 26);
      data[i + 2] = 252; data[i + 3] = 255;
    }
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(2, 5); map.needsUpdate = true;
    material.normalMap = map; material.normalScale.set(.16, .16);
  }
  return material;
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
  return new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize, bevelThickness: bevelSize, curveSegments: 32 });
}

function capTexture(carbon = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0b0d0f'; ctx.fillRect(0, 0, 256, 256);
  if (carbon) {
    for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
      const vertical = (x / 16 + y / 16) % 2 === 0;
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 3 === 0 ? '#41444a' : '#23262c'; ctx.fillRect(x + (vertical ? i * 2 : 0), y + (vertical ? 0 : i * 2), vertical ? 1 : 16, vertical ? 16 : 1); }
    }
  }
  ctx.strokeStyle = '#a4a19b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(128, 128, 115, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#eeeae2'; ctx.textAlign = 'center'; ctx.font = 'italic 800 68px Arial'; ctx.fillText('NFW', 126, 147);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

/** One 2.06-unit diameter wheel, with its face looking down +Z and its centre at the origin. */
export function createWheel(input = {}) {
  const opts = options(input), preset = presets[opts.design];
  const group = new THREE.Group(); group.name = `NFW_${opts.design}`;
  const material = metalMaterial(opts);
  const polished = new THREE.MeshPhysicalMaterial({ color: '#c8c8c4', metalness: 1, roughness: .14, clearcoat: .6 });
  const inner = material.clone(); inner.roughness = Math.min(.65, inner.roughness + .12); inner.color.multiplyScalar(.68);
  const dark = new THREE.MeshStandardMaterial({ color: '#141619', metalness: .6, roughness: .35 });
  const machined = polished.clone(); machined.roughness = .36;
  const lipMat = opts.lip === 'polished' || opts.lip === 'chrome' ? polished : opts.lip === 'machined' ? machined : opts.lip === 'black' ? dark : material;
  const depth = opts.width / opts.diameter * 1.8;
  const face = preset.bolts ? .23 : .33;
  const centre = ['deep7', 'concave9'].includes(opts.design) ? -.1 : -.035;

  // A closed, turned-aluminium barrel profile includes bead seats and both rolled lips.
  lathe([[.958, -face + .046], [1.005, -face + .046], [1.025, -face + .05], [1.029, -face + .055],
    [1.012, -face + .06], [.978, -face + .066], [.964, -face + .11],
    [.952, depth - face - .1], [.97, depth - face - .045], [1.004, depth - face - .035],
    [1.011, depth - face - .012], [1.001, depth - face + .012], [.947, depth - face + .012],
    [.933, depth - face - .04], [.921, -face + .15], [.936, -face + .064], [.958, -face + .046]], inner, group);
  lathe([[.957, -face], [1.008, -face], [1.028, -face + .012], [1.024, -face + .038], [.96, -face + .04], [.957, -face]], lipMat, group);
  lathe([[.952, depth - face - .025], [1.005, depth - face - .025], [1.009, depth - face], [.954, depth - face], [.952, depth - face - .025]], material, group);

  const spoke = (angle, branch = 0, style = preset.style) => {
    const shape = new THREE.Shape();
    const end = preset.bolts ? .84 : .969;
    const width = preset.width;
    const start = style === 'split' ? .21 : .18;
    const bend = ['twist', 'turbine'].includes(style) ? (opts.mirror ? -.15 : .15) : branch;
    shape.moveTo(-width * 2.15, start);
    shape.bezierCurveTo(-width * 1.6, .32, bend - width * .54, .55, bend - width * .49, end);
    shape.lineTo(bend + width * .49, end);
    shape.bezierCurveTo(bend + width * .45, .55, width * 1.6, .32, width * 2.15, start);
    shape.quadraticCurveTo(0, start - .045, -width * 2.15, start);
    const geometry = beveled(shape, .055, .009);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      const t = THREE.MathUtils.smoothstep(radius, .22, .98);
      positions.setZ(i, positions.getZ(i) + centre + (face - centre - .07) * t);
    }
    geometry.computeVertexNormals();
    const item = mesh(geometry, material, group); item.rotation.z = angle;
  };

  for (let i = 0; i < preset.count; i++) {
    const angle = i * TAU / preset.count;
    if (preset.style === 'fork' || preset.style === 'split') { spoke(angle - .09, -.06); spoke(angle + .09, .06); }
    else if (preset.style === 'mesh') { spoke(angle, -.18, 'mesh'); spoke(angle, .18, 'mesh'); }
    else spoke(angle);
  }

  // Through-drilled mounting holes and machined bevels around each seat.
  const holePositions = Array.from({ length: Math.round(opts.bolts) }, (_, i) => {
    const a = i * TAU / opts.bolts + Math.PI / opts.bolts;
    return [Math.sin(a) * .22, Math.cos(a) * .22, .051];
  });
  const hubShape = new THREE.Shape();
  const hubPoints = Array.from({ length: 100 }, (_, i) => {
    const a = i * TAU / 100, radius = .285 - .013 * Math.cos(a * Math.round(opts.bolts));
    return new THREE.Vector2(Math.sin(a) * radius, Math.cos(a) * radius);
  });
  hubShape.moveTo(hubPoints[0].x, hubPoints[0].y);
  for (let i = 1; i <= hubPoints.length; i++) { const p = hubPoints[i % hubPoints.length]; hubShape.lineTo(p.x, p.y); }
  for (const [x, y, r] of [[0, 0, .102], ...holePositions]) { const hole = new THREE.Path(); hole.absarc(x, y, r, 0, TAU, false); hubShape.holes.push(hole); }
  const hub = mesh(beveled(hubShape, .074, .015), material, group);
  hub.position.z = centre - .004;
  for (const [x, y] of holePositions) {
    const seat = lathe([[.046, 0], [.057, 0], [.060, -.014], [.052, -.024], [.046, -.019], [.046, 0]], lipMat, group, 48);
    seat.position.set(x, y, centre + .079);
    const recess = mesh(new THREE.CylinderGeometry(.043, .043, .018, 32), dark, group);
    recess.rotation.x = Math.PI / 2; recess.position.set(x, y, centre + .077);
  }
  if (opts.cap !== 'none') {
    const capMat = ['same', 'body'].includes(opts.cap) ? material : opts.cap === 'silver' ? polished : dark;
    const cap = mesh(new THREE.CylinderGeometry(.102, .106, .05, 96), capMat, group);
    cap.rotation.x = Math.PI / 2; cap.position.z = centre + .073;
    if (['black', 'carbon'].includes(opts.cap)) {
      const badgeMat = new THREE.MeshStandardMaterial({ map: capTexture(opts.cap === 'carbon'), roughness: .29, metalness: .3 });
      const badge = mesh(new THREE.CircleGeometry(.092, 96), badgeMat, group); badge.position.z = centre + .1;
    }
    const capRing = mesh(new THREE.TorusGeometry(.099, .003, 12, 96), polished, group); capRing.position.z = centre + .101;
  }

  // Valve stem and anodised cap are separately modelled.
  const valve = mesh(new THREE.CylinderGeometry(.013, .019, .074, 20), dark, group);
  valve.rotation.x = Math.PI / 2; valve.position.set(.13, -.91, face + .01);
  const valveCap = mesh(new THREE.CylinderGeometry(.017, .017, .028, 12), polished, group);
  valveCap.rotation.x = Math.PI / 2; valveCap.position.set(.13, -.91, face + .048);
  if (preset.bolts) {
    lathe([[.84, -face], [.96, -face], [.96, -face + .05], [.84, -face + .05], [.84, -face]], lipMat, group);
    const boltGeometry = new THREE.CylinderGeometry(.019, .019, .022, 6);
    const bolts = new THREE.InstancedMesh(boltGeometry, polished, 32), dummy = new THREE.Object3D();
    for (let i = 0; i < 32; i++) { const a = i * TAU / 32; dummy.position.set(Math.sin(a) * .896, Math.cos(a) * .896, face + .009); dummy.rotation.x = Math.PI / 2; dummy.updateMatrix(); bolts.setMatrixAt(i, dummy.matrix); }
    bolts.castShadow = true; group.add(bolts);
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
  active.get(container)?.dispose();
  let opts = options(input), disposed = false, model = null, carModel = null, generation = 0;
  let asset = null, modelMetadata = null, paintMaterials = [], installedWheels = [];
  let loadAbort = null, parsing = null;
  const registeredAsset = () => window.NFWVehicleModels.get(opts.vehicleAsset?.id || opts.vehicleAsset || window.NFWVehicleModels.defaultModel.id);
  let renderer;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(input.background || '#151718');
  scene.fog = new THREE.Fog(scene.background, 12, 35);
  const camera = new THREE.PerspectiveCamera(34, 1, .03, 70);
  const status = document.createElement('div'); status.className = 'showroom-status'; status.setAttribute('role', 'status');
  status.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:24px;color:#c8c4bc;font:13px/1.6 Arial;pointer-events:none;z-index:2';
  status.textContent = 'Připravuji 3D studio…'; container.append(status);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch (error) {
    status.textContent = '3D náhled není na tomto zařízení dostupný. Prohlédněte si fotografie produktu.';
    input.onError?.(error); throw error;
  }
  renderer.setPixelRatio(input.thumbnail ? 1 : Math.min(2, Math.max(opts.mode === 'car' ? 1.5 : 1, window.devicePixelRatio || 1)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !input.thumbnail; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  renderer.domElement.setAttribute('aria-label', 'Interaktivní 3D model. Tažením otáčejte, kolečkem přibližujte.');
  renderer.domElement.tabIndex = 0; container.append(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .055); scene.environment = environment.texture;
  scene.environmentIntensity = 1.05; room.dispose(); pmrem.dispose();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .075; controls.enablePan = false;
  controls.minPolarAngle = .13; controls.maxPolarAngle = Math.PI * .49;
  controls.rotateSpeed = .65; controls.zoomSpeed = .75;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  controls.autoRotate = opts.autoRotate && !reduced.matches; controls.autoRotateSpeed = .55;
  const motionChange = () => { controls.autoRotate = opts.autoRotate && !reduced.matches; };
  reduced.addEventListener('change', motionChange);
  const key = new THREE.DirectionalLight('#fff6e8', 2.1); key.position.set(-3, 6, 5); key.castShadow = !input.thumbnail;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4; key.shadow.normalBias = .006; key.shadow.bias = -.00003;
  key.shadow.camera.near = .5; key.shadow.camera.far = 18;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#bacbdf', 1.5); fill.position.set(4, 3, -4); scene.add(fill);
  // A charcoal cyclorama and soft contact shadow keep the studio free of hard sun shadows.
  const floor = mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#0a0d11', roughness: .78, metalness: 0, envMapIntensity: .05 }), scene);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; floor.position.y = -.015;
  const shadow = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, opacity: .85 }), scene);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.009; shadow.castShadow = shadow.receiveShadow = false;
  const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_URL); draco.setWorkerLimit(2);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
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
    else { camera.position.set(2.2, 1.6, 4.4); controls.target.set(0, 1.02, -.08); controls.minDistance = 2.6; controls.maxDistance = 7; }
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
      wheel.scale.setScalar(scale); wheel.position.z = -(presets[opts.design].bolts ? .23 : .33) * scale;
      wheel.name = `NFW_mounted_${binding.id}`;
      anchor.add(wheel); installedWheels.push(wheel);
    }
    paintMaterials.forEach(material => material.color.set(opts.bodyColor));
  }
  async function build(modeChanged = false) {
    const token = ++generation;
    loadAbort?.abort(); loadAbort = new AbortController();
    const signal = loadAbort.signal;
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
        if (disposed || generation !== token) return;
        controller.dispose();
        status.textContent = 'Model auta se nepodařilo načíst. Zvolte detail kola nebo načtení opakujte.';
        status.style.display = 'grid'; container.append(status);
        input.onError?.(error); throw error;
      }
    } else {
      asset = null; modelMetadata = null; delete container.dataset.vehicleAsset; delete container.dataset.mountedWheels;
      model = createWheel(opts); model.position.y = 1.033; scene.add(model); shadow.scale.set(3.6, 2.2, 1);
    }
    if (disposed || generation !== token) return;
    status.style.display = 'none'; if (modeChanged) resetCamera(); render();
    input.onReady?.(controller);
  }
  const controller = {
    get options() { return { ...opts }; },
    get renderer() { return renderer; },
    async update(patch = {}) {
      if (disposed) return;
      const previous = opts; opts = options({ ...opts, ...patch }); motionChange();
      const changed = previous.mode !== opts.mode || (opts.mode === 'car' && asset?.id !== registeredAsset()?.id);
      const wheelChanged = ['design','color','finish','lip','cap','mirror','bolts', ...(opts.mode === 'wheel' ? ['width','diameter'] : [])].some(key => previous[key] !== opts[key]);
      if (changed || !model) await build(changed);
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
      if (opts.mode !== 'car' || !views[preset]) return;
      controls.target.fromArray(preset === 'detail' ? [-1.35, .5, .7] : asset.camera.target);
      camera.position.fromArray(views[preset]);
      camera.position.sub(controls.target).multiplyScalar(fitScale).add(controls.target); controls.update(); render();
    },
    get view() { return { assetId: asset?.id || null, mountedWheels: installedWheels.length, camera: camera.position.toArray(), target: controls.target.toArray() }; },
    capture(type = 'image/webp', quality = .92) { render(); return renderer.domElement.toDataURL(type, quality); },
    dispose() {
      if (disposed) return; disposed = true; generation++;
      loadAbort?.abort(); input.signal?.removeEventListener('abort', cancelMount);
      renderer.setAnimationLoop(null); observer.disconnect(); intersection.disconnect(); controls.dispose();
      reduced.removeEventListener('change', motionChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.domElement.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('dblclick', resetCamera);
      // Finish an in-flight CPU decode, then release workers; the WebGL context is released now.
      if (parsing) parsing.then(() => draco.dispose(), () => draco.dispose()); else draco.dispose();
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
let thumbnailHost, thumbnailController, thumbnailIdleTimer;
function disposeThumbnails() {
  clearTimeout(thumbnailIdleTimer); thumbnailController?.dispose(); thumbnailHost?.remove();
  thumbnailController = null; thumbnailHost = null;
}
export function renderThumbnail(input = {}) {
  const job = thumbnailQueue.then(async () => {
    clearTimeout(thumbnailIdleTimer);
    try {
      if (!thumbnailController) {
        thumbnailHost = document.createElement('div'); thumbnailHost.style.cssText = 'position:fixed;left:-2000px;top:0;width:400px;height:400px;';
        document.body.append(thumbnailHost);
        thumbnailController = await mount(thumbnailHost, { ...input, mode: 'wheel', thumbnail: true, autoRotate: false });
      } else await thumbnailController.update({ ...input, mode: 'wheel', autoRotate: false });
      const result = thumbnailController.capture();
      thumbnailIdleTimer = setTimeout(disposeThumbnails, 2500);
      return result;
    } catch (error) { disposeThumbnails(); throw error; }
  });
  thumbnailQueue = job.catch(() => {}); return job;
}

// A separate transparent renderer supplies actual wheel geometry for photo fitting.
// Cached snapshots are independent of this GPU context and must be treated as read-only.
const FACE_CACHE_LIMIT = 30, FACE_IDLE_MS = 10000;
const faceCache = new Map();
let faceQueue = Promise.resolve(), faceStudio = null, faceIdleTimer;

function faceOptions(input) {
  const opts = options({ ...input, color: hex(input.colorHex, hex(input.color, '#967044')), autoRotate: false });
  return {
    design: opts.design, color: opts.color, finish: opts.finish,
    lip: ['same', 'polished', 'chrome', 'machined', 'black'].includes(opts.lip) ? opts.lip : 'same',
    cap: ['none', 'same', 'body', 'silver', 'black', 'carbon'].includes(opts.cap) ? opts.cap : 'black',
    diameter: opts.diameter, width: opts.width, bolts: Math.round(opts.bolts), mirror: Boolean(input.mirror),
    size: Math.round(clamp(input.size, 256, 512, 512)),
    yaw: Number(clamp(input.yaw, -1.2, 1.2, 0).toFixed(4)),
    pitch: Number(clamp(input.pitch, -.8, .8, 0).toFixed(4))
  };
}

function createFaceStudio() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.052, 1.052, 1.052, -1.052, .01, 15);
  camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .055);
  scene.environment = environment.texture; scene.environmentIntensity = .68;
  room.dispose(); pmrem.dispose();
  // A side-biased key reveals the spoke dishes; restrained fill preserves depth.
  const key = new THREE.DirectionalLight('#fff8ee', 3.1); key.position.set(-3.5, 4.8, 4);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.65, right: 1.65, top: 1.65, bottom: -1.65, near: .1, far: 14 });
  key.shadow.normalBias = .002; key.shadow.bias = -.00006; scene.add(key);
  const fill = new THREE.DirectionalLight('#cad8e7', .42); fill.position.set(4, .5, 2.5); scene.add(fill);
  const edge = new THREE.DirectionalLight('#ffffff', .7); edge.position.set(3, 4, -3); scene.add(edge);
  return { renderer, scene, camera, environment };
}

function addFaceBrakes(group, face) {
  // This black backing is drawn first, without writing depth. Its projection follows
  // the outer rim exactly, so the original photograph's spokes never shine through.
  // The 0.004-unit black perimeter is only a rim edge, not an added tyre.
  const backing = mesh(new THREE.CircleGeometry(1.032, 192), new THREE.MeshBasicMaterial({ color: '#090c0e', side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false }), group);
  backing.position.z = face; backing.renderOrder = -100;
  // This compositing seal must never cast a solid-disc shadow onto the real brake.
  backing.castShadow = backing.receiveShadow = false;
  const brake = new THREE.MeshStandardMaterial({ color: '#52585d', roughness: .49, metalness: .76, envMapIntensity: .48 });
  const rotor = mesh(new THREE.CylinderGeometry(.79, .79, .045, 160), brake, group);
  rotor.rotation.x = Math.PI / 2; rotor.position.z = -.2;
  const hat = mesh(new THREE.CylinderGeometry(.3, .3, .034, 96), new THREE.MeshStandardMaterial({ color: '#1b2127', metalness: .5, roughness: .6 }), group);
  hat.rotation.x = Math.PI / 2; hat.position.z = -.164;
  const grooves = new THREE.MeshStandardMaterial({ color: '#434a50', metalness: .55, roughness: .79, envMapIntensity: .25 });
  for (const radius of [.48, .55, .62, .69, .765]) {
    const ring = mesh(new THREE.TorusGeometry(radius, .0016, 6, 160), grooves, group);
    ring.position.z = -.176; ring.castShadow = false;
  }
  const holes = new THREE.InstancedMesh(new THREE.CircleGeometry(.013, 12), new THREE.MeshBasicMaterial({ color: '#11161a', toneMapped: false }), 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const angle = i * TAU / 24 + (i >= 24 ? .075 : 0), radius = i >= 24 ? .69 : .59;
    dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, -.1748);
    dummy.updateMatrix(); holes.setMatrixAt(i, dummy.matrix);
  }
  group.add(holes);
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
 */
export function renderWheelFace(input = {}) {
  const opts = faceOptions(input), cacheKey = JSON.stringify(opts);
  const job = faceQueue.then(() => {
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
      if (renderer.getContext().isContextLost()) throw new Error('Kontext 3D náhledu kola není dostupný.');
      assembly = new THREE.Group();
      const wheel = createWheel(opts), face = presets[opts.design].bolts ? .23 : .33;
      // The recessed barrel receives less open-room reflection than the exposed
      // machined face. Keep it a rougher, shaded cavity instead of a bright bowl.
      const barrel = wheel.children.find(item => item.geometry?.type === 'LatheGeometry');
      if (barrel?.material) {
        barrel.material.envMapIntensity *= .38;
        barrel.material.roughness = Math.max(.46, barrel.material.roughness);
      }
      addFaceBrakes(wheel, face);
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
      while (faceCache.size > FACE_CACHE_LIMIT) faceCache.delete(faceCache.keys().next().value);
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

window.NFWShowroom = { mount, createWheel, renderThumbnail, disposeThumbnails, renderWheelFace, disposeWheelFaces, version: '1.2.0', threeVersion: THREE.REVISION };
window.dispatchEvent(new CustomEvent('nfw:showroom-ready'));
