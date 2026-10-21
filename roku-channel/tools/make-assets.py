"""Builds the Roku channel's images and font metrics from the web game.

Run from anywhere:  python roku-channel/tools/make-assets.py
Needs Pillow and fontTools (pip install pillow fonttools).

Makes:
  images/covers/*.jpg      book covers sized for TV (300x480)
  images/qr/*.png          book QR codes, redrawn pixel-exact from party-game/qr-*.svg
  images/ui/*.9.png        rounded-corner 9-patch shapes (tinted in the channel)
  images/ui/dot.png        a white circle (score dots, badges)
  images/icon_focus_fhd.png (540x405), icon_focus_hd.png (290x218), splash_fhd.jpg (1920x1080)
  data/metrics.json        character widths for the bundled fonts (used to lay out text)
"""
import json
import os
import re

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CH = os.path.dirname(HERE)                       # roku-channel/
WEB = os.path.join(os.path.dirname(CH), "party-game")
FONTS = os.path.join(CH, "fonts")
IMG = os.path.join(CH, "images")

BG = (0x16, 0x21, 0x1C)
POP = (0xE0, 0x7A, 0x55)
GOLD = (0xF2, 0xC4, 0x6B)
CREAM = (0xF4, 0xF3, 0xEE)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


# ---------- covers ----------
def covers():
    src = os.path.join(WEB, "covers")
    for f in sorted(os.listdir(src)):
        if not f.endswith(".jpg"):
            continue
        im = Image.open(os.path.join(src, f)).convert("RGB")
        im = im.resize((300, 480), Image.LANCZOS)
        im.save(os.path.join(IMG, "covers", f), quality=86, optimize=True, progressive=False)


# ---------- QR codes (the SVGs are 1x1 module squares) ----------
def qrs():
    for f in sorted(os.listdir(WEB)):
        m = re.match(r"qr-(\w+)\.svg$", f)
        if not m:
            continue
        svg = open(os.path.join(WEB, f), encoding="utf-8").read()
        vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
        n = int(vb.group(1))
        scale = 10
        im = Image.new("RGB", (n * scale, n * scale), (255, 255, 255))
        d = ImageDraw.Draw(im)
        count = 0
        for x, y in re.findall(r"M(\d+),(\d+)H", svg):
            x, y = int(x), int(y)
            d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=(0, 0, 0))
            count += 1
        assert count > 300, f
        im.save(os.path.join(IMG, "qr", f"qr-{m.group(1)}.png"), optimize=True)


# ---------- 9-patch shapes ----------
def ninepatch(name, radius, border=0):
    """White rounded rectangle (or ring when border>0), stretchable in the middle."""
    size = radius * 2 + 4
    ss = 4  # supersample for smooth corners
    big = Image.new("L", (size * ss, size * ss), 0)
    d = ImageDraw.Draw(big)
    d.rounded_rectangle([0, 0, size * ss - 1, size * ss - 1], radius=radius * ss, fill=255)
    if border:
        d.rounded_rectangle([border * ss, border * ss, (size - border) * ss - 1, (size - border) * ss - 1],
                            radius=max(0, (radius - border)) * ss, fill=0)
    alpha = big.resize((size, size), Image.LANCZOS)
    shape = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    shape.putalpha(alpha)
    out = Image.new("RGBA", (size + 2, size + 2), (0, 0, 0, 0))
    out.paste(shape, (1, 1))
    px = out.load()
    for i in range(radius + 1, radius + 3):   # stretch the middle 2 px (shape coords + 1)
        px[i + 1, 0] = (0, 0, 0, 255)
        px[0, i + 1] = (0, 0, 0, 255)
    out.save(os.path.join(IMG, "ui", name + ".9.png"))


def dot():
    ss = 4
    size = 64
    big = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(big).ellipse([0, 0, size * ss - 1, size * ss - 1], fill=255)
    im = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    im.putalpha(big.resize((size, size), Image.LANCZOS))
    im.save(os.path.join(IMG, "ui", "dot.png"))


def glow():
    """Soft orange glow for the top-right corner of every screen (like the web background)."""
    w, h = 960, 540
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = Image.new("L", (w, h), 0)
    ImageDraw.Draw(a).ellipse([w * 0.35, -h * 0.75, w * 1.45, h * 0.75], fill=60)
    a = a.filter(ImageFilter.GaussianBlur(110))
    im = Image.new("RGBA", (w, h), POP + (0,))
    im.putalpha(a)
    im.save(os.path.join(IMG, "ui", "glow.png"))


