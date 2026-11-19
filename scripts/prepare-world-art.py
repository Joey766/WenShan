"""Create optimized scene plates and independent effects from the round-two art pack."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/assets"
WORLD = ROOT / "public/art/world"
SCENES = ["01_entrance_shanhai", "02_divination_platform", "03_interpretation_pavilion"]
BRANCHES = [
    [(0, 0), (608, 0), (491, 93), (390, 112), (260, 177), (154, 175),
     (112, 293), (49, 368), (0, 436)],
    [(0, 0), (613, 0), (551, 72), (418, 109), (290, 152), (161, 161),
     (111, 250), (57, 327), (0, 378)],
    [(0, 0), (379, 0), (289, 85), (180, 104), (124, 167),
     (48, 192), (0, 253)],
]


def write(image, name, max_width, quality):
    image.thumbnail((max_width, max_width), Image.Resampling.LANCZOS)
    image.save(WORLD / f"{name}.webp", quality=quality, method=6)


def main():
    WORLD.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(SCENES):
        image = Image.open(ASSETS / f"backgrounds/{name}.png").convert("RGB")
        write(image.copy(), f"scene-{index}", 1672, 87)
        # Mobile framing is offset for the path, stone dais, and pavilion opening.
        center = (834, 842, 1014)[index]
        write(image.crop((center - 320, 0, center + 320, image.height)), f"scene-{index}-portrait", 960, 89)
        mask = Image.new("L", image.size)
        ImageDraw.Draw(mask).polygon(BRANCHES[index], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(29))
        canopy = image.convert("RGBA")
        canopy.putalpha(mask)
        write(canopy.crop((0, 0, 680, 510)), f"canopy-{index}", 680, 86)

    for name, source, size in [
        ("mist", "fog/foreground_mist_overlay.png", 1160),
        ("lantern", "lantern/lantern_hanging.png", 420),
        ("scroll", "scroll/blank_ancient_scroll.png", 1060),
        ("ring", "effects/golden_divination_ring.png", 580),
        ("coin-yang", "coins/coin_yang_face.png", 512),
        ("coin-yin", "coins/coin_yin_face.png", 512),
    ]:
        write(Image.open(ASSETS / "interaction" / source).convert("RGBA"), name, size, 88)


if __name__ == "__main__":
    main()
