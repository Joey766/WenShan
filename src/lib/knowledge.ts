import texts from "../data/zhouyi.json" with { type: "json" };
import { modernNotes } from "../data/zhouyi-notes.ts";
import { getHexagram, linePositions, type Coins, type Polarity, type Reading } from "./yijing.ts";

const catalogue = texts.map((source, index) => {
  const [plain, keywords] = modernNotes[index];
  const lines: Polarity[] = source.lines.map(line => line.slice(0, 2).includes("九") ? 1 : 0);
  const hexagram = getHexagram(lines);
  if (hexagram.number !== source.number) throw new Error(`经文第 ${source.number} 卦的爻位与卦表不一致`);
  return {
    ...hexagram,
    classical: { judgement: source.judgement, lines: source.lines, extra: source.extra, source: source.source },
    commentary: { plain, keywords: keywords.split(" ") },
  };
});

export function knowledgeFor(number: number) {
  const entry = catalogue[number - 1];
  if (!entry || entry.number !== number) throw new RangeError("未找到对应的卦");
  return entry;
}

export function readingEvidence(reading: Reading) {
  const original = knowledgeFor(reading.original.number);
  const relating = knowledgeFor(reading.relating.number);
  return {
    original, relating,
    moving: reading.moving.map(index => ({
      position: index + 1,
      label: linePositions[index] + "爻",
      from: reading.lines[index].yang,
      to: reading.lines[index].changed,
      text: original.classical.lines[index],
    })),
    specialText: reading.moving.length === 6 ? original.classical.extra : null,
  };
}

export function modelEvidence({ question, background, coins, followup }: {
  question: string; background?: string; coins: Coins[]; followup?: string;
}, result: Reading) {
  const evidence = readingEvidence(result);
  const brief = (hex: ReturnType<typeof knowledgeFor>) => ({
    卦序: hex.number, 卦名: hex.name, 象名: hex.title, 卦符: hex.symbol,
    上卦: hex.upper, 下卦: hex.lower, 六爻从下往上: hex.lines,
    卦辞: hex.classical.judgement, 来源: hex.classical.source,
    编者白话: hex.commentary.plain, 主题: hex.commentary.keywords,
  });
  return {
    原问题: question,
    用户补充背景: background ?? "",
    当前追问: followup ?? "",
    原始投掷由下往上: coins.map((faces, index) => ({
      爻位: index + 1, 面值: faces, 和: result.lines[index].value,
      爻象: result.lines[index].name,
    })),
    本卦: { ...brief(evidence.original), 六条爻辞: evidence.original.classical.lines },
    动爻: evidence.moving,
    变卦: brief(evidence.relating),
    乾坤全动附文: evidence.specialText,
  };
}
