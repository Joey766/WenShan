import { strict as assert } from "node:assert";
import { test } from "node:test";
import { knowledgeFor, modelEvidence, readingEvidence } from "../src/lib/knowledge.ts";
import { demoReading, fortuneFromCast, judgementPhrases } from "../src/lib/interpretation.ts";
import { cleanOracleLine, oracleClosings, readingFieldStream, generateReading } from "../src/lib/reading-generation.ts";
import { oracleCases } from "../scripts/oracle-fixtures.mjs";
import { getReading, type Coins } from "../src/lib/yijing.ts";

const oldYin = [2,2,2] as const;
const yang = [2,2,3] as const;
const yin = [2,3,3] as const;
const oldYang = [3,3,3] as const;

test("all 64 knowledge entries include trigram structure, canonical text, original commentary and keywords", () => {
  for (let n = 1; n <= 64; n++) {
    const { number, name, upper, lower, lines, classical, commentary } = knowledgeFor(n);
    assert.equal(number, n);
    assert.ok(name && upper && lower);
    assert.equal(lines.length, 6);
    assert.equal(classical.lines.length, 6);
    assert.ok(classical.judgement && classical.source.includes("zh.wikisource.org"));
    assert.ok(commentary.plain.length >= 30);
    assert.equal(new Set(commentary.keywords).size, 3);
  }
});

test("none, one, several, and all moving lines select the correct evidence", () => {
  const cases: { rolls: Coins[]; numbers: [number, number]; positions: number[] }[] = [
    { rolls: [yang,yang,yang,yin,yin,yin], numbers: [11,11], positions: [] },
    { rolls: [oldYang,yang,yang,yang,yang,yang], numbers: [1,44], positions: [1] },
    { rolls: [oldYang,yang,yang,yin,yin,oldYin], numbers: [11,18], positions: [1,6] },
    { rolls: Array(6).fill(oldYang), numbers: [1,2], positions: [1,2,3,4,5,6] },
    { rolls: Array(6).fill(oldYin), numbers: [2,1], positions: [1,2,3,4,5,6] },
  ];
  for (const { rolls, numbers, positions } of cases) {
    const result = getReading(rolls);
    const evidence = readingEvidence(result);
    assert.deepEqual([evidence.original.number, evidence.relating.number], numbers);
    assert.deepEqual(evidence.moving.map(line => line.position), positions);
    assert.deepEqual(evidence.moving.map(line => line.text), positions.map(pos => evidence.original.classical.lines[pos - 1]));
    assert.ok(evidence.moving.every(line => line.from !== line.to));
    if (positions.length === 6) assert.match(evidence.specialText ?? "", numbers[0] === 1 ? /^用九/ : /^用六/);
    else assert.equal(evidence.specialText, null);
  }
  assert.equal(readingEvidence(getReading([oldYang,oldYang,oldYang,oldYin,oldYin,oldYin])).specialText, null);
});

test("AI evidence preserves exact rolls, background, original and relating sources across follow-ups", () => {
  const coins = [oldYang, yang, yang, yang, yang, yang];
  const reading = getReading(coins);
  const request = { question: "如何开始", background: "正在准备第一次提案", coins };
  const first = modelEvidence(request, reading);
  const follow = modelEvidence({ ...request, followup: "应该先找谁反馈？" }, reading);
  assert.deepEqual(follow, { ...first, 当前追问: "应该先找谁反馈？" });
  assert.equal(first.用户补充背景, request.background);
  assert.deepEqual(first.原始投掷由下往上.map(row => row.面值), coins);
  assert.equal(first.本卦.卦序, 1);
  assert.equal(first.变卦.卦序, 44);
  assert.equal(first.动爻[0].text, first.本卦.六条爻辞[0]);
  assert.ok(first.本卦.来源.includes("oldid="));
  assert.ok(first.变卦.来源.includes("oldid="));
});



