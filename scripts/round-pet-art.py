"""Round and softly relight the existing approved puppet layers."""
from math import exp, hypot
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ART = Path(__file__).resolve().parents[1] / "public/art"
CENTERS = {"xiaogua": (.47, .71), "yunyao": (.54, .7), "qingpu": (.54, .65), "xuanji": (.55, .57)}


def deform(size, center):
    width, height = size
    cx, cy = center

    def sample(x, y):
        u, v = x / width, y / height
        dx, dy = u - cx, v - cy
        radius = hypot(dx / .34, dy / .31)
        edge = min(1, u / .08, (1 - u) / .08, v / .08, (1 - v) / .09)
        weight = exp(-.85 * radius * radius) * edge
        return (u - .21 * dx * weight) * width, (v - .145 * dy * weight) * height

    return [
        ((left, top, right, bottom), sample(left, top) + sample(left, bottom) + sample(right, bottom) + sample(right, top))
        for row in range(12) for column in range(16)
        for left, right in [(width * column // 16, width * (column + 1) // 16)]
        for top, bottom in [(height * row // 12, height * (row + 1) // 12)]
    ]


def light_map(size, center):
    width, height = size
    cx, cy = center
    values = []
    for y in range(height):
        for x in range(width):
            dx, dy = x / width - cx, y / height - cy
            dome = exp(-((dx / .36) ** 2 + (dy / .32) ** 2))
            highlight = exp(-(((dx + .085) / .17) ** 2 + ((dy + .105) / .19) ** 2))
            shadow = exp(-(((dx - .13) / .19) ** 2 + ((dy - .13) / .14) ** 2))
            values.append(dome * (.12 * highlight - .12 * shadow))
    return values


def rerender(image, mesh, lights):
    warped = image.transform(image.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    warped.putdata([
        (min(255, round(r * (1 + light))), min(255, round(g * (1 + light * .88))),
         min(255, round(b * (1 + light * .70))), a)
        for (r, g, b, a), light in zip(warped.getdata(), lights)
    ])
    return warped


for name, center in CENTERS.items():
    original = Image.open(ART / f"{name}.webp").convert("RGBA")
    mesh = deform(original.size, center)
    lighting = light_map(original.size, center)
    for layer in ("rig", "eyes", "blink", "accessory"):
        image = Image.open(ART / f"{name}-{layer}.webp").convert("RGBA")
        if layer == "rig":
            alpha = image.getchannel("A")
            # An underlap at the accessory seam keeps skin covered while it settles.
            overlap = ImageChops.darker(original.getchannel("A"), alpha.filter(ImageFilter.MaxFilter(9)))
            image = Image.composite(image, original, alpha)
            image.putalpha(overlap)
        rerender(image, mesh, lighting).save(ART / f"{name}-round-{layer}.webp", quality=92, method=6)
