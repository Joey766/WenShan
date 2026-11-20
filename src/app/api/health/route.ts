import { aiProvider, geminiModel } from "@/lib/server/ai-provider";
import { accountBackend, hostedPool } from "@/lib/server/hosted-accounts";
import { buildVersion, logEvent } from "@/lib/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const provider = aiProvider();
  const backend = accountBackend();
  let ready = backend === "supabase" || backend === "local" && !process.env.VERCEL;
  let persistence = backend === "supabase" ? "unavailable" : "local";
  if (backend === "supabase" || provider === "gemini") {
    try {
      const { rows: [check] } = await hostedPool().query<{ available: boolean }>(`SELECT
        has_function_privilege(current_user,'companion.hosted_owner(uuid)','EXECUTE') AND
        has_function_privilege(current_user,'companion.reserve_user_ai(uuid,integer,integer,integer,integer)','EXECUTE') AND
        to_regclass('companion.login_challenges') IS NOT NULL AND EXISTS (
          SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('companion.profiles') AND attname='personal' AND NOT attisdropped
        ) AS available`);
      persistence = check.available ? "ready" : "unavailable";
    } catch { /* Health responds without exposing connection details. */ }
    ready &&= persistence === "ready";
  }
  if (backend === "supabase") ready &&= Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_AUTH_ADMIN_KEY);
  if (provider === "gemini") ready &&= Boolean(geminiModel());
  if (!ready) logEvent("warn", "readiness_unavailable", { backend, provider });
  return Response.json({ ready, version: buildVersion(), provider, persistence }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