test("fixed casts produce topic-specific answers with all three verdicts", () => {
  const readingTexts: string[] = [];
  for (const item of oracleCases) {
    const coins = item.coins as unknown as Coins[];
    const cast = getReading(coins);
    const request = { question: item.question, coins };
    const fortune = fortuneFromCast(request, cast);
    assert.deepEqual([cast.original.name, cast.relating.name], item.names);
    assert.deepEqual(cast.moving.map(index => index + 1), item.positions);
    assert.equal(fortune.verdict, item.verdict, item.label);
    assert.ok(fortune.directAnswer.includes(item.first) && fortune.directAnswer.includes(item.aim));
    assert.match(fortune.hexagramBasis, new RegExp(item.names[0]));
    const answer = demoReading(request, cast);
    assert.doesNotMatch(answer.text, /建议|训练|请补充|如果|肯定|一定|注定|[？?]|[\d%％]/u);
    readingTexts.push(answer.text);
  }
  assert.notEqual(readingTexts[0], readingTexts.at(-1));
  assert.notEqual(readingTexts[0], readingTexts[5]);
  assert.deepEqual(judgementPhrases(knowledgeFor(1).classical.judgement), ["元亨。", "利貞。"]);
  const kan: Coins[] = [yin, yang, yin, yin, yang, yin];
  const repeatedDanger = getReading(kan);
  assert.equal(repeatedDanger.original.name, "坎");
  assert.equal(fortuneFromCast({ question: "我这次考试能过吗？", coins: kan }, repeatedDanger).verdict, "偏慎");
});

test("lottery language follows the cast without inventing winning chances", () => {
  const question = "我今天适合买彩票吗？";
  const adverse = [yin, yin, yin, yang, yang, yang];
  const favorable = [yang, yang, yang, yang, yang, yang];
  assert.match(fortuneFromCast({ question, coins: adverse }, getReading(adverse)).directAnswer, /今日彩运偏慎.*不宜买彩票/);
  assert.match(fortuneFromCast({ question, coins: favorable }, getReading(favorable)).directAnswer, /今日彩运偏吉.*中奖仍是随机/);
  for (const verdict of ["偏吉", "中平", "偏慎"] as const) {
    assert.ok(oracleClosings(question, verdict).every(line => !/值得买|可以购买|建议购买|概率|中定了/u.test(line)));
  }
});

test("oracle guard rejects coaching, invented history, guaranteed outcomes and conflicting tones", () => {
  const item = oracleCases[0];
  const coins = item.coins as unknown as Coins[];
  const input = { question: item.question, coins };
  const result = getReading(coins);
  assert.equal(cleanOracleLine("closing", "你最近训练很多，所以一定能进球。", input, result), null);
  assert.equal(cleanOracleLine("closing", "大吉，这局必败无疑吗？", input, result), null);
  assert.equal(cleanOracleLine("closing", "卦象大吉，破门是好兆头。", input, result), null);
  assert.equal(cleanOracleLine("hexagramBasis", "建议加强控球训练，熟悉阵容。", input, result), null);
  assert.equal(cleanOracleLine("hexagramBasis", "带着明察的象意，再读便多一分进退起伏。", input, result), "带着明察的象意，再读便多一分进退起伏。");
});

test("partially received model responses emit available fields before a closing JSON object", () => {
  const seen: string[] = [];
  const stream = readingFieldStream((field, value) => seen.push(field + ":" + value));
  stream.push('{"hexagramBasis":"微\\u8');
  assert.deepEqual(seen, []);
  stream.push('fdb",');
  assert.deepEqual(seen, ["hexagramBasis:微进"]);
  assert.equal(stream.complete(), false);
  stream.push('"closing":"云开一线"}');
  assert.equal(stream.complete(), true);
  assert.equal(seen.length, 2);
});

test("gateway forwards real available basis without waiting for the closing section", async () => {
  const oldFetch = globalThis.fetch;
  const queue: string[] = [];
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let resolveFirst!: () => void;
  const received = new Promise<void>(resolve => { resolveFirst = resolve; });
  globalThis.fetch = async () => new Response(readable);
  const item = oracleCases[0];
  const coins = item.coins as unknown as Coins[];
  try {
    const reply = generateReading({ endpoint: "http://127.0.0.1:11434", name: "qwen3:4b" }, { question: item.question, coins }, getReading(coins),
      AbortSignal.timeout(2000), event => { if ("delta" in event) { queue.push(event.delta); resolveFirst(); } });
    await writer.write(encoder.encode(JSON.stringify({ message: { content: '{"hexagramBasis":"明察的象意里，有进退的起伏。",' } }) + "\n"));
    await received;
    assert.equal(queue.length, 1);
    assert.match(queue[0], /有进退的起伏/);
    const closing = oracleClosings(item.question, item.verdict as "偏慎")[1];
    await writer.write(encoder.encode(JSON.stringify({ message: { content: '"closing":' + JSON.stringify(closing) + "}" } }) + "\n" + JSON.stringify({ done: true }) + "\n"));
    await writer.close();
    const answer = await reply;
    assert.equal(answer?.mode, "local");
    assert.equal(answer?.fortune?.verdict, "偏慎");
    assert.equal(queue.length, 2);
    assert.ok(answer?.text.endsWith(queue.join("")));
  } finally { globalThis.fetch = oldFetch; }
});
