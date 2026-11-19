"""Validate the browser-rendered expressions and package transparent fallback sheets."""
from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/derived/pet-expression-sheets"
OUT = ROOT / "public/art/companion-expressions/motions"
PROOF = ROOT / "output/playwright/pet-expression-pass"
FRAMED = ROOT / "src/data/pet-v16-motions.json"

def main():
    actions = json.loads(FRAMED.read_text(encoding="utf8"))
    names = {"xiaogua": "小卦", "yunyao": "云爻", "qingpu": "青朴", "xuanji": "玄机"}
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 19)
    overview = Image.new("RGB", (1200, 778), "#eee1cd")
    labels = ImageDraw.Draw(overview)
    for row, (pet, motions) in enumerate(actions.items()):
        for col, motion in enumerate(motions):
            path = SOURCE / pet / (motion["id"] + ".png")
            with Image.open(path) as opened:
                assert opened.mode == "RGBA" and opened.size == (2160, 1640), path
                frames = [opened.crop((x * 540, y * 410, (x+1) * 540, (y+1) * 410))
                          for y in range(4) for x in range(4)]
                distinct = {hashlib.sha256(frame.tobytes()).digest() for frame in frames}
                assert len(distinct) == 16, path
                for frame in frames:
                    alpha = frame.getchannel("A")
                    bbox = alpha.point(lambda pixel: 255 if pixel >= 72 else 0).getbbox()
                    assert bbox and 389 <= bbox[3] <= 401 and bbox[2] - bbox[0] > 300, (path, bbox)
                    assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (539, 0), (0, 409), (539, 409))), path
                asset = OUT / pet / (motion["id"] + ".webp")
                asset.parent.mkdir(parents=True, exist_ok=True)
                opened.resize((864, 656), Image.Resampling.LANCZOS).save(asset, quality=89, method=6)
                position = 9 if motion["kind"] in ("accessory", "happy") else 8
                sample = frames[position].resize((218, 166), Image.Resampling.LANCZOS)
                overview.paste(sample, (col * 240 + 11, row * 194 + 2), sample)
                labels.text((col * 240 + 12, row * 194 + 163), names[pet] + "  " + motion["name"], font=font, fill="#3e2c25")
    PROOF.mkdir(parents=True, exist_ok=True)
    overview.save(PROOF / "expression-sheet-overview.jpg", quality=93)
    print("Validated 320 distinct alpha frames and optimized 20 fallback sheets.")


if __name__ == "__main__":
    main()
