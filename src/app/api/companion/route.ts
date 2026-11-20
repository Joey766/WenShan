import { NextRequest, NextResponse } from "next/server";
import { parseHistory } from "@/lib/history";
import { decorItems, forms, type Decoration, type Form } from "@/lib/pet-v16";
import { pets } from "@/lib/pets";
import { checkPassword, cookieName, removeAccount, revokeSession, sessionDuration, startSession, validateSession } from "@/lib/server/companion-auth";
import { accountDb, AccountError, bindPet, castLine, equip, progressFor, readingsFor, touch, visit, withOwner, writeReadings, type AccountTransaction } from "@/lib/server/companion-db";

import { accountBackend, accessCookie, refreshCookie, hostedDelete, hostedIdentity, hostedLogout, hostedSignIn,
  hostedRequestReset, hostedCompleteReset, hostedEmailOtpEnabled, hostedSendEmailCode, hostedVerifyEmailCode,
  hostedHybridLoginEnabled, hostedTwoStepEnabled, startHostedLoginChallenge, completeHostedLoginChallenge, loginChallengeCookie,
  loginChallengeMaxAge, sealHostedSession, sessionProofCookie,
  withHostedOwner, type HostedIdentity } from "@/lib/server/hosted-accounts";
import { logEvent } from "@/lib/server/observability";
import { emptyProfile, parseProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (payload: unknown, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const own = (object: object, prop: string) => Object.hasOwn(object, prop);
const validUUID = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

function fail(error: unknown) {
  if (error instanceof AccountError) return json({ error: error.message }, error.status);
  logEvent("error", "account_operation_failed");
  return json({ error: "账号服务暂不可用，仍可继续游客问卦。" }, 503);
}

function setSession(request: NextRequest, response: NextResponse, value: string) {
  const secure = process.env.WENSHAN_ACCOUNT_ORIGIN?.startsWith("https://") ?? request.nextUrl.protocol === "https:";
  response.cookies.set(cookieName, value, { httpOnly: true, sameSite: "lax", secure,
    path: "/", maxAge: value ? sessionDuration : 0 });
  return response;
}

function hostedCookieOptions(request: NextRequest) {
  const secure = Boolean(process.env.VERCEL) || request.nextUrl.protocol === "https:" ||
    process.env.WENSHAN_ACCOUNT_ORIGIN?.startsWith("https:") === true;
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure };
}

function hostedCookies(request: NextRequest, response: NextResponse, renew?: HostedIdentity["renewal"], clear = false) {
  if (!renew && !clear) return response;
  const options = hostedCookieOptions(request);
  response.cookies.set(accessCookie, renew?.access_token ?? "", { ...options, maxAge: renew?.expires_in ?? 0 });
  response.cookies.set(refreshCookie, renew?.refresh_token ?? "", { ...options, maxAge: renew ? sessionDuration : 0 });
  if (hostedTwoStepEnabled() || clear) response.cookies.set(sessionProofCookie,
    renew && !clear ? sealHostedSession(renew, sessionDuration) : "", { ...options, maxAge: renew && !clear ? sessionDuration : 0 });
  return response;
}

const currentHosted = (request: NextRequest) =>
  hostedIdentity(request.cookies.get(accessCookie)?.value, request.cookies.get(refreshCookie)?.value,
    request.cookies.get(sessionProofCookie)?.value);

const hostedState = () => ({ backend: "supabase", authMode: hostedHybridLoginEnabled() ? "password-or-email-code" :
  hostedTwoStepEnabled() ? "password-email-code" : hostedEmailOtpEnabled() ? "email-otp" : "password" });
const hostedGuest = () => ({ account: null, progress: null, ...hostedState() });

function backend() {
  const value = accountBackend();
  if (value === "supabase" || value === "local" && !process.env.VERCEL) return value;
  throw new Error("Account backend not configured");
}

async function accountPayload(tx: AccountTransaction, owner: string, label: string, history: boolean, hosted: boolean) {
  const data = { account: { label }, progress: await progressFor(tx, owner),
    ...(history ? { entries: await readingsFor(tx, owner) } : {}) };
  if (!hosted) return data;
  const profile = await tx.query<{ display_name: string; personal: unknown }>("SELECT display_name,personal FROM companion.profiles WHERE owner_id=$1", [owner]);
  const inventory = await tx.query<{ item: string }>("SELECT item FROM companion.inventory WHERE owner_id=$1 ORDER BY item", [owner]);
  const stored = profile.rows[0];
  const displayName = stored?.display_name ?? "";
  const personalProfile = parseProfile(JSON.stringify({ ...emptyProfile,
    ...(stored?.personal as object), nickname: displayName, consent: false })) ?? emptyProfile;
  return { ...data, ...hostedState(), displayName, personalProfile, inventory: inventory.rows.map(row => row.item) };
}

export async function GET(request: NextRequest) {
  try {
    for (const key of request.nextUrl.searchParams.keys()) if (key !== "history") return json({ error: "不支持此查询。" }, 400);
    if (backend() === "supabase") {
      const user = await currentHosted(request);
      if (!user) return hostedCookies(request, json(hostedGuest()), undefined, true);
      const result = await withHostedOwner(user.subject, (tx, owner) =>
        accountPayload(tx, owner, user.label, request.nextUrl.searchParams.has("history"), true));
      return hostedCookies(request, json(result), user.renewal);
    }
    const token = request.cookies.get(cookieName)?.value;
    if (!token) return json({ account: null, progress: null });
    const db = await accountDb();
    const session = await validateSession(db, token);
    if (!session) return setSession(request, json({ account: null, progress: null }), "");
    return await withOwner(db, session.owner, async tx => json({
      account: { label: session.label }, progress: await progressFor(tx, session.owner),
      ...(request.nextUrl.searchParams.has("history") ? { entries: await readingsFor(tx, session.owner) } : {}),
    }));
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const expected = process.env.WENSHAN_ACCOUNT_ORIGIN ?? request.nextUrl.protocol + "//" + request.headers.get("host");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== expected))
      return json({ error: "无法验证请求来源。" }, 403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
      return json({ error: "需要 JSON 请求。" }, 415);
    if (Number(request.headers.get("content-length") ?? 0) > 1_200_000)
      return json({ error: "请求过大。" }, 413);
    const raw = await request.text();
    if (raw.length > 1_200_000) return json({ error: "请求过大。" }, 413);
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data || typeof data !== "object" || Array.isArray(data) || ["user_id","userId","owner","owner_id"].some(key => own(data, key)))
      return json({ error: "请求字段无效。" }, 400);
    const op = data.op;
    if (backend() === "supabase") return await hostedPost(request, op, data);
    const token = request.cookies.get(cookieName)?.value;
    const db = await accountDb();
    if ((op === "register" || op === "login") && typeof data.label === "string" && checkPassword(data.password)) {
      const session = await startSession(db, data.label.trim().toLowerCase(), data.password, op === "register");
      if (token) await revokeSession(db, token);
      const progress = await withOwner(db, session.owner, tx => progressFor(tx, session.owner));
      return setSession(request, json({ account: { label: session.label }, progress }), session.token);
    }
    if (op === "login" || op === "register") return json({ error: "请填写账户名和至少 10 位的密码。" }, 400);
    const session = token ? await validateSession(db, token) : null;
    if (!token || !session) return json({ error: "请先登录。" }, 401);
    const owner = session.owner;
    if (op === "logout") {
      await revokeSession(db, token);
      return setSession(request, json({ account: null, progress: null }), "");
    }
    if (op === "deleteAccount" && checkPassword(data.password)) {
      await removeAccount(db, owner, data.password);
      return setSession(request, json({ account: null, progress: null }), "");
    }
    return await withOwner(db, owner, tx => accountOperation(tx, owner, op, data));
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "请求内容无法解析。" }, 400);
    return fail(error);
  }
}

