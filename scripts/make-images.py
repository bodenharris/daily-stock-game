"""Draw the link-preview image, the app icons, the favicon and the web app manifest.

Writes static/og.png (1200x630), static/apple-touch-icon.png (180x180), static/icon-192.png,
static/icon-512.png, src/lib/assets/favicon.svg and static/manifest.webmanifest.

Everything is drawn from code in the site's pixel style: the game name comes from
src/lib/game/config.ts, the mascot from src/lib/brand/wolf.json (the same sprite the site draws),
the colors are the tokens in src/routes/layout.css and the header scene, and the type is the
self-hosted pixel fonts in static/fonts. Pixel art is drawn at 1x and scaled up with
nearest-neighbour, so every pixel stays a crisp square.

Needs Pillow, fontTools and brotli (fontTools uses brotli to read woff2). From the repo root:

    python -m venv <somewhere outside the repo>/venv
    <venv python> -m pip install pillow fonttools brotli
    <venv python> scripts/make-images.py
"""

from __future__ import annotations

import io
import json
import random
import re
from functools import cache
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
FONTS = STATIC / "fonts"

# Tokens from src/routes/layout.css; SKY is the header scene's (src/lib/brand/WolfScene.svelte).
INK = "#050a14"
SURFACE = "#0a1428"
PANEL = "#101d33"
OUTLINE_VARIANT = "#1f3557"
ON_SURFACE = "#e8f1ff"
ON_SURFACE_VARIANT = "#9fb2d3"
CYAN = "#4de3ff"
PINK = "#ff5d8f"
GREEN = "#5cf29a"
SKY = ["#0b1430", "#141a44", "#221c55", "#361f63", "#52226b", "#7a2a72", "#a83a78"]

PIXEL_FONT = "press-start-2p-latin-400-normal.woff2"
BODY_FONT = "vt323-latin-400-normal.woff2"

TAGLINE = "THE DAILY HUNT"
SUBLINE = "One famous chart a day. Five calls. No hindsight."
DESCRIPTION = "One famous stock chart a day, name hidden. Five up-or-down calls on what it did next."


def game_name() -> str:
    config = (ROOT / "src/lib/game/config.ts").read_text(encoding="utf-8")
    match = re.search(r"export const GAME_NAME = '([^']+)'", config)
    if not match:
        raise SystemExit("GAME_NAME not found in src/lib/game/config.ts")
    return match.group(1)


