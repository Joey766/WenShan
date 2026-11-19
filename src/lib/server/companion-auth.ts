import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { AccountError } from "./companion-db.ts";

export const cookieName = "wenshan_session";
export const sessionDuration = 30 * 24 * 60 * 60;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
const attempts = new Map<string, { count: number; expires: number }>();
let deriving = 0;

async function derive(password: string, salt: Buffer) {
  if (deriving >= 3) throw new AccountError(429, "请求较多，请稍后再试。");
  deriving++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password, salt, 64, { N: 1 << 17, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key)));
  } finally { deriving--; }
}

function cap(key: string, allowance: number, ttl = 10 * 60_000) {
  const now = Date.now();
  for (const [label, bucket] of attempts) if (bucket.expires <= now) attempts.delete(label);
  if (attempts.size >= 2000 && !attempts.has(key)) throw new AccountError(429, "请求较多，请稍后再试。");
  const bucket = attempts.get(key) ?? { count: 0, expires: now + ttl };
  if (bucket.count >= allowance) throw new AccountError(429, "尝试过多，请十分钟后再试。");
  attempts.set(key, { count: bucket.count + 1, expires: bucket.expires });
}

export function checkPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 10 && Buffer.byteLength(password) <= 128;
}

type Identity = { owner: string; label: string };

export async function validateSession(db: PGlite, token: string): Promise<Identity | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const result = await db.query<Identity>(`
    SELECT a.id AS owner, a.label FROM companion.sessions s JOIN companion.accounts a ON a.id=s.owner_id
    WHERE s.token_hash=$1 AND s.expires>$2`, [tokenHash(token), Date.now()]);
  return result.rows[0] ?? null;
}

async function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(await derive(password, Buffer.from(salt, "hex")), Buffer.from(hash, "hex"));
}

export async function startSession(db: PGlite, label: string, password: string, register: boolean) {
  if (!/^[a-z0-9][a-z0-9_.-]{2,30}$/.test(label) || !checkPassword(password))
    throw new AccountError(400, "账户名用 3–31 位字母或数字，密码至少 10 位。");
  cap("all", 100);
  cap((register ? "register:" : "login:") + label, 8);
  let owner = randomUUID();
  if (register) {
    const salt = randomBytes(16);
    const hash = await derive(password, salt);
    try {
      await db.query("INSERT INTO companion.accounts(id,label,password_hash) VALUES ($1,$2,$3)",
        [owner, label, salt.toString("hex") + ":" + hash.toString("hex")]);
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new AccountError(409, "这个账户名已被使用。");
      throw error;
    }
  } else {
    const { rows: [identity] } = await db.query<{ id: ReturnType<typeof randomUUID>; password_hash: string }>(
      "SELECT id,password_hash FROM companion.accounts WHERE label=$1", [label]);
    const valid = await passwordMatches(password, identity?.password_hash ?? dummy);
    if (!identity || !valid) throw new AccountError(401, "账户名或密码不正确。");
    owner = identity.id;
  }
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async tx => {
    await tx.query("DELETE FROM companion.sessions WHERE expires<=$1", [Date.now()]);
    await tx.query("INSERT INTO companion.sessions(token_hash,owner_id,expires) VALUES ($1,$2,$3)",
      [tokenHash(token), owner, Date.now() + sessionDuration * 1000]);
  });
  return { owner, label, token };
}

export async function revokeSession(db: PGlite, token: string) {
  await db.query("DELETE FROM companion.sessions WHERE token_hash=$1", [tokenHash(token)]);
}

export async function removeAccount(db: PGlite, owner: string, password: string) {
  cap("remove:" + owner, 5);
  const { rows: [record] } = await db.query<{ password_hash: string }>("SELECT password_hash FROM companion.accounts WHERE id=$1", [owner]);
  if (!record || !await passwordMatches(password, record.password_hash))
    throw new AccountError(401, "请输入当前账号的正确密码。");
  await db.query("DELETE FROM companion.accounts WHERE id=$1", [owner]);
}
