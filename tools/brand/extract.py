# Usage: python3 tools/brand/extract.py docs/brand/legal-pad-reference.png <out-dir>
# Needs numpy and Pillow. Copy the results into apps/web/src/assets/brand and apps/web/public.
"""Cut the Joke Shovel artwork out of the legal-pad screenshot.

Writes transparent PNGs: the full shovel, the blade (JS) icon, and the
wordmark in dark ink and in light (for the charcoal top bar).
"""
import sys
import numpy as np
from PIL import Image

src, outdir = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(float)
PAPER = np.array([243, 238, 138.])
TEAL = np.array([89, 161, 145.])
RED = np.array([175, 64, 68.])
INK = np.array([30, 29, 32.])
LUM = np.array([0.299, 0.587, 0.114])


def seg_dist(px, a, b):
    ab = b - a
    t = np.clip(((px - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(px - (a + t[..., None] * ab), axis=-1)


def dilate(m):
    d = m.copy()
    d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]
    return d


def erode(m):
    e = m.copy()
    e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
    return e


def flood_from_border(bg):
    region = np.zeros_like(bg)
    region[0, :] = bg[0, :]; region[-1, :] = bg[-1, :]; region[:, 0] = bg[:, 0]; region[:, -1] = bg[:, -1]
    # Also seed from any open patch of paper (e.g. inside the D-handle grip).
    open_paper = bg
    for _ in range(7):
        open_paper = erode(open_paper)
    region |= open_paper
    while True:
        grown = dilate(region) & bg
        if (grown == region).all():
            return region
        region = grown


def ink_alpha(px):
    """Coverage of black ink over paper, from luminance."""
    lum = px @ LUM
    return np.clip((PAPER @ LUM - lum) / (PAPER @ LUM - INK @ LUM), 0, 1)


def save(arr_rgba, name, height=None):
    img = Image.fromarray(arr_rgba.astype(np.uint8), 'RGBA')
    bbox = img.getbbox()
    img = img.crop(bbox)
    if height and img.height > height:
        img = img.resize((round(img.width * height / img.height), height), Image.LANCZOS)
    img.save(f'{outdir}/{name}', optimize=True)
    print(name, img.size)
    return img


# ---- Shovel: multi-colour art; remove background connected to the outside.
x0, y0, x1, y1 = 91, 150, 400, 1175
crop = rgb[y0:y1, x0:x1]
bg = (seg_dist(crop, PAPER, TEAL) < 24) | (seg_dist(crop, PAPER, RED) < 24)
outside = flood_from_border(bg)
# The wordmark's first letters overlap this box (right of the handle, above the blade).
outside[325 - y0 : 650 - y0, 330 - x0 :] = True
alpha = np.where(outside, 0.0, 1.0)
# Edge pixels are paper blended with the black outline: un-mix them.
edge = ~outside & dilate(outside)
edge2 = ~outside & ~edge & dilate(edge)
colour = crop.copy()
for e in (edge, edge2):
    a = ink_alpha(crop[e])
    alpha[e] = np.maximum(a, 0.0)
    colour[e] = INK
shovel = np.dstack([colour, alpha * 255])
save(shovel, 'shovel.png', height=640)

# Blade with the JS initials, as a square icon.
blade = shovel[640:, :, :].copy()
bimg = Image.fromarray(blade.astype(np.uint8), 'RGBA')
bimg = bimg.crop(bimg.getbbox())
side = max(bimg.size) + 16
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(bimg, ((side - bimg.width) // 2, (side - bimg.height) // 2))
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (64, 'icon-64.png'), (32, 'favicon-32.png')]:
    sq.resize((size, size), Image.LANCZOS).save(f'{outdir}/{name}', optimize=True)
print('icons from blade', sq.size)

# ---- Wordmark: pure ink; key out paper and every ruled-line pixel.
x0, y0, x1, y1 = 330, 320, 840, 650
crop = rgb[y0:y1, x0:x1]
greenish = (crop[..., 1] - crop[..., 0]) > 8
alpha = ink_alpha(crop)
alpha[greenish] = 0
alpha[alpha < 0.08] = 0
dark = np.dstack([np.broadcast_to(INK, crop.shape), alpha * 255])
light = np.dstack([np.broadcast_to(np.array([250, 247, 220.]), crop.shape), alpha * 255])
save(dark, 'wordmark-dark.png', height=220)
save(light, 'wordmark-light.png', height=220)
