/* Vehicle imagery is independent of fitment data and of the interactive 3D studio. */
(function (global) {
  'use strict';
  const V = global.NFWVehicles;
  const models = new Map(), variants = new Map();
  let loaded = false;
  const loadErrors = new Map(), failedLoads = new Map();
  const text = value => typeof value === 'string' ? value.trim().slice(0, 1600) : '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function assetURL(value) {
    const path = text(value);
    return /^assets\/[a-z0-9_./() +-]+\.(?:webp|png|jpe?g)$/i.test(path) && !path.split('/').includes('..') ? path : '';
  }
  function sourceURL(value) {
    try {
      const url = new URL(text(value));
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function family(brandId, modelId) {
    const brand = V?.getBrand(brandId), model = V?.getModel(brandId, modelId);
    return brand && model ? { brand, model, key: brand.id + '/' + model.id } : null;
  }
  function sanitise(record, match, key) {
    if (!record || record.match !== match || !['photo', 'render'].includes(record.kind)) return null;
    const src = assetURL(record.src);
    if (!src) return null;
    const depiction = record.depicted || {};
    if (match === 'variant' && (!text(depiction.body) || !Number.isInteger(depiction.from) || !Number.isInteger(depiction.to) || depiction.to < depiction.from)) return null;
    return Object.freeze({
      id: text(record.id) || key, src, thumb: assetURL(record.thumb) || src,
      kind: record.kind, match, title: text(record.title), alt: text(record.alt) || text(record.title),
      depicted: Object.freeze({ label: text(depiction.label) || text(record.title), body: text(depiction.body), from: Number.isInteger(depiction.from) ? depiction.from : null, to: Number.isInteger(depiction.to) ? depiction.to : null }),
      sourceUrl: sourceURL(record.sourceUrl), articleUrl: sourceURL(record.articleUrl),
      author: text(record.author), license: text(record.license), licenseUrl: sourceURL(record.licenseUrl),
      width: Number.isInteger(record.width) && record.width > 0 ? record.width : 1200,
      height: Number.isInteger(record.height) && record.height > 0 ? record.height : 800
    });
  }
  function getModel(brandId, modelId) {
    const item = family(brandId, modelId);
    return item ? models.get(item.key) || null : null;
  }
  function resolve(selection = {}, { allowModelFallback = true } = {}) {
    const item = family(selection.brand, selection.model);
    if (!item) return null;
    const year = Number(selection.year);
    const body = text(selection.body), generation = text(selection.generation);
    // Never infer an exact image from a model name, a year alone or an ambiguous choice.
    const g = body && generation && Number.isInteger(year)
      ? V.getCandidates(item.brand.id, item.model.id, year, body).find(candidate => candidate.id === generation && candidate.body === body)
      : null;
    if (g) {
      const legacyAsset = assetURL(g.asset);
      if (legacyAsset) return Object.freeze({
        id: 'render:' + item.key + '/' + g.id, src: legacyAsset, thumb: legacyAsset,
        kind: 'render', match: 'variant', title: item.brand.name + ' ' + item.model.name + ' · ' + g.name,
        alt: 'Ilustrační render ' + item.brand.name + ' ' + item.model.name + ' · ' + g.name,
        depicted: Object.freeze({ label: item.brand.name + ' ' + item.model.name + ' · ' + g.name + ' · ' + g.bodyName, body: g.body, from: g.from, to: g.to }),
        sourceUrl: '', articleUrl: '', author: 'Need For Wheels', license: 'Vlastní ilustrační render', licenseUrl: '', width: 1672, height: 941
      });
      const exact = variants.get(item.key + '/' + g.id);
      if (exact && exact.depicted.body === body && year >= exact.depicted.from && year <= exact.depicted.to) return exact;
    }
    return allowModelFallback ? models.get(item.key) || null : null;
  }
  function creditHTML(visual) {
    if (!visual) return '';
    const source = sourceURL(visual.sourceUrl), license = sourceURL(visual.licenseUrl);
    const parts = [];
    if (visual.author) parts.push(`<span>${visual.kind === 'render' ? 'Vizualizace' : 'Foto'}: ${esc(visual.author)}</span>`);
    if (source) parts.push(`<a href="${esc(source)}" target="_blank" rel="noopener">Zdroj fotografie ↗</a>`);
    if (visual.license) parts.push(license ? `<a href="${esc(license)}" target="_blank" rel="noopener">${esc(visual.license)}</a>` : `<span>${esc(visual.license)}</span>`);
    return parts.length ? `<span class="vehicle-visual-credit">${parts.join('<span aria-hidden="true"> · </span>')}</span>` : '';
  }

  const scriptURL = document.currentScript?.src || new URL('js/vehicle-visuals.js', document.baseURI).href;
  const version = new URL(scriptURL).searchParams.get('v');
  async function loadData(filename, field, target) {
    try {
      const dataURL = new URL('../data/' + filename, scriptURL);
      if (version) dataURL.searchParams.set('v', version);
      const response = await fetch(dataURL, failedLoads.has(filename) ? { cache: 'reload' } : undefined);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.schemaVersion !== 1 || !data[field] || typeof data[field] !== 'object') throw new Error('Invalid visual catalogue');
      target.clear();
      for (const [key, value] of Object.entries(data[field])) {
        const [brandId, modelId, variantId, extra] = key.split('/');
        const item = family(brandId, modelId);
        if (!item || item.key !== brandId + '/' + modelId || extra) continue;
        if (field === 'models' ? Boolean(variantId) : !item.model.variants.some(g => g.id === variantId)) continue;
        const record = sanitise(value, field === 'models' ? 'model' : 'variant', key);
        if (record) target.set(key, record);
      }
      loadErrors.delete(filename);
      failedLoads.delete(filename);
    } catch (error) {
      loadErrors.set(filename, filename + ': ' + error.message);
      failedLoads.set(filename, { filename, field, target });
    }
  }
  const status = () => Object.freeze({ modelCount: models.size, variantCount: variants.size, errors: Object.freeze([...loadErrors.values()]) });
  function begin(tasks) {
    loaded = false;
    return Promise.all(tasks.map(task => loadData(task.filename, task.field, task.target))).then(() => { loaded = true; return status(); });
  }
  let pending = begin([
    { filename: 'vehicle-visuals.json', field: 'models', target: models },
    { filename: 'vehicle-visual-variants.json', field: 'variants', target: variants }
  ]);
  function retryFailedData() {
    if (!loaded) return pending;
    if (!failedLoads.size) return Promise.resolve(status());
    pending = begin([...failedLoads.values()]);
    return pending;
  }
  global.NFWVehicleVisuals = Object.freeze({
    get ready() { return pending; },
    getModel, resolve, creditHTML, retryFailedData,
    get isReady() { return loaded; },
    get modelCount() { return models.size; },
    get variantCount() { return variants.size; }
  });
})(window);
