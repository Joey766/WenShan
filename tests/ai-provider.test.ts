import { strict as assert } from "node:assert";
import test from "node:test";
import { requestModel, streamModelText } from "../src/lib/server/ai-provider.ts";
import { generateReading, oracleClosings } from "../src/lib/reading-generation.ts";
import { fortuneFromCast } from "../src/lib/interpretation.ts";
import { getReading, type Coins } from "../src/lib/yijing.ts";

const gemini = { provider: "gemini", key: "fixture-key", name: "gemini-3.1-flash-lite" } as const;
const options = { messages: [{ role: "system", content: "返还合法 JSON" }, { role: "user", content: "固定的测试" }],
  stream: true, format: {}, maxTokens: 240, temperature: .2, context: 2048 };

test("Gemini streaming adapter handles split SSE frames, ignores thoughts and preserves validated divination", async context => {
  const sent: string[] = [];
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let first!: () => void;
  const received = new Promise<void>(resolve => { first = resolve; });
  context.mock.method(globalThis, "fetch", async (url: string, request: RequestInit) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?alt=sse");
    assert.equal(new Headers(request.headers).get("x-goog-api-key"), "fixture-key");
    const body = JSON.parse(String(request.body));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "minimal" });
    assert.ok(body.systemInstruction.parts.length);
    assert.ok(!String(request.body).includes("fixture-key"));
    return new Response(readable);
  });
  const question = "今天比赛踢得如何？";
  const coins: Coins[] = Array.from({ length: 6 }, () => [2,2,3]);
  const reading = getReading(coins);
  const answer = generateReading(gemini, { question, coins }, reading, AbortSignal.timeout(2000), event => {
    if ("delta" in event) { sent.push(event.delta); first(); }
  });
  function frame(text: string, done = false) {
    return "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text }] },
      ...(done ? { finishReason: "STOP" } : {}) }] }) + "\r\n\r\n";
  }
  const writing = frame('{"hexagramBasis":"一段无效的白话",');
  await writer.write(encoder.encode(writing.slice(0, 10)));
  await writer.write(encoder.encode(writing.slice(10)));
  await received;
  assert.equal(sent.length, 1);
  const selected = oracleClosings(question, fortuneFromCast({ question, coins }, reading).verdict)[0];
  await writer.write(encoder.encode(frame('"closing":' + JSON.stringify(selected) + "}", true)));
  await writer.close();
  const final = await answer;
  assert.equal(final?.mode, "cloud");
  assert.equal(final?.fortune?.closing, selected);
  assert.ok(!final?.text.includes("hidden") && !final?.text.includes("无效的白话"));
});

test("model quota errors and incomplete upstream streams are distinguishable", async context => {
  context.mock.method(globalThis, "fetch", async () => new Response("", { status: 429 }));
  await assert.rejects(requestModel(gemini, options, new AbortController().signal), { code: "quota" });
  assert.equal(await streamModelText(gemini, new Response('data: {"candidates":[{"finishReason":"MAX_TOKENS"}]}\n\n'), () => {}), false);
});
