"""Builds the "Label of the Day" widget data for iOS and Android from the web game.

Usage (from the repository root):
    python widgets/export-widget-data.py          # write data + cover thumbnails
    python widgets/export-widget-data.py --check  # fail if the committed data is stale

Reads party-game/puzzles.js (all 105 puzzles: 85 "which product is it?" labels with
their weird-ingredient spotlight, and 20 toilet-paper true/false claims with their
explanation) with Node, and the book names, Amazon links and
covers from the same BOOKS table the game uses. Nothing is maintained by hand.

Writes:
    watch-app/PartyGameWidgets/Resources/daily.json
    watch-app/PartyGameWidgets/Assets.xcassets/cover-<book>.imageset/   (needs Pillow)
    watch-app/PartyGameWidgets/Assets.xcassets/qr-<book>.imageset/      (from party-game/qr-<book>.svg)
    android/app/src/main/res/raw/daily_puzzles.json
    android/app/src/main/res/drawable-nodpi/widget_cover_<book>.jpg      (needs Pillow)
    android/app/src/main/res/drawable-nodpi/widget_qr_<book>.png
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "party-game")
IOS = os.path.join(ROOT, "watch-app", "PartyGameWidgets")
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# Everyone sees the same puzzle on the same calendar day: the deck is shuffled once
# with this fixed seed and day N (days since EPOCH, local date) shows order[N % count].
SEED = 20261113
EPOCH = "2026-01-01"
NL = chr(10)

NODE = r"""
const vm = require('vm'), fs = require('fs');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8') + ';globalThis.__o = {BOOKS, PUZZLES};', ctx);
process.stdout.write(JSON.stringify(ctx.__o));
"""


def load_game():
    out = subprocess.run(["node", "-e", NODE, os.path.join(GAME, "puzzles.js")],
                         check=True, capture_output=True, text=True, encoding="utf-8").stdout
    return json.loads(out)


def mulberry32(seed):
    state = seed & 0xFFFFFFFF

    def nxt():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


def daily_order(count):
    rnd = mulberry32(SEED)
    order = list(range(count))
    for i in range(count - 1, 0, -1):
        j = int(rnd() * (i + 1))
        order[i], order[j] = order[j], order[i]
    return order


def build():
    game = load_game()
    books, puzzles = game["BOOKS"], game["PUZZLES"]
    out_books = {}
    for key, b in books.items():
        url = b["url"]
        if not url.startswith("https://www.amazon.com/"):
            raise SystemExit(f"Unexpected book link for {key}: {url}")
        out_books[key] = {"name": b["name"], "title": b.get("title", b["name"]), "url": url,
                          "cover": "cover-" + key, "coverFile": b["cover"],
                          "qr": "qr-" + key, "qrFile": b["qr"]}
    out = []
    for i, p in enumerate(puzzles):
        if p["book"] not in out_books:
            raise SystemExit(f"Puzzle {i} uses unknown book {p['book']}")
        if p.get("type") == "tf" or isinstance(p.get("answer"), bool):
            if not p.get("explain"):
                raise SystemExit(f"True/false puzzle {i} has no explanation")
            # After answering, medium/large widgets show the game's "real story".
            out.append({"id": i, "type": "tf", "book": p["book"], "statement": p["statement"],
                        "options": ["True", "False"], "answer": 0 if p["answer"] else 1,
                        "ingredients": [], "spotlight": "", "note": p["explain"]})
            continue
        opts = p["options"]
        spot = p.get("spotlight") or {}
        if (len(opts) != 4 or p["answer"] not in opts or not p.get("ingredients")
                or not spot.get("name") or not spot.get("note")):
            raise SystemExit(f"Malformed puzzle {i}: {p.get('answer')}")
        # After answering, medium/large widgets show the game's weird-ingredient spotlight.
        out.append({"id": i, "type": "mc", "book": p["book"], "statement": "",
                    "options": opts, "answer": opts.index(p["answer"]),
                    "ingredients": p["ingredients"], "spotlight": spot["name"], "note": spot["note"]})
    data = {"version": 2, "epoch": EPOCH, "seed": SEED, "count": len(out),
            "order": daily_order(len(out)), "books": out_books, "puzzles": out}
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def targets():
    return [os.path.join(IOS, "Resources", "daily.json"),
            os.path.join(ANDROID_RES, "raw", "daily_puzzles.json")]


def qr_image(svg_path, module=10):
    """Draws the game's own QR SVG (one square path per module) as a crisp PNG."""
    import re
    from PIL import Image, ImageDraw

    text = open(svg_path, encoding="utf-8").read()
    size = int(float(re.search(r'viewBox="0 0 ([0-9.]+)', text).group(1)))
    im = Image.new("L", (size * module, size * module), 255)
    d = ImageDraw.Draw(im)
    for path in re.findall(r' d="([^"]+)"', text):
        for x, y, x2, y2 in re.findall(r"M([0-9.]+),([0-9.]+)H([0-9.]+)V([0-9.]+)", path):
            d.rectangle((float(x) * module, float(y) * module,
                         float(x2) * module - 1, float(y2) * module - 1), fill=0)
    return im


