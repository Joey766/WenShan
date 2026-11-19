import { PGlite, type Transaction } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canDecorate, forms, homes, type Decoration, type Form, type Progress } from "../pet-v16.ts";
import type { PetId } from "../pets.ts";
import { tossCoins, type Coins } from "../yijing.ts";
import type { SavedReading } from "../history.ts";

const schema = `
CREATE SCHEMA IF NOT EXISTS companion;
REVOKE ALL ON SCHEMA companion FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wenshan_member') THEN
    CREATE ROLE wenshan_member NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA companion TO wenshan_member;
CREATE TABLE IF NOT EXISTS companion.accounts (
  id uuid PRIMARY KEY, label text UNIQUE NOT NULL, password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS companion.sessions (
  token_hash text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS companion.pets (
  owner_id uuid PRIMARY KEY REFERENCES companion.accounts(id) ON DELETE CASCADE,
  pet text NOT NULL CHECK (pet IN ('xiaogua','yunyao','qingpu','xuanji')),
  bound_at bigint NOT NULL, xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  shape text NOT NULL DEFAULT 'normal' CHECK (shape IN ('normal','slightly_plump','extra_cuddly')),
  decoration text
);
CREATE TABLE IF NOT EXISTS companion.events (
  owner_id uuid NOT NULL REFERENCES companion.pets(owner_id) ON DELETE CASCADE,
  event_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('visit','cast','touch')),
  day date NOT NULL, event_at bigint NOT NULL, xp integer NOT NULL CHECK (xp IN (2,5,10)),
  PRIMARY KEY (owner_id,event_id)
);
CREATE INDEX IF NOT EXISTS companion_events_day ON companion.events(owner_id,day,kind);
CREATE TABLE IF NOT EXISTS companion.casts (
  owner_id uuid NOT NULL REFERENCES companion.pets(owner_id) ON DELETE CASCADE,
  cast_id uuid NOT NULL, question text NOT NULL,
  coins jsonb NOT NULL DEFAULT '[]', started_at bigint NOT NULL, PRIMARY KEY (owner_id,cast_id)
);
CREATE TABLE IF NOT EXISTS companion.history (
  owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE,
  entry_id text NOT NULL, created_at bigint NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY (owner_id,entry_id)
);
CREATE TABLE IF NOT EXISTS companion.identity_links (
  provider text NOT NULL, provider_subject text NOT NULL,
  owner_id uuid NOT NULL REFERENCES companion.accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (provider,provider_subject)
);
`;

export class AccountError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function openAccountDb(data = "memory://") {
  if (data !== "memory://") await mkdir(dirname(data), { recursive: true });
  const db = await PGlite.create(data);
  await db.transaction(async transaction => {
    await transaction.exec(`
      CREATE SCHEMA IF NOT EXISTS companion;
      CREATE TABLE IF NOT EXISTS companion.local_migrations (version integer PRIMARY KEY);
    `);
    if ((await transaction.query("SELECT version FROM companion.local_migrations WHERE version=1")).rows.length) return;
    await transaction.exec(schema);
    for (const table of ["sessions", "pets", "events", "casts", "history", "identity_links"]) {
      await transaction.exec(`
        ALTER TABLE companion.${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE companion.${table} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS own_rows ON companion.${table};
        CREATE POLICY own_rows ON companion.${table} TO wenshan_member
          USING (owner_id::text = current_setting('wenshan.owner', true))
          WITH CHECK (owner_id::text = current_setting('wenshan.owner', true));
      `);
    }
    await transaction.exec(`
      ALTER TABLE companion.accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE companion.accounts FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS own_account ON companion.accounts;
      CREATE POLICY own_account ON companion.accounts FOR SELECT TO wenshan_member
        USING (id::text = current_setting('wenshan.owner', true));
      GRANT SELECT (id,label) ON companion.accounts TO wenshan_member;
      GRANT SELECT, INSERT (owner_id,pet,bound_at), UPDATE (xp,shape,decoration) ON companion.pets TO wenshan_member;
      GRANT SELECT, INSERT ON companion.events TO wenshan_member;
      GRANT SELECT, INSERT, UPDATE (coins), DELETE ON companion.casts TO wenshan_member;
      GRANT SELECT, INSERT, UPDATE, DELETE ON companion.history TO wenshan_member;
      INSERT INTO companion.local_migrations(version) VALUES (1);
    `);
  });
  return db;
}

