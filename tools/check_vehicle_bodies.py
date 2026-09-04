"""Regression checks for body ambiguities; python tools/check_vehicle_bodies.py."""
from vehicle_bodies import classify_body, normalise, brand_key, TARGET_BRANDS

CASES = [
    ("bmw", "rada-3", "3 Series Touring", 2019, "wagon"),
    ("bmw", "rada-2", "2 Series Gran Coupe", 2019, "sedan-coupe"),
    ("bmw", "rada-4", "4 Series Gran Coupe", 2014, "liftback"),
    ("bmw", "rada-8", "8 Series Gran Coupe", 2019, "sedan-coupe"),
    ("bmw", "rada-2", "2 Series Active Tourer", 2014, "mpv"),
    ("bmw", "x6", "X6", 2023, "suv-coupe"),
    ("bmw", "x2", "X2", 2018, "suv"),
    ("bmw", "x2", "X2", 2023, "suv-coupe"),
    ("bmw", "z4", "Z4 Coupe", 2006, "coupe"),
    ("mercedes-benz", "glc", "MERCEDES BENZ GLC Class Coupe", 2023, "suv-coupe"),
    ("mercedes-benz", "s", "MERCEDES BENZ CL-Klasse and predecessors", 1999, "coupe"),
    ("mercedes-benz", "amg-gt", "GT 4-DOOR COUPE", 2018, "liftback"),
    ("audi", "a5", "A5 Sedan", 2024, "liftback"),
    ("audi", "q3", "Q3 Sportback", 2020, "suv-coupe"),
    ("audi", "a3", "A3 Sportback", 2020, "hatchback-5"),
    ("audi", "a4", "A4 Cabriolet", 2006, "cabriolet"),
    ("audi", "a5", "A5", 2024, "unknown"),
    ("honda", "hr-v", "HR-V 3 Doors", 1999, "suv-3"),
    ("honda", "civic", "Civic 3 Doors", 2007, "hatchback-3"),
    ("toyota", "rav4", "RAV4 5 Doors", 2000, "suv-5"),
    ("toyota", "corolla", "Corolla 3 Doors", 2004, "hatchback-3"),
    ("toyota", "hilux", "Hilux Double Cab", 2015, "pickup-double"),
    ("toyota", "hilux", "Hilux", 2015, "pickup"),
    ("ford", "ranger", "Ranger Super Cab", 2022, "pickup-extended"),
    ("ford", "puma", "Puma", 1997, "coupe"),
    ("ford", "puma", "Puma", 2019, "suv"),
    ("ford", "puma", "Puma", 2008, "unknown"),
    ("ford", "explorer", "Explorer Sport Trac", 2006, "pickup"),
    ("ford", "tourneo", "Transit Connect Wagon", 2019, "mpv"),
    ("volkswagen", "golf", "Golf Sportsvan", 2014, "mpv"),
    ("volkswagen", "polo", "Polo Coupe", 1985, "hatchback-3"),
    ("peugeot", "5008", "5008", 2013, "mpv"),
    ("peugeot", "5008", "5008", 2016, "suv"),
    ("peugeot", "508", "508", 2011, "sedan"),
    ("peugeot", "508", "508", 2018, "liftback"),
    ("renault", "espace", "Espace", 1996, "mpv"),
    ("renault", "espace", "Espace", 2023, "suv"),
    ("renault", "megane", "Megane Coupe", 2012, "hatchback-3"),
    ("kia", "proceed", "Pro cee'd", 2013, "hatchback"),
    ("kia", "proceed", "ProCeed", 2018, "wagon"),
    ("fiat", "500", "500", 1957, "unknown"),
    ("fiat", "500", "500", 2007, "hatchback"),
    ("fiat", "500", "500 Cabriolet", 2020, "cabriolet"),
    ("fiat", "500", "500 3+1", 2020, "hatchback"),
    ("fiat", "600", "600", 1955, "sedan"),
    ("fiat", "600", "600", 2023, "suv"),
    ("citroen", "c4", "CITROËN C4 Coupe", 2004, "hatchback-3"),
    ("CitroÃ«n", "c3", "CITROÃ‹N C3", 2024, "hatchback"),
    ("ŠKODA", "octavia", "SKODA Octavia Combi", 2020, "wagon"),
    ("skoda", "octavia", "SKODA Octavia Scout", 2006, "wagon"),
    ("skoda", "octavia", "SKODA Octavia Scout", 2014, "wagon"),
    ("skoda", "octavia", "SKODA Octavia Scout", 2020, "wagon"),
    ("volkswagen", "passat", "Passat 3 Doors", 1973, "liftback"),
    ("SsangYong/KGM", "musso", "Musso", 1993, "suv"),
    ("KGM", "musso", "Musso", 2018, "pickup"),
    ("porsche", "911", "911 Targa", 2020, "targa"),
    ("porsche", "cayenne", "Cayenne Coupe", 2019, "suv-coupe"),
    ("porsche", "taycan", "Taycan Cross Turismo", 2021, "wagon"),
    ("citroen", "berlingo", "Berlingo", 2018, "unknown"),
    ("gmc", "hummer-ev", "Hummer EV", 2021, "pickup"),
    ("subaru", "impreza", "Impreza", 2016, "unknown"),
    ("subaru", "impreza", "Impreza", 2022, "hatchback"),
    ("mg", "mg5", "MG 5", 2021, "unknown"),
    ("chevrolet", "cruze", "Cruze - 5 doors", 2017, "hatchback-5"),
    ("chevrolet", "cruze", "Cruze", 2017, "sedan"),
    ("subaru", "outback", "Outback", 2025, "suv"),
]

assert len(TARGET_BRANDS) == 53
for brand, model, name, year, expected in CASES:
    actual = classify_body(brand, model, name, f"{name} ({year})", year)
    assert actual["id"] == expected, (brand, model, name, year, expected, actual)
    assert set(actual) == {"id", "name", "basis"}
    assert actual["basis"] in ("source-name", "family-curation", "unresolved")
    assert (actual["basis"] == "unresolved") == (expected == "unknown")
assert classify_body("bogus", "bogus", "", "", None)["id"] == "unknown"
assert classify_body("bogus", "bogus", "Car", "Car 3 Doors", 2020)["id"] == "unknown"
assert brand_key("Land Rover / Range Rover") == "land-rover-range-rover"
assert normalise("Citroën") == "citroen"
print(f"PASS {len(CASES)} body cases, brand aliases, exact one-record output and unresolved contract")
