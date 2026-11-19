import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseHistory } from "../src/lib/history.ts";
import { pets, readCompanion } from "../src/lib/pets.ts";

test("companion choice migrates without requiring or interpreting the growth profile", () => {
  for (const pet of pets) {
    assert.equal(readCompanion(pet.id, null), pet.id);
    assert.equal(readCompanion(null, JSON.stringify({ chosen: pet.id, profiles: {} })), pet.id);
  }
  assert.equal(readCompanion(null, "{invalid"), null);
  assert.equal(readCompanion("invalid-pet", null), null);
});

test("history only loads complete validated readings, limits chats, and rejects duplicates", () => {
  const valid = {
    id: "one", createdAt: 1, pet: "xiaogua", question: "想理清的问题", background: "选填背景",
    casts: Array(6).fill([2,2,3]),
    messages: Array(20).fill({ role: "assistant", content: "回复", mode: "local" }),
  };
  const invalid = { ...valid, id: "two", casts: Array(6).fill([1,1,1]) };
  const records = parseHistory(JSON.stringify([invalid, valid, valid]));
  assert.equal(records.length, 1);
  assert.equal(records[0].messages.length, 12);
  assert.deepEqual(parseHistory("{corrupt"), []);
});
