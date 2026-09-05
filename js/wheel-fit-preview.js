/* Project the configured, physically rendered wheel into each photographed rim.
 * Coordinates belong to the full, uncropped local photograph, not the viewport.
 * Original photographs and tyres are preserved; only the rim faces are covered.
 */
import { renderWheelFace } from './showroom.js?v=20260905-wheel-fit';

const manifestURL = new URL('../data/wheel-fitments.json?v=20260905-wheel-fit', import.meta.url);
let manifestPromise;
const validClip = points => points === undefined || (Array.isArray(points) && points.length >= 3 && points.length <= 32 &&
  points.every(point => Array.isArray(point) && point.length === 2 &&
    point.every(value => Number.isFinite(value) && value >= 0 && value <= 1)));

export function validPlacement(photo) {
  return photo && Number.isFinite(photo.width) && photo.width > 0 &&
    Number.isFinite(photo.height) && photo.height > 0 &&
    Array.isArray(photo.wheels) && photo.wheels.length > 0 && photo.wheels.length <= 4 &&
    photo.wheels.every(w => w && typeof w === 'object' && [w.cx, w.cy, w.rx, w.ry, w.rotation ?? 0].every(Number.isFinite) &&
      w.cx > 0 && w.cx < 1 && w.cy > 0 && w.cy < 1 &&
      w.rx > 0 && w.rx < .3 && w.ry > 0 && w.ry < .5 && validClip(w.clip));
}

export function loadWheelFitments(retry = false) {
  if (retry) manifestPromise = null;
  return manifestPromise || (manifestPromise = fetch(manifestURL, { cache: retry ? 'reload' : 'default' })
    .then(r => { if (!r.ok) throw new Error('Wheel placements unavailable'); return r.json(); })
    .then(data => {
      if (data.schemaVersion !== 1 || !data.photos) throw new Error('Invalid wheel placements');
      return data.photos;
    }).catch(error => { manifestPromise = null; throw error; }));
}

export function paintWheelFaces(canvas, placement, face, input = {}) {
  canvas.width = placement.width;
  canvas.height = placement.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const wheel of placement.wheels) {
    const rx = wheel.rx * canvas.width, ry = wheel.ry * canvas.height;
    ctx.save();
    if (wheel.clip) {
      // A visible-region polygon keeps foreground bodywork in front of the rim.
      ctx.beginPath();
      wheel.clip.forEach(([x, y], index) => {
        if (index) ctx.lineTo(x * canvas.width, y * canvas.height);
        else ctx.moveTo(x * canvas.width, y * canvas.height);
      });
      ctx.closePath();
      ctx.clip();
    }
    ctx.translate(wheel.cx * canvas.width, wheel.cy * canvas.height);
    ctx.rotate(wheel.rotation || 0);
    ctx.scale(rx / face.radius, ry / face.radius);
    // Hide factory spokes behind the new geometry, while retaining the tyre.
    ctx.beginPath();
    ctx.arc(0, 0, face.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#18191a';
    ctx.fillRect(-face.radius, -face.radius, face.radius * 2, face.radius * 2);
    ctx.drawImage(face.canvas, -face.centerX, -face.centerY);
    // A narrow contact shadow seats the metal lip inside the existing tyre.
    const shade = ctx.createRadialGradient(0, 0, face.radius * .9, 0, 0, face.radius);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = shade;
    ctx.fillRect(-face.radius, -face.radius, face.radius * 2, face.radius * 2);
    ctx.restore();
  }
}

