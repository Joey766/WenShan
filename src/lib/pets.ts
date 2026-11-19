export const pets = [
  { id: "xiaogua", name: "小卦", trait: "竹笠问道", color: "#ac573c", greeting: "你慢慢说，我在这儿。" },
  { id: "yunyao", name: "云爻", trait: "乘云听风", color: "#7b7a96", greeting: "给你留了一小朵云。" },
  { id: "qingpu", name: "青朴", trait: "含露栖叶", color: "#57704c", greeting: "听，叶尖有滴水。" },
  { id: "xuanji", name: "玄机", trait: "抱星观变", color: "#665672", greeting: "一起看看今天的卦。" },
] as const;

export type PetId = typeof pets[number]["id"];
export type Pet = typeof pets[number];
export const companionKey = "wenshan.companion.v1";
export const legacyCompanionKey = "wenshan.pet.v1";

export function readCompanion(current: string | null, legacy: string | null): PetId | null {
  if (current !== null) return pets.find(p => p.id === current)?.id ?? null;
  if (!legacy) return null;
  try {
    const value = JSON.parse(legacy) as { chosen?: unknown } | null;
    return pets.find(p => p.id === value?.chosen)?.id ?? null;
  } catch {
    return null;
  }
}
