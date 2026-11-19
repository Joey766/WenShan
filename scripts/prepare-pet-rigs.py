"""Split identity-preserving motion layers from the approved runtime cutouts."""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ART = Path(__file__).resolve().parents[1] / "public/art"

PARTS = {
    "xiaogua": ([(119,0),(314,0),(304,37),(247,58),(203,70),(185,61),(141,38)], [(165,149,15),(272,174,15)]),
    "yunyao": ([(91,0),(392,0),(392,88),(331,92),(302,77),(217,79),(170,103),(131,145),(123,175),(91,177)], [(199,173,15),(312,170,15)]),
    "qingpu": ([(16,173),(40,169),(47,189),(46,218),(25,228),(12,217),(12,193)], [(196,165,16),(320,150,16)]),
    "xuanji": ([(0,117),(38,119),(61,132),(75,149),(66,160),(45,169),(0,174)], [(173,98,15),(304,121,15)]),
}


def write_layer(source, alpha, name):
    layer = source.copy()
    layer.putalpha(ImageChops.multiply(source.getchannel("A"), alpha))
    layer.save(ART / f"{name}.webp", quality=91, method=6)


def main():
    for name, (accessory, eyes) in PARTS.items():
        source = Image.open(ART / f"{name}.webp").convert("RGBA")
        accessory_mask = Image.new("L", source.size)
        ImageDraw.Draw(accessory_mask).polygon(accessory, fill=255)
        accessory_mask = accessory_mask.filter(ImageFilter.GaussianBlur(.73))
        write_layer(source, accessory_mask, f"{name}-accessory")

        eyes_mask = Image.new("L", source.size)
        painter = ImageDraw.Draw(eyes_mask)
        for x, y, size in eyes:
            painter.ellipse((x-size, y-size, x+size, y+size), fill=255)
        eyes_mask = eyes_mask.filter(ImageFilter.GaussianBlur(1))
        write_layer(source, eyes_mask, f"{name}-eyes")

        # The existing blink artwork already contains sampled face colours.
        # Reuse its colour plane to clean the eyes, without painting eyelid strokes.
        fallback = source.copy()
        for x, y, size in eyes:
            patch = source.crop((x-size, y+size+2, x+size+1, y+size*3+3))
            fallback.paste(patch, (x-size, y-size))
        clean = Image.composite(fallback, source, eyes_mask)
        clean.putalpha(ImageChops.multiply(source.getchannel("A"), ImageChops.invert(accessory_mask)))
        clean.save(ART / f"{name}-rig.webp", quality=92, method=6)


if __name__ == "__main__":
    main()
