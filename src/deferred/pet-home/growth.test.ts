import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dayMs, emptySave, growth, interact, parsePetSave, pets, selectPet, setDecoration } from "./growth.ts";

test("all four pets can be selected and their independent profiles survive serialization", () => {
  let save = emptySave;
  for (const pet of pets) {
    save = selectPet(save, pet.id, dayMs);
    save = interact(save, "pat", dayMs + 1);
    assert.equal(save.chosen, pet.id);
    assert.deepEqual(parsePetSave(JSON.stringify(save)), save);
  }
  assert.equal(Object.keys(save.profiles).length, 4);
  assert.ok(pets.every(pet => save.profiles[pet.id]?.xp === 4));
});

test("absence preserves growth, and a single care action restores the pet", () => {
  const initial = selectPet(emptySave, "qingpu", dayMs);
  const late = selectPet(initial, "qingpu", dayMs * 7);
  assert.equal(late.profiles.qingpu?.sleepy, true);
  const reopened = parsePetSave(JSON.stringify(late));
  assert.equal(selectPet(reopened, "qingpu", dayMs * 7).profiles.qingpu?.sleepy, true);
  const fed = interact(reopened, "feed", dayMs * 7);
  const profile = fed.profiles.qingpu!;
  assert.equal(profile.sleepy, false);
  assert.equal(profile.actions.feed, 1);
  assert.equal(growth(profile, dayMs * 7).days, 7);
  assert.equal(growth(profile, dayMs * 7).level, 1);
});

test("decorations require growth and can be changed with sufficient experience", () => {
  let save = selectPet(emptySave, "xiaogua", dayMs);
  assert.equal(setDecoration(save, "blossom", dayMs).profiles.xiaogua?.decoration, "plain");
  for (let i = 0; i < 4; i++) save = interact(save, "feed", dayMs);
  assert.equal(growth(save.profiles.xiaogua!, dayMs).level, 2);
  assert.equal(setDecoration(save, "blossom", dayMs).profiles.xiaogua?.decoration, "blossom");
  assert.equal(parsePetSave("{malformed").chosen, null);
});
