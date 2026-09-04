"""Conservative, one-record body classification for Need For Wheels imports.

The input database does not supply bodyType. Never expand a row into multiple
bodies: classify an explicit name, use a curated family rule, or return unknown.
Run directly to write an audit of unresolved rows in the 53 requested brands.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import unicodedata
from pathlib import Path


BODY_NAMES = {
    "hatchback": "Hatchback", "hatchback-3": "Hatchback · 3 dveře",
    "hatchback-5": "Hatchback · 5 dveří", "wagon": "Kombi",
    "sedan": "Sedan", "sedan-coupe": "Čtyřdveřové kupé", "liftback": "Liftback",
    "coupe": "Kupé", "cabriolet": "Kabriolet / roadster", "targa": "Targa",
    "suv": "SUV / crossover", "suv-3": "SUV · 3 dveře", "suv-5": "SUV · 5 dveří",
    "suv-coupe": "SUV kupé", "suv-cabriolet": "SUV kabriolet",
    "mpv": "MPV", "van": "Dodávka", "pickup": "Pick-up",
    "pickup-single": "Pick-up · jednoduchá kabina", "pickup-extended": "Pick-up · prodloužená kabina",
    "pickup-double": "Pick-up · dvojitá kabina", "unknown": "Karoserie neuvedena",
}


def normalise(value: object) -> str:
    """ASCII words, with a bounded repair of common source mojibake."""
    value = str(value or "")
    if any(c in value for c in ("Ã", "Â", "Å", "Ä")):
        for encoding in ("cp1252", "latin1"):
            try:
                repaired = value.encode(encoding).decode("utf8")
                if repaired.count("�") <= value.count("�"):
                    value = repaired
                    break
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


BRAND_ALIASES = {
    "mercedes benz": "mercedes-benz", "mercedes": "mercedes-benz",
    "land rover": "land-rover-range-rover", "range rover": "land-rover-range-rover",
    "land rover range rover": "land-rover-range-rover", "ssangyong": "ssangyong-kgm",
    "ssang yong": "ssangyong-kgm", "kgm": "ssangyong-kgm", "ssangyong kgm": "ssangyong-kgm",
    "citron": "citroen", "citroen": "citroen", "ds": "ds-automobiles",
    "ds automobiles": "ds-automobiles", "mini": "mini", "rolls royce": "rolls-royce",
}


def brand_key(value: str) -> str:
    value = normalise(value)
    return BRAND_ALIASES.get(value, value.replace(" ", "-"))


def model_key(value: str) -> str:
    return normalise(value).replace(" ", "-")


# Base body only. Explicit source names override these entries. No door counts
# are assigned from this table. Variants of multi-body families remain separate
# only if separate source records identify them.
FAMILY_GROUPS = {
    "bmw": {"hatchback": "rada-1", "sedan": "rada-3|rada-5|rada-7|i5|i7", "coupe": "rada-2|rada-4|rada-8", "liftback": "i4", "suv": "x1|x2|x3|x5|x7|xm|ix", "suv-coupe": "x4|x6", "cabriolet": "z4"},
    "mercedes-benz": {"hatchback": "a", "mpv": "b|v-class", "sedan": "c|e|s|eqe", "sedan-coupe": "cla|cls", "liftback": "eqs", "coupe": "cle|amg-gt", "cabriolet": "sl", "suv": "gla|glb|glc|gle|gls|g-class"},
    "audi": {"hatchback": "a1|a3", "sedan": "a4|a6|a8|e-tron-gt", "liftback": "a7", "suv": "q2|q3|q4-e-tron|q5|q6-e-tron|q7|q8", "coupe": "tt|r8"},
    "volkswagen": {"hatchback": "polo|golf|id-3", "sedan": "passat", "liftback": "arteon|id-7", "suv": "t-cross|t-roc|tiguan|tayron|touareg|id-4", "suv-coupe": "taigo|id-5", "mpv": "touran|multivan|id-buzz"},
    "skoda": {"hatchback": "fabia|scala", "liftback": "octavia|superb", "suv": "kamiq|karoq|kodiaq|elroq|enyaq"},
    "porsche": {"cabriolet": "718-boxster", "coupe": "718-cayman|911", "liftback": "panamera", "sedan": "taycan", "suv": "macan|cayenne"},
    "toyota": {"suv": "aygo-x|c-hr|yaris-cross|corolla-cross|rav4|highlander|land-cruiser", "hatchback": "yaris", "sedan": "camry", "coupe": "gr86|gr-86|gr-supra", "pickup": "hilux"},
    "ford": {"hatchback": "fiesta|focus", "suv": "kuga|mustang-mach-e|explorer|bronco", "coupe": "mustang", "pickup": "ranger", "mpv": "tourneo"},
    "volvo": {"sedan": "s60|s90", "wagon": "v60|v90", "suv": "xc40|xc60|xc90|ex30|ex40|ex90"},
    "land-rover-range-rover": {"suv": "defender|discovery|discovery-sport|range-rover|range-rover-sport|velar|evoque"},
    "jaguar": {"sedan": "xe|xf|xj", "coupe": "f-type", "suv": "e-pace|f-pace|i-pace"},
    "lexus": {"suv": "lbx|ux|nx|rx|rz", "sedan": "es|ls", "coupe": "lc"},
    "hyundai": {"hatchback": "i10|i20|i30", "suv": "bayon|kona|tucson|santa-fe|ioniq-5|ioniq-9", "sedan": "ioniq-6"},
    "kia": {"hatchback": "picanto|ceed", "suv": "xceed|stonic|niro|sportage|sorento|ev3|ev6|ev9", "sedan": "ev4"},
    "peugeot": {"hatchback": "208|308", "suv": "2008|3008", "mpv": "rifter|traveller"},
    "renault": {"hatchback": "clio|megane", "suv": "captur|symbioz|austral", "suv-coupe": "arkana|rafale"},
    "opel": {"hatchback": "corsa|astra", "suv": "mokka|frontera|grandland", "mpv": "zafira"},
    "seat": {"hatchback": "ibiza|leon", "suv": "arona|ateca|tarraco"},
    "cupra": {"hatchback": "leon|born", "suv": "formentor|ateca|terramar", "suv-coupe": "tavascan"},
    "nissan": {"hatchback": "micra", "suv": "juke|qashqai|x-trail|ariya", "coupe": "gt-r", "pickup": "navara"},
    "mazda": {"hatchback": "mazda2|mazda3", "suv": "cx-30|cx-5|cx-60|cx-80|mx-30", "cabriolet": "mx-5"},
    "honda": {"hatchback": "jazz|civic", "suv": "hr-v|zr-v|cr-v|e-ny1", "coupe": "nsx"},
    "citroen": {"hatchback": "c3", "sedan": "c4-x", "suv": "c5-aircross", "mpv": "spacetourer"},
    "dacia": {"hatchback": "sandero|spring", "sedan": "logan", "wagon": "jogger", "suv": "duster|bigster"},
    "tesla": {"sedan": "model-3", "liftback": "model-s", "suv": "model-y|model-x", "pickup": "cybertruck"},
    "jeep": {"suv": "avenger|renegade|compass|cherokee|grand-cherokee|wrangler", "pickup": "gladiator"},
    "alfa-romeo": {"sedan": "giulia", "suv": "stelvio|tonale|junior", "coupe": "4c"},
    "fiat": {"suv": "500x", "mpv": "500l", "hatchback": "panda|grande-panda"},
    "suzuki": {"hatchback": "swift|ignis", "suv": "vitara|s-cross|jimny|across", "wagon": "swace"},
    "mitsubishi": {"hatchback": "colt", "suv": "asx|eclipse-cross|outlander", "pickup": "l200"},
    "subaru": {"suv": "crosstrek|forester|solterra", "wagon": "outback", "coupe": "brz"},
    "mini": {"hatchback": "cooper", "suv": "aceman|countryman", "wagon": "clubman"},
    "maserati": {"suv": "grecale|levante", "sedan": "quattroporte", "coupe": "granturismo|mc20", "cabriolet": "grancabrio"},
    "ferrari": {"coupe": "roma|296-gtb|sf90|12cilindri|f8-tributo", "cabriolet": "portofino", "suv": "purosangue"},
    "lamborghini": {"coupe": "huracan|temerario|revuelto|aventador", "suv": "urus"},
    "bentley": {"coupe": "continental-gt", "sedan": "flying-spur", "suv": "bentayga"},
    "rolls-royce": {"sedan": "ghost|phantom", "suv": "cullinan", "coupe": "spectre|wraith", "cabriolet": "dawn"},
    "aston-martin": {"coupe": "vantage|db11|db12|dbs|vanquish", "suv": "dbx"},
    "mclaren": {"coupe": "artura|gt|gts|570s|600lt|720s|750s|senna"},
    "chevrolet": {"hatchback": "spark", "sedan": "cruze|malibu", "coupe": "camaro|corvette", "suv": "tahoe|suburban", "pickup": "silverado"},
    "dodge": {"coupe": "challenger", "suv": "durango|hornet"},
    "ram": {"pickup": "1500|2500|3500"},
    "cadillac": {"sedan": "ct4|ct5", "suv": "xt4|xt5|xt6|escalade|lyriq"},
    "gmc": {"pickup": "sierra|canyon", "suv": "yukon"},
    "genesis": {"sedan": "g70|g80|g90", "suv": "gv60|gv70|gv80"},
    "polestar": {"liftback": "polestar-2|2", "suv": "3", "suv-coupe": "4"},
    "byd": {"hatchback": "dolphin", "suv": "atto-3|seal-u|tang", "sedan": "seal|han"},
    "mg": {"hatchback": "mg3|mg4", "suv": "zs|hs|marvel-r", "cabriolet": "cyberster"},
    "ds-automobiles": {"hatchback": "ds-4", "suv": "ds-7", "sedan": "ds-9"},
    "lancia": {"hatchback": "ypsilon|delta", "sedan": "thema"},
    "smart": {"hatchback": "fortwo|forfour", "suv": "1|5", "suv-coupe": "3"},
    "ssangyong-kgm": {"suv": "tivoli|korando|torres|rexton"},
    "isuzu": {"pickup": "d-max", "suv": "mu-x"},
}
FAMILIES = {
    brand: {model_key(model): body for body, models in groups.items() for model in models.split("|")}
    for brand, groups in FAMILY_GROUPS.items()
}
TARGET_BRANDS = frozenset(FAMILIES)


def _result(body: str, basis: str) -> dict[str, str]:
    return {"id": body, "name": BODY_NAMES[body], "basis": basis}


def _base_body(brand: str, model: str, text: str, year: int | None) -> str | None:
    """Known family exceptions; year means source generation start, not user year."""
    if brand == "toyota" and model == "corolla" and re.search(r"\b[35] doors?\b", text):
        return "hatchback"
    if brand == "chevrolet" and model == "cruze" and "5 doors" in text:
        return "hatchback"
    if brand == "subaru" and model == "impreza" and year and year >= 2022:
        return "hatchback"
    if brand == "subaru" and model == "outback" and year and year >= 2025:
        return "suv"
    if brand == "gmc" and model == "hummer-ev" and year == 2021:
        return "pickup"
    if brand == "ford" and model == "mondeo" and "contour" in text:
        return "sedan"
    if brand == "skoda" and model == "octavia" and "scout" in text:
        return "wagon"
    if brand == "volkswagen" and model == "passat" and "3 doors" in text:
        return "liftback"
    if brand == "ford" and model == "puma":
        return "suv" if year and year >= 2019 else "coupe" if year and 1997 <= year <= 2002 else None
    if brand == "peugeot" and model == "5008":
        return "suv" if year and year >= 2016 else "mpv" if year and year >= 2009 else None
    if brand == "peugeot" and model == "508":
        return "liftback" if year and year >= 2018 else "sedan" if year and year >= 2010 else None
    if brand == "peugeot" and model == "408":
        return None  # European fastback and Asian sedan coexist; name must tell.
    if brand == "renault" and model in ("espace", "scenic"):
        return "suv" if year and year >= 2023 else "mpv" if year and year >= 1984 else None
    if brand == "fiat" and model == "600":
        return "suv" if year and year >= 2023 else "sedan" if year and 1955 <= year <= 1982 else None
    if brand == "fiat" and model == "500":
        return "hatchback" if year and year >= 2007 else None
    if brand == "fiat" and model == "tipo":
        return "sedan" if year and year >= 2015 else "hatchback" if year and 1988 <= year <= 1995 else None
    if brand == "ssangyong-kgm" and model == "musso":
        if "sports" in text or (year and year >= 2016):
            return "pickup"
        return "suv" if year and 1993 <= year <= 2005 else None
    if brand == "kia" and model in ("proceed", "pro-ceed"):
        return "wagon" if year and year >= 2018 else "hatchback" if year and year >= 2007 else None
    if brand == "maserati" and model == "ghibli":
        return "sedan" if year and year >= 2013 else "coupe" if year and 1966 <= year <= 1998 else None
    if brand == "nissan" and model == "leaf":
        return "suv" if year and year >= 2025 else "hatchback" if year and year >= 2010 else None
    if brand == "citroen" and model == "c4":
        return "suv" if year and year >= 2020 else "hatchback" if year and year >= 2004 else None
    if brand == "citroen" and model == "c5-x":
        return "liftback"  # Mixed silhouette, but one rear liftgate; never three bodies.
    if brand == "ds-automobiles" and model == "ds-3":
        return "suv" if "crossback" in text or (year and year >= 2018) else "hatchback"
    if brand == "skoda" and model == "superb" and year and year < 2008:
        return "sedan" if year >= 2001 else None
    if brand == "skoda" and model == "octavia" and year and year < 1996:
        return "sedan" if year >= 1959 else None
    if brand == "dodge" and model == "charger":
        return "sedan" if year and 2005 <= year <= 2023 else None
    if brand == "audi" and model == "a5":
        return None  # Coupe/Sportback/2024 Sedan coexist in the raw catalogue.
    if brand == "bmw" and model == "x2" and year and year >= 2023:
        return "suv-coupe"
    if brand == "bmw" and model == "z4":
        return "cabriolet" if "coupe" not in text else "coupe"
    return FAMILIES.get(brand, {}).get(model)


def classify_body(brand_id: str, model_id: str, source_model_name: str,
                  generation_name: str, start_year: int | None) -> dict[str, str]:
    """Classify exactly one generation record; no ranges or combinations added.

    ``basis`` denotes explicit source-name evidence, family-curation, or unresolved.
    Unknown does not mean the vehicle has an unusual body: it means this source row
    does not establish one. Raw source names must be retained by the importer.
    """
    brand, model = brand_key(brand_id), model_key(model_id)
    # Generation name wins; the source model supplies hints only when not repeated.
    text = normalise(generation_name) or normalise(source_model_name)
    source = normalise(source_model_name)
    if not text:
        return _result("unknown", "unresolved")
    year = int(start_year) if isinstance(start_year, (int, float)) and not isinstance(start_year, bool) else None
    base = _base_body(brand, model, text, year)
    suv = base in ("suv", "suv-coupe") or bool(re.search(r"\bsuv\b", text))

    # Cab types are stronger than words such as Wagon (RAM Power Wagon).
    for pattern, body in (
        (r"\b(?:double|dual|crew|super crew|quad) cab\b|\bsupercrew\b", "pickup-double"),
        (r"\b(?:single|regular) cab\b", "pickup-single"),
        (r"\b(?:extra|extended|king|super|freestyle) cab\b|\bsupercab\b", "pickup-extended"),
    ):
        if re.search(pattern, text):
            return _result(body, "source-name")
    if re.search(r"\btarga\b", text):
        return _result("targa", "source-name")
    if re.search(r"\b(?:cabrio(?:let)?|convertible|roadster|spyder|spider|volante|drophead|aper(?:ta|to)|barchetta|speedster)\b|\bc c\b|\bcrosscabriolet\b", text):
        return _result("suv-cabriolet" if suv else "cabriolet", "source-name")
    if re.search(r"\b(?:panel van|cargo|furgon|kombi van|box van)\b", text):
        return _result("van", "source-name")
    if re.search(r"\b(?:pick up|pickup)\b", text):
        return _result("pickup", "source-name")
    if brand == "bmw" and re.search(r"\b(?:active|gran) tourer\b", text):
        return _result("mpv", "source-name")
    if (brand == "volkswagen" and re.search(r"\bgolf (?:plus|sportsvan)\b", text)) or (brand == "toyota" and re.search(r"\b(?:corolla|yaris) verso\b", text)) or (brand == "citroen" and "picasso" in text) or (brand == "ford" and "transit connect wagon" in text):
        return _result("mpv", "family-curation")
    if brand == "citroen" and "pluriel" in text:
        return _result("cabriolet", "family-curation")
    if brand == "mercedes-benz" and model == "amg-gt" and "4 door" in text:
        return _result("liftback", "family-curation")
    if brand == "mercedes-benz" and re.search(r"\bcl klasse\b", text):
        return _result("coupe", "family-curation")
    if brand == "bmw" and "gran coupe" in text:
        if model == "rada-4" or "4 series" in text:
            return _result("liftback", "family-curation")
        if model in ("rada-2", "rada-8") or re.search(r"\b[268] series\b|\bm[68]\b", text):
            return _result("sedan-coupe", "family-curation")
        return _result("unknown", "unresolved")
    if brand == "bmw" and "gran turismo" in text:
        return _result("liftback", "family-curation")
    if re.search(r"\b(?:shooting brake|sport turismo|cross turismo|station wagon|sport wagon|sportswagon|sportwagon|sports tourer|aero deck|all terrain|allroad|alltrack|estate|touring|tourer|avant|combi|caravan|break|sw|t modell|variant|giardiniera|weekend)\b", text):
        # MPV names containing Touring are explicitly handled before this rule.
        return _result("wagon", "source-name")
    if "wagon" in text and base != "pickup":
        return _result("wagon", "source-name")
    if re.search(r"\b(?:sedan|saloon|limousine)\b", text):
        # Audi markets the new A5 liftgate body as Sedan; preserve physical body.
        if brand == "audi" and model == "a5" and year and year >= 2024:
            return _result("liftback", "family-curation")
        return _result("sedan", "source-name")
    if re.search(r"\b(?:liftback|fastback)\b", text):
        return _result("coupe" if brand == "ford" and model == "mustang" else "liftback", "source-name")
    if "sportback" in text:
        if suv or re.search(r"\b(?:sq|q)[2-8]\b|\be tron sportback\b", text):
            return _result("suv-coupe", "family-curation")
        if brand == "audi" and (model in ("a1", "a3") or re.search(r"\b(?:rs |s)[13]\b", text)):
            return _result("hatchback-5", "family-curation")
        if brand == "audi" and (model in ("a5", "a6", "a7") or re.search(r"\b(?:rs |s)[567]\b", text)):
            return _result("liftback", "family-curation")
        return _result("unknown", "unresolved")
    if re.search(r"\b(?:hatchback|hatch|compact)\b", text):
        doors = re.search(r"\b([35]) doors?\b", text)
        return _result("hatchback-" + doors[1] if doors else "hatchback", "source-name")
    # Marketing Coupe is sometimes a 3-door hatch, not a notchback coupe.
    if re.search(r"\b(?:coupe|sportcoupe|gtc)\b", text):
        if (brand == "hyundai" and model in ("i20", "i30")) or (brand == "citroen" and model == "c4") or (brand == "opel" and "gtc" in text) or (brand == "volkswagen" and model == "polo") or (brand == "mercedes-benz" and (model == "a" or "sportcoupe" in text)):
            return _result("hatchback-3", "family-curation")
        if brand == "renault" and model == "megane" and year and year >= 2008:
            return _result("hatchback-3", "family-curation")
        return _result("suv-coupe" if suv else "coupe", "source-name")
    if re.search(r"\bsuv\b", text):
        return _result("suv", "source-name")
    # A door count alone cannot establish body architecture (RAV4 3-door is SUV).
    doors = re.search(r"\b([35]) doors?\b", text)
    if doors and base in ("hatchback", "suv"):
        return _result(base + "-" + doors[1], "family-curation")
    if brand == "ford" and model == "explorer" and "sport trac" in text:
        return _result("pickup", "family-curation")
    if brand == "bentley" and model == "continental-gt" and re.search(r"\bgtc\b", text):
        return _result("cabriolet", "family-curation")
    if brand == "ferrari" and re.search(r"\bgts\b|\bcielo\b", text):
        return _result("cabriolet", "family-curation")
    if brand == "maserati" and "cielo" in text:
        return _result("cabriolet", "family-curation")
    if brand == "fiat" and model == "500" and re.search(r"\b500c\b", text):
        return _result("cabriolet", "family-curation")
    if brand == "ford" and model == "focus" and re.search(r"\bcc\b", text):
        return _result("cabriolet", "family-curation")
    if brand == "peugeot" and re.search(r"\bcc\b", text):
        return _result("cabriolet", "family-curation")
    if base:
        return _result(base, "family-curation")
    return _result("unknown", "unresolved")


def write_report(source_path: Path, output_path: Path, crosswalk_path: Path | None = None) -> dict:
    """Audit all source rows in target brands, including nonrequested histories.

    This intentionally does not invent the parent importer's model crosswalk.
    Exact family IDs are used where source names match; otherwise name parsing
    alone is assessed. The final importer should additionally audit its matched
    rows with its canonical model IDs.
    """
    data = json.loads(source_path.read_text(encoding="utf8"))
    unresolved, counts = [], collections.Counter()
    mappings = {}
    if crosswalk_path and crosswalk_path.exists():
        for target, entries in json.loads(crosswalk_path.read_text(encoding="utf8")).items():
            for entry in entries:
                mappings.setdefault((entry["group"], entry["model"]), []).append(target.split("/", 1))
    for group in data["groups"]:
        brand = brand_key(group["group"])
        if brand not in TARGET_BRANDS and not any(key[0] == group["group"] for key in mappings):
            continue
        for make in group["makes"]:
            for model in make.get("models", []):
                source_name = model["name"]
                stripped = re.sub(r"^(?:citroen|citron|skoda|mercedes benz)\s+", "", normalise(source_name))
                mid = model_key(stripped)
                targets = mappings.get((group["group"], source_name), []) if mappings else [(brand, mid)]
                if not targets:
                    continue
                for generation in model.get("generations", []):
                    start = generation.get("yearStart")
                    if start is not None and start > 2026:
                        continue
                    for target_brand, target_model in targets:
                        result = classify_body(target_brand, target_model, source_name, generation["name"], start)
                        counts[result["basis"]] += 1
                        if result["basis"] == "unresolved":
                            unresolved.append({"brand": target_brand, "model": target_model, "sourceModel": source_name,
                                "generation": generation["name"], "from": start, "to": generation.get("yearEnd")})
    report = {"scope": "Requested families matched through data/model-crosswalk.json." if mappings else "All raw generations in 53 requested brands, including nonrequested models; no canonical family crosswalk applied.",
        "sourceRevision": data.get("revision"), "counts": dict(counts), "unresolved": unresolved}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return report


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / "data/source/vehicle-makes-models.json")
    parser.add_argument("--report", type=Path, default=root / "data/source/body-classification-audit.json")
    parser.add_argument("--crosswalk", type=Path, default=root / "data/model-crosswalk.json")
    args = parser.parse_args()
    result = write_report(args.source, args.report, args.crosswalk)
    print(json.dumps({"counts": result["counts"], "report": str(args.report)}, ensure_ascii=False))
