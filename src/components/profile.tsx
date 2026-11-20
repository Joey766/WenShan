"use client";

import { UserRound, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { birthHours, emptyProfile, gregorianBirth, localDate, parseProfile, profileKey, roles, type Profile } from "@/lib/profile";
import type { AccountState } from "@/lib/pet-v16";
import { accountRequest, useAccount } from "./account";

const Context = createContext<{ profile: Profile; open: () => void } | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { state, ready, setPersonalProfile } = useAccount();
  const label = state.account?.label;
  const hosted = Boolean(label && state.backend);
  const savedAccountProfile = state.personalProfile;
  const [stored, setStored] = useState<Profile>(emptyProfile);
  const [draft, setDraft] = useState<Profile>(emptyProfile);
  const [first, setFirst] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  const currentProfile = hosted ? savedAccountProfile ?? emptyProfile : stored;

  useEffect(() => {
    if (!ready) return;
    if (hosted && label) {
      setStored(savedAccountProfile ?? emptyProfile);
      setFirst(false);
      return;
    }
    setStored(emptyProfile);
    setDraft(emptyProfile);
    setFirst(false);
    modal.current?.close();
    if (label || location.pathname !== "/") return;
    try {
      const profile = parseProfile(localStorage.getItem(profileKey));
      if (profile) { setStored(profile); return; }
    } catch { /* Profile is optional when browser storage is blocked. */ }
    setFirst(true);
    modal.current?.showModal();
  }, [ready, label, hosted, savedAccountProfile]);

  async function persist(profile: Profile) {
    setBusy(true);
    setNotice("");
    try {
      const normalized = { ...profile, consent: false };
      if (hosted && label) {
        const next = await accountRequest<AccountState>({ op: "savePersonalProfile", profile: normalized });
        setPersonalProfile(label, next);
      } else {
        setStored(normalized);
        try { if (!label) localStorage.setItem(profileKey, JSON.stringify(normalized)); } catch { /* Session only. */ }
      }
      setFirst(false);
      modal.current?.close();
    } catch (error) { setNotice(error instanceof Error ? error.message : "资料暂时无法保存。"); }
    finally { setBusy(false); }
  }
  function open() {
    setNotice("");
    setDraft(currentProfile);
    modal.current?.showModal();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.birth && !gregorianBirth(draft)) { setNotice("请选择有效的出生日期，农历请核对闰月。"); return; }
    const profile = parseProfile(JSON.stringify(draft));
    if (profile) void persist(profile);
  }

  const lunar = draft.calendar === "lunar";
  const clockTime = draft.birthTime && /^[0-9]/.test(draft.birthTime) ? draft.birthTime : "";
  const traditional = birthHours.find(hour => hour === draft.birthTime) ?? "";

  return <Context.Provider value={{ open, profile: currentProfile }}>
    {children}
    <dialog ref={modal} className="settings-dialog profile-dialog" data-first={first} aria-labelledby="profile-title"
      onCancel={event => { if (first) { event.preventDefault(); void persist(emptyProfile); } }}>
      <div className="dialog-head">
        <h2 id="profile-title">{first ? "入山前，留个印记" : "个人资料"}</h2>
        <button className="icon-button" aria-label="关闭个人资料" onClick={() => { if (first) void persist(emptyProfile); else modal.current?.close(); }}><X size={16} /></button>
      </div>
      <p>多了解你一点，解读便更贴近你。</p>
      <p>所有资料均可跳过。{hosted ? "资料只保存到你的问山账号。" : "游客资料留在此浏览器。"} 保存时不会发送给 Gemini。</p>
      <form onSubmit={submit}>
        <div className="profile-fields">
          <label>昵称 <input maxLength={32} value={draft.nickname ?? ""} onChange={event => setDraft({ ...draft, nickname: event.target.value })} /></label>
          <label>出生日期 <input type={lunar ? "text" : "date"} aria-label="出生日期" value={draft.birth} min="1900-01-01" max={localDate()}
            placeholder={lunar ? "农历 YYYY-MM-DD" : undefined} maxLength={10}
            onChange={event => setDraft({ ...draft, birth: event.target.value })} /></label>
          <label>性别 <select aria-label="性别" value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as Profile["gender"] })}>
            <option value="undisclosed">不愿透露</option><option value="woman">女</option><option value="man">男</option><option value="other">其他</option>
          </select></label>
          <label>当前身份 <select value={draft.role ?? ""} onChange={event => setDraft({ ...draft, role: event.target.value as Profile["role"] })}>
            <option value="">不提供</option>{roles.map(role => <option key={role}>{role}</option>)}
          </select></label>
        </div>
        <details className="profile-extra"><summary>更多生辰信息</summary>
          <div className="profile-fields">
            <label>历法 <select value={draft.calendar ?? "solar"} onChange={event => setDraft({ ...draft,
              calendar: event.target.value === "lunar" ? "lunar" : "solar", birth: "", leapMonth: false })}>
              <option value="solar">公历</option><option value="lunar">农历</option>
            </select></label>
            {lunar && <label className="profile-consent"><input type="checkbox" checked={!!draft.leapMonth}
              onChange={event => setDraft({ ...draft, leapMonth: event.target.checked })} /> 闰月</label>}
            <label>出生城市 <input maxLength={60} placeholder="城市、国家或地区" value={draft.city ?? ""}
              onChange={event => setDraft({ ...draft, city: event.target.value })} /></label>
            <label>出生时间 <input type="time" value={clockTime}
              onChange={event => setDraft({ ...draft, birthTime: event.target.value })} /></label>
            <label>传统时辰 <select value={traditional} onChange={event => setDraft({ ...draft, birthTime: event.target.value })}>
              <option value="">未知或使用具体时间</option>{birthHours.map(hour => <option key={hour}>{hour}</option>)}
            </select></label>
            {clockTime && <button type="button" className="text-button" onClick={() => setDraft({ ...draft, birthTime: "" })}>清除出生时间</button>}
          </div>
        </details>
        {notice && <p className="field-error" role="status">{notice}</p>}
        <div className="profile-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={() => void persist(emptyProfile)}>{first ? "跳过" : "清除资料"}</button>
          <button className="button primary" type="submit" disabled={busy}>{busy ? "正在保存" : "保存资料"}</button>
        </div>
      </form>
    </dialog>
  </Context.Provider>;
}

export function useProfile() {
  const profile = useContext(Context);
  if (!profile) throw new Error("ProfileProvider is required");
  return profile;
}

export function ProfileButton() {
  const { open } = useProfile();
  return <button type="button" className="icon-button" aria-label="个人资料" onClick={open}><UserRound size={17} /></button>;
}
