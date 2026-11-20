import motions from "../data/pet-v16-motions.json" with { type: "json" };
import type { PetId } from "./pets.ts";

export type MotionIndex = 0 | 1 | 2 | 3 | 4;
function withExpressionSheets(actions: typeof motions[PetId]) {
  return actions.map(action => ({ ...action, src: action.src.replace("/art/pet-v16/", "/art/companion-expressions/") }));
}

export const petMotions = {
  xiaogua: withExpressionSheets(motions.xiaogua),
  yunyao: withExpressionSheets(motions.yunyao),
  qingpu: withExpressionSheets(motions.qingpu),
  xuanji: withExpressionSheets(motions.xuanji),
};

export const homes = {
  xiaogua: { name: "卦算屋", toy: "xiaogua_coin_toy", toyName: "铜钱摇铃", decor: "decoration_wind_chime", light: "#f8ce8b" },
  yunyao: { name: "云栖台", toy: "yunyao_cloud_ball", toyName: "软云球", decor: "decoration_cloud_mobile", light: "#e4ebf9" },
  qingpu: { name: "木叶居", toy: "qingpu_dew_ball", toyName: "露珠球", decor: "decoration_blossom", light: "#e7edbf" },
  xuanji: { name: "星演阁", toy: "xuanji_orbit_ball", toyName: "星轨球", decor: "decoration_star_mobiles", light: "#e3cfb9" },
} as const;
export const propsRoot = "/art/pet-v16/props/";

export const decorItems = {
  decoration_wind_chime: { name: "竹风铃", xp: 60 },
  decoration_cloud_mobile: { name: "云团吊饰", xp: 60 },
  decoration_blossom: { name: "飞花枝", xp: 60 },
  decoration_star_mobiles: { name: "星光挂饰", xp: 180 },
  decoration_moon_lamp: { name: "月灯", xp: 180 },
} as const;
export type Decoration = keyof typeof decorItems;

export const forms = {
  normal: { name: "小团子", xp: 0, width: 0 },
  slightly_plump: { name: "圆乎乎", xp: 60, width: .04 },
  extra_cuddly: { name: "软糯糯", xp: 180, width: .065 },
} as const;
export type Form = keyof typeof forms;
export type Progress = { pet: PetId; xp: number; boundAt: number; activeDays: number; shape: Form; decoration: Decoration | null };
export type AccountState = { account: { label: string } | null; progress: Progress | null;
  backend?: "supabase"; authMode?: "password" | "email-otp" | "password-email-code" | "password-or-email-code";
  needsConfirmation?: boolean; needsLoginCode?: boolean; registrationVerified?: boolean;
  reset?: "sent" | "completed"; displayName?: string; personalProfile?: import("./profile.ts").Profile; inventory?: string[] };
export const growthPhase = (xp: number) => xp >= 180 ? "默契" : xp >= 60 ? "熟悉" : "初识";

export function canDecorate(pet: PetId, key: Decoration, xp: number) {
  return xp >= decorItems[key].xp && (key === homes[pet].decor || key === "decoration_moon_lamp" || key === "decoration_star_mobiles");
}
