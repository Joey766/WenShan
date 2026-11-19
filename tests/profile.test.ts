import { strict as assert } from "node:assert";
import { test } from "node:test";
import { emptyProfile, modelProfile, parseProfile, validBirth } from "../src/lib/profile.ts";

test("profile gates consent, omits the full birth date, and validates calendar dates", () => {
  assert.equal(validBirth("2001-02-29", "2026-11-18"), false);
  assert.equal(validBirth("2000-02-29", "2026-11-18"), true);
  assert.equal(validBirth("2027-01-01", "2026-11-18"), false);
  const profile = { birth: "2001-11-20", gender: "other" as const, custom: "不设称谓", consent: true };
  assert.deepEqual(modelProfile(profile, "2026-11-18"), { ageBand: "18至24岁", expression: "其他" });
  assert.equal(modelProfile({ ...profile, consent: false }), undefined);
  assert.equal(modelProfile(emptyProfile), undefined);
  assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
});
