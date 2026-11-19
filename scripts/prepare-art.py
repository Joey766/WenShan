"""Make optimized runtime art from the supplied reference files."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "public/art"

# Coordinates are traced against 1000px proofs. No character pixels are redrawn.
APPROVED = {
    "xiaogua": [(118,155),(117,144),(127,134),(148,124),(175,119),(206,116),(250,116),
        (250,102),(240,98),(212,90),(212,85),(228,76),(241,74),(254,78),(269,89),
        (276,77),(287,72),(310,70),(315,72),(308,84),(297,94),(277,100),(273,113),
        (296,120),(322,130),(345,144),(368,159),(395,179),(413,197),(419,215),
        (411,231),(400,236),(409,252),(425,247),(440,233),(452,228),(465,229),
        (477,239),(478,252),(465,246),(447,249),(426,262),(411,269),(397,264),
        (377,250),(376,268),(365,284),(343,294),(326,295),(314,300),(279,300),
        (267,296),(231,297),(213,300),(187,299),(174,294),(154,292),(142,278),
        (145,263),(132,269),(123,270),(110,265),(119,252),(127,236),(128,224),
        (122,218),(116,208),(116,194),(124,178),(130,174)],
    "yunyao": [(595,209),(603,199),(618,196),(630,198),(651,198),(664,197),
        (667,173),(670,149),(680,122),(697,96),(723,78),(752,68),(781,65),
        (812,70),(837,81),(852,97),(865,124),(873,147),(865,137),(861,121),
        (850,105),(833,90),(809,79),(785,74),(754,76),(731,84),(710,99),
        (695,115),(683,140),(677,166),(677,193),(689,196),(704,171),
        (724,150),(747,136),(766,130),(794,127),(821,131),(847,141),(871,159),
        (888,182),(905,209),(928,208),(949,213),(961,222),(968,236),(970,254),
        (964,268),(951,277),(927,280),(917,292),(901,302),(878,308),(854,307),
        (837,304),(808,310),(771,312),(746,309),(727,305),(709,307),(685,304),
        (664,305),(632,296),(610,285),(602,272),(601,253),(594,242),(591,226)],
    "qingpu": [(153,468),(155,457),(164,441),(182,424),(207,409),(235,398),
        (262,382),(281,378),(306,382),(322,391),(337,403),(351,402),
        (366,410),(372,426),(376,452),(386,465),(403,470),(420,481),(430,495),
        (436,510),(435,520),(428,530),(415,533),(415,555),(401,579),(386,586),
        (376,598),(353,602),(335,598),(307,602),(269,602),(229,600),(201,594),
        (184,585),(177,567),(177,546),(181,520),(191,490),(191,481),(177,485),
        (172,497),(178,510),(177,518),(171,524),(164,522),(159,514),(159,507),
        (165,497),(166,484),(159,480)],
    "xuanji": [(646,498),(649,488),(664,478),(685,472),(712,467),(729,450),
        (752,436),(775,429),(801,424),(825,423),(849,427),(870,433),(891,445),
        (911,466),(922,481),(941,486),(957,495),(964,506),(967,518),(963,526),
        (954,536),(946,540),(949,532),(958,520),(960,510),(953,502),(938,495),
        (927,493),(939,517),(947,543),(949,563),(945,582),(934,600),(919,612),
        (897,618),(871,632),(847,634),(816,628),(781,627),(753,623),(733,627),
        (711,624),(693,616),(681,604),(674,586),(675,563),(679,541),(687,531),
        (670,523),(663,530),(653,531),(646,526),(642,517),(642,507),(647,503),
        (655,501),(659,503),(665,510),(674,518),(688,525),(697,503),(710,480),
        (688,477),(670,482),(658,487),(651,496)],
}

ENTRANCE = {
    "xiaogua": [(39,130),(54,143),(74,142),(98,128),(119,128),(142,141),
        (152,146),(129,161),(119,176),(122,187),(139,196),(157,201),(168,201),
        (164,213),(155,228),(168,232),(178,226),(176,211),(180,205),(188,224),
        (206,237),(219,245),(235,239),(254,238),(270,230),(284,234),(294,230),
        (297,214),(309,200),(314,176),(325,175),(330,163),(323,148),(304,130),
        (276,118),(250,112),(251,101),(264,94),(273,82),(258,80),(244,88),
        (237,101),(228,91),(212,85),(200,88),(199,95),(208,99),(228,101),
        (233,112),(209,116),(183,122),(166,134),(146,132),(124,119),(102,112),
        (83,115),(57,130)],
    "yunyao": [(708,179),(718,166),(733,166),(734,153),(743,131),(760,117),
        (779,108),(800,104),(822,104),(848,113),(867,130),(884,151),(893,174),
        (892,193),(887,181),(884,161),(874,143),(858,128),(841,116),(814,110),
        (794,110),(773,116),(753,127),(743,145),(739,166),(748,173),(767,155),
        (787,140),(810,136),(829,139),(851,152),(872,171),(882,196),(904,202),
        (910,217),(906,233),(890,244),(878,246),(867,255),(846,258),(830,253),
        (810,259),(784,256),(766,259),(740,254),(717,248),(706,236),(705,221),
        (713,206),(707,194)],
    "qingpu": [(83,360),(90,342),(114,321),(139,311),(161,310),(183,303),
        (208,299),(221,304),(240,320),(248,340),(249,351),(263,353),(277,365),
        (289,380),(298,399),(294,402),(288,394),(290,420),(294,436),(285,453),
        (273,462),(267,469),(251,469),(234,466),(219,472),(185,472),(157,470),
        (141,474),(127,468),(119,457),(114,437),(115,418),(120,394),(113,381),
        (108,384),(111,395),(109,402),(103,404),(98,397),(99,391),(103,383),
        (93,380),(86,373)],
    "xuanji": [(710,319),(729,313),(751,309),(771,300),(798,294),(819,292),
        (845,295),(867,306),(885,321),(898,340),(913,350),(926,362),(933,376),
        (933,386),(925,394),(911,399),(905,420),(890,437),(868,446),(856,458),
        (840,460),(829,453),(804,453),(781,447),(757,444),(736,440),(724,429),
        (720,416),(716,393),(713,367),(703,361),(698,351),(703,341),(714,342),
        (723,345),(738,326),(747,316),(727,318),(717,322),(708,333),(707,340),
        (705,335),(706,325)],
}

GESTURES = {
    "xiaogua": [(205,228),(210,221),(222,219),(231,222),(235,228),(235,234),
        (231,240),(225,244),(215,245),(208,240),(205,234)],
    "yunyao": [(706,184),(708,175),(714,169),(721,166),(729,166),(735,168),
        (742,172),(748,178),(749,185),(747,196),(742,202),(731,206),
        (723,210),(715,203),(709,194)],
}
BELL = [(910,54),(916,52),(920,56),(920,67),(922,74),(924,81),(930,88),
    (933,99),(941,110),(931,115),(921,116),(922,127),(927,138),(935,144),
    (948,150),(956,157),(969,169),(953,167),(941,170),(931,163),(922,152),
    (915,139),(912,128),(914,119),(907,118),(894,115),(890,109),(898,102),
    (901,91),(904,83),(912,77),(913,71),(909,66)]

# Face landmarks on the transparent runtime crops, with a patch of each pet's
# own texture for its small moving paw/cloud puff.
REACTIONS = {
    "xiaogua": (((165,149,14), (272,174,14)), "#694c34", (276,192,346,267)),
    "yunyao": (((199,173,14), (312,170,14)), "#665344", (352,206,429,275)),
    "qingpu": (((196,165,15), (320,150,15)), "#61603e", (322,220,397,297)),
    "xuanji": (((173,98,15), (304,121,15)), "#dfb269", (364,114,433,182)),
}


def coords(points, width):
    return [(round(x * width / 1000), round(y * width / 1000)) for x, y in points]


def alpha(image, points):
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).polygon(coords(points, image.width), fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.9))


def cutout(image, mask, name, max_width=500, box=None):
    result = image.copy().convert("RGBA")
    result.putalpha(mask)
    bounds = box or mask.getbbox()
    result = result.crop(bounds)
    result.thumbnail((max_width, max_width))
    result.save(OUTPUT / f"{name}.webp", quality=91, method=6)
    return bounds


def fill_plate(image, mask):
    """Fill only areas revealed under the moving sprites."""
    cut = np.asarray(mask.filter(ImageFilter.MaxFilter(9))) > 10
    indices = distance_transform_edt(cut, return_distances=False, return_indices=True)
    nearest = np.asarray(image)[tuple(indices)]
    fill = Image.fromarray(nearest).filter(ImageFilter.GaussianBlur(13))
    return Image.composite(fill, image, mask.filter(ImageFilter.MaxFilter(7)))


def frame(path, number):
    with Image.open(path) as source:
        source.seek(number)
        return source.convert("RGB")


def reaction_layers(name):
    eyes, stroke, patch = REACTIONS[name]
    pet = Image.open(OUTPUT / f"{name}.webp").convert("RGBA")
    closed = Image.new("L", pet.size)
    scan = ImageDraw.Draw(closed)
    for x, y, r in eyes:
        scan.ellipse((x-r-3, y-r-3, x+r+3, y+r+3), fill=255)
    # The closed eyelid layer inherits the colour immediately around the eyes.
    closed = closed.filter(ImageFilter.GaussianBlur(2))
    eyelids = fill_plate(pet.convert("RGB"), closed).convert("RGBA")
    face = ImageDraw.Draw(eyelids)
    for x, y, r in eyes:
        face.arc((x-r+3, y-5, x+r-3, y+5), 4, 170, fill=stroke, width=4)
    eyelids.putalpha(closed)
    eyelids.save(OUTPUT / f"{name}-blink.webp", quality=89, method=6)

    texture = pet.crop(patch).convert("RGB").resize((102, 106), Image.Resampling.LANCZOS)
    y, x = np.mgrid[0:106, 0:102]
    tone = 1.12 - 0.26 * (y / 106) - 0.12 * (x / 102)
    floof = Image.fromarray(np.uint8(np.clip(np.asarray(texture, dtype=float) * tone[:, :, None], 0, 255))).convert("RGBA")
    pad = Image.new("L", floof.size)
    ImageDraw.Draw(pad).ellipse((8, 5, 95, 101), fill=255)
    floof.putalpha(pad.filter(ImageFilter.GaussianBlur(1.4)))
    floof.save(OUTPUT / f"{name}-paw.webp", quality=91, method=6)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    approved = Image.open(ASSETS / "reference/characters_4_approved.png").convert("RGB")
    for name, points in APPROVED.items():
        cutout(approved, alpha(approved, points), name)
        reaction_layers(name)

    entrance = Image.open(ASSETS / "scenes/01_entrance/homepage_3d_concept.png").convert("RGB")
    plate = entrance.copy()
    for name, points in ENTRANCE.items():
        mask = alpha(entrance, points)
        box = cutout(entrance, mask, "entrance-" + name)
        if name in GESTURES:
            moving = ImageChops.multiply(alpha(entrance, GESTURES[name]), mask)
            rest = fill_plate(entrance, moving)
            cutout(rest, mask, "entrance-" + name + "-base", box=box)
            cutout(entrance, moving, "entrance-" + name + "-gesture", box=box)
        plate = fill_plate(plate, mask)
        print(name, [round(100 * x / s, 4) for x, s in zip(
            (box[0], box[1], box[2] - box[0], box[3] - box[1]), entrance.size * 2)])
    entrance.save(OUTPUT / "entrance-original.webp", quality=89, method=6)
    bell = alpha(entrance, BELL)
    cutout(entrance, bell, "entrance-bell", box=tuple(round(x * entrance.width / 1000) for x in (886, 46, 972, 173)))
    plate = fill_plate(plate, bell)
    plate.save(OUTPUT / "entrance.webp", quality=89, method=6)

    transition = ASSETS / "transitions/03_divination_to_reading/hexagram_to_scroll_transition.gif"
    table = frame(transition, 0)
    mask = Image.new("L", table.size)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(0,240),(116,235),(183,290),(191,388),(149,413),(0,412)], fill=255)
    draw.rounded_rectangle((234,198,380,375), 15, fill=255)
    fill_plate(table, mask.filter(ImageFilter.GaussianBlur(5))).save(OUTPUT / "terrace.webp", quality=87)
    pavilion = frame(transition, 5)
    pavilion.crop((0, 0, 508, 270)).save(OUTPUT / "pavilion.webp", quality=89)

    homes = Image.open(ASSETS / "pet_homes/four_homes_enlarged_reference.png").convert("RGB")
    rooms = [(22,28,477,216),(524,28,971,210),(23,358,476,560),(524,358,971,548)]
    occupants = [
        [(298,99),(400,96),(421,155),(413,209),(295,211),(292,160)],
        [(682,84),(808,83),(820,149),(794,202),(674,196),(662,152)],
        [(199,426),(310,426),(337,460),(326,532),(288,554),(201,551),(183,483)],
        [(664,410),(801,405),(833,467),(814,531),(667,544),(650,487)],
    ]
    for name, bounds, occupant in zip(APPROVED, rooms, occupants, strict=True):
        cleaned = fill_plate(homes, alpha(homes, occupant).filter(ImageFilter.GaussianBlur(4)))
        bounds_px = tuple(round(x * homes.width / 1000) for x in bounds)
        cleaned.crop(bounds_px).save(OUTPUT / f"home-{name}.webp", quality=88)


if __name__ == "__main__":
    main()
