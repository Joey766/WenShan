import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { bindPet, castLine, equip, openAccountDb, progressFor, readingsFor, touch, withOwner, writeReadings } from "../src/lib/server/companion-db.ts";
import { removeAccount, revokeSession, startSession, validateSession } from "../src/lib/server/companion-auth.ts";
import type { Coins } from "../src/lib/yijing.ts";

test("real PostgreSQL RLS, authenticated ownership, idempotent XP and saved account appearance", async () => {
  const db = await openAccountDb();
  try {
    const password = "Test-only-123!v16";
    const a = await startSession(db, "unit-north", password, true);
    const b = await startSession(db, "unit-south", password, true);
    assert.notEqual(a.owner, b.owner);
    assert.equal((await validateSession(db, a.token))?.owner, a.owner);
    assert.equal(await validateSession(db, "not-a-session"), null);
    const now = Date.UTC(2026, 10, 19, 10);
    const day = 86_400_000;
    const runA = <T,>(work: Parameters<typeof withOwner<T>>[2]) => withOwner(db, a.owner, work);
    const runB = <T,>(work: Parameters<typeof withOwner<T>>[2]) => withOwner(db, b.owner, work);
    assert.equal((await runA(tx => bindPet(tx, a.owner, "xiaogua", now)))?.xp, 5);
    assert.equal((await runB(tx => bindPet(tx, b.owner, "xuanji", now)))?.pet, "xuanji");
    assert.equal((await runA(tx => bindPet(tx, a.owner, "xiaogua", now)))?.xp, 5);
    await assert.rejects(runA(tx => bindPet(tx, a.owner, "yunyao", now)), { status: 409 });
    await assert.rejects(runA(tx => equip(tx, a.owner, "extra_cuddly", null)), { status: 403 });
    await assert.rejects(runA(tx => touch(tx, a.owner, randomUUID(), "xiaogua_coin_toy", now)), { status: 403 });

    const first = { id: randomUUID(), createdAt: now, pet: "xiaogua" as const, question: "可复现的测试问句", background: "", casts: [] as Coins[], messages: [] };
    await assert.rejects(runA(tx => castLine(tx, a.owner, first.id, first.question, 1, now)), { status: 409 });
    for (let index = 0; index < 6; index++) {
      const line = await runA(tx => castLine(tx, a.owner, first.id, first.question, index, now));
      first.casts.push(line.coins);
      assert.deepEqual((await runA(tx => castLine(tx, a.owner, first.id, first.question, index, now))).coins, line.coins);
    }
    assert.equal((await runA(tx => progressFor(tx, a.owner)))?.xp, 15);
    await assert.rejects(runA(tx => writeReadings(tx, a.owner, [{ ...first, question: "另一个问题" }])), { status: 403 });
    await runA(tx => writeReadings(tx, a.owner, [first]));
    assert.deepEqual(await runB(tx => readingsFor(tx, b.owner)), []);
    assert.deepEqual(await runB(tx => readingsFor(tx, a.owner)), []);
    assert.equal(await runB(tx => progressFor(tx, a.owner)), null);
    assert.equal((await runB(tx => tx.query("SELECT label FROM companion.accounts WHERE id=$1", [a.owner]))).rows.length, 0);
    assert.equal((await runB(tx => tx.query("UPDATE companion.pets SET xp=1000 WHERE owner_id=$1 RETURNING xp", [a.owner]))).rows.length, 0);
    assert.equal((await runB(tx => tx.query("DELETE FROM companion.history WHERE owner_id=$1 RETURNING entry_id", [a.owner]))).rows.length, 0);
    await assert.rejects(runB(tx => tx.query("UPDATE companion.pets SET pet='qingpu' WHERE owner_id=$1", [b.owner])), { code: "42501" });
    await assert.rejects(runB(tx => tx.query("SELECT password_hash FROM companion.accounts")), { code: "42501" });
    await assert.rejects(runB(tx => tx.query(`INSERT INTO companion.events VALUES ($1,'fake','visit','2026-11-19',$2,5)`,
      [a.owner, now])), { code: "42501" });
    await assert.rejects(runB(tx => writeReadings(tx, b.owner, [first])), { status: 403 });

    const id = randomUUID();
    const touches = await Promise.all([0, 1, 2].map(() => runA(tx => touch(tx, a.owner, id, "pat", now))));
    assert.equal(touches.reduce((sum, event) => sum + event.earned, 0), 2);
    assert.equal((await runA(tx => touch(tx, a.owner, randomUUID(), "pat", now + 1000))).earned, 0);
    for (let offset = 1; offset <= 9; offset++) await runA(tx => bindPet(tx, a.owner, "xiaogua", now + offset * day));
    assert.equal((await runA(tx => progressFor(tx, a.owner)))?.xp, 62);
    const grown = await runA(tx => equip(tx, a.owner, "slightly_plump", "decoration_wind_chime"));
    assert.equal(grown?.shape, "slightly_plump");
    assert.equal(grown?.decoration, "decoration_wind_chime");

    await revokeSession(db, a.token);
    assert.equal(await validateSession(db, a.token), null);
    const secondDevice = await startSession(db, a.label, password, false);
    assert.equal(secondDevice.owner, a.owner);
    assert.equal((await runA(tx => readingsFor(tx, a.owner)))[0].id, first.id);
    await removeAccount(db, a.owner, password);
    assert.equal(await validateSession(db, secondDevice.token), null);
    assert.deepEqual(await runA(tx => readingsFor(tx, a.owner)), []);
    assert.equal((await runB(tx => progressFor(tx, b.owner)))?.pet, "xuanji");
  } finally { await db.close(); }
});

test("a file-backed account and its binding survive database close and restart", async () => {
  const scratch = resolve(".work");
  await mkdir(scratch, { recursive: true });
  const folder = await mkdtemp(join(scratch, "v16-db-test-"));
  assert.ok(folder.startsWith(scratch + sep + "v16-db-test-"));
  let db: Awaited<ReturnType<typeof openAccountDb>> | undefined;
  try {
    db = await openAccountDb(folder);
    const account = await startSession(db, "disk-record", "Local-test-only!234", true);
    await withOwner(db, account.owner, tx => bindPet(tx, account.owner, "qingpu"));
    await db.close();
    db = undefined;
    db = await openAccountDb(folder);
    const reloaded = await validateSession(db, account.token);
    assert.equal(reloaded?.owner, account.owner);
    assert.equal((await withOwner(db, account.owner, tx => progressFor(tx, account.owner)))?.pet, "qingpu");
  } finally {
    await db?.close();
    await rm(folder, { force: true, recursive: true });
  }
});
