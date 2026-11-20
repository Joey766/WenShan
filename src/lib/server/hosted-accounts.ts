import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { AccountError } from "./companion-db.ts";

export const accountBackend = () => process.env.WENSHAN_ACCOUNT_BACKEND ??
  (process.env.VERCEL ? "supabase" : "local");
export const accessCookie = "wenshan_access";
export const refreshCookie = "wenshan_refresh";

const globals = globalThis as typeof globalThis & { wenshanPool?: Pool };

export function hostedPool() {
  const connectionString = process.env.WENSHAN_DATABASE_URL;
  if (!connectionString) throw new Error("Missing PostgreSQL runtime connection");
  const ca = process.env.WENSHAN_DATABASE_CA;
  return globals.wenshanPool ??= new Pool({
    connectionString, max: 3, connectionTimeoutMillis: 3500, query_timeout: 5000,
    ssl: process.env.WENSHAN_DB_SSL === "disable" && !process.env.VERCEL ? false : { rejectUnauthorized: true, ca },
  }).on("error", () => console.error(JSON.stringify({ event: "database_idle_connection_error" })));
}

function authClient(admin = false) {
  const url = process.env.SUPABASE_URL;
  const key = admin ? process.env.SUPABASE_AUTH_ADMIN_KEY : process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  const origin = new URL(url);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      origin.protocol !== "https:" && (origin.protocol !== "http:" || process.env.VERCEL ||
        !["localhost","127.0.0.1","[::1]"].includes(origin.hostname)))
    throw new Error("Supabase requires HTTPS");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", redirect: "error",
      signal: AbortSignal.any([AbortSignal.timeout(5000), ...(init?.signal ? [init.signal] : [])]) }) },
  }).auth;
}

type Session = { access_token: string; refresh_token: string; expires_in: number };
export type HostedIdentity = { subject: string; label: string; renewal?: Session };

function identity(user: { id: string; email?: string }, renewal?: Session): HostedIdentity {
  return { subject: user.id, label: user.email ?? "问山访客", renewal };
}

function authFailure(error: { status?: number } | null, message: string): never {
  if (error?.status === 429) throw new AccountError(429, "账号请求过多，请稍后重试。");
  if (error && (!error.status || error.status >= 500)) throw new Error("Auth upstream unavailable");
  throw new AccountError(401, message);
}

function checkEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AccountError(400, "请填写有效邮箱。");
}

function emailCode(code: unknown) {
  const otp = typeof code === "string" ? code.trim() : "";
  if (!/^\d{6,10}$/.test(otp)) throw new AccountError(400, "请填写邮件中的验证码。");
  return otp;
}

export async function hostedSignIn(email: string, password: string, op: "login" | "register" | "verifyEmail", code: unknown) {
  checkEmail(email);
  const auth = authClient();
  const result = op === "verifyEmail"
    ? await auth.verifyOtp({ email, token: emailCode(code), type: "email" })
    : op === "register" ? await auth.signUp({ email, password }) : await auth.signInWithPassword({ email, password });
  if (result.error) authFailure(result.error, op === "verifyEmail" ? "验证码无效或已过期。" : "注册或登录失败，请核对邮箱、密码与验证状态。");
  if (op === "register" && !result.data.session) return null;
  if (!result.data.session || !result.data.user) return authFailure(null, "请先完成邮箱验证。");
  return identity(result.data.user, result.data.session);
}

export async function hostedRequestReset(email: string) {
  checkEmail(email);
  const { error } = await authClient().resetPasswordForEmail(email);
  if (error && (error.status === 429 || !error.status || error.status >= 500)) authFailure(error, "");
}

export async function hostedCompleteReset(email: string, code: unknown, password: string) {
  checkEmail(email);
  const auth = authClient();
  const { data, error } = await auth.verifyOtp({ email, token: emailCode(code), type: "recovery" });
  if (error || !data.session || !data.user?.email_confirmed_at || data.user.email?.toLowerCase() !== email)
    return authFailure(error, "验证码无效或已过期。");
  const updated = await auth.updateUser({ password });
  if (updated.error) authFailure(updated.error, "无法设为新密码，请检查密码要求。");
  const revoked = await auth.admin.signOut(data.session.access_token, "global");
  if (revoked.error) console.warn(JSON.stringify({ event: "password_reset_signout_failed" }));
}

export async function hostedIdentity(access?: string, refresh?: string) {
  if (!access && !refresh) return null;
  const auth = authClient();
  if (access) {
    const { data, error } = await auth.getUser(access);
    if (data.user?.email_confirmed_at) return identity(data.user);
    if (error && (!error.status || error.status >= 500)) return authFailure(error, "");
  }
  if (!refresh) return null;
  const { data, error } = await auth.refreshSession({ refresh_token: refresh });
  if (error && (!error.status || error.status >= 500)) return authFailure(error, "");
  return data.user?.email_confirmed_at && data.session ? identity(data.user, data.session) : null;
}

export async function hostedLogout(access?: string) {
  if (access) await authClient().admin.signOut(access, "local");
}

export async function hostedDelete(current: HostedIdentity, password: string) {
  const { data, error } = await authClient().signInWithPassword({ email: current.label, password });
  if (error || data.user?.id !== current.subject) return authFailure(error, "请输入当前账号的正确密码。");
  const result = await authClient(true).admin.deleteUser(current.subject);
  if (result.error) throw new Error("Auth deletion failed");
}

export async function withHostedOwner<T>(subject: string, action: (tx: import("./companion-db.ts").AccountTransaction, owner: string) => Promise<T>) {
  const tx = await hostedPool().connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SET LOCAL statement_timeout='4s'");
    const { rows: [row] } = await tx.query<{ owner: string | null }>("SELECT companion.hosted_owner($1) AS owner", [subject]);
    if (!row.owner) throw new AccountError(401, "请先验证邮箱。");
    await tx.query("SET LOCAL ROLE wenshan_member");
    await tx.query("SELECT set_config('wenshan.owner',$1,true)", [row.owner]);
    const result = await action(tx, row.owner);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { tx.release(); }
}
