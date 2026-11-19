export function logEvent(level: "info" | "warn" | "error", event: string,
  fields: Record<string, string | number | boolean> = {}) {
  console[level](JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

export const buildVersion = () => (process.env.VERCEL_GIT_COMMIT_SHA || process.env.WENSHAN_RELEASE || "local").slice(0, 40);
