"""Inventory all vehicle photographs and produce non-destructive wheel-fitting QA sheets.

Coordinates are normalized to each original image: (0, 0) is its top-left corner,
(1, 1) its bottom-right. Letterboxing around an image is never part of that space.
Only diagnostic copies in the ignored cache directory receive a coordinate grid.
"""
from argparse import ArgumentParser
from datetime import date
from hashlib import sha256
from pathlib import Path
import json
import math

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "wheel-photo-inventory.json"
CACHE = ROOT / "tools" / ".cache-wheel-fit"
SHEETS = CACHE / "inventory-sheets"


def font(size):
    for candidate in ("C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def entries():
    for filename, group in (("vehicle-visuals.json", "models"),
                            ("vehicle-visual-variants.json", "variants")):
        manifest = json.loads((ROOT / "data" / filename).read_text(encoding="utf-8"))
        for key, record in manifest[group].items():
            yield {
                "id": record["id"],
                "key": key,
                "kind": "variant-photo" if group == "variants" else "model-photo",
                "source": "data/" + filename,
                "src": record["src"],
                "label": record.get("alt") or record.get("title") or key,
                "sourceUrl": record.get("sourceUrl"),
                "sourceFile": record.get("sourceFile"),
                "sourceSha1": record.get("sourceSha1"),
            }
    for phase, year in (("e70", 2008), ("g05", 2020)):
        yield {
            "id": "legacy-render-bmw-x5-" + phase,
            "key": "bmw/x5/" + phase,
            "kind": "legacy-render",
            "source": "docs/image-prompts.md",
            "src": "assets/cars/bmw-x5-" + phase + ".webp",
            "label": "BMW X5 " + phase.upper() + " " + str(year) + " illustrative render",
            "sourceUrl": None,
            "sourceFile": None,
            "sourceSha1": None,
        }


def draw_panel(canvas, record, panel, number, grid=True):
    """Two by two panels, retaining each source image's full frame and aspect ratio."""
    panel_width, panel_height = 1000, 800
    origin_x = (panel % 2) * panel_width
    origin_y = (panel // 2) * panel_height
    draw = ImageDraw.Draw(canvas)
    label = f"{number:03d} | {record['key']} | {record['width']} x {record['height']}"
    draw.text((origin_x + 25, origin_y + 15), label, font=font(22), fill="#e6eef5")
    draw.text((origin_x + 25, origin_y + 46), record["id"], font=font(16), fill="#b0bfcb")
    with Image.open(ROOT / record["src"]) as original:
        picture = ImageOps.contain(original.convert("RGB"), (900, 650), Image.Resampling.LANCZOS)
    left = origin_x + (panel_width - picture.width) // 2
    top = origin_y + 80 + (650 - picture.height) // 2
    canvas.paste(picture, (left, top))
    if grid:
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        grid_draw = ImageDraw.Draw(overlay)
        for step in range(11):
            fraction = step / 10
            x = left + round(fraction * (picture.width - 1))
            y = top + round(fraction * (picture.height - 1))
            rgba = (255, 209, 88, 110) if step == 5 else (62, 210, 240, 64)
            grid_draw.line((x, top, x, top + picture.height - 1), fill=rgba, width=1)
            grid_draw.line((left, y, left + picture.width - 1, y), fill=rgba, width=1)
            draw.text((x - 12, top - 24), f"{fraction:.1f}", font=font(15), fill="#9ce6f2")
            draw.text((left - 35, y - 8), f"{fraction:.1f}", font=font(15), fill="#9ce6f2")
        canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB"))
        draw = ImageDraw.Draw(canvas)
    draw.rectangle((left, top, left + picture.width - 1, top + picture.height - 1), outline="#68b0b8", width=1)
    draw.text((origin_x + 25, origin_y + 750), "x = image width fraction; y = image height fraction; origin = top left", font=font(16), fill="#b0bfcb")
    draw.text((origin_x + 25, origin_y + 774), "QA annotation only; original vehicle image is unchanged.", font=font(14), fill="#8b9da9")
    record["qaImageRect"] = {"x": left, "y": top, "width": picture.width, "height": picture.height}


def create_sheets(records):
    SHEETS.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(records), 4):
        canvas = Image.new("RGB", (2000, 1600), "#151d24")
        selected = records[start:start + 4]
        page = start // 4 + 1
        relative = f"tools/.cache-wheel-fit/inventory-sheets/photos-{page:03d}.jpg"
        for panel, record in enumerate(selected):
            record["qaSheet"] = relative
            record["qaPanel"] = panel
            draw_panel(canvas, record, panel, start + panel + 1)
        canvas.save(ROOT / relative, "JPEG", quality=88, optimize=True)


def create_overviews(records):
    directory = CACHE / "overview"
    directory.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(records), 40):
        selected = records[start:start + 40]
        canvas = Image.new("RGB", (1500, math.ceil(len(selected) / 5) * 220), "#eeece8")
        draw = ImageDraw.Draw(canvas)
        for index, record in enumerate(selected):
            x, y = (index % 5) * 300, (index // 5) * 220
            with Image.open(ROOT / record["src"]) as original:
                picture = ImageOps.contain(original.convert("RGB"), (290, 180), Image.Resampling.LANCZOS)
            canvas.paste(picture, (x + (300 - picture.width) // 2, y + (180 - picture.height) // 2))
            draw.text((x + 6, y + 183), f"{start + index + 1:03d} {record['key']}", font=font(14), fill="#182025")
            draw.text((x + 6, y + 202), record["kind"], font=font(12), fill="#525d65")
        canvas.save(directory / f"overview-{start // 40 + 1:02d}.jpg", "JPEG", quality=88)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--no-sheets", action="store_true", help="Refresh inventory dimensions only.")
    args = parser.parse_args()
    previous = {}
    if OUTPUT.exists():
        previous = {r["id"]: r for r in json.loads(OUTPUT.read_text(encoding="utf-8")).get("photos", [])}
    records = []
    seen = set()
    for record in entries():
        if record["id"] in seen:
            raise ValueError("Duplicate image id: " + record["id"])
        seen.add(record["id"])
        source = (ROOT / record["src"]).resolve()
        if not source.is_relative_to(ROOT.resolve()):
            raise ValueError("Asset must remain inside workspace: " + record["src"])
        with Image.open(source) as original:
            original.verify()
            record["width"], record["height"] = original.size
        record["localSha256"] = sha256(source.read_bytes()).hexdigest()
        record["wheelVisibility"] = "not-reviewed"
        record["reviewNote"] = ""
        old = previous.get(record["id"], {})
        if old.get("localSha256") == record["localSha256"]:
            for field in ("wheelVisibility", "reviewNote", "wheelCenters", "targetRegion", "reviewedOn", "qaSheet", "qaPanel", "qaImageRect"):
                if field in old:
                    record[field] = old[field]
        records.append(record)
    if not args.no_sheets:
        create_sheets(records)
        create_overviews(records)
    counts = {kind: sum(r["kind"] == kind for r in records) for kind in ("model-photo", "variant-photo", "legacy-render")}
    payload = {
        "schemaVersion": 1,
        "builtOn": str(date.today()),
        "coordinateSystem": "normalized-image",
        "coordinateDescription": "Full source image, x left-to-right and y top-to-bottom, each in [0,1]; outside letterbox excluded.",
        "counts": counts,
        "total": len(records),
        "reviewScope": "Rim-face visibility only. Approximate manual centers are not a calibrated replacement ellipse or a certified wheel fitment.",
        "replacementRequired": [r["id"] for r in records if r["wheelVisibility"] == "none"],
        "photos": records,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "counts": counts, "sheets": math.ceil(len(records) / 4) if not args.no_sheets else 0}))


if __name__ == "__main__":
    main()
