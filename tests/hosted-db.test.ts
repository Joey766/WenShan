import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { bindPet, equip, openAccountDb, progressFor, readingsFor, withOwner } from "../src/lib/server/companion-db.ts";
import { importLegacy } from "../scripts/import-legacy-accounts.mjs";

test("versioned hosted migrations preserve backup data and isolate two Auth identities", async () => {
  const db = await PGlite.create();
  const prior = await openAccountDb();
  let backup: PGlite | undefined;
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz)`);
    const migrationFolder = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(migrationFolder)).filter(file => file.endsWith(".sql")).sort()) {
      await db.transaction(async tx => { await tx.exec(await readFile(new URL(name, migrationFolder), "utf8")); });
    }
    const [legacy, first, second, waiting] = Array.from({ length: 4 }, () => randomUUID());
    const record = { test: "旧版历史", at: 1795068000000 };
    await prior.query("INSERT INTO companion.accounts VALUES($1,'legacy-fixture','old-local-hash')", [legacy]);
    await prior.query("INSERT INTO companion.pets VALUES($1,'xiaogua',1795068000000,180,'extra_cuddly','decoration_moon_lamp')", [legacy]);
    await prior.query("INSERT INTO companion.events VALUES($1,'visit:2026-11-19','visit','2026-11-19',1795068000000,5)", [legacy]);
    await prior.query("INSERT INTO companion.history VALUES($1,'saved',1795068000000,$2)", [legacy, JSON.stringify(record)]);
    const blob = await prior.dumpDataDir();
    backup = await PGlite.create({ loadDataDir: blob });
    await db.query("INSERT INTO auth.users VALUES ($1,now()),($2,now()),($3,NULL)", [first,second,waiting]);

    await assert.rejects(db.transaction(async tx => {
      await importLegacy(backup, tx, { [legacy]: first });
      throw new Error("dry run rollback");
    }), /dry run rollback/);
    assert.equal((await db.query("SELECT * FROM companion.accounts")).rows.length, 0);
    await assert.rejects(db.transaction(tx => importLegacy(backup, tx, { [legacy]: waiting })), /email-verified/);
    const counts = await db.transaction(tx => importLegacy(backup, tx, { [legacy]: first }));
    assert.deepEqual(counts, { accounts: 1, pets: 1, events: 1, casts: 0, history: 1 });
    assert.deepEqual((await db.query("SELECT password_hash FROM companion.accounts")).rows, [{ password_hash: "supabase-migrated" }]);
    await assert.rejects(db.transaction(tx => importLegacy(backup, tx, { [legacy]: first })), { code: "23505" });

    async function resolveOwner(subject: string) {
      return db.transaction(async tx => {
        await tx.exec("SET LOCAL ROLE wenshan_runtime");
        return (await tx.query<{ owner: string }>("SELECT companion.hosted_owner($1) AS owner", [subject])).rows[0].owner;
      });
    }
    assert.equal(await resolveOwner(first), legacy);
    assert.equal(await resolveOwner(waiting), null);
    const other = await resolveOwner(second);
    assert.notEqual(other, legacy);
    assert.equal(await resolveOwner(second), other);
    const restored = await withOwner(db, legacy, tx => progressFor(tx, legacy));
    assert.deepEqual(restored, { pet: "xiaogua", xp: 180, activeDays: 1, boundAt: 1795068000000,
      shape: "extra_cuddly", decoration: "decoration_moon_lamp" });
    assert.deepEqual(await withOwner(db, legacy, tx => readingsFor(tx, legacy)), [record]);
    await withOwner(db, other, tx => bindPet(tx, other, "qingpu"));
    await withOwner(db, legacy, tx => equip(tx, legacy, "normal", null));
    await withOwner(db, legacy, tx => tx.query("UPDATE companion.profiles SET display_name='测试昵称' WHERE owner_id=$1", [legacy]));
    await withOwner(db, other, async tx => {
      assert.equal(await progressFor(tx, legacy), null);
      assert.deepEqual(await readingsFor(tx, legacy), []);
      for (const table of ["pets", "events", "casts", "history", "profiles", "inventory"]) {
        assert.deepEqual((await tx.query(`SELECT * FROM companion.${table} WHERE owner_id=$1`, [legacy])).rows, []);
      }
      assert.deepEqual((await tx.query("DELETE FROM companion.history WHERE owner_id=$1 RETURNING entry_id", [legacy])).rows, []);
      assert.deepEqual((await tx.query("UPDATE companion.profiles SET display_name='wrong' WHERE owner_id=$1 RETURNING owner_id", [legacy])).rows, []);
      assert.deepEqual((await tx.query("SELECT item FROM companion.inventory ORDER BY item")).rows.map(row => (row as { item: string }).item),
        ["form:normal", "shared_rolling_ball", "shared_soft_cushion"]);
    });
    assert.ok((await withOwner(db, legacy, tx => tx.query("SELECT item FROM companion.inventory WHERE item='xiaogua_coin_toy'"))).rows.length);
    await assert.rejects(withOwner(db, other, tx => tx.query("INSERT INTO companion.inventory(owner_id,item) VALUES($1,'forged')", [other])), { code: "42501" });
    await assert.rejects(db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE authenticated");
      await tx.query("SELECT companion.hosted_owner($1)", [first]);
    }), { code: "42501" });
    await assert.rejects(db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE anon");
      await tx.query("SELECT * FROM companion.history");
    }), { code: "42501" });
    await db.query("DELETE FROM auth.users WHERE id=$1", [first]);
    assert.equal(await withOwner(db, legacy, tx => progressFor(tx, legacy)), null);
    assert.equal((await withOwner(db, other, tx => progressFor(tx, other)))?.pet, "qingpu");

    const reserve = (minute: number, day: number) => db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE wenshan_runtime");
      return (await tx.query<{ result: string }>("SELECT companion.reserve_ai($1,$2) AS result", [minute,day])).rows[0].result;
    });
    assert.equal(await reserve(0, 10), "disabled");
    const calls = await Promise.all(Array.from({ length: 8 }, () => reserve(3,3)));
    assert.equal(calls.filter(x => x === "ok").length, 3);
    assert.equal(await reserve(100,3), "day");
    assert.equal(await reserve(3,100), "minute");

    const third = randomUUID();
    await db.query("INSERT INTO auth.users VALUES ($1,now())", [third]);
    const userBudget = (subject: string, minute: number, day: number, userMinute: number, userDay: number) => db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE wenshan_runtime");
      return (await tx.query<{ result: string }>("SELECT companion.reserve_user_ai($1,$2,$3,$4,$5) AS result",
        [subject, minute, day, userMinute, userDay])).rows[0].result;
    });
    assert.equal(await userBudget(waiting, 100, 100, 1, 2), "identity");
    assert.equal(await userBudget(second, 100, 100, 1, 2), "ok");
    assert.equal(await userBudget(second, 100, 100, 1, 2), "user_minute");
    assert.equal(await userBudget(third, 100, 100, 1, 2), "ok");
    assert.equal(await userBudget(second, 100, 100, 2, 1), "user_day");
    assert.equal(await userBudget(third, 100, 1, 2, 2), "day");
    await db.query("DELETE FROM auth.users WHERE id=$1", [third]);
    assert.deepEqual((await db.query("SELECT * FROM companion.ai_user_usage WHERE subject_id=$1", [third])).rows, []);
  } finally {
    await backup?.close();
    await prior.close();
    await db.close();
  }
});