async function hostedPost(request: NextRequest, op: unknown, data: Record<string, unknown>) {
  const emailOtp = hostedEmailOtpEnabled();
  const hybrid = hostedHybridLoginEnabled();
  const twoStep = hostedTwoStepEnabled();
  if (twoStep && (op === "login" || op === "verifyLoginChallenge")) {
    if (typeof data.label !== "string") return json({ error: "请填写邮箱。" }, 400);
    const email = data.label.trim().toLowerCase();
    if (op === "login") {
      if (!checkPassword(data.password)) return json({ error: "请填写邮箱和至少 10 位的密码。" }, 400);
      const nonce = await startHostedLoginChallenge(email, data.password);
      const response = hostedCookies(request, json({ ...hostedGuest(), needsLoginCode: true }), undefined, true);
      response.cookies.set(loginChallengeCookie, nonce, { ...hostedCookieOptions(request), maxAge: loginChallengeMaxAge });
      return response;
    }
    const user = await completeHostedLoginChallenge(request.cookies.get(loginChallengeCookie)?.value, email, data.code);
    const result = await withHostedOwner(user.subject, (tx, owner) => accountPayload(tx, owner, user.label, false, true));
    const response = hostedCookies(request, json(result), user.renewal);
    response.cookies.set(loginChallengeCookie, "", { ...hostedCookieOptions(request), maxAge: 0 });
    return response;
  }
  if (op === "sendLoginCode" || op === "verifyLoginCode") {
    if (!emailOtp && !hybrid) return json({ error: "邮箱验证码登录暂未启用。" }, 409);
    if (typeof data.label !== "string") return json({ error: "请填写邮箱。" }, 400);
    const email = data.label.trim().toLowerCase();
    if (op === "sendLoginCode") {
      try { await hostedSendEmailCode(email, false); }
      catch (error) {
        if (!(error instanceof AccountError && (error.status === 401 || error.status === 429))) throw error;
      }
      return json({ ...hostedGuest(), needsConfirmation: true });
    }
    const user = await hostedVerifyEmailCode(email, data.code);
    const result = await withHostedOwner(user.subject, (tx, owner) => accountPayload(tx, owner, user.label, false, true));
    return hostedCookies(request, json(result), user.renewal);
  }
  if (emailOtp && ["login", "register", "verifyEmail", "requestReset", "resetPassword"].some(action => action === op))
    return json({ error: "请打开最新版问山，用邮箱验证码登录。" }, 409);
  if (op === "requestReset" || op === "resetPassword") {
    if (typeof data.label !== "string") return json({ error: "请填写邮箱。" }, 400);
    const email = data.label.trim().toLowerCase();
    if (op === "requestReset") {
      try { await hostedRequestReset(email); }
      catch (error) {
        if (!(hybrid && error instanceof AccountError && error.status === 429)) throw error;
      }
      return json({ ...hostedGuest(), reset: "sent" });
    }
    if (!checkPassword(data.password)) return json({ error: "新密码至少 10 位。" }, 400);
    await hostedCompleteReset(email, data.code, data.password);
    return hostedCookies(request, json({ ...hostedGuest(), reset: "completed" }), undefined, true);
  }
  if (op === "register" || op === "login" || op === "verifyEmail") {
    if (typeof data.label !== "string" || (op !== "verifyEmail" && !checkPassword(data.password)))
      return json({ error: "请填写邮箱和至少 10 位的密码。" }, 400);
    const email = data.label.trim().toLowerCase();
    if (twoStep && op === "verifyEmail") {
      await hostedVerifyEmailCode(email, data.code);
      return hostedCookies(request, json({ ...hostedGuest(), registrationVerified: true }), undefined, true);
    }
    if (hybrid && op === "verifyEmail") {
      const user = await hostedVerifyEmailCode(email, data.code);
      const result = await withHostedOwner(user.subject, (tx, owner) => accountPayload(tx, owner, user.label, false, true));
      return hostedCookies(request, json(result), user.renewal);
    }
    let user: HostedIdentity | null;
    try {
      user = await hostedSignIn(email, checkPassword(data.password) ? data.password : "", op, data.code);
    } catch (error) {
      if (!((twoStep || hybrid) && op === "register" && error instanceof AccountError &&
        (error.status === 401 || error.status === 429))) throw error;
      user = null;
    }
    if ((twoStep || hybrid) && op === "register") return json({ ...hostedGuest(), needsConfirmation: true });
    if (!user) return json({ ...hostedGuest(), needsConfirmation: true });
    const result = await withHostedOwner(user.subject, (tx, owner) => accountPayload(tx, owner, user.label, false, true));
    return hostedCookies(request, json(result), user.renewal);
  }
  const user = await currentHosted(request);
  if (!user) return hostedCookies(request, json({ error: "请先登录。" }, 401), undefined, true);
  if (op === "sendDeleteCode" && emailOtp) {
    await hostedSendEmailCode(user.label.toLowerCase(), false);
    return hostedCookies(request, json({ deletionCodeSent: true }), user.renewal);
  }
  if (op === "logout" || op === "deleteAccount") {
    if (op === "deleteAccount") {
      if (emailOtp) await hostedDelete(user, { code: data.code });
      else {
        if (!checkPassword(data.password)) return json({ error: "请输入当前密码。" }, 400);
        await hostedDelete(user, { password: data.password });
      }
    } else {
      await hostedLogout(user.renewal?.access_token ?? request.cookies.get(accessCookie)?.value);
    }
    const response = hostedCookies(request, json(hostedGuest()), undefined, true);
    response.cookies.set(loginChallengeCookie, "", { ...hostedCookieOptions(request), maxAge: 0 });
    return response;
  }
  const result = await withHostedOwner(user.subject, async (tx, owner) => {
    if (op === "savePersonalProfile") {
      const input = data.profile as { birth?: unknown } | null | undefined;
      const complete = input && parseProfile(JSON.stringify(input));
      if (!complete || (input?.birth && !complete.birth)) return json({ error: "请检查出生日期及资料格式。" }, 400);
      const { nickname = "", ...personal } = { ...complete, consent: false };
      await tx.query(`INSERT INTO companion.profiles(owner_id,display_name,personal) VALUES($1,$2,$3)
        ON CONFLICT(owner_id) DO UPDATE SET display_name=excluded.display_name,personal=excluded.personal`,
        [owner, nickname, JSON.stringify(personal)]);
      return json(await accountPayload(tx, owner, user.label, false, true));
    }
    if (op === "updateProfile") {
      const name = typeof data.displayName === "string" ? data.displayName.trim() : null;
      if (name === null || [...name].length > 32) return json({ error: "昵称最多 32 字。" }, 400);
      await tx.query(`INSERT INTO companion.profiles(owner_id,display_name) VALUES($1,$2)
        ON CONFLICT(owner_id) DO UPDATE SET display_name=excluded.display_name`, [owner, name]);
      return json(await accountPayload(tx, owner, user.label, false, true));
    }
    return accountOperation(tx, owner, op, data);
  });
  return hostedCookies(request, result, user.renewal);
}

