
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { fortuneFromCast } from "../src/lib/interpretation.ts";
import { getReading } from "../src/lib/yijing.ts";
import { oracleCases } from "./oracle-fixtures.mjs";

const origin = process.env.WENSHAN_AI_TEST_ORIGIN ?? "http://127.0.0.1:3193";
const provider = process.argv.includes("--gemini") ? "gemini" : "ollama";
if (provider === "gemini" && !process.env.WENSHAN_AI_TEST_ORIGIN) {
  assert.ok(process.env.GEMINI_API_KEY && process.env.WENSHAN_DATABASE_URL,
    "Configure the isolated Gemini Free Tier project and quota database before the live test.");
}
if (provider === "gemini") {
  assert.ok(process.env.WENSHAN_AI_TEST_EMAIL && process.env.WENSHAN_AI_TEST_PASSWORD,
    "Use a disposable email-verified Preview account for the live Gemini test.");
}
assert.equal(new URL(origin).hostname, "127.0.0.1");
const server = process.env.WENSHAN_AI_TEST_ORIGIN ? null : spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3193",
], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", WENSHAN_AI_PROVIDER: provider,
    WENSHAN_ACCOUNT_BACKEND: provider === "gemini" ? "supabase" : "local",
    OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "qwen3:4b" },
  stdio: "inherit", windowsHide: true,
});
const results = [];
const failures = [];
let cloudCookies = "";
async function stream(caseData) {
  const { question, coins } = caseData;
  const request = { question, coins, cloudConsent: provider === "gemini" };
  const cast = getReading(coins);
  assert.deepEqual([cast.original.name, cast.relating.name], caseData.names);
  assert.deepEqual(cast.moving.map(index => index + 1), caseData.positions);
  const expected = fortuneFromCast(request, cast);
  assert.equal(expected.verdict, caseData.verdict);
  const began = performance.now();
  const reply = await fetch(origin + "/api/reading", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson",
      ...(cloudCookies ? { Cookie: cloudCookies } : {}) },
    body: JSON.stringify(request), signal: AbortSignal.timeout(124_000),
  });
  assert.equal(reply.status, 200);
  const parts = [];
  const phases = [];
  let earliest, nextPart, finalEvent;
  let buffer = "";
  for await (const chunk of reply.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const event = JSON.parse(line);
      if (event.phase) phases.push(event.phase);
      if (event.delta) {
        earliest ??= Math.round(performance.now() - began);
        if (parts.length === 1) nextPart = Math.round(performance.now() - began);
        parts.push(event.delta);
      }
      if (event.answer) finalEvent = event.answer;
    }
  }
  const result = {
    label: caseData.label, question, coins, cast: caseData.names, moving: caseData.positions,
    firstMs: earliest, modelSectionMs: nextPart, completeMs: Math.round(performance.now() - began), phases, parts, ...finalEvent,
  };
  results.push(result);
  console.log(JSON.stringify(result));
  assert.equal(result.mode, provider === "gemini" ? "cloud" : "local", caseData.label);
  assert.equal(result.fortune.verdict, caseData.verdict);
  assert.equal(parts[0], expected.directAnswer);
  assert.ok(parts[0].includes(caseData.first) && parts[0].includes(caseData.aim));
  assert.ok(result.fortune.hexagramBasis.startsWith(expected.hexagramBasis));
  assert.deepEqual(parts.join(""), result.text);
  assert.equal(parts.length, 3);
  assert.equal((result.text.match(/[?？]/gu) ?? []).length, 0);
  assert.doesNotMatch(result.text, /建议|训练|请补充|如果|肯定|一定|注定|队友传球|最近你|你考了|[\d%％]/u);
  const length = (result.text.match(/\p{Script=Han}/gu) ?? []).length;
  assert.ok(length >= 75 && length <= 180, "Chinese answer length " + length);
}
try {
  let ready = false;
  for (let i = 0; i < 40 && (!server || server.exitCode === null); i++) {
    try { ready = (await fetch(origin)).ok; if (ready) break; } catch { /* Server is starting. */ }
    await wait(250);
  }
  assert.ok(ready, "Build the app before the local model test.");
  if (provider === "gemini") {
    const login = await fetch(origin + "/api/companion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "login", label: process.env.WENSHAN_AI_TEST_EMAIL, password: process.env.WENSHAN_AI_TEST_PASSWORD }),
    });
    assert.equal(login.status, 200, "The Preview test account must be able to sign in.");
    cloudCookies = login.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]).join("; ");
    assert.ok(cloudCookies, "The test sign-in did not establish a session.");
  }
  const kind = process.env.WENSHAN_AI_CASE;
  const cases = kind === "SPORTS" ? oracleCases.filter(item => item.label.includes("足球")) :
    kind === "LOTTERY" ? oracleCases.filter(item => item.label.startsWith("彩票")) : oracleCases;
  for (const scenario of (provider === "gemini" || process.argv.includes("--one") ? cases.slice(0, 1) : cases)) {
    try { await stream(scenario); }
    catch (error) { failures.push(scenario.label + " — " + error.message); console.error(scenario.label, error.message); }
  }
  if (results.length > 1) assert.notEqual(results[0].text, results.at(-1).text);
  assert.equal(failures.length, 0, failures.join("\n"));
} finally {
  if (process.env.WENSHAN_AI_PROOFS) {
    await mkdir("output/playwright", { recursive: true });
    const name = provider === "gemini" ? "oracle-gemini-results.json" :
      process.env.WENSHAN_AI_CASE === "LOTTERY" ? "lottery-ollama-results.json" : "oracle-ollama-results.json";
    await writeFile("output/playwright/" + name, JSON.stringify({ results, failures }, null, 2) + "\n", "utf8");
  }
  server?.kill();
}