const globals = globalThis as typeof globalThis & { wenshanAccountDb?: Promise<PGlite> };
export function accountDb() {
  const path = process.env.WENSHAN_ACCOUNTS_DATA;
  return globals.wenshanAccountDb ??= openAccountDb(path === "memory://" ? path : resolve(/* turbopackIgnore: true */ path ?? ".work/wenshan-account-db"));
}

export function withOwner<T>(db: PGlite, owner: string, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE wenshan_member");
    await tx.query("SELECT set_config('wenshan.owner', $1, true)", [owner]);
    return work(tx);
  });
}

export interface AccountTransaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

type PetRow = { pet: PetId; xp: number; bound_at: number | bigint; days: number; shape: Form; decoration: Decoration | null };

export async function progressFor(tx: AccountTransaction, owner: string): Promise<Progress | null> {
  const { rows: [p] } = await tx.query<PetRow>(`
    SELECT p.pet, p.xp, p.bound_at, p.shape, p.decoration,
      (SELECT count(*)::int FROM companion.events WHERE owner_id = p.owner_id AND kind = 'visit') AS days
    FROM companion.pets p WHERE p.owner_id = $1`, [owner]);
  return p ? { pet: p.pet, boundAt: Number(p.bound_at), xp: p.xp, activeDays: p.days, shape: p.shape, decoration: p.decoration } : null;
}

