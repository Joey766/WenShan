export const profileKey = "wenshan.profile.v1";
export const genders = ["undisclosed", "woman", "man", "other"] as const;
type Gender = typeof genders[number];
export const roles = ["学生", "求职中", "工作中", "其他"] as const;
export const birthHours = ["子时", "丑时", "寅时", "卯时", "辰时", "巳时", "午时", "未时", "申时", "酉时", "戌时", "亥时"] as const;
export type Profile = { birth: string; gender: Gender; custom: string; consent: boolean;
  nickname?: string; calendar?: "solar" | "lunar"; leapMonth?: boolean; birthTime?: string; city?: string;
  role?: typeof roles[number] | "" };
export const emptyProfile: Profile = { birth: "", gender: "undisclosed", custom: "", consent: false };
export const ageBands = ["未满18岁", "18至24岁", "25至39岁", "40至59岁", "60岁以上"] as const;
export type ProfileContext = { ageBand?: typeof ageBands[number]; expression?: string; role?: typeof roles[number];
  nickname?: string; birth?: string; calendar?: "solar" | "lunar"; leapMonth?: boolean; birthTime?: string; city?: string };

export function localDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function validBirth(birth: string, today = localDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(birth) || birth < "1900-01-01" || birth > today) return false;
  const date = new Date(`${birth}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(birth + "T");
}

const lunarMonths = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "腊"];
const lunarCalendar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai",
});

export function gregorianBirth(profile: Pick<Profile, "birth" | "calendar" | "leapMonth">, today = localDate()): string | undefined {
  if (profile.calendar !== "lunar") return validBirth(profile.birth, today) ? profile.birth : undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$/.test(profile.birth)) return;
  const [year, month, day] = profile.birth.split("-").map(Number);
  if (year < 1900 || year > Number(today.slice(0, 4))) return;
  const monthName = (profile.leapMonth ? "闰" : "") + lunarMonths[month - 1] + "月";
  const date = new Date(Date.UTC(year, 0, 1, 4));
  while (date.getUTCFullYear() <= year + 1) {
    const iso = date.toISOString().slice(0, 10);
    if (iso > today) break;
    const parts = lunarCalendar.formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)?.value;
    if (part("relatedYear") === String(year) && part("month") === monthName && part("day") === String(day)) return iso;
    if (Number(part("relatedYear")) > year) break;
    date.setUTCDate(date.getUTCDate() + 1);
  }
}

export function validBirthTime(value: string) {
  return !value || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || birthHours.some(hour => hour === value);
}

export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Profile> | null;
    if (!data || !genders.includes(data.gender as Gender)) return null;
    const profile: Profile = {
      birth: typeof data.birth === "string" && gregorianBirth({ birth: data.birth, calendar: data.calendar, leapMonth: data.leapMonth }) ? data.birth : "",
      gender: data.gender as Gender,
      custom: data.gender === "other" && typeof data.custom === "string" ? data.custom.trim().slice(0, 30) : "",
      consent: data.consent === true,
    };
    if (typeof data.nickname === "string") profile.nickname = data.nickname.trim().slice(0, 32);
    if (data.calendar === "solar" || data.calendar === "lunar") profile.calendar = data.calendar;
    if (data.calendar === "lunar" && data.leapMonth === true) profile.leapMonth = true;
    if (typeof data.birthTime === "string" && validBirthTime(data.birthTime)) profile.birthTime = data.birthTime;
    if (typeof data.city === "string") profile.city = data.city.trim().slice(0, 60);
    if (data.role === "" || roles.some(role => role === data.role)) profile.role = data.role;
    return profile;
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

export function sharedProfile(profile: Profile, today = localDate()): ProfileContext | undefined {
  const birthday = gregorianBirth(profile, today);
  const result: ProfileContext = { ...modelProfile({ ...profile, birth: birthday ?? "", consent: true }, today) };
  if (profile.nickname) result.nickname = profile.nickname;
  if (profile.role) result.role = profile.role;
  if (profile.city) result.city = profile.city;
  if (profile.birthTime) result.birthTime = profile.birthTime;
  if (birthday) {
    result.birth = profile.birth;
    result.calendar = profile.calendar === "lunar" ? "lunar" : "solar";
    if (result.calendar === "lunar" && profile.leapMonth) result.leapMonth = true;
  }
  return Object.keys(result).length ? result : undefined;
}

export function validSharedProfile(input: unknown): input is ProfileContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as ProfileContext;
  if (Object.keys(value).some(key => !["ageBand", "expression", "role", "nickname", "birth", "calendar", "leapMonth", "birthTime", "city"].includes(key))) return false;
  const brief = (text: unknown, max: number) => text === undefined || typeof text === "string" && !!text.trim() && text.length <= max;
  return (value.ageBand === undefined || ageBands.includes(value.ageBand)) &&
    (value.expression === undefined || ["男", "女", "其他"].includes(value.expression)) &&
    (value.role === undefined || roles.includes(value.role)) && brief(value.nickname, 32) && brief(value.city, 60) &&
    (value.birthTime === undefined || typeof value.birthTime === "string" && validBirthTime(value.birthTime)) &&
    (value.calendar === undefined || ["solar", "lunar"].includes(value.calendar)) &&
    (value.leapMonth === undefined || value.calendar === "lunar" && value.leapMonth === true) &&
    (value.birth === undefined || typeof value.birth === "string" && !!gregorianBirth({ ...value, birth: value.birth }));
}
