import { readCompanion, type PetId } from "./pets.ts";
import { parseDetails, type Message } from "./interpretation.ts";
import { isCoins, type Coins } from "./yijing.ts";
import { readingFocus, type ReadingFocus } from "./reading-context.ts";

export const historyKey = "wenshan.readings.v1";
export const historyLimit = 24;
export const messageLimit = 12;

export type SavedReading = {
  id: string;
  createdAt: number;
  pet: PetId;
  question: string;
  background: string;
  focus?: ReadingFocus;
  casts: Coins[];
  messages: Message[];
};

export function parseHistory(raw: string | null): SavedReading[] {
  if (!raw) return [];
  try {
    const input = JSON.parse(raw) as unknown;
    if (!Array.isArray(input)) return [];
    const known = new Set<string>();
    return input.slice(0, historyLimit).flatMap((entry: Partial<SavedReading> | null) => {
      if (!entry || typeof entry.id !== "string" || entry.id.length > 60 || known.has(entry.id) ||
          typeof entry.createdAt !== "number" || !Number.isFinite(entry.createdAt) || entry.createdAt < 0 ||
          entry.createdAt > 8.64e15 || typeof entry.question !== "string" || !entry.question.trim() ||
          entry.question.length > 240 || typeof entry.background !== "string" || entry.background.length > 480 ||
          !Array.isArray(entry.casts) || entry.casts.length !== 6 || !entry.casts.every(isCoins)) return [];
      const pet = readCompanion(typeof entry.pet === "string" ? entry.pet : null, null);
      if (!pet) return [];
      known.add(entry.id);
      const focus = readingFocus(entry.focus);
      const messages = Array.isArray(entry.messages) ? entry.messages.slice(-messageLimit).filter(validMessage)
        .map(message => message.role === "assistant" ? {
          ...message,
          details: parseDetails(message.details),
          fallbackSections: typeof message.fallbackSections === "number" && Number.isInteger(message.fallbackSections) &&
            message.fallbackSections >= 1 && message.fallbackSections <= 5
            ? message.fallbackSections : undefined,
        } : message) : [];
      return [{
        id: entry.id, createdAt: entry.createdAt, question: entry.question, background: entry.background,
        ...(focus ? { focus } : {}), pet, casts: entry.casts, messages,
      }];
    });
  } catch {
    return [];
  }
}

function validMessage(message: unknown): message is Message {
  if (!message || typeof message !== "object") return false;
  const item = message as Partial<Message>;
  if (typeof item.content !== "string" || !item.content.trim()) return false;
  if (item.role === "user") return item.content.length <= 240;
  return item.role === "assistant" && item.content.length <= 1600 &&
    (item.mode === "demo" || item.mode === "local" || item.mode === "cloud");
}

export function saveReading(entry: SavedReading) {
  const other = parseHistory(localStorage.getItem(historyKey)).filter(item => item.id !== entry.id);
  const next = [{ ...entry, messages: entry.messages.slice(-messageLimit) }, ...other].slice(0, historyLimit);
  localStorage.setItem(historyKey, JSON.stringify(next));
}

export function clearReadings() {
  localStorage.removeItem(historyKey);
}
