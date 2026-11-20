export const readingRanges = ["不限定", "今天", "本周", "未来一个月", "未来三个月", "自定义时间范围"] as const;
export type ReadingFocus = { period: typeof readingRanges[number]; start?: string; end?: string };

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function readingFocus(value: unknown): ReadingFocus | undefined {
  if (!value || typeof value !== "object") return;
  const { period, start, end } = value as Partial<ReadingFocus>;
  if (!period || !readingRanges.includes(period) || period === "不限定") return;
  if (period !== "自定义时间范围") return { period };
  if (calendarDate(start) && calendarDate(end) && start <= end) return { period, start, end };
}
