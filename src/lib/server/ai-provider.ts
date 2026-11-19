export type LocalModel = { endpoint: string; name: string };
export type GeminiModel = { provider: "gemini"; key: string; name: string };
export type ReadingModel = LocalModel | GeminiModel;
export type Provider = "ollama" | "gemini" | "demo";

export function aiProvider(): Provider {
  const configured = process.env.WENSHAN_AI_PROVIDER;
  if (configured === "gemini" || configured === "demo") return configured;
  return configured === "ollama" || (!configured && !process.env.VERCEL) ? "ollama" : "demo";
}

export function geminiModel(): GeminiModel | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  const name = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  return key && /^gemini-[a-z0-9.-]+$/i.test(name) ? { provider: "gemini", key, name } : null;
}

export class ModelError extends Error {
  readonly code: "quota" | "account-quota" | "identity" | "unavailable" | "invalid";
  constructor(code: ModelError["code"]) {
    super(code);
    this.code = code;
  }
}

type Prompt = { role: string; content: string }[];
type Options = { format: object; messages: Prompt; stream: boolean; maxTokens: number; context: number; temperature: number };

export async function requestModel(model: ReadingModel, options: Options, signal: AbortSignal) {
  const { format, messages, stream, maxTokens, context, temperature } = options;
  const gemini = "provider" in model;
  const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  const url = gemini ? `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:${method}` : model.endpoint + "/api/chat";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gemini) headers["x-goog-api-key"] = model.key;
  const system = messages.filter(message => message.role === "system");
  const body = gemini ? {
    systemInstruction: { parts: system.map(message => ({ text: message.content })) },
    contents: messages.filter(message => message.role !== "system").map(message => ({
      role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }],
    })),
    generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json",
      responseJsonSchema: format, ...(model.name.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "minimal" } } :
        model.name.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
  } : { model: model.name, stream, think: false, keep_alive: "6m", format,
    options: { temperature, num_predict: maxTokens, num_ctx: context }, messages };
  const response = await fetch(url, { method: "POST", headers, signal, redirect: "error", body: JSON.stringify(body) });
  if (!response.ok) throw new ModelError(response.status === 429 ? "quota" : "unavailable");
  return response;
}

type GeminiFrame = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; error?: unknown };

function parseGemini(frame: GeminiFrame) {
  if (frame.error) throw new ModelError("invalid");
  const candidate = frame.candidates?.[0];
  return {
    text: candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "",
    done: candidate?.finishReason === "STOP",
  };
}

export async function collectModelText(model: ReadingModel, response: Response) {
  const body = await response.json();
  if (!("provider" in model)) return body.message?.content;
  const result = parseGemini(body);
  return result.done ? result.text : "";
}

export async function streamModelText(model: ReadingModel, response: Response, onText: (chunk: string) => void) {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  if (!reader) return false;
  const gemini = "provider" in model;
  const separator = gemini ? /\r?\n\r?\n/ : /\r?\n/;
  let pending = "";
  let done = false;
  function accept(frame: string) {
    if (gemini) frame = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5)).join("\n").trim();
    if (!frame.trim() || frame === "[DONE]") return;
    const raw = JSON.parse(frame);
    if (raw.error) throw new ModelError("invalid");
    const chunk = gemini ? parseGemini(raw) : { text: raw.message?.content, done: raw.done === true };
    if (chunk.text) onText(chunk.text);
    if (chunk.done) done = true;
  }
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      pending += next.value;
      const frames = pending.split(separator);
      pending = frames.pop() ?? "";
      if (pending.length > 32_000) throw new ModelError("invalid");
      for (const frame of frames) accept(frame);
    }
    accept(pending);
    return done;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
