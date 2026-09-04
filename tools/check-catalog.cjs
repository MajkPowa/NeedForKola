#!/usr/bin/env node
'use strict';

// Run from any directory: node tools/check-catalog.cjs
// Only Node built-ins are needed. Import runChecks/loadCatalogue from a later
// integration harness to reuse these checks without starting a browser here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cataloguePath = path.resolve(__dirname, '..', 'js', 'vehicles.js');

function loadCatalogue(filePath = cataloguePath) {
  const context = vm.createContext({ window: Object.create(null) });
  vm.runInContext(fs.readFileSync(path.join(path.dirname(filePath), 'vehicle-data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, {
    filename: filePath,
    timeout: 1000
  });
  assert.ok(context.window.NFWVehicles, 'vehicles.js must expose window.NFWVehicles');
  return context.window.NFWVehicles;
}

function runChecks(catalogue = loadCatalogue()) {
  let checks = 0;
  const completed = [];
  function check(name, callback) {
    callback();
    checks += 1;
    completed.push(name);
  }

  // Brand names and per-brand model totals transcribed from the requested list.
  // Counts catch omissions without deriving the expectation from vehicles.js.
  const expectedBrands = [
    ['BMW', 20], ['Mercedes-Benz', 19], ['Audi', 17], ['Volkswagen', 18],
    ['Škoda', 9], ['Porsche', 7], ['Toyota', 14], ['Ford', 12], ['Volvo', 10],
    ['Land Rover / Range Rover', 7], ['Jaguar', 7], ['Lexus', 8], ['Hyundai', 10],
    ['Kia', 12], ['Peugeot', 9], ['Renault', 10], ['Opel', 7], ['SEAT', 5],
    ['CUPRA', 6], ['Nissan', 8], ['Mazda', 9], ['Honda', 7], ['Citroën', 7],
    ['Dacia', 6], ['Tesla', 5], ['Jeep', 7], ['Alfa Romeo', 5], ['Fiat', 9],
    ['Suzuki', 7], ['Mitsubishi', 5], ['Subaru', 6], ['MINI', 4], ['Maserati', 7],
    ['Ferrari', 7], ['Lamborghini', 5], ['Bentley', 3], ['Rolls-Royce', 6],
    ['Aston Martin', 6], ['McLaren', 8], ['Chevrolet', 8], ['Dodge', 4], ['RAM', 3],
    ['Cadillac', 7], ['GMC', 4], ['Genesis', 6], ['Polestar', 3], ['BYD', 6],
    ['MG', 7], ['DS Automobiles', 4], ['Lancia', 3], ['Smart', 5],
    ['SsangYong/KGM', 5], ['Isuzu', 2]
  ];

  check('53 brands and 401 models, with every requested brand and per-brand total', () => {
    assert.equal(catalogue.brandCount, 53);
    assert.equal(catalogue.brands.length, 53);
    assert.equal(catalogue.modelCount, 401);
    assert.equal(catalogue.brands.reduce((sum, brand) => sum + brand.models.length, 0), 401);
    expectedBrands.forEach(([name, count], index) => {
      assert.equal(catalogue.brands[index].name, name, `Brand ${index + 1}`);
      assert.equal(catalogue.brands[index].models.length, count, `${name} model total`);
    });
  });

  check('non-empty unique IDs, brand-scoped models, and stable lookups', () => {
    const brandIds = new Set();
    for (const brand of catalogue.brands) {
      assert.match(brand.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(!brandIds.has(brand.id), `Duplicate brand: ${brand.id}`);
      brandIds.add(brand.id);
      assert.equal(catalogue.getBrand(brand.id), brand);
      assert.equal(catalogue.getBrand(brand.name), brand);
      const modelIds = new Set();
      for (const model of brand.models) {
        assert.match(model.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        assert.ok(model.name.trim(), `Empty name in ${brand.id}`);
        assert.ok(!modelIds.has(model.id), `Duplicate model: ${brand.id}/${model.id}`);
        modelIds.add(model.id);
        assert.equal(catalogue.getModel(brand.id, model.id), model);
        assert.equal(catalogue.getModel(brand.name, model.name), model);
        assert.equal(catalogue.getGenerations(brand.id, model.id), model.generations);
      }
    }
    assert.notEqual(catalogue.getModel('seat', 'leon'), catalogue.getModel('cupra', 'leon'));
    assert.equal(catalogue.getModel('BMW', 'řada 1').id, 'rada-1');
    assert.equal(catalogue.getModel('SKODA', 'Octavia').name, 'Octavia');
    assert.equal(catalogue.getModel('Smart', '#1').id, '1');
    assert.equal(catalogue.getModel('Honda', 'e:Ny1').id, 'e-ny1');
    assert.equal(catalogue.getModel('Volkswagen', 'ID. Buzz').id, 'id-buzz');
    assert.equal(catalogue.getModel('Ferrari', '458 Italia'), null, 'Separate showroom must not silently expand the requested catalogue');
  });

  check('BMW X5 2008 and 2020 resolve to different generations and images', () => {
    const oldCar = catalogue.resolve('bmw', 'x5', 2008);
    const newerCar = catalogue.resolve('bmw', 'x5', '2020');
    assert.equal(oldCar.id, 'e70');
    assert.equal(oldCar.asset, 'assets/cars/bmw-x5-e70.webp');
    assert.equal(newerCar.id, 'g05');
    assert.equal(newerCar.asset, 'assets/cars/bmw-x5-g05.webp');
    assert.notEqual(oldCar.asset, newerCar.asset);
    assert.equal(oldCar.kind, 'render');
    assert.equal(newerCar.kind, 'render');
    assert.equal(catalogue.resolve('bmw', 'x5', 2001).id, 'e53');
    assert.equal(catalogue.resolve('bmw', 'x5', 2012).id, 'e70-lci');
    assert.equal(catalogue.resolve('bmw', 'x5', 2016).id, 'f15');
    assert.equal(catalogue.resolve('bmw', 'x5', 2024).id, 'g05-lci');
  });

  check('transition years need an explicit generation and never auto-select an image', () => {
    const changes = [
      [2003, ['e53', 'e53-lci']], [2006, ['e53-lci', 'e70']], [2010, ['e70', 'e70-lci']],
      [2013, ['e70-lci', 'f15']], [2018, ['f15', 'g05']],
      [2023, ['g05', 'g05-lci']], [2026, ['g05-lci', 'generation-5']]
    ];
    for (const [year, ids] of changes) {
      assert.equal(catalogue.resolve('bmw', 'x5', year), null, `${year} needs disambiguation`);
      assert.deepEqual(Array.from(catalogue.getCandidates('bmw', 'x5', year), item => item.id), ids);
    }
  });

  check('every model has real source periods and preview assets stay exact', () => {
    const actualAssets = [];
    let count = 0;
    for (const brand of catalogue.brands) {
      for (const model of brand.models) {
        assert.ok(model.variants.length > 0, `Missing periods: ${brand.id}/${model.id}`);
        assert.equal(model.variants, model.generations);
        const ids = new Set();
        for (const generation of model.generations) {
          count++;
          assert.ok(!ids.has(generation.id), `Duplicate variant ${model.id}/${generation.id}`);
          ids.add(generation.id);
          assert.ok(Number.isInteger(generation.from) && Number.isInteger(generation.to));
          assert.ok(generation.from <= generation.to && generation.to <= 2026);
          assert.match(generation.source, /^https:\/\//);
          assert.ok(generation.body && generation.bodyName);
          assert.ok(['imported','verified'].includes(generation.confidence));
          assert.ok(['source','open','inferred'].includes(generation.endBasis));
          if (generation.asset) {
            actualAssets.push(`${brand.id}/${model.id}/${generation.id}`);
            assert.equal(generation.kind, 'render');
            assert.ok(fs.existsSync(path.resolve(__dirname,'..',generation.asset)));
          }
        }
        const expectedYears = new Set(model.variants.flatMap(v => Array.from({length:v.to-v.from+1},(_,i)=>v.from+i)));
        assert.deepEqual(new Set(catalogue.getYears(brand.id,model.id)), expectedYears);
      }
    }
    assert.equal(count, catalogue.variantCount);
    assert.ok(count > 2500, 'Substantial source-backed coverage');
    assert.deepEqual(actualAssets, ['bmw/x5/e70', 'bmw/x5/g05']);
    assert.equal(catalogue.resolve('bmw', 'x5', 2012).asset, undefined);
  });

  check('body facets are real intersections and unavailable years remain gaps', () => {
    assert.equal(catalogue.getCandidates('ford','puma',2010).length,0);
    assert.ok(!catalogue.getYears('ford','puma').includes(2010));
    assert.ok(catalogue.getBodies('ford','puma',2000).some(b=>b.id==='coupe'));
    assert.ok(catalogue.getBodies('ford','puma',2021).some(b=>b.id==='suv'));
    for (const brand of catalogue.brands) for (const model of brand.models) {
      for (const year of [1990,2000,2010,2020,2026]) {
        const rows = catalogue.getCandidates(brand.id,model.id,year);
        for (const body of catalogue.getBodies(brand.id,model.id,year)) {
          assert.ok(rows.some(v=>v.body===body.id));
          const exact = catalogue.getCandidates(brand.id,model.id,year,body.id);
          assert.ok(exact.length && exact.every(v=>v.body===body.id && v.from<=year && v.to>=year));
        }
      }
    }
    assert.equal(catalogue.resolve('bmw','x5',2020,'wagon'),null);
  });

  check('invalid and future years are rejected without selecting a car', () => {
    const invalidYears = [null, undefined, '', '   ', 'abc', '<script>alert(1)</script>',
      '2020;alert(1)', '2020/01/01', '2020x', NaN, Infinity, -Infinity, 1949, 1998,
      2008.5, 2027, 999999999, false, true];
    assert.equal(catalogue.verifiedThrough, 2026);
    for (const year of invalidYears) {
      assert.equal(catalogue.resolve('bmw', 'x5', year), null, `Invalid year: ${String(year)}`);
      assert.equal(catalogue.getCandidates('bmw', 'x5', year).length, 0);
    }
  });

  check('unknown and malicious brand/model strings never resolve to catalogue content', () => {
    const unknownValues = [null, undefined, '', 'not-a-car', '__proto__', 'constructor',
      'prototype', 'toString', '../../etc/passwd', 'javascript:alert(1)',
      '<img src=x onerror=alert(1)>', '<script>window.pwned=true</script>',
      '\" autofocus onfocus=alert(1) x=\"', 'bmw&model=x5', '%62mw', '\u0000bogus'];
    for (const value of unknownValues) {
      assert.equal(catalogue.getBrand(value), null, `Unknown brand: ${String(value)}`);
      assert.equal(catalogue.getModel('bmw', value), null, `Unknown model: ${String(value)}`);
      assert.equal(catalogue.resolve('bmw', value, 2020), null);
      assert.equal(catalogue.getModel(value, 'x5'), null);
      assert.equal(catalogue.resolve(value, 'x5', 2020), null);
    }
    assert.equal(catalogue.getModel('bmw', 'q5'), null);
    assert.equal(catalogue.getModel('audi', 'x5'), null);
    assert.equal(catalogue.resolve('audi', 'x5', 2020), null);
  });

  check('registry and nested data cannot be mutated', () => {
    assert.ok(Object.isFrozen(catalogue));
    assert.ok(Object.isFrozen(catalogue.brands));
    for (const brand of catalogue.brands) {
      assert.ok(Object.isFrozen(brand));
      assert.ok(Object.isFrozen(brand.models));
      for (const model of brand.models) {
        assert.ok(Object.isFrozen(model));
        assert.ok(Object.isFrozen(model.generations));
        model.generations.forEach(generation => assert.ok(Object.isFrozen(generation)));
      }
    }
    assert.throws(() => { catalogue.brands[0].name = '<script>'; }, TypeError);
    assert.throws(() => { catalogue.getModel('bmw', 'x5').generations[1].asset = 'wrong.webp'; }, TypeError);
    assert.equal(catalogue.resolve('bmw', 'x5', 2008).asset, 'assets/cars/bmw-x5-e70.webp');
  });

  return { checks, brands: catalogue.brandCount, models: catalogue.modelCount, completed };
}

if (require.main === module) {
  try {
    const result = runChecks();
    result.completed.forEach(name => process.stdout.write(`PASS ${name}\n`));
    process.stdout.write(`Catalogue verified: ${result.brands} brands, ${result.models} models, ${result.checks} check groups.\n`);
  } catch (error) {
    process.stderr.write(`Catalogue check failed: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { loadCatalogue, runChecks };
