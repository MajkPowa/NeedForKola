/* Exact, licensed vehicle meshes. Catalogue coverage and 3D availability are separate. */
(function () {
  'use strict';
  if (window.NFWVehicleModels) return;
  const models = [{
    id: 'bmw-x5-g05', name: 'BMW X5 G05', edition: '2018 · před faceliftem',
    brand: 'bmw', model: 'x5', generations: ['g05'], body: 'suv', from: 2018, to: 2023,
    src: 'assets/models/bmw-x5-g05.glb', metadata: 'data/bmw-x5-g05-model.json',
    author: 'BMW Car IT GmbH a přispěvatelé', source: 'https://github.com/bmwcarit/digital-car-3d',
    license: 'CC BY 4.0', licenseURL: 'https://creativecommons.org/licenses/by/4.0/',
    camera: { position: [-3.8, 1.95, 4.2], target: [0, .85, 0], minDistance: 1.2, maxDistance: 12 },
  }, {
    id: 'tesla-model-3-2018', name: 'Tesla Model 3', edition: '2018 · původní provedení',
    brand: 'tesla', model: 'model-3', generations: ['v-6710df4e3223'], body: 'sedan', from: 2018, to: 2018,
    src: 'assets/models/tesla-model-3-2018.glb', metadata: 'data/tesla-model-3-2018-model.json',
    author: 'Ameer Studio', source: 'https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f',
    license: 'CC BY 4.0', licenseURL: 'https://creativecommons.org/licenses/by/4.0/',
    camera: { position: [-3.8, 1.75, 4.2], target: [0, .65, 0], minDistance: 1.2, maxDistance: 12 },
  }];
  function resolve(selection = {}) {
    const year = Number(selection.year);
    if (!Number.isInteger(year) || !selection.generation || !selection.body) return null;
    return models.find(asset => asset.brand === selection.brand && asset.model === selection.model &&
      asset.generations.includes(selection.generation) && asset.body === selection.body &&
      year >= asset.from && year <= asset.to) || null;
  }
  window.NFWVehicleModels = Object.freeze({
    models: Object.freeze(models.map(asset => Object.freeze(asset))),
    resolve, get: id => models.find(asset => asset.id === id) || null,
    get defaultModel() { return models[0]; },
  });
})();