def write_covers(data):
    from PIL import Image  # only needed when regenerating

    for key, b in data["books"].items():
        im = Image.open(os.path.join(GAME, b["coverFile"])).convert("RGB")
        w = 180
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        d = os.path.join(IOS, "Assets.xcassets", f"cover-{key}.imageset")
        os.makedirs(d, exist_ok=True)
        im.save(os.path.join(d, f"cover-{key}.jpg"), quality=88)
        with open(os.path.join(d, "Contents.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump({"images": [{"idiom": "universal", "filename": f"cover-{key}.jpg"}],
                       "info": {"author": "xcode", "version": 1}}, f, indent=2)
            f.write("\n")
        a = os.path.join(ANDROID_RES, "drawable-nodpi")
        os.makedirs(a, exist_ok=True)
        im.save(os.path.join(a, f"widget_cover_{key}.jpg"), quality=88)
        qr = qr_image(os.path.join(GAME, b["qrFile"]))
        qd = os.path.join(IOS, "Assets.xcassets", f"qr-{key}.imageset")
        os.makedirs(qd, exist_ok=True)
        qr.save(os.path.join(qd, f"qr-{key}.png"))
        with open(os.path.join(qd, "Contents.json"), "w", encoding="utf-8", newline=NL) as f:
            json.dump({"images": [{"idiom": "universal", "filename": f"qr-{key}.png"}],
                       "info": {"author": "xcode", "version": 1},
                       "properties": {"template-rendering-intent": "original"}}, f, indent=2)
            f.write(NL)
        qr.save(os.path.join(a, f"widget_qr_{key}.png"))
    cat = os.path.join(IOS, "Assets.xcassets", "Contents.json")
    with open(cat, "w", encoding="utf-8", newline="\n") as f:
        f.write('{\n  "info" : {\n    "author" : "xcode",\n    "version" : 1\n  }\n}\n')


def main():
    text = build()
    if "--check" in sys.argv:
        stale = [t for t in targets() if not os.path.exists(t) or open(t, encoding="utf-8").read() != text]
        if stale:
            raise SystemExit("Widget data is out of date; run python widgets/export-widget-data.py: " + ", ".join(stale))
        print("Widget data matches party-game/puzzles.js")
        return
    for t in targets():
        os.makedirs(os.path.dirname(t), exist_ok=True)
        with open(t, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    data = json.loads(text)
    write_covers(data)
    mc = sum(1 for p in data["puzzles"] if p["type"] == "mc")
    print(f"puzzles: {data['count']} ({mc} labels, {data['count'] - mc} true/false), books: {len(data['books'])}")


if __name__ == "__main__":
    main()
