
import { demoReading, fortuneFromCast, preparedDetails, type ReadingEvent, type ReadingRequest, type ReadingNotice } from "@/lib/interpretation";
import { generateGlosses, generateReading, localModel } from "@/lib/reading-generation";
import { validSharedProfile, type ProfileContext } from "@/lib/profile";
import { readingFocus } from "@/lib/reading-context";
import { getReading, isCoins } from "@/lib/yijing";
import { aiProvider, geminiModel, ModelError } from "@/lib/server/ai-provider";
import { accessCookie, accountBackend, hostedIdentity, hostedPool, refreshCookie, sessionProofCookie } from "@/lib/server/hosted-accounts";
import { logEvent } from "@/lib/server/observability";

export const runtime = "nodejs";
export const maxDuration = 30;

function cap(env: string | undefined, fallback: number) {
  if (env === undefined) return fallback;
  if (!/^\d{1,9}$/.test(env)) return 0;
  return Number(env);
}

async function getModel(provider: ReturnType<typeof aiProvider>, request: NextRequest, signal: AbortSignal) {
  if (provider === "ollama") return localModel(signal);
  if (provider === "demo") return null;
  const model = geminiModel();
  if (!model) throw new ModelError("unavailable");
  const access = request.cookies.get(accessCookie)?.value;
  const owner = accountBackend() === "supabase" && access ? await hostedIdentity(access,
    request.cookies.get(refreshCookie)?.value, request.cookies.get(sessionProofCookie)?.value, false) : null;
  if (!owner) throw new ModelError("identity");
  signal.throwIfAborted();
  const { rows: [budget] } = await hostedPool().query<{ result: string }>(
    "SELECT companion.reserve_user_ai($1,$2,$3,$4,$5) AS result",
    [owner.subject, cap(process.env.GEMINI_LIMIT_PER_MINUTE, 5), cap(process.env.GEMINI_LIMIT_PER_DAY, 40),
      cap(process.env.GEMINI_USER_LIMIT_PER_MINUTE, 2), cap(process.env.GEMINI_USER_LIMIT_PER_DAY, 5)],
  );
  if (budget.result === "identity") throw new ModelError("identity");
  if (budget.result !== "ok") throw new ModelError(budget.result.startsWith("user_") ? "account-quota" : "quota");
  return model;
}

function cloudNotice(error: unknown): ReadingNotice {
  if (error instanceof ModelError) {
    if (error.code === "quota") return "cloud-quota";
    if (error.code === "account-quota") return "cloud-account-quota";
    if (error.code === "identity") return "cloud-sign-in";
  }
  return "cloud-unavailable";
}

const shortText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

function parseRequest(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const input = data as Partial<ReadingRequest> & { mode?: unknown };
  if (!Array.isArray(input.coins) || input.coins.length !== 6 || !input.coins.every(isCoins)) return null;
  if (input.mode === "classics") return { kind: "classics", coins: input.coins } as const;
  if (!shortText(input.question, 240)) return null;
  let profile: ProfileContext | undefined;
  if (input.profile !== undefined) {
    if (!validSharedProfile(input.profile) || input.profileConsent !== true) return null;
    profile = input.profile;
  }
  if (input.background !== undefined && (typeof input.background !== "string" || input.background.length > 480)) return null;
  const focus = readingFocus(input.focus);
  if (input.focus && !focus && input.focus.period !== "不限定") return null;
  return { kind: "fortune", input: { question: input.question.trim(), coins: input.coins, profile, focus, background: input.background?.trim(),
    cloudConsent: input.cloudConsent === true } } as const;
}

export async function POST(request: NextRequest) {
  let parsed: ReturnType<typeof parseRequest> = null;
  try {
    const raw = Number(request.headers.get("content-length") ?? 0) <= 28_000 ? await request.text() : "";
    parsed = raw.length <= 28_000 ? parseRequest(JSON.parse(raw)) : null;
  } catch { /* Invalid JSON. */ }
  if (!parsed) return Response.json({ error: "请提交有效问题与六轮铜钱面值。" }, { status: 400 });
  const stop = new AbortController();
  const provider = aiProvider();
  const signal = AbortSignal.any([request.signal, stop.signal, AbortSignal.timeout(provider === "gemini" ? 25_000 : 116_000)]);
  if (parsed.kind === "classics") {
    const reading = getReading(parsed.coins);
    const authored = preparedDetails(reading);
    if (authored) return Response.json({ source: "editor", details: authored });
    try {
      const model = await getModel(provider, request, signal);
      const details = model && await generateGlosses(model, reading, signal);
      if (details) return Response.json({ source: provider === "gemini" ? "cloud" : "local", details });
    } catch (error) {
      if (provider === "gemini") return Response.json({ source: "unavailable", notice: cloudNotice(error) });
      if (!request.signal.aborted) logEvent("warn", "gloss_provider_unavailable", { provider });
    }
    return Response.json({ source: "unavailable" });
  }
  const input = parsed.input;
  const reading = getReading(input.coins);
  async function read(send: (event: ReadingEvent) => void) {
    send({ phase: "identifying" });
    send({ delta: fortuneFromCast(input, reading).directAnswer });
    send({ phase: "checking" });
    if (provider === "gemini" && !input.cloudConsent) return { ...demoReading(input, reading), notice: "cloud-consent" as const };
    const started = performance.now();
    let notice: ReadingNotice | undefined = provider === "gemini" ? "cloud-unavailable" : undefined;
    try {
      const model = await getModel(provider, request, signal);
      const answer = model && await generateReading(model, input, reading, signal, send);
      if (answer) {
        logEvent("info", "reading_complete", { provider, ms: Math.round(performance.now() - started) });
        return answer;
      }
    } catch (error) {
      if (provider === "gemini") notice = cloudNotice(error);
    }
    if (provider !== "demo" && !request.signal.aborted && !stop.signal.aborted)
      logEvent("warn", "reading_fallback", { provider, reason: notice ?? "local_unavailable" });
    return { ...demoReading(input, reading), notice };
  }
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) return Response.json(await read(() => {}));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: ReadingEvent) {
        if (!stop.signal.aborted && !request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      void read(send).then(answer => {
        if (stop.signal.aborted) return;
        send({ answer });
        controller.close();
      }).catch(() => { if (!stop.signal.aborted) controller.close(); });
    },
    cancel() { stop.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
import type { NextRequest } from "next/server";
