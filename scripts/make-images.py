"""Draw the link-preview image, the app icons and the web app manifest.

Writes static/og.png (1200x630), static/apple-touch-icon.png (180x180),
static/icon-192.png, static/icon-512.png and static/manifest.webmanifest.

Everything is drawn from code: the game name comes from src/lib/game/config.ts, the colors are
the M3 tokens in src/routes/layout.css, and the type is the self-hosted variable fonts in
static/fonts, pinned to a weight with fontTools in memory (no converted font files are written).

Needs Pillow, fontTools and brotli (fontTools uses brotli to read woff2). From the repo root:

    python -m venv <somewhere outside the repo>/venv
    <venv python> -m pip install pillow fonttools brotli
    <venv python> scripts/make-images.py
"""

from __future__ import annotations

import io
import json
import math
import re
from functools import cache
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
FONTS = STATIC / "fonts"

# Supersampling factor: everything is drawn this many times larger, then downsampled.
SS = 4

# M3 color roles from src/routes/layout.css (light scheme, seed #2E6B3A).
PRIMARY = "#36693e"
ON_PRIMARY = "#ffffff"
PRIMARY_CONTAINER = "#b7f1ba"
SURFACE = "#f7fbf2"
SURFACE_CONTAINER_HIGH = "#e5e9e1"
ON_SURFACE = "#181d18"
ON_SURFACE_VARIANT = "#424940"

DISPLAY_FONT = "google-sans-flex-latin-rond-normal.woff2"
BODY_FONT = "roboto-flex-latin-opsz-normal.woff2"

TAGLINE = "One famous chart a day. Five calls. No hindsight."
DESCRIPTION = "One famous stock chart a day, name hidden. Five up-or-down calls on what it did next."


def game_name() -> str:
    config = (ROOT / "src/lib/game/config.ts").read_text(encoding="utf-8")
    match = re.search(r"export const GAME_NAME = '([^']+)'", config)
    if not match:
        raise SystemExit("GAME_NAME not found in src/lib/game/config.ts")
    return match.group(1)


# --------------------------------------------------------------------------------------------
# Fonts
# --------------------------------------------------------------------------------------------


@cache
def font_bytes(file: str, axes: tuple[tuple[str, float], ...]) -> bytes:
    """A static instance of a variable font at the given axis values, as TTF bytes."""
    font = TTFont(FONTS / file)  # reading woff2 needs the brotli package
    static = instancer.instantiateVariableFont(font, dict(axes))
    static.flavor = None
    out = io.BytesIO()
    static.save(out)
    return out.getvalue()


def load_font(file: str, size: float, **axes: float) -> ImageFont.FreeTypeFont:
    data = font_bytes(file, tuple(sorted(axes.items())))
    return ImageFont.truetype(io.BytesIO(data), round(size * SS))


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    tracking: float = 0,
) -> None:
    """Draw text with its baseline at xy (in output pixels), with optional letter spacing."""
    x, y = xy[0] * SS, xy[1] * SS
    if not tracking:
        draw.text((x, y), text, font=font, fill=fill, anchor="ls")
        return
    for i, ch in enumerate(text):
        # Advance by the laid-out width of the prefix so pair spacing matches plain layout.
        dx = font.getlength(text[:i]) + i * tracking * SS
        draw.text((x + dx, y), ch, font=font, fill=fill, anchor="ls")


# --------------------------------------------------------------------------------------------
# Shapes (all coordinates in output pixels; scaled by SS here)
# --------------------------------------------------------------------------------------------


def s(*values: float) -> list[float]:
    return [v * SS for v in values]


def disc(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill) -> None:
    draw.ellipse(s(cx - r, cy - r, cx + r, cy + r), fill=fill)


def polyline(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], width: float, fill) -> None:
    """A stroked path with round joins and round caps."""
    flat = [(x * SS, y * SS) for x, y in pts]
    draw.line(flat, fill=fill, width=round(width * SS), joint="curve")
    for x, y in (pts[0], pts[-1]):
        disc(draw, x, y, width / 2, fill)


