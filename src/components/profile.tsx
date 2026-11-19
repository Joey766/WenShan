"use client";

import { UserRound, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { emptyProfile, localDate, modelProfile, parseProfile, profileKey, validBirth, type Profile } from "@/lib/profile";
import { useAccount } from "./account";

const Context = createContext<{ context: ReturnType<typeof modelProfile>; open: () => void } | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { state, ready } = useAccount();
  const label = state.account?.label;
  const [stored, setStored] = useState<Profile>(emptyProfile);
  const [draft, setDraft] = useState<Profile>(emptyProfile);
  const [first, setFirst] = useState(false);
  const [notice, setNotice] = useState("");
  const modal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ready) return;
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
  }, [ready, label]);

  function persist(profile: Profile) {
    setStored(profile);
    try { if (!label) localStorage.setItem(profileKey, JSON.stringify(profile)); }
    catch { /* Keep the selection only for this screen session. */ }
    setFirst(false);
    modal.current?.close();
  }
  function open() {
    setNotice("");
    setDraft(stored);
    modal.current?.showModal();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.birth && !validBirth(draft.birth)) { setNotice("请选择有效的出生日期。"); return; }
    persist({ ...draft, custom: draft.gender === "other" ? draft.custom.trim() : "" });
  }

  return <Context.Provider value={{ open, context: modelProfile(stored) }}>
    {children}
    <dialog ref={modal} className="settings-dialog profile-dialog" data-first={first} aria-labelledby="profile-title"
      onCancel={event => { if (first) { event.preventDefault(); persist(emptyProfile); } }}>
      <div className="dialog-head">
        <h2 id="profile-title">{first ? "入山前，留个印记" : "个人资料"}</h2>
        {!first && <button className="icon-button" aria-label="关闭个人资料" onClick={() => modal.current?.close()}><X size={16} /></button>}
      </div>
      <p>愿意的话，留下生日和性别。两项都可跳过，{label ? "仅在当前页面会话使用" : "只保存在此浏览器"}。三枚铜钱始终独立随机。</p>
      <form onSubmit={submit}>
        <div className="profile-fields">
          <label>出生日期 <input type="date" aria-label="出生日期" value={draft.birth} min="1900-01-01" max={localDate()}
            onChange={event => setDraft({ ...draft, birth: event.target.value })} /></label>
          <label>性别 <select aria-label="性别" value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.target.value as Profile["gender"] })}>
            <option value="undisclosed">不愿透露</option><option value="woman">女</option><option value="man">男</option><option value="other">其他</option>
          </select></label>
        </div>
        <label className="profile-consent"><input type="checkbox" checked={draft.consent} onChange={event => setDraft({ ...draft, consent: event.target.checked })} />
          <span>允许将年龄段和性别作为本机 AI 解读的辅助语境，出生日期原值仅留在浏览器。</span></label>
        {notice && <p className="field-error" role="status">{notice}</p>}
        <div className="profile-actions">
          <button className="button secondary" type="button" onClick={() => persist(emptyProfile)}>{first ? "跳过" : "清除资料"}</button>
          <button className="button primary" type="submit">保存资料</button>
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