# ---------- channel art ----------
def tracked(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


def tracked_len(draw, text, fnt, tracking):
    return sum(draw.textlength(c, font=fnt) for c in text) + tracking * (len(text) - 1)


def background(w, h):
    im = Image.new("RGB", (w, h), BG)
    g = Image.new("L", (w, h), 0)
    ImageDraw.Draw(g).ellipse([w * 0.45, -h * 0.7, w * 1.4, h * 0.55], fill=70)
    g = g.filter(ImageFilter.GaussianBlur(max(w, h) // 10))
    im.paste(Image.new("RGB", (w, h), POP), (0, 0), g)
    g2 = Image.new("L", (w, h), 0)
    ImageDraw.Draw(g2).ellipse([-w * 0.35, h * 0.55, w * 0.45, h * 1.5], fill=45)
    g2 = g2.filter(ImageFilter.GaussianBlur(max(w, h) // 10))
    im.paste(Image.new("RGB", (w, h), (0x6F, 0xA3, 0xD9)), (0, 0), g2)
    return im


def lockup(w, h, scale, with_byline):
    im = background(w, h)
    d = ImageDraw.Draw(im)
    f1 = font("Inter-ExtraBold.ttf", int(30 * scale))
    f2 = font("Fraunces-Black.ttf", int(150 * scale))
    f3 = font("Fraunces-Black.ttf", int(150 * scale))
    f4 = font("Inter-Bold.ttf", int(24 * scale))
    tr = 3 * scale
    t1 = "INGREDIENT DICTIONARY"
    l1 = tracked_len(d, t1, f1, tr)
    party, game = "PARTY", "GAME"
    lp, lg = d.textlength(party, font=f2), d.textlength(game, font=f3)
    asc2 = f2.getbbox("PARTY")
    hp = asc2[3] - asc2[1]
    gap1, gap2 = 34 * scale, 10 * scale
    total = f1.getbbox("I")[3] - f1.getbbox("I")[1] + gap1 + hp + gap2 + hp
    if with_byline:
        total += 40 * scale
    y = (h - total) / 2
    b1 = f1.getbbox("I")
    tracked(d, ((w - l1) / 2, y - b1[1]), t1, f1, GOLD, tr)
    y += b1[3] - b1[1] + gap1
    d.text(((w - lp) / 2, y - asc2[1]), party, font=f2, fill=POP)
    y += hp + gap2
    bg = f3.getbbox("GAME")
    d.text(((w - lg) / 2, y - bg[1]), game, font=f3, fill=CREAM)
    y += hp
    if with_byline:
        t = "a living-room game by Maeser"
        lt = d.textlength(t, font=f4)
        d.text(((w - lt) / 2, y + 40 * scale - f4.getbbox("a")[1] - 4 * scale), t, font=f4, fill=(0xC9, 0xCD, 0xC6))
    return im


def channel_art():
    lockup(540, 405, 0.88, False).save(os.path.join(IMG, "icon_focus_fhd.png"), optimize=True)
    lockup(290, 218, 0.47, False).save(os.path.join(IMG, "icon_focus_hd.png"), optimize=True)
    lockup(1920, 1080, 2.0, True).save(os.path.join(IMG, "splash_fhd.jpg"), quality=90)
    # Small game logo used in the middle of the "all books" QR code.
    lockup(220, 220, 0.42, False).save(os.path.join(IMG, "ui", "logo_square.png"), optimize=True)


# ---------- font metrics ----------
FONT_KEYS = {
    "serif": "Fraunces-Black.ttf",
    "serifItalic": "Fraunces-BlackItalic.ttf",
    "serifSemi": "Fraunces-SemiBold.ttf",
    "medium": "Inter-Medium.ttf",
    "bold": "Inter-Bold.ttf",
    "xbold": "Inter-ExtraBold.ttf",
}


def metrics():
    out = {}
    for key, fname in FONT_KEYS.items():
        f = TTFont(os.path.join(FONTS, fname))
        upm = f["head"].unitsPerEm
        cmap = f.getBestCmap()
        hmtx = f["hmtx"]
        chars, widths = [], []
        for cp in sorted(cmap):
            if cp < 32:
                continue
            chars.append(chr(cp))
            widths.append(round(hmtx[cmap[cp]][0] / upm, 4))
        out[key] = {"chars": "".join(chars), "w": widths, "upm": upm}
    with open(os.path.join(CH, "data", "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    for sub in ("covers", "qr", "ui"):
        os.makedirs(os.path.join(IMG, sub), exist_ok=True)
    covers()
    qrs()
    ninepatch("r12", 12)
    ninepatch("r20", 20)
    ninepatch("r28", 28)
    ninepatch("pill", 40)
    ninepatch("ring12", 14, 4)
    ninepatch("ring20", 22, 4)
    ninepatch("ring28", 30, 6)
    ninepatch("pillring", 46, 6)
    dot()
    glow()
    channel_art()
    metrics()
    print("assets done")
