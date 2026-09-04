/* Local raster brand identifiers. Provenance: docs/brand-logos.md. */
(function (global) {
  "use strict";
  const logos = {
  "bmw": {
    "src": "assets/brands/bmw.png",
    "name": "BMW",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/bmw.png"
  },
  "mercedes-benz": {
    "src": "assets/brands/mercedes-benz.png",
    "name": "Mercedes-Benz",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mercedes-benz.png"
  },
  "audi": {
    "src": "assets/brands/audi.png",
    "name": "Audi",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/audi.png"
  },
  "volkswagen": {
    "src": "assets/brands/volkswagen.png",
    "name": "Volkswagen",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/volkswagen.png"
  },
  "skoda": {
    "src": "assets/brands/skoda.png",
    "name": "Škoda",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/skoda.png"
  },
  "porsche": {
    "src": "assets/brands/porsche.png",
    "name": "Porsche",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/porsche.png"
  },
  "toyota": {
    "src": "assets/brands/toyota.png",
    "name": "Toyota",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/toyota.png"
  },
  "ford": {
    "src": "assets/brands/ford.png",
    "name": "Ford",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/ford.png"
  },
  "volvo": {
    "src": "assets/brands/volvo.png",
    "name": "Volvo",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/volvo.png"
  },
  "land-rover-range-rover": {
    "src": "assets/brands/land-rover-range-rover.png",
    "name": "Land Rover / Range Rover",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/land-rover.png"
  },
  "jaguar": {
    "src": "assets/brands/jaguar.png",
    "name": "Jaguar",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/jaguar.png"
  },
  "lexus": {
    "src": "assets/brands/lexus.png",
    "name": "Lexus",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/lexus.png"
  },
  "hyundai": {
    "src": "assets/brands/hyundai.png",
    "name": "Hyundai",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/hyundai.png"
  },
  "kia": {
    "src": "assets/brands/kia.png",
    "name": "Kia",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/kia.png"
  },
  "peugeot": {
    "src": "assets/brands/peugeot.png",
    "name": "Peugeot",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/peugeot.png"
  },
  "renault": {
    "src": "assets/brands/renault.png",
    "name": "Renault",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/renault.png"
  },
  "opel": {
    "src": "assets/brands/opel.png",
    "name": "Opel",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/opel.png"
  },
  "seat": {
    "src": "assets/brands/seat.png",
    "name": "SEAT",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/seat.png"
  },
  "cupra": {
    "src": "assets/brands/cupra.png",
    "name": "CUPRA",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/cupra.png"
  },
  "nissan": {
    "src": "assets/brands/nissan.png",
    "name": "Nissan",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/nissan.png"
  },
  "mazda": {
    "src": "assets/brands/mazda.png",
    "name": "Mazda",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mazda.png"
  },
  "honda": {
    "src": "assets/brands/honda.png",
    "name": "Honda",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/honda.png"
  },
  "citroen": {
    "src": "assets/brands/citroen.png",
    "name": "Citroën",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/citroen.png"
  },
  "dacia": {
    "src": "assets/brands/dacia.png",
    "name": "Dacia",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/dacia.png"
  },
  "tesla": {
    "src": "assets/brands/tesla.png",
    "name": "Tesla",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/tesla.png"
  },
  "jeep": {
    "src": "assets/brands/jeep.png",
    "name": "Jeep",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/jeep.png"
  },
  "alfa-romeo": {
    "src": "assets/brands/alfa-romeo.png",
    "name": "Alfa Romeo",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/alfa-romeo.png"
  },
  "fiat": {
    "src": "assets/brands/fiat.png",
    "name": "Fiat",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/fiat.png"
  },
  "suzuki": {
    "src": "assets/brands/suzuki.png",
    "name": "Suzuki",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/suzuki.png"
  },
  "mitsubishi": {
    "src": "assets/brands/mitsubishi.png",
    "name": "Mitsubishi",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mitsubishi.png"
  },
  "subaru": {
    "src": "assets/brands/subaru.png",
    "name": "Subaru",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/subaru.png"
  },
  "mini": {
    "src": "assets/brands/mini.png",
    "name": "MINI",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mini.png"
  },
  "maserati": {
    "src": "assets/brands/maserati.png",
    "name": "Maserati",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/maserati.png"
  },
  "ferrari": {
    "src": "assets/brands/ferrari.png",
    "name": "Ferrari",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/ferrari.png"
  },
  "lamborghini": {
    "src": "assets/brands/lamborghini.png",
    "name": "Lamborghini",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/lamborghini.png"
  },
  "bentley": {
    "src": "assets/brands/bentley.png",
    "name": "Bentley",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/bentley.png"
  },
  "rolls-royce": {
    "src": "assets/brands/rolls-royce.png",
    "name": "Rolls-Royce",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/rolls-royce.png"
  },
  "aston-martin": {
    "src": "assets/brands/aston-martin.png",
    "name": "Aston Martin",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/aston-martin.png"
  },
  "mclaren": {
    "src": "assets/brands/mclaren.png",
    "name": "McLaren",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mclaren.png"
  },
  "chevrolet": {
    "src": "assets/brands/chevrolet.png",
    "name": "Chevrolet",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/chevrolet.png"
  },
  "dodge": {
    "src": "assets/brands/dodge.png",
    "name": "Dodge",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/dodge.png"
  },
  "ram": {
    "src": "assets/brands/ram.png",
    "name": "RAM",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/ram.png"
  },
  "cadillac": {
    "src": "assets/brands/cadillac.png",
    "name": "Cadillac",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/cadillac.png"
  },
  "gmc": {
    "src": "assets/brands/gmc.png",
    "name": "GMC",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/gmc.png"
  },
  "genesis": {
    "src": "assets/brands/genesis.png",
    "name": "Genesis",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/genesis.png"
  },
  "polestar": {
    "src": "assets/brands/polestar.png",
    "name": "Polestar",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/polestar.png"
  },
  "byd": {
    "src": "assets/brands/byd.png",
    "name": "BYD",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/byd.png"
  },
  "mg": {
    "src": "assets/brands/mg.png",
    "name": "MG",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/mg.png"
  },
  "ds-automobiles": {
    "src": "assets/brands/ds-automobiles.png",
    "name": "DS Automobiles",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/ds.png"
  },
  "lancia": {
    "src": "assets/brands/lancia.png",
    "name": "Lancia",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/lancia.png"
  },
  "smart": {
    "src": "assets/brands/smart.png",
    "name": "Smart",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/smart.png"
  },
  "ssangyong-kgm": {
    "src": "assets/brands/ssangyong-kgm.png",
    "name": "SsangYong/KGM",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/ssangyong.png"
  },
  "isuzu": {
    "src": "assets/brands/isuzu.png",
    "name": "Isuzu",
    "source": "https://github.com/filippofilip95/car-logos-dataset/blob/bb2d661f28ce617dba8a51bdfc2069a3381a23b0/logos/optimized/isuzu.png"
  }
};
  Object.values(logos).forEach(Object.freeze);
  global.NFWBrandLogos = Object.freeze(logos);
})(window);
