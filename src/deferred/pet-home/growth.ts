import { pets as companions, type PetId } from "../../lib/pets.ts";

const rooms = {
  xiaogua: { home: "卦算屋", greeting: "你慢慢说，我在这儿陪着。", chat: "要不要先把心上那件事，写成一句话？" },
  yunyao: { home: "云栖台", greeting: "今天的云，给你留了一小朵。", chat: "先歇一会儿。云也要等风来了再走。" },
  qingpu: { home: "木叶居", greeting: "听见啦，是你踩着叶子回来了。", chat: "叶子一点一点长。小小的事，也值得做。" },
  xuanji: { home: "星演阁", greeting: "给你留了一个看星星的位置。", chat: "有的星星现在看不见，换个角度再看呢？" },
} as const;
export const pets = companions.map(pet => ({ ...pet, ...rooms[pet.id] }));
export type { PetId };
export type Mood = "normal" | "happy" | "sleepy" | "revived";
export type Action = "pat" | "feed" | "jump" | "chat";
export type Decoration = "plain" | "blossom" | "starlight";
type Profile = {
  createdAt: number;
  lastVisitAt: number;
  lastInteractionAt: number;
  sleepy: boolean;
  xp: number;
  actions: Record<Action, number>;
  decoration: Decoration;
};
export type PetSave = { chosen: PetId | null; profiles: Partial<Record<PetId, Profile>> };

export const petStorageKey = "wenshan.pet.v1";
export const dayMs = 24 * 60 * 60 * 1000;
export const emptySave: PetSave = { chosen: null, profiles: {} };
export const decorations = [
  { id: "plain", title: "清景", level: 1 },
  { id: "blossom", title: "飞花", level: 2 },
  { id: "starlight", title: "流萤", level: 3 },
] as const;

const actionXp: Record<Action, number> = { pat: 4, feed: 6, jump: 3, chat: 5 };
const validCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parsePetSave(raw: string | null): PetSave {
  if (!raw) return emptySave;
  try {
    const data = JSON.parse(raw) as Partial<PetSave> | null;
    const profiles: PetSave["profiles"] = {};
    for (const { id } of pets) {
      const profile = data?.profiles?.[id];
      if (!profile || !validCount(profile.createdAt) || !validCount(profile.lastVisitAt)) continue;
      const actions = {} as Record<Action, number>;
      for (const key of Object.keys(actionXp) as Action[]) {
        actions[key] = validCount(profile.actions?.[key]) ? profile.actions[key] : 0;
      }
      profiles[id] = {
        createdAt: profile.createdAt,
        lastVisitAt: profile.lastVisitAt,
        lastInteractionAt: validCount(profile.lastInteractionAt) ? profile.lastInteractionAt : 0,
        sleepy: profile.sleepy === true,
        xp: validCount(profile.xp) ? profile.xp : 0,
        actions,
        decoration: decorations.find(d => d.id === profile.decoration)?.id ?? "plain",
      };
    }
    const chosen = pets.find(pet => pet.id === data?.chosen)?.id ?? null;
    return { chosen: chosen && profiles[chosen] ? chosen : null, profiles };
  } catch {
    return emptySave;
  }
}

export function selectPet(save: PetSave, chosen: PetId, now = Date.now()): PetSave {
  const existing = save.profiles[chosen];
  const profile: Profile = existing ?? {
    createdAt: now, lastVisitAt: now, lastInteractionAt: 0, sleepy: false, xp: 0,
    actions: { pat: 0, feed: 0, jump: 0, chat: 0 }, decoration: "plain",
  };
  return {
    chosen,
    profiles: {
      ...save.profiles,
      [chosen]: { ...profile, sleepy: profile.sleepy || now - profile.lastVisitAt >= 3 * dayMs, lastVisitAt: now },
    },
  };
}

export function interact(save: PetSave, action: Action, now = Date.now()): PetSave {
  const id = save.chosen;
  if (!id) return save;
  const profile = save.profiles[id];
  if (!profile) return save;
  return {
    ...save,
    profiles: {
      ...save.profiles,
      [id]: {
        ...profile,
        sleepy: false,
        lastInteractionAt: now,
        xp: profile.xp + actionXp[action],
        actions: { ...profile.actions, [action]: profile.actions[action] + 1 },
      },
    },
  };
}

export function growth(profile: Profile, now = Date.now()) {
  const days = Math.max(1, Math.floor((now - profile.createdAt) / dayMs) + 1);
  const points = profile.xp + (days - 1) * 2;
  return { days, level: 1 + Math.floor(points / 20), progress: points % 20 };
}

export function setDecoration(save: PetSave, id: Decoration, now = Date.now()): PetSave {
  const chosen = save.chosen;
  const profile = chosen && save.profiles[chosen];
  const decoration = decorations.find(item => item.id === id);
  if (!chosen || !profile || !decoration || growth(profile, now).level < decoration.level) return save;
  return { ...save, profiles: { ...save.profiles, [chosen]: { ...profile, decoration: id } } };
}
