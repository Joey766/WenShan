export type Coin = 2 | 3;
export type Coins = readonly [Coin, Coin, Coin];
export type LineValue = 6 | 7 | 8 | 9;
export type Polarity = 0 | 1;

export const lineNames: Record<LineValue, string> = {
  6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳",
};
export const linePositions = ["初", "二", "三", "四", "五", "上"] as const;
export const coinFace = { 2: "反面", 3: "正面" } as const;

export const hexagramNames = (
  "乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 " +
  "噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 咸 恒 遁 大壮 晋 明夷 家人 睽 蹇 解 " +
  "损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济"
).split(" ");

// The least significant bit is the bottom line. Table rows are lower trigrams.
const trigrams = [
  { name: "乾", image: "天", mask: 7 },
  { name: "兑", image: "泽", mask: 3 },
  { name: "离", image: "火", mask: 5 },
  { name: "震", image: "雷", mask: 1 },
  { name: "巽", image: "风", mask: 6 },
  { name: "坎", image: "水", mask: 2 },
  { name: "艮", image: "山", mask: 4 },
  { name: "坤", image: "地", mask: 0 },
];
const wenWangTable = [
  [1, 43, 14, 34, 9, 5, 26, 11],
  [10, 58, 38, 54, 61, 60, 41, 19],
  [13, 49, 30, 55, 37, 63, 22, 36],
  [25, 17, 21, 51, 42, 3, 27, 24],
  [44, 28, 50, 32, 57, 48, 18, 46],
  [6, 47, 64, 40, 59, 29, 4, 7],
  [33, 31, 56, 62, 53, 39, 52, 15],
  [12, 45, 35, 16, 20, 8, 23, 2],
];

export function tossCoins(): Coins {
  const bits = globalThis.crypto.getRandomValues(new Uint8Array(3));
  return [bits[0] & 1 ? 3 : 2, bits[1] & 1 ? 3 : 2, bits[2] & 1 ? 3 : 2];
}

export function isCoins(input: unknown): input is Coins {
  return Array.isArray(input) && input.length === 3 && input.every(c => c === 2 || c === 3);
}

export function lineFromCoins([a, b, c]: Coins) {
  const value = (a + b + c) as LineValue;
  const yang = (value % 2) as Polarity;
  const moving = value === 6 || value === 9;
  return { value, name: lineNames[value], yang, moving, changed: (moving ? 1 - yang : yang) as Polarity };
}

export function getHexagram(lines: readonly Polarity[]) {
  if (lines.length !== 6 || !lines.every(line => line === 0 || line === 1)) {
    throw new RangeError("卦象须有六根阴阳爻");
  }
  const lower = trigrams.findIndex(t => t.mask === (lines[0] | lines[1] << 1 | lines[2] << 2));
  const upper = trigrams.findIndex(t => t.mask === (lines[3] | lines[4] << 1 | lines[5] << 2));
  const number = wenWangTable[lower][upper];
  const name = hexagramNames[number - 1];
  return {
    number,
    name,
    symbol: String.fromCodePoint(0x4dc0 + number - 1),
    title: lower === upper ? `${name}为${trigrams[upper].image}` : `${trigrams[upper].image}${trigrams[lower].image}${name}`,
    upper: trigrams[upper].name,
    lower: trigrams[lower].name,
    lines,
  };
}

export function getReading(coins: readonly Coins[]) {
  if (coins.length !== 6 || !coins.every(isCoins)) {
    throw new RangeError("完成六次三钱投掷后方可成卦");
  }
  const lines = coins.map(lineFromCoins);
  return {
    lines,
    original: getHexagram(lines.map(l => l.yang)),
    relating: getHexagram(lines.map(l => l.changed)),
    moving: lines.flatMap((l, i) => l.moving ? [i] : []),
  };
}

export type Reading = ReturnType<typeof getReading>;
