"""Import the public-domain 易經 section of each Chinese Wikisource hexagram."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
HOST = "https://zh.wikisource.org"
INDEX = "/wiki/%E5%91%A8%E6%98%93"
CACHE = ROOT / ".work" / "zhouyi"
HEADERS = {"User-Agent": "WenshanLocalPrototype/0.1 (Chinese Wikisource Zhouyi import)"}


def page(url, key):
    cached = CACHE / (key + ".html")
    if not cached.exists():
        with urlopen(Request(url, headers=HEADERS), timeout=30) as response:
            cached.write_bytes(response.read())
    return BeautifulSoup(cached.read_bytes(), "html.parser")


def index_rows(soup):
    for table in soup.find_all("table"):
        rows = [
            [(a.get_text(strip=True), urljoin(HOST, a["href"])) for a in row.select("a[href]")
             if a["href"].startswith(INDEX + "/")]
            for row in table.find_all("tr")
        ]
        if [len(row) for row in rows if row] == [8] * 8:
            return [row for row in rows if row]
    raise ValueError("未找到维基文库六十四卦速查表")


def import_hexagram(task):
    number, name, url = task
    soup = page(url, f"{number:02d}")
    marker = soup.find(string=re.compile(r"^\s*易[經经][：:]\s*$"))
    if not marker:
        raise ValueError(f"{name}: 找不到易經小节")
    section = marker.find_parent("li")
    for annotation in section.select(".variant-tooltip, style, sup.reference"):
        annotation.decompose()
    statements = section.find("ul", recursive=False)
    lines = section.find("ol", recursive=False)
    judgement = statements.get_text(strip=True)
    active = [item.get_text(strip=True) for item in lines.find_all("li", recursive=False)]
    expected = 7 if number in (1, 2) else 6
    if len(active) != expected or not judgement:
        raise ValueError(f"{name}: 卦爻辞数量异常")
    for idx, line in enumerate(active[:6]):
        if not re.match(("初[六九]", "[六九]二", "[六九]三", "[六九]四", "[六九]五", "上[六九]")[idx], line):
            raise ValueError(f"{name}: 爻序异常 {line}")
    revision = soup.select_one("#t-permalink a[href]")
    source = urljoin(HOST, revision["href"]) if revision else url
    return {
        "number": number,
        "name": name,
        "judgement": judgement,
        "lines": active[:6],
        "extra": active[6] if expected == 7 else None,
        "source": source,
    }


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    index = page(HOST + INDEX, "index")
    rows = index_rows(index)
    index_numbers = [ord(c) - 0x4DBF for table in index.find_all("table")
                     for c in table.get_text() if 0x4DC0 <= ord(c) <= 0x4DFF]
    if sorted(index_numbers[:64]) != list(range(1, 65)):
        raise ValueError("卦表卦象编码异常")
    tasks = [(n, name, url) for n, (name, url) in zip(index_numbers[:64], sum(rows, []), strict=True)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        texts = sorted(pool.map(import_hexagram, tasks), key=lambda entry: entry["number"])
    out = ROOT / "src" / "data"
    out.mkdir(parents=True, exist_ok=True)
    for name, data in [("zhouyi", texts), ("zhouyi-index", index_numbers[:64])]:
        (out / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(texts)} hexagrams, {sum(len(t['lines']) for t in texts)} lines")


if __name__ == "__main__":
    main()