export function mountWheelPhoto(frame, visual, initial = {}) {
  const photo = frame.querySelector('img');
  if (!photo) throw new Error('Vehicle photograph missing');
  const canvas = document.createElement('canvas');
  canvas.className = 'vehicle-wheel-overlay';
  canvas.hidden = true;
  canvas.setAttribute('role', 'img');
  frame.append(canvas);
  const toolbar = document.createElement('div');
  toolbar.className = 'wheel-photo-toolbar';
  const status = document.createElement('span');
  status.className = 'wheel-photo-status';
  status.setAttribute('role', 'status');
  const compare = document.createElement('button');
  compare.type = 'button';
  compare.className = 'wheel-photo-compare';
  compare.textContent = 'Původní kola';
  compare.setAttribute('aria-pressed', 'false');
  compare.setAttribute('aria-label', 'Porovnat s původními koly');
  compare.disabled = true;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'wheel-photo-retry';
  retry.textContent = 'Obnovit náhled kol';
  retry.hidden = true;
  toolbar.append(status, compare, retry);
  frame.after(toolbar);
  let disposed = false, revision = 0, timer = null, showOriginal = false, options = initial;
  let lastSignature = '', renderedLabel = '', loading = false;
  const sourceAlt = photo.alt;

  function showState() {
    canvas.hidden = showOriginal || !lastSignature;
    frame.dataset.wheelView = showOriginal ? 'original' : lastSignature ? 'configured' : 'loading';
    compare.setAttribute('aria-pressed', String(showOriginal));
    compare.textContent = showOriginal ? 'Zobrazit nová kola' : 'Původní kola';
    status.textContent = loading ? 'Připravuji nová kola…' :
      showOriginal ? 'Původní náhled · původní kola' : renderedLabel;
    photo.alt = !showOriginal && lastSignature ? `${sourceAlt}. Osazeno návrhem kol ${renderedLabel}.` : sourceAlt;
    canvas.setAttribute('aria-label', `Návrh kol ${renderedLabel} na vybraném voze`);
  }

  async function render(token, input, reload = false) {
    try {
      const data = await loadWheelFitments(reload);
      if (disposed || token !== revision) return;
      const placement = data[visual.src];
      if (!validPlacement(placement) || placement.width !== visual.width || placement.height !== visual.height ||
          (placement.sourceSha1 && visual.sourceSha1 && placement.sourceSha1 !== visual.sourceSha1)) {
        throw new Error('No matching rim placement for this photograph');
      }
      const face = await renderWheelFace({ ...input, size: 512 });
      if (disposed || token !== revision) return;
      if (!photo.complete) await new Promise((resolve, reject) => {
        photo.addEventListener('load', resolve, { once: true });
        photo.addEventListener('error', reject, { once: true });
      });
      if (!photo.naturalWidth) throw new Error('Vehicle photograph failed');
      if (disposed || token !== revision) return;
      paintWheelFaces(canvas, placement, face, input);
      lastSignature = signature(input);
      renderedLabel = input.label || input.design || 'Need For Wheels';
      canvas.dataset.design = input.design;
      canvas.dataset.color = input.colorHex || input.color;
      canvas.dataset.wheelCount = String(placement.wheels.length);
      canvas.dataset.ready = 'true';
      loading = false;
      compare.disabled = false;
      retry.hidden = true;
      showState();
    } catch (error) {
      if (disposed || token !== revision) return;
      loading = false;
      lastSignature = '';
      canvas.hidden = true;
      canvas.dataset.ready = 'false';
      frame.dataset.wheelView = 'unavailable';
      photo.alt = sourceAlt;
      status.textContent = 'Náhled nových kol se nepodařilo načíst. Zobrazuje se originální fotografie.';
      compare.disabled = true;
      retry.hidden = false;
    }
  }

  function signature(input) {
    return JSON.stringify([input.design, input.colorHex || input.color, input.finish, input.lip,
      input.cap, input.bolts, input.mirror, input.width, input.diameter]);
  }
  function update(input, reload = false) {
    options = { ...input };
    const token = ++revision;
    clearTimeout(timer);
    if (!reload && lastSignature && signature(input) === lastSignature) {
      loading = false;
      showState();
      return;
    }
    loading = true;
    status.textContent = 'Připravuji nová kola…';
    retry.hidden = true;
    // Keep the current fitted wheels visible during rapid colour input changes.
    timer = setTimeout(() => render(token, options, reload), 40);
  }
  compare.addEventListener('click', () => { showOriginal = !showOriginal; showState(); });
  retry.addEventListener('click', () => update(options, true));
  update(initial);
  return {
    update,
    dispose() {
      disposed = true;
      revision++;
      clearTimeout(timer);
      canvas.remove();
      toolbar.remove();
      photo.alt = sourceAlt;
    }
  };
}
