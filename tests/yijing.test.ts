import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getHexagram, getReading, isCoins, lineFromCoins, tossCoins, type Coins, type Polarity } from "../src/lib/yijing.ts";

type Text = { number: number; lines: string[]; judgement: string; source: string; extra: string | null };
const load = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const sourceTable = load("zhouyi-index") as number[];
const texts = load("zhouyi") as Text[];
const masks = [7, 3, 5, 1, 6, 2, 4, 0];
const lineBits = (mask: number, n: number) => Array.from({ length: n }, (_, i) => ((mask >> i) & 1) as Polarity);

test("all 64 patterns agree with the canonical index and the polarity of the 384 line labels", () => {
  assert.equal(texts.length, 64);
  assert.equal(sourceTable.length, 64);
  assert.deepEqual([...new Set(sourceTable)].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1));
  for (const [row, lower] of masks.entries()) {
    for (const [col, upper] of masks.entries()) {
      const number = sourceTable[row * 8 + col];
      const bits = [...lineBits(lower, 3), ...lineBits(upper, 3)];
      assert.equal(getHexagram(bits).number, number, `lower ${lower}, upper ${upper}`);
      const text = texts[number - 1];
      assert.equal(text.number, number);
      assert.equal(text.lines.length, 6);
      assert.deepEqual(text.lines.map(line => line.slice(0, 2).includes("九") ? 1 : 0), bits, `canonical text ${number}`);
      assert.ok(text.judgement.trim());
      assert.match(text.source, /^https:\/\/zh\.wikisource\.org\/.*(?:oldid=\d+|%E5%91%A8%E6%98%93)/);
    }
  }
  assert.match(texts[0].extra ?? "", /^用九/);
  assert.match(texts[1].extra ?? "", /^用六/);
  assert.equal(texts.slice(2).some(text => text.extra), false);
});

test("the eight coin-face combinations produce 1:3:3:1 and the expected names", () => {
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const [a, b, c] = lineBits(i, 3).map(x => (2 + x) as 2 | 3);
    const line = lineFromCoins([a, b, c]);
    const offset = a + b + c - 6;
    counts[offset]++;
    assert.equal(line.name, ["老阴", "少阳", "少阴", "老阳"][offset]);
    assert.equal(line.moving, offset === 0 || offset === 3);
  }
  assert.deepEqual(counts, [1, 3, 3, 1]);
});

test("generating a toss draws three independent random bytes", (context) => {
  const random = context.mock.method(globalThis.crypto, "getRandomValues", (buffer: Uint8Array) => {
    assert.equal(buffer.length, 3);
    return buffer.set([14, 73, 9]), buffer;
  });
  assert.deepEqual(tossCoins(), [2, 3, 3]);
  assert.equal(random.mock.callCount(), 1);
});

test("six throws descend through no hidden reorder and moving lines flip only their own polarity", () => {
  const table: Coins[] = [[2,2,2], [3,2,2], [3,3,2], [3,3,3]];
  for (let mask = 0; mask < 4096; mask++) {
    const rolls = Array.from({ length: 6 }, (_, i) => table[(mask >> (i * 2)) & 3]);
    assert.ok(rolls.every(isCoins));
    const result = getReading(rolls);
    result.lines.forEach((line, position) => {
      const value = rolls[position].reduce<number>((sum, coin) => sum + coin, 0);
      assert.equal(line.value, value);
      assert.equal(result.original.lines[position], value % 2);
      assert.equal(result.moving.includes(position), value === 6 || value === 9);
      assert.equal(result.relating.lines[position], value === 6 || value === 7 ? 1 : 0);
    });
  }
  assert.equal(getReading(Array(6).fill(table[3])).relating.name, "坤");
  assert.equal(getReading(Array(6).fill(table[0])).relating.name, "乾");
  assert.throws(() => getReading(table), RangeError);
});

test("known asymmetric hexagrams retain top and bottom orientation", () => {
  assert.equal(getHexagram([1,1,1,0,0,0]).title, "地天泰");
  assert.equal(getHexagram([0,0,0,1,1,1]).title, "天地否");
  assert.equal(getHexagram([1,0,1,0,1,0]).number, 63);
  assert.equal(getHexagram([0,1,0,1,0,1]).number, 64);
});
