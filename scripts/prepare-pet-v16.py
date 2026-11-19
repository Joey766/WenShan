"""Build optimized runtime images from the verified v1.6 archive."""
from pathlib import Path
import json
import shutil
from xml.etree import ElementTree

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "assets/imports/wenshan-v16"
V15 = IMPORT / "WENSHAN_PET_V15"
V16 = IMPORT / "WENSHAN_V16"
PUBLIC = ROOT / "public/art/pet-v16"
PETS = ("xiaogua", "yunyao", "qingpu", "xuanji")
SHAPES = ("normal", "slightly_plump", "extra_cuddly")


def save_webp(source, dest, size, quality):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as picture:
        picture.thumbnail(size, Image.Resampling.LANCZOS)
        picture.save(dest, "WEBP", quality=quality, method=6)


def checked_svg(source, target):
    root = ElementTree.parse(source).getroot()
    for node in root.iter():
        assert node.tag.rsplit("}", 1)[-1] not in {"script", "foreignObject", "iframe", "image"}
        for prop, value in node.attrib.items():
            name = prop.rsplit("}", 1)[-1].lower()
            assert not name.startswith("on")
            assert name != "href" or value.startswith("#")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def main():
    raw = json.loads((V16 / "docs/MOTION_MANIFEST.json").read_text(encoding="utf8"))["assets"]
    actions = {pet: [] for pet in PETS}
    for motion in raw:
        pet, key = motion["character"], motion["action"]
        assert motion["rows"] == motion["cols"] == 4 and motion["frames"] == 16
        sheet = V16 / motion["sheet"]
        with Image.open(sheet) as art:
            assert art.mode == "RGBA" and art.size == (2160, 1640)
        path = f"motions/{pet}/{key}.webp"
        save_webp(sheet, PUBLIC / path, (864, 656), 86)
        actions[pet].append({"id": key, "name": motion["title_zh"], "kind": motion["type"],
                             "src": f"/art/pet-v16/{path}"})
    assert all(len(motions) == 5 for motions in actions.values())
    data = ROOT / "src/data/pet-v16-motions.json"
    data.write_text(json.dumps(actions, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

    for pet in PETS:
        save_webp(V15 / f"assets/homes/{pet}_home_4x3.png", PUBLIC / f"homes/{pet}.webp", (1600, 1200), 88)
        for shape in SHAPES:
            save_webp(V16 / f"assets/growth/{pet}/{shape}.png", PUBLIC / f"growth/{pet}/{shape}.webp", (380, 290), 89)

    for source in sorted((V15 / "assets/props").glob("*.svg")):
        checked_svg(source, PUBLIC / "props" / source.name)
    print("Built 20 sheets, 4 houses, 12 growth forms and 13 SVG props.")


if __name__ == "__main__":
    main()