def dashed(
    draw: ImageDraw.ImageDraw,
    a: tuple[float, float],
    b: tuple[float, float],
    dash: float,
    gap: float,
    width: float,
    fill,
) -> None:
    """A dashed straight line with round-capped dashes."""
    length = math.dist(a, b)
    ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    t = 0.0
    while t < length:
        end = min(t + dash, length)
        p = (a[0] + ux * t, a[1] + uy * t)
        q = (a[0] + ux * end, a[1] + uy * end)
        polyline(draw, [p, q], width, fill)
        t += dash + gap


def downsample(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    return img.resize(size, Image.Resampling.LANCZOS)


# --------------------------------------------------------------------------------------------
# The mark: the favicon (src/lib/assets/favicon.svg) in its 64-unit grid
# --------------------------------------------------------------------------------------------

MARK_LINE = [(12, 42), (21, 35), (28, 39), (37, 24)]
MARK_NEXT = ((41, 22), (52, 16))
MARK_STROKE = 5.5
MARK_DOT_SPACING = 8


def mark_dots() -> list[tuple[float, float]]:
    """Centres of the dotted 'next' segment.

    The favicon's dots (dasharray 0.1 8 from 41,22) start so close to the line's end that the
    first one touches it, which is invisible at 16 px but reads as a blob on a home screen.
    Here the dots keep the favicon's direction and 8-unit rhythm but are counted from the
    line's last point, so line, dot and dot are evenly spaced.
    """
    (x0, y0), (x1, y1) = MARK_NEXT
    length = math.dist(MARK_NEXT[0], MARK_NEXT[1])
    ux, uy = (x1 - x0) / length, (y1 - y0) / length
    ex, ey = MARK_LINE[-1]
    return [(ex + ux * k * MARK_DOT_SPACING, ey + uy * k * MARK_DOT_SPACING) for k in (1, 2)]


def mark_bounds() -> tuple[float, float, float, float]:
    pts = MARK_LINE + mark_dots()
    r = MARK_STROKE / 2
    return (
        min(x for x, _ in pts) - r,
        min(y for _, y in pts) - r,
        max(x for x, _ in pts) + r,
        max(y for _, y in pts) + r,
    )


def draw_mark(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    unit: float,
    line_color: str = ON_PRIMARY,
    next_color: str = PRIMARY_CONTAINER,
) -> None:
    """Draw the mark with its bounding box centred on (cx, cy); `unit` is px per favicon unit."""
    x0, y0, x1, y1 = mark_bounds()
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2

    def tx(p: tuple[float, float]) -> tuple[float, float]:
        return (cx + (p[0] - mx) * unit, cy + (p[1] - my) * unit)

    polyline(draw, [tx(p) for p in MARK_LINE], MARK_STROKE * unit, line_color)
    for p in mark_dots():
        x, y = tx(p)
        disc(draw, x, y, MARK_STROKE * unit / 2, next_color)


def mark_unit_for_safe_zone(size: float, radius_share: float) -> float:
    """Largest scale at which the centred mark fits inside a circle of radius size*radius_share."""
    x0, y0, x1, y1 = mark_bounds()
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    r = MARK_STROKE / 2
    reach = max(math.hypot(x - mx, y - my) + r for x, y in MARK_LINE + mark_dots())
    return size * radius_share / reach


# --------------------------------------------------------------------------------------------
# Icons
# --------------------------------------------------------------------------------------------


def make_icon(size: int, unit: float) -> Image.Image:
    img = Image.new("RGB", (size * SS, size * SS), PRIMARY)
    draw = ImageDraw.Draw(img)
    draw_mark(draw, size / 2, size / 2, unit)
    return downsample(img, (size, size))


def make_icons() -> None:
    # iOS rounds the corners itself and wants no transparency: a full-bleed tile, the mark at
    # about the favicon's proportions.
    apple = make_icon(180, 180 / 64 * 0.92)
    apple.save(STATIC / "apple-touch-icon.png", optimize=True)

    # Maskable: launchers may crop to a circle of radius 40%; keep the mark well inside it.
    for size in (192, 512):
        icon = make_icon(size, mark_unit_for_safe_zone(size, 0.34))
        icon.save(STATIC / f"icon-{size}.png", optimize=True)


# --------------------------------------------------------------------------------------------
# Link preview
# --------------------------------------------------------------------------------------------

OG_W, OG_H = 1200, 630
MARGIN_X = 88

# A made-up price path (higher is up). It belongs to no puzzle: a climb, a sharp drop, a slow
# recovery with a wobble, and it stops partway up so either call is plausible.
SHAPE = [
    0.400, 0.424, 0.454, 0.445, 0.448, 0.487, 0.532, 0.546, 0.529, 0.544, 0.598,
    0.644, 0.679, 0.692, 0.690, 0.726, 0.712, 0.589, 0.459, 0.371, 0.355, 0.328,
    0.287, 0.287, 0.313, 0.341, 0.358, 0.346, 0.348, 0.379, 0.397, 0.413, 0.437,
    0.468, 0.484, 0.512, 0.536, 0.503, 0.467, 0.473, 0.508, 0.554, 0.580, 0.600,
]


def make_og(name: str) -> None:
    img = Image.new("RGB", (OG_W * SS, OG_H * SS), SURFACE)
    draw = ImageDraw.Draw(img)

    # --- Type -----------------------------------------------------------------------------
    wordmark = load_font(DISPLAY_FONT, 132, wght=760, ROND=100)
    tagline = load_font(BODY_FONT, 48, wght=500, opsz=48)

    top = 74
    word_baseline = top + 104
    draw_text(draw, (MARGIN_X - 4, word_baseline), name, wordmark, ON_SURFACE, tracking=-2.5)
    draw_text(draw, (MARGIN_X, word_baseline + 72), TAGLINE, tagline, ON_SURFACE_VARIANT)

    # --- Chart ----------------------------------------------------------------------------
    chart_left, chart_right = MARGIN_X, OG_W - MARGIN_X
    chart_top, chart_bottom = 330, OG_H - 72
    context_right = chart_left + (chart_right - chart_left) * 0.5

    slots = 5
    gap = 12
    slot_w = (chart_right - context_right - gap * slots) / slots
    slot_x = [context_right + gap + k * (slot_w + gap) for k in range(slots)]
    radius = 28
    for k, x in enumerate(slot_x):
        fill = PRIMARY_CONTAINER if k == 0 else SURFACE_CONTAINER_HIGH
        draw.rounded_rectangle(
            s(x, chart_top, x + slot_w, chart_bottom), radius=radius * SS, fill=fill
        )

    lo, hi = min(SHAPE), max(SHAPE)
    pad = 30
    line_w = 8

    def point(i: int) -> tuple[float, float]:
        x = chart_left + (context_right - chart_left) * i / (len(SHAPE) - 1)
        y = chart_bottom - pad - (SHAPE[i] - lo) / (hi - lo) * (chart_bottom - chart_top - 2 * pad)
        return (x, y)

    pts = [point(i) for i in range(len(SHAPE))]
    head = pts[-1]

    # The current level, carried across the next slot: "from here, up or down?"
    dashed(
        draw,
        (head[0] + 30, head[1]),
        (slot_x[0] + slot_w - 22, head[1]),
        dash=12,
        gap=11,
        width=5,
        fill=PRIMARY,
    )

    polyline(draw, pts, line_w, PRIMARY)
    # The current point: a dot with a surface-coloured ring, like the game's chart head.
    disc(draw, head[0], head[1], 20, SURFACE)
    disc(draw, head[0], head[1], 13, PRIMARY)

    downsample(img, (OG_W, OG_H)).save(STATIC / "og.png", optimize=True)


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
        "theme_color": PRIMARY,
        "icons": icons,
    }
    (STATIC / "manifest.webmanifest").write_text(
        json.dumps(manifest, indent="\t") + "\n", encoding="utf-8"
    )


def main() -> None:
    name = game_name()
    make_og(name)
    make_icons()
    make_manifest(name)
    for f in ("og.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"):
        print(f"wrote static/{f}")


if __name__ == "__main__":
    main()