export async function bindPet(tx: AccountTransaction, owner: string, pet: PetId, now = Date.now()) {
  await tx.query("INSERT INTO companion.pets(owner_id,pet,bound_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [owner, pet, now]);
  const progress = await progressFor(tx, owner);
  if (progress?.pet !== pet) throw new AccountError(409, "这只账号已经结契。");
  await reward(tx, owner, "visit", utcDay(now), now);
  return progressFor(tx, owner);
}

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
const grants = { visit: { xp: 5, count: 1, cool: 0 }, cast: { xp: 10, count: 2, cool: 0 }, touch: { xp: 2, count: 3, cool: 8_000 } } as const;

async function reward(tx: AccountTransaction, owner: string, kind: keyof typeof grants, key: string, now: number) {
  const locked = await tx.query("SELECT owner_id FROM companion.pets WHERE owner_id=$1 FOR UPDATE", [owner]);
  if (!locked.rows.length) throw new AccountError(409, "请先与一只灵宠结契。");
  const rule = grants[kind];
  const day = utcDay(now);
  const { rows: [today] } = await tx.query<{ seen: number; points: number; last: number }>(`
    SELECT count(*) FILTER (WHERE kind=$2)::int AS seen, coalesce(sum(xp),0)::int AS points,
      coalesce(max(event_at) FILTER (WHERE kind=$2),0)::float8 AS last
    FROM companion.events WHERE owner_id=$1 AND day=$3`, [owner, kind, day]);
  if (today.seen >= rule.count || today.points + rule.xp > 31 || now - today.last < rule.cool) return 0;
  const inserted = await tx.query(`
    INSERT INTO companion.events(owner_id,event_id,kind,day,event_at,xp)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id`, [owner, kind + ":" + key, kind, day, now, rule.xp]);
  if (!inserted.rows.length) return 0;
  await tx.query("UPDATE companion.pets SET xp=xp+$2 WHERE owner_id=$1", [owner, rule.xp]);
  return rule.xp;
}

export async function visit(tx: AccountTransaction, owner: string) {
  const now = Date.now();
  await reward(tx, owner, "visit", utcDay(now), now);
  return progressFor(tx, owner);
}

export async function touch(tx: AccountTransaction, owner: string, key: string, what: string, now = Date.now()) {
  const pet = await progressFor(tx, owner);
  if (!pet) throw new AccountError(409, "请先与一只灵宠结契。");
  if (what !== "pat" && what !== "shared_rolling_ball" && what !== "shared_soft_cushion" &&
      (what !== homes[pet.pet].toy || pet.xp < 60)) throw new AccountError(403, "这个玩具还未解锁。");
  const earned = await reward(tx, owner, "touch", key, now);
  return { earned, progress: await progressFor(tx, owner) };
}

export async function equip(tx: AccountTransaction, owner: string, shape: Form | undefined, decoration: Decoration | null | undefined) {
  const pet = await progressFor(tx, owner);
  if (!pet) throw new AccountError(409, "请先与一只灵宠结契。");
  if (shape && forms[shape].xp > pet.xp) throw new AccountError(403, "这个身形还未解锁。");
  if (decoration && !canDecorate(pet.pet, decoration, pet.xp)) throw new AccountError(403, "这件装饰还未解锁。");
  await tx.query("UPDATE companion.pets SET shape=$2, decoration=$3 WHERE owner_id=$1",
    [owner, shape ?? pet.shape, decoration === undefined ? pet.decoration : decoration]);
  return progressFor(tx, owner);
}

export async function castLine(tx: AccountTransaction, owner: string, id: string, question: string, index: number, now = Date.now()) {
  if (!await progressFor(tx, owner)) throw new AccountError(409, "请先与一只灵宠结契。");
  if (index === 0) {
    await tx.query("DELETE FROM companion.casts WHERE owner_id=$1 AND started_at<$2", [owner, now - 30 * 86_400_000]);
    await tx.query(`INSERT INTO companion.casts(owner_id,cast_id,question,started_at)
      VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [owner, id, question, now]);
  }
  const { rows: [entry] } = await tx.query<{ question: string; coins: Coins[] }>(
    "SELECT question,coins FROM companion.casts WHERE owner_id=$1 AND cast_id=$2 FOR UPDATE", [owner, id]);
  if (!entry || entry.question !== question || index > entry.coins.length) throw new AccountError(409, "投掷次序不一致。");
  if (index < entry.coins.length) return { coins: entry.coins[index], progress: await progressFor(tx, owner) };
  const coins = tossCoins();
  await tx.query("UPDATE companion.casts SET coins=$3 WHERE owner_id=$1 AND cast_id=$2",
    [owner, id, JSON.stringify([...entry.coins, coins])]);
  if (index === 5) await reward(tx, owner, "cast", id, now);
  return { coins, progress: await progressFor(tx, owner) };
}

export async function readingsFor(tx: AccountTransaction, owner: string) {
  const { rows } = await tx.query<{ record: SavedReading }>(
    "SELECT record FROM companion.history WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 24", [owner]);
  return rows.map(row => row.record);
}

export async function writeReadings(tx: AccountTransaction, owner: string, entries: SavedReading[], imported = false) {
  for (const entry of entries) {
    if (!imported) {
      const { rows: [cast] } = await tx.query<{ coins: Coins[]; question: string; pet: PetId }>(
        "SELECT c.coins, c.question, p.pet FROM companion.casts c JOIN companion.pets p USING (owner_id) WHERE c.owner_id=$1 AND cast_id::text=$2",
        [owner, entry.id]);
      if (!cast || cast.question !== entry.question || cast.pet !== entry.pet || JSON.stringify(cast.coins) !== JSON.stringify(entry.casts)) {
        throw new AccountError(403, "这条记录缺少本账号的完整投掷。");
      }
    }
    const conflict = imported ? "DO NOTHING" : "DO UPDATE SET record=excluded.record";
    await tx.query(`INSERT INTO companion.history(owner_id,entry_id,created_at,record) VALUES ($1,$2,$3,$4)
      ON CONFLICT (owner_id,entry_id) ${conflict}`, [owner, entry.id, Math.round(entry.createdAt), JSON.stringify(entry)]);
  }
  await tx.query(`DELETE FROM companion.history WHERE owner_id=$1 AND entry_id IN (
    SELECT entry_id FROM companion.history WHERE owner_id=$1 ORDER BY created_at DESC,entry_id OFFSET 24
  )`, [owner]);
  return readingsFor(tx, owner);
}
