"""Prepare texture atlases for deformation, retaining the approved v6 palette."""
from pathlib import Path
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "public/art/companions-v6"
OUT = ROOT / "public/art/companion-motion"
MOUTHS = {
    "xiaogua": ((188, 166, 243, 196), 35, [(191,174),(194,168),(208,168),(241,182),(242,191),(237,195),(201,182)]),
    "yunyao": ((225, 186, 282, 211), 28, [(227,190),(239,187),(256,188),(278,197),(281,205),(272,209),(230,202)]),
    "qingpu": ((232, 171, 300, 192), 30, [(233,181),(244,175),(265,173),(292,173),(297,179),(296,187),(274,186),(236,190)]),
    "xuanji": ((201, 115, 264, 151), 34, [(203,120),(212,116),(230,120),(262,134),(263,143),(259,148),(232,141),(203,130)]),
}
CAPS = {
    "xiaogua": [(0,81),(47,65),(126,59),(235,54),(320,75),(407,139),(441,183),(404,238),(365,245),
                (350,199),(320,154),(283,127),(247,110),(207,103),(167,105),(122,124),(90,145),(54,150),(17,139)],
    "qingpu": [(0,0),(358,0),(373,103),(371,126),(326,111),(284,94),(240,85),(210,83),(184,103),
               (163,121),(128,134),(79,134),(52,144),(28,157),(0,145)],
}
COIN = [(50,65),(78,65),(59,105),(56,130),(74,143),(83,159),(78,184),(62,202),(52,213),
        (51,238),(43,265),(31,275),(7,273),(3,257),(12,235),(22,209),(10,195),(5,166),(19,147),(39,139),(44,112)]
LIP_COLORS = {"xiaogua": (105, 66, 41), "yunyao": (97, 58, 37),
              "qingpu": (105, 72, 43), "xuanji": (170, 133, 93)}


def polygon(size, points, feather):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(feather))


def cut(base, points):
    mask = polygon(base.size, points, 1.2)
    layer = base.copy()
    alpha = base.getchannel("A")
    layer.putalpha(ImageChops.multiply(alpha, mask))
    base.putalpha(ImageChops.multiply(alpha, ImageChops.invert(mask.filter(ImageFilter.MinFilter(7)))))
    return layer


def face_mouth(base, pet):
    box, below, contour = MOUTHS[pet]
    mask = polygon(base.size, contour, 1.45)
    mouth = base.copy()
    mouth.putalpha(ImageChops.multiply(base.getchannel("A"), mask))
    x1, y1, x2, y2 = box
    clean = base.crop((x1, y1 + below, x2, y2 + below))
    base.paste(clean, (x1, y1), mask.crop(box))
    return mouth


def small_paw(name, size):
    stamp = Image.new("RGBA", size)
    if name not in CAPS:
        return stamp
    paw = Image.open(ROOT / f"public/art/{name}-paw.webp").convert("RGBA")
    paw = paw.crop(paw.getchannel("A").getbbox())
    width, height = size
    diameter = round(width * .074)
    paw.thumbnail((diameter, diameter), Image.Resampling.LANCZOS)
    stamp.paste(paw, ((width - paw.width) // 2, (height - paw.height) // 2))
    return stamp


def pursed_mouth(name, size):
    stamp = Image.new("RGBA", size)
    (left, top, right, bottom), _, _ = MOUTHS[name]
    x, y = (left + right) / 2, (top + bottom) / 2 + 1
    color = LIP_COLORS[name]
    radius = size[0] * .021
    draw = ImageDraw.Draw(stamp)
    draw.ellipse((x - radius, y - radius * .65, x + radius, y + radius * .65), fill=(*color, 238))
    inner = tuple(round(channel * .72) for channel in color)
    draw.ellipse((x - radius * .59, y - radius * .42, x + radius * .59, y + radius * .31), fill=(*inner, 255))
    return stamp.filter(ImageFilter.GaussianBlur(.75))


def smiling_mouth(name, size):
    stamp = Image.new("RGBA", size)
    (left, top, right, bottom), _, _ = MOUTHS[name]
    x, y = (left + right) / 2, (top + bottom) / 2
    radius = size[0] * (.032 if name == "xuanji" else .042)
    depth = radius * (.31 if name == "xuanji" else .43)
    color = (*LIP_COLORS[name], 240)
    points = []
    for step in range(25):
        position = step / 12 - 1
        curve = depth * (1 - position * position)
        points.append((x + radius * position, y + curve - depth * .38))
    brush = max(3, round(size[0] * .012))
    draw = ImageDraw.Draw(stamp)
    draw.line(points, fill=color, width=brush, joint="curve")
    for tip_x, tip_y in (points[0], points[-1]):
        half = brush / 2
        draw.ellipse((tip_x - half, tip_y - half, tip_x + half, tip_y + half), fill=color)
    return stamp.filter(ImageFilter.GaussianBlur(.85))


def main(expressions=False):
    output = OUT.with_name("companion-expressions") if expressions else OUT
    output.mkdir(parents=True, exist_ok=True)
    for name in MOUTHS:
        layer = lambda part: Image.open(V6 / f"{name}-{part}.webp").convert("RGBA")
        base = layer("rig")
        width, height = base.size
        empty = Image.new("RGBA", base.size)
        coin = cut(base, COIN) if name == "xiaogua" else empty
        cap = cut(base, CAPS[name]) if name in CAPS else empty
        mouth = face_mouth(base, name)
        atlas = Image.new("RGBA", ((width + 4) * 3, (height + 4) * (4 if expressions else 3)))
        parts = (base, layer("eyes"), layer("blink"), mouth, layer("accessory"), cap, coin,
                 small_paw(name, base.size), pursed_mouth(name, base.size))
        if expressions:
            parts += (smiling_mouth(name, base.size),)
        for i, part in enumerate(parts):
            atlas.paste(part, (i % 3 * (width + 4) + 2, i // 3 * (height + 4) + 2))
        atlas.save(output / f"{name}.webp", quality=94, method=6)


if __name__ == "__main__":
    main("--expressions" in sys.argv[1:])
