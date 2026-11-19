export const profileKey = "wenshan.profile.v1";
export const genders = ["undisclosed", "woman", "man", "other"] as const;
type Gender = typeof genders[number];
export type Profile = { birth: string; gender: Gender; custom: string; consent: boolean };
export const emptyProfile: Profile = { birth: "", gender: "undisclosed", custom: "", consent: false };
export const ageBands = ["未满18岁", "18至24岁", "25至39岁", "40至59岁", "60岁以上"] as const;
export type ProfileContext = { ageBand?: typeof ageBands[number]; expression?: string };

export function localDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function validBirth(birth: string, today = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(birth) || birth < "1900-01-01" || birth > today) return false;
  const date = new Date(`${birth}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(birth + "T");
}

export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Profile> | null;
    if (!data || !genders.includes(data.gender as Gender)) return null;
    return {
      birth: typeof data.birth === "string" && validBirth(data.birth) ? data.birth : "",
      gender: data.gender as Gender,
      custom: data.gender === "other" && typeof data.custom === "string" ? data.custom.trim().slice(0, 30) : "",
      consent: data.consent === true,
    };
  } catch { return null; }
}

export function modelProfile(profile: Profile, today = localDate()): ProfileContext | undefined {
  if (!profile.consent) return undefined;
  let ageBand: ProfileContext["ageBand"];
  if (validBirth(profile.birth, today)) {
    const age = Number(today.slice(0, 4)) - Number(profile.birth.slice(0, 4)) - Number(today.slice(5) < profile.birth.slice(5));
    ageBand = age < 18 ? ageBands[0] : age < 25 ? ageBands[1] : age < 40 ? ageBands[2] : age < 60 ? ageBands[3] : ageBands[4];
  }
  const expression = profile.gender === "man" ? "男" : profile.gender === "woman" ? "女" : profile.gender === "other" ? "其他" : undefined;
  return ageBand || expression ? { ageBand, expression } : undefined;
}