async function accountOperation(tx: AccountTransaction, owner: string, op: unknown, data: Record<string, unknown>) {
  const pet = pets.find(item => item.id === data.pet)?.id;
  if (op === "bind" && pet) return json({ progress: await bindPet(tx, owner, pet) });
  if (op === "visit") return json({ progress: await visit(tx, owner) });
  if (op === "touch" && validUUID(data.id) && typeof data.what === "string")
    return json(await touch(tx, owner, data.id, data.what));
  if (op === "cast" && validUUID(data.id) && typeof data.question === "string" && data.question.trim() &&
      data.question.length <= 240 && typeof data.index === "number" && Number.isInteger(data.index) && data.index >= 0 && data.index < 6)
    return json(await castLine(tx, owner, data.id, data.question.trim(), data.index));
  if (op === "equip") {
    const shape = typeof data.shape === "string" && own(forms, data.shape) ? data.shape as Form : undefined;
    const decor = data.decoration === null ? null :
      typeof data.decoration === "string" && own(decorItems, data.decoration) ? data.decoration as Decoration : undefined;
    if (own(data,"shape") && !shape || own(data,"decoration") && decor === undefined || !shape && decor === undefined)
      return json({ error: "外观配置无效。" }, 400);
    return json({ progress: await equip(tx, owner, shape, decor) });
  }
  if (op === "clearHistory") {
    await tx.query("DELETE FROM companion.history WHERE owner_id=$1", [owner]);
    return json({ entries: [] });
  }
  if ((op === "saveHistory" || op === "importHistory") && Array.isArray(data.entries) &&
      data.entries.length >= 1 && data.entries.length <= (op === "saveHistory" ? 1 : 24)) {
    const entries = parseHistory(JSON.stringify(data.entries));
    if (entries.length !== data.entries.length) return json({ error: "问卦记录格式无效。" }, 400);
    return json({ entries: await writeReadings(tx, owner, entries, op === "importHistory") });
  }
  return json({ error: "不支持此操作。" }, 400);
}
