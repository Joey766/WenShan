import { strict as assert } from "node:assert";
import { test } from "node:test";
import { emptyProfile, gregorianBirth, modelProfile, parseProfile, sharedProfile, validBirth, validBirthTime, validSharedProfile } from "../src/lib/profile.ts";
import { readingFocus } from "../src/lib/reading-context.ts";

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

test("lunar DOB validates real leap months and the authorized payload preserves all filled fields", () => {
  const base = { ...emptyProfile, birth: "2023-02-01", calendar: "lunar" as const, nickname: "访客", city: "成都，中国",
    gender: "woman" as const, role: "学生" as const, birthTime: "子时" };
  assert.equal(gregorianBirth(base, "2026-11-20"), "2023-02-20");
  assert.equal(gregorianBirth({ ...base, leapMonth: true }, "2026-11-20"), "2023-03-22");
  assert.equal(gregorianBirth({ ...base, birth: "2023-03-01", leapMonth: true }, "2026-11-20"), undefined);
  assert.equal(gregorianBirth({ ...base, birth: "2023-12-01" }, "2026-11-20"), "2024-01-11");
  assert.deepEqual(parseProfile(JSON.stringify(base)), base);
  assert.ok(validBirthTime("23:59") && validBirthTime("午时") && !validBirthTime("24:00"));
  assert.equal(sharedProfile(emptyProfile, "2026-11-20"), undefined);
  const sharing = sharedProfile({ ...base, leapMonth: true }, "2026-11-20");
  assert.deepEqual(sharing, { ageBand: "未满18岁", expression: "女", nickname: "访客", role: "学生", city: "成都，中国",
    birthTime: "子时", birth: "2023-02-01", calendar: "lunar", leapMonth: true });
  assert.ok(validSharedProfile(sharing));
  assert.deepEqual(sharedProfile(base, "2026-11-20", ["birth", "city", "nickname", "birthTime", "expression"]), { role: "学生" });
  assert.ok(!validSharedProfile({ ...sharing, phone: "should never be present" }));
});

test("validates custom dates without carrying stray user data in preset selections", () => {
  assert.deepEqual(readingFocus({ period: "本周", start: "不发送" }), { period: "本周" });
  assert.equal(readingFocus({ period: "自定义时间范围", start: "2026-02-30", end: "2026-03-02" }), undefined);
  assert.equal(readingFocus({ period: "自定义时间范围", start: "2026-04-01", end: "2026-03-02" }), undefined);
  assert.deepEqual(readingFocus({ period: "自定义时间范围", start: "2026-03-01", end: "2026-03-02" }),
    { period: "自定义时间范围", start: "2026-03-01", end: "2026-03-02" });
});