def wolf() -> dict:
    return json.loads((ROOT / "src/lib/brand/wolf.json").read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# Fonts
# --------------------------------------------------------------------------------------------


@cache
def font_bytes(file: str) -> bytes:
    """The woff2 file as plain TTF bytes (reading woff2 needs the brotli package)."""
    font = TTFont(FONTS / file)
    font.flavor = None
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def load_font(file: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(io.BytesIO(font_bytes(file)), size)


def text_width(text: str, font: ImageFont.FreeTypeFont, tracking: int = 0) -> float:
    return font.getlength(text) + tracking * (len(text) - 1)


def draw_text(draw, xy, text, font, fill, tracking: int = 0) -> None:
    """Text with its top-left at xy, unantialiased-looking via a 1-bit mask, with letter spacing."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


# --------------------------------------------------------------------------------------------
# Pixel art
# --------------------------------------------------------------------------------------------


def sprite_image(rows: list[str], palette: dict[str, str]) -> Image.Image:
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, key in enumerate(row):
            if key != ".":
                img.putpixel((x, y), Image.new("RGB", (1, 1), palette[key]).getpixel((0, 0)) + (255,))
    return img


def upscale(img: Image.Image, k: int) -> Image.Image:
    return img.resize((img.width * k, img.height * k), Image.Resampling.NEAREST)


HEAD_ROWS = 20  # ears to chin


def wolf_head() -> Image.Image:
    w = wolf()
    return sprite_image(w["rows"][:HEAD_ROWS], w["palette"])


# --------------------------------------------------------------------------------------------
# Icons
# --------------------------------------------------------------------------------------------


def make_icon(size: int, share: float) -> Image.Image:
    """The wolf's head on night navy, at the largest whole-number scale that fits `share` of it."""
    head = wolf_head()
    k = max(1, int(size * share / max(head.width, head.height)))
    big = upscale(head, k)
    img = Image.new("RGB", (size, size), SKY[0])
    # a band of dusk behind the chin, like the site's skyline
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, size * 0.72, size, size], fill=SKY[3])
    img.paste(big, ((size - big.width) // 2, (size - big.height) // 2 + k), big)
    return img


def make_icons() -> None:
    # iOS rounds the corners itself and wants no transparency: a full-bleed tile.
    make_icon(180, 0.78).save(STATIC / "apple-touch-icon.png", optimize=True)
    # Maskable: launchers may crop to a circle of radius 40%; keep the head inside it.
    for size in (192, 512):
        make_icon(size, 0.58).save(STATIC / f"icon-{size}.png", optimize=True)


def make_favicon(name: str) -> None:
    """The wolf's head as an SVG of merged pixel runs on a square navy tile."""
    w = wolf()
    rows = w["rows"][:HEAD_ROWS]
    pal = w["palette"]
    width = len(rows[0])
    side = max(width, len(rows)) + 2
    ox, oy = (side - width) // 2, (side - len(rows)) // 2 + 1
    rects = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            key, end = row[x], x + 1
            while end < len(row) and row[end] == key:
                end += 1
            if key != ".":
                rects.append(
                    f'\t<rect x="{x + ox}" y="{y + oy}" width="{end - x}" height="1" fill="{pal[key]}" />'
                )
            x = end
    svg = "\n".join(
        [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" shape-rendering="crispEdges">',
            f"\t<title>{name}</title>",
            f'\t<rect width="{side}" height="{side}" fill="{SKY[0]}" />',
            *rects,
            "</svg>",
            "",
        ]
    )
    (ROOT / "src/lib/assets/favicon.svg").write_text(svg, encoding="utf-8")


# --------------------------------------------------------------------------------------------
# Link preview
# --------------------------------------------------------------------------------------------

OG_W, OG_H = 1200, 630
P = 6  # one scene pixel = 6 output pixels
# A made-up price path (higher is up). It belongs to no puzzle.
SHAPE = [
    0.400, 0.424, 0.454, 0.445, 0.448, 0.487, 0.532, 0.546, 0.529, 0.544, 0.598,
    0.644, 0.679, 0.692, 0.690, 0.726, 0.712, 0.589, 0.459, 0.371, 0.355, 0.328,
    0.287, 0.287, 0.313, 0.341, 0.358, 0.346, 0.348, 0.379, 0.397, 0.413, 0.437,
    0.468, 0.484, 0.512, 0.536, 0.503, 0.467, 0.473, 0.508, 0.554, 0.580, 0.600,
]


def og_scene() -> Image.Image:
    """The site's header scene at 1x: dusk sky, stars, a skyline with lit windows."""
    w, h = OG_W // P, OG_H // P
    img = Image.new("RGB", (w, h), SKY[0])
    d = ImageDraw.Draw(img)
    sky_h = int(h * 0.62)
    band = sky_h / len(SKY)
    for i, c in enumerate(SKY):
        d.rectangle([0, int(i * band), w, int((i + 1) * band)], fill=c)
    rng = random.Random(14)
    for _ in range(60):
        d.point((rng.randrange(w), rng.randrange(int(sky_h * 0.45))), fill=ON_SURFACE_VARIANT)
    # moon
    d.ellipse([20, 6, 33, 19], fill="#fff2c4")
    d.rectangle([24, 10, 25, 11], fill="#f0dc96")
    # skyline
    x = 0
    while x < w:
        bw, bh = rng.randint(8, 22), rng.randint(8, 26)
        top = sky_h - bh
        d.rectangle([x, top, x + bw - 1, sky_h], fill=rng.choice(["#0d1530", "#111a3a"]))
        d.line([x, top, x + bw - 1, top], fill="#1d2a55")
        for wy in range(top + 3, sky_h - 2, 3):
            for wx in range(x + 2, x + bw - 2, 3):
                if rng.random() > 0.62:
                    d.point((wx, wy), fill=CYAN if rng.random() > 0.8 else "#ffd23f")
        x += bw
    # the street and the deep below it
    d.rectangle([0, sky_h, w, h], fill=SURFACE)
    d.line([0, sky_h, w, sky_h], fill=CYAN)
    return img


def make_og(name: str) -> None:
    img = upscale(og_scene(), P)
    draw = ImageDraw.Draw(img)
    sky_h = int((OG_H // P) * 0.62) * P

    # the wolf, standing on the street line
    w = wolf()
    k = 7
    mascot = upscale(sprite_image(w["rows"], w["palette"]), k)
    mx = 120
    img.paste(mascot, (mx, sky_h - mascot.height + 2 * k), mascot)

    # wordmark: the glitch split (pink left, cyan right), an ink drop, then the white face
    title = name.upper()
    font = load_font(PIXEL_FONT, 88)
    tx, ty = 400, 96
    draw_text(draw, (tx, ty + 8), title, font, INK, tracking=4)
    draw_text(draw, (tx - 5, ty), title, font, PINK, tracking=4)
    draw_text(draw, (tx + 5, ty), title, font, CYAN, tracking=4)
    draw_text(draw, (tx, ty), title, font, ON_SURFACE, tracking=4)

    tag = load_font(BODY_FONT, 56)
    draw_text(draw, (tx + 6, ty + 120), TAGLINE, tag, CYAN, tracking=18)

    sub = load_font(BODY_FONT, 44)
    draw_text(draw, (88, sky_h + 40), SUBLINE, sub, ON_SURFACE_VARIANT, tracking=2)

    # a stepped price line heading into five empty call slots, bottom right
    left, right = 470, OG_W - 88
    top, bottom = sky_h + 110, OG_H - 40
    ctx_r = left + (right - left) * 0.45
    slots = 5
    gap = 12
    slot_w = (right - ctx_r - gap * slots) / slots
    for i in range(slots):
        x0 = ctx_r + gap + i * (slot_w + gap)
        draw.rectangle([x0, top, x0 + slot_w, bottom], fill=PANEL if i else "#123a52", outline=OUTLINE_VARIANT, width=3)
    lo, hi = min(SHAPE), max(SHAPE)
    pts = [
        (
            left + (ctx_r - left) * i / (len(SHAPE) - 1),
            bottom - 8 - (v - lo) / (hi - lo) * (bottom - top - 16),
        )
        for i, v in enumerate(SHAPE)
    ]
    draw.line(pts, fill=CYAN, width=6)
    hx, hy = pts[-1]
    draw.rectangle([hx - 9, hy - 9, hx + 9, hy + 9], fill=INK)
    draw.rectangle([hx - 6, hy - 6, hx + 6, hy + 6], fill=GREEN)

    img.save(STATIC / "og.png", optimize=True)


# --------------------------------------------------------------------------------------------
# Manifest
# --------------------------------------------------------------------------------------------


def make_manifest(name: str) -> None:
    icons = []
    for size in (192, 512):
        for purpose in ("any", "maskable"):
            icons.append(
                {
                    "src": f"/icon-{size}.png",
                    "sizes": f"{size}x{size}",
                    "type": "image/png",
                    "purpose": purpose,
                }
            )
    manifest = {
        "name": name,
        "short_name": name,
        "description": DESCRIPTION,
        "start_url": "/",
        "display": "standalone",
        "background_color": SURFACE,
        "theme_color": SKY[0],
        "icons": icons,
    }
    (STATIC / "manifest.webmanifest").write_text(
        json.dumps(manifest, indent="\t") + "\n", encoding="utf-8"
    )


def main() -> None:
    name = game_name()
    make_og(name)
    make_icons()
    make_favicon(name)
    make_manifest(name)
    for f in (
        "static/og.png",
        "static/apple-touch-icon.png",
        "static/icon-192.png",
        "static/icon-512.png",
        "src/lib/assets/favicon.svg",
        "static/manifest.webmanifest",
    ):
        print(f"wrote {f}")


if __name__ == "__main__":
    main()
