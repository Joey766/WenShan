"""Build transparent, grounded companion layers from the material pack."""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/companions-v6/assets"
OUTPUT = ROOT / "public/art/companions-v6"
FEET = {
    "xiaogua": (129, 260, 34),
    "yunyao": (210, 305, 33),
    "qingpu": (162, 335, 38),
    "xuanji": (138, 329, 39),
}


def ease(amount):
    amount = max(0, min(1, amount))
    return amount * amount * (3 - 2 * amount)


def shorten_feet(base, placements):
    width, height = base.size
    top = height - 33
    strip = base.crop((0, top, width, height))
    left, right, spread = placements

    def source(x, y):
        nearest = min((left, right), key=lambda foot: abs(foot - x))
        delta = x - nearest
        blend = ease(y / 27)
        foot = 1 - ease(abs(delta) / spread)
        return x + delta * .86 * foot * blend, y + y * .32 * (.65 + .35 * foot) * blend

    grid_x = sorted(set(range(0, width, 5)) | {width})
    grid_y = (0, 5, 10, 15, 20, 24, 29, 33)
    mesh = [
        ((x1, y1, x2, y2), source(x1, y1) + source(x1, y2) + source(x2, y2) + source(x2, y1))
        for x1, x2 in zip(grid_x, grid_x[1:]) for y1, y2 in zip(grid_y, grid_y[1:])
    ]
    base.paste(strip.transform(strip.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC), (0, top))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for pet, placements in FEET.items():
        approved = Image.open(SOURCE / "approved" / f"{pet}.png").convert("RGBA")
        for layer in ("rig", "eyes", "blink", "accessory"):
            image = Image.open(SOURCE / "rig_layers" / f"{pet}-{layer}.png").convert("RGBA")
            assert image.size == approved.size
            if layer == "rig":
                # A narrow overlap keeps the seam covered when an accessory follows the body.
                alpha = image.getchannel("A")
                overlap = ImageChops.darker(approved.getchannel("A"), alpha.filter(ImageFilter.MaxFilter(7)))
                image = Image.composite(image, approved, alpha)
                image.putalpha(overlap)
                shorten_feet(image, placements)
            image.save(OUTPUT / f"{pet}-{layer}.webp", quality=92, method=6)


if __name__ == "__main__":
    main()
