/* Need For Wheels vehicle catalogue. See docs/vehicle-catalog.md for data scope. */
(function (global) {
  'use strict';

  const UNKNOWN_GENERATION = 'Generaci ověříme podle roku / VIN';
  const VERIFIED_THROUGH = 2026;
  const DATA = global.NFW_VEHICLE_DATA;
  if (!DATA || DATA.schemaVersion !== 1) throw new Error('Vehicle data is missing or incompatible.');

  const catalogue = [
    ['BMW', ['řada 1', 'řada 2', 'řada 3', 'řada 4', 'řada 5', 'řada 7', 'řada 8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4', 'i4', 'i5', 'i7', 'iX']],
    ['Mercedes-Benz', ['A', 'B', 'C', 'E', 'S', 'CLA', 'CLS', 'CLE', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'SL', 'AMG GT', 'EQE', 'EQS', 'V-Class']],
    ['Audi', ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q6 e-tron', 'Q7', 'Q8', 'TT', 'R8', 'e-tron GT']],
    ['Volkswagen', ['Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'Taigo', 'T-Roc', 'Tiguan', 'Tayron', 'Touareg', 'Touran', 'Caddy', 'Multivan', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz']],
    ['Škoda', ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Karoq', 'Kodiaq', 'Elroq', 'Enyaq']],
    ['Porsche', ['718 Boxster', '718 Cayman', '911', 'Panamera', 'Macan', 'Cayenne', 'Taycan']],
    ['Toyota', ['Aygo X', 'Yaris', 'Corolla', 'Camry', 'C-HR', 'Yaris Cross', 'Corolla Cross', 'RAV4', 'Highlander', 'Land Cruiser', 'Hilux', 'GR86', 'GR Supra', 'Proace']],
    ['Ford', ['Fiesta', 'Focus', 'Mondeo', 'Puma', 'Kuga', 'Mustang', 'Mustang Mach-E', 'Explorer', 'Ranger', 'Bronco', 'Tourneo', 'Transit']],
    ['Volvo', ['S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90', 'EX30', 'EX40', 'EX90']],
    ['Land Rover / Range Rover', ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Velar', 'Evoque']],
    ['Jaguar', ['XE', 'XF', 'XJ', 'F-Type', 'E-Pace', 'F-Pace', 'I-Pace']],
    ['Lexus', ['LBX', 'UX', 'NX', 'RX', 'RZ', 'ES', 'LS', 'LC']],
    ['Hyundai', ['i10', 'i20', 'i30', 'Bayon', 'Kona', 'Tucson', 'Santa Fe', 'Ioniq 5', 'Ioniq 6', 'Ioniq 9']],
    ['Kia', ['Picanto', 'Ceed', 'ProCeed', 'XCeed', 'Stonic', 'Niro', 'Sportage', 'Sorento', 'EV3', 'EV4', 'EV6', 'EV9']],
    ['Peugeot', ['208', '308', '408', '508', '2008', '3008', '5008', 'Rifter', 'Traveller']],
    ['Renault', ['Clio', 'Captur', 'Arkana', 'Mégane', 'Symbioz', 'Austral', 'Espace', 'Rafale', 'Scenic', 'Kangoo']],
    ['Opel', ['Corsa', 'Astra', 'Mokka', 'Frontera', 'Grandland', 'Combo', 'Zafira']],
    ['SEAT', ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco']],
    ['CUPRA', ['Leon', 'Formentor', 'Ateca', 'Born', 'Tavascan', 'Terramar']],
    ['Nissan', ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Ariya', 'Leaf', 'GT-R', 'Navara']],
    ['Mazda', ['Mazda2', 'Mazda3', 'Mazda6', 'CX-30', 'CX-5', 'CX-60', 'CX-80', 'MX-5', 'MX-30']],
    ['Honda', ['Jazz', 'Civic', 'HR-V', 'ZR-V', 'CR-V', 'e:Ny1', 'NSX']],
    ['Citroën', ['C3', 'C4', 'C4 X', 'C5 Aircross', 'C5 X', 'Berlingo', 'SpaceTourer']],
    ['Dacia', ['Sandero', 'Logan', 'Jogger', 'Duster', 'Bigster', 'Spring']],
    ['Tesla', ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck']],
    ['Jeep', ['Avenger', 'Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Gladiator']],
    ['Alfa Romeo', ['Giulia', 'Stelvio', 'Tonale', 'Junior', '4C']],
    ['Fiat', ['500', '500X', '500L', 'Panda', 'Tipo', 'Grande Panda', '600', 'Doblò', 'Ducato']],
    ['Suzuki', ['Swift', 'Ignis', 'Vitara', 'S-Cross', 'Jimny', 'Across', 'Swace']],
    ['Mitsubishi', ['Colt', 'ASX', 'Eclipse Cross', 'Outlander', 'L200']],
    ['Subaru', ['Impreza', 'Crosstrek', 'Forester', 'Outback', 'BRZ', 'Solterra']],
    ['MINI', ['Cooper', 'Aceman', 'Countryman', 'Clubman']],
    ['Maserati', ['Grecale', 'Levante', 'Ghibli', 'Quattroporte', 'GranTurismo', 'GranCabrio', 'MC20']],
    ['Ferrari', ['Roma', 'Portofino', '296 GTB', 'SF90', '12Cilindri', 'Purosangue', 'F8 Tributo']],
    ['Lamborghini', ['Huracán', 'Temerario', 'Revuelto', 'Urus', 'Aventador']],
    ['Bentley', ['Continental GT', 'Flying Spur', 'Bentayga']],
    ['Rolls-Royce', ['Ghost', 'Phantom', 'Cullinan', 'Spectre', 'Wraith', 'Dawn']],
    ['Aston Martin', ['Vantage', 'DB11', 'DB12', 'DBS', 'Vanquish', 'DBX']],
    ['McLaren', ['Artura', 'GT', 'GTS', '570S', '600LT', '720S', '750S', 'Senna']],
    ['Chevrolet', ['Spark', 'Cruze', 'Malibu', 'Camaro', 'Corvette', 'Tahoe', 'Suburban', 'Silverado']],
    ['Dodge', ['Challenger', 'Charger', 'Durango', 'Hornet']],
    ['RAM', ['1500', '2500', '3500']],
    ['Cadillac', ['CT4', 'CT5', 'XT4', 'XT5', 'XT6', 'Escalade', 'Lyriq']],
    ['GMC', ['Sierra', 'Yukon', 'Canyon', 'Hummer EV']],
    ['Genesis', ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80']],
    ['Polestar', ['Polestar 2', '3', '4']],
    ['BYD', ['Dolphin', 'Atto 3', 'Seal', 'Seal U', 'Tang', 'Han']],
    ['MG', ['MG3', 'MG4', 'MG5', 'ZS', 'HS', 'Marvel R', 'Cyberster']],
    ['DS Automobiles', ['DS 3', 'DS 4', 'DS 7', 'DS 9']],
    ['Lancia', ['Ypsilon', 'Delta', 'Thema']],
    ['Smart', ['Fortwo', 'Forfour', '#1', '#3', '#5']],
    ['SsangYong/KGM', ['Tivoli', 'Korando', 'Torres', 'Rexton', 'Musso']],
    ['Isuzu', ['D-Max', 'MU-X']]
  ];

  function slug(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const brands = catalogue.map(function (entry) {
    return {
      id: slug(entry[0]),
      name: entry[0],
      models: entry[1].map(function (name) {
        const variants = DATA.models[slug(entry[0]) + '/' + slug(name)] || [];
        return { id: slug(name), name: name, generations: variants, variants: variants };
      })
    };
  });

  function getBrand(brandId) {
    const id = slug(brandId);
    return brands.find(function (brand) { return brand.id === id; }) || null;
  }

  function getModel(brandId, modelId) {
    const brand = getBrand(brandId);
    const id = slug(modelId);
    return brand ? brand.models.find(function (model) { return model.id === id; }) || null : null;
  }

  function getGenerations(brandId, modelId) {
    const model = getModel(brandId, modelId);
    return model ? model.generations : [];
  }

  function validYear(year) {
    return (typeof year === 'number' || typeof year === 'string') && String(year).trim() !== ''
      && Number.isInteger(Number(year)) && Number(year) >= 1886 && Number(year) <= VERIFIED_THROUGH;
  }

  function getCandidates(brandId, modelId, year, bodyId) {
    if (!validYear(year)) return [];
    return getGenerations(brandId, modelId).filter(function (variant) {
      return Number(year) >= variant.from && Number(year) <= variant.to && (!bodyId || variant.body === bodyId);
    });
  }

  function getBodies(brandId, modelId, year) {
    const rows = year == null ? getGenerations(brandId, modelId) : getCandidates(brandId, modelId, year);
    const found = new Map();
    rows.forEach(function (row) { found.set(row.body, { id: row.body, name: row.bodyName }); });
    return Array.from(found.values()).sort(function (a,b) { return a.name.localeCompare(b.name, 'cs'); });
  }

  function getYears(brandId, modelId, bodyId) {
    const years = new Set();
    getGenerations(brandId, modelId).forEach(function (row) {
      if (bodyId && row.body !== bodyId) return;
      for (let year = row.from; year <= Math.min(row.to, VERIFIED_THROUGH); year++) years.add(year);
    });
    return Array.from(years).sort(function (a,b) { return b-a; });
  }

  function resolve(brandId, modelId, year, bodyId) {
    const candidates = getCandidates(brandId, modelId, year, bodyId);
    return candidates.length === 1 ? candidates[0] : null;
  }

  function periodLabel(row) {
    return row.from === row.to ? String(row.from) : row.from + '–' + row.to;
  }

  function freezeDeep(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freezeDeep);
      Object.freeze(value);
    }
    return value;
  }

  // Prevent UI code from accidentally changing the shared registry.
  brands.forEach(function (brand) {
    brand.models.forEach(function (model) {
      model.generations.forEach(freezeDeep);
      Object.freeze(model.generations);
      Object.freeze(model);
    });
    Object.freeze(brand.models);
    Object.freeze(brand);
  });
  Object.freeze(brands);

  global.NFWVehicles = Object.freeze({
    brands: brands,
    brandCount: brands.length,
    modelCount: brands.reduce(function (sum, brand) { return sum + brand.models.length; }, 0),
    unknownGenerationLabel: UNKNOWN_GENERATION,
    verifiedThrough: VERIFIED_THROUGH,
    through: VERIFIED_THROUGH,
    variantCount: DATA.stats.variants,
    stats: Object.freeze(DATA.stats),
    getBodies: getBodies,
    getYears: getYears,
    getVariants: getGenerations,
    periodLabel: periodLabel,
    getBrand: getBrand,
    getModel: getModel,
    getGenerations: getGenerations,
    getCandidates: getCandidates,
    resolve: resolve
  });
})(window);
