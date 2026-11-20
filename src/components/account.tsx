"use client";

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, X } from "lucide-react";
import { historyKey, parseHistory } from "@/lib/history";
import type { AccountState, Progress } from "@/lib/pet-v16";

type Operation = { op: string; [field: string]: unknown };

export async function accountRequest<T>(payload?: Operation, query = ""): Promise<T> {
  const response = await fetch("/api/companion" + query, payload ?
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" } :
    { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "账号请求失败。");
  return result as T;
}

const anonymous: AccountState = { account: null, progress: null };
const Context = createContext<{
  state: AccountState; ready: boolean; show: () => void; setProgress: (value: Progress | null) => void;
  setPersonalProfile: (label: string, next: AccountState) => void;
} | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>(anonymous);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "verifyEmail" | "verifyLoginChallenge" | "sendLoginCode" |
    "verifyLoginCode" | "requestReset" | "resetPassword">("login");
  const [verifyAddress, setVerifyAddress] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionCodeSent, setDeletionCodeSent] = useState(false);
  const [importing, setImporting] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const epoch = useRef(0);
  const emailOtp = state.authMode === "email-otp";
  const hybrid = state.authMode === "password-or-email-code";
  const requestCode = mode === "sendLoginCode";
  const signInCode = mode === "verifyLoginChallenge";
  const enteringCode = signInCode || mode === "verifyEmail" || mode === "verifyLoginCode" || mode === "resetPassword";

  useEffect(() => {
    let mounted = true;
    const read = async () => {
      const version = ++epoch.current;
      try {
        const next = await accountRequest<AccountState>();
        if (!mounted || version !== epoch.current) return;
        setState(next);
      } catch {
        if (mounted && version === epoch.current) setState(anonymous);
      } finally { if (mounted) setReady(true); }
    };
    const sync = (event: StorageEvent) => { if (event.key === "wenshan.account-change") void read(); };
    window.addEventListener("storage", sync);
    void read();
    return () => { mounted = false; window.removeEventListener("storage", sync); };
  }, []);

  function show() {
    setMessage("");
    setDeleting(false);
    setDeletionCodeSent(false);
    setImporting(false);
    try { setLocalCount(parseHistory(localStorage.getItem(historyKey)).length); } catch { setLocalCount(0); }
    dialog.current?.showModal();
  }

  async function transition(payload: Operation) {
    setBusy(true);
    setMessage("");
    ++epoch.current;
    try {
      const next = await accountRequest<AccountState & { deletionCodeSent?: boolean }>(payload);
      if (next.deletionCodeSent) {
        setDeletionCodeSent(true);
        setMessage("请查收邮件并输入验证码。");
        return;
      }
      setState(next);
      setReady(true);
      setDeleting(false);
      setDeletionCodeSent(false);
      if (next.needsLoginCode) {
        setVerifyAddress(String(payload.label));
        setMode("verifyLoginChallenge");
        setMessage("请查收登录验证码，验证码验证步骤限 5 分钟。");
        return;
      }
      if (next.registrationVerified) {
        setMode("login");
        setMessage("邮箱验证成功，请输入邮箱和密码登录。");
        return;
      }
      if (next.needsConfirmation) {
        setVerifyAddress(String(payload.label));
        const loginCode = payload.op === "sendLoginCode";
        setMode(loginCode && hybrid ? "verifyLoginCode" : "verifyEmail");
        setMessage(loginCode ? "若邮箱已注册，请查收验证码。请至少等一分钟再重发。" :
          "若邮箱可以注册，请查收验证码。已有账号可返回登录。");
        return;
      }
      if (next.reset === "sent") {
        setVerifyAddress(String(payload.label));
        setMode("resetPassword");
        setMessage("若邮箱已注册，请查收重置验证码。");
        return;
      }
      setMode("login");
      try { localStorage.setItem("wenshan.account-change", String(Date.now())); } catch { /* Session still changed. */ }
      if (next.reset === "completed") { setMessage("密码已更新，请重新登录。"); return; }
      dialog.current?.close();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败。"); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const op = deleting ? "deleteAccount" : emailOtp ? mode === "verifyEmail" ? "verifyLoginCode" : "sendLoginCode" : mode;
    void transition({ op, label: enteringCode ? verifyAddress : fields.get("label"),
      password: fields.get("password"), code: fields.get("code") });
  }

  async function importGuest() {
    setBusy(true);
    try {
      const entries = parseHistory(localStorage.getItem(historyKey));
      if (!entries.length) { setMessage("此浏览器没有可导入记录。"); return; }
      await accountRequest({ op: "importHistory", entries });
      setMessage("已导入本机记录。");
      setImporting(false);
      setLocalCount(0);
    } catch (error) { setMessage(error instanceof Error ? error.message : "导入失败。"); }
    finally { setBusy(false); }
  }

  const version = epoch.current;
  const resetMode = mode === "requestReset" || mode === "resetPassword";
  return <Context.Provider value={{ state, ready, show, setProgress: progress =>
    setState(current => epoch.current === version && current.account ? { ...current, progress } : current),
    setPersonalProfile: (label, next) => setState(current => current.account?.label === label ?
      { ...current, displayName: next.displayName, personalProfile: next.personalProfile } : current) }}>
    {children}
    <dialog ref={dialog} className="settings-dialog account-dialog" aria-labelledby="account-title">
      <div className="dialog-head"><h2 id="account-title">{state.account ? "我的账号" :
        resetMode ? "重置密码" : enteringCode ? "输入邮箱验证码" : emailOtp || requestCode || mode === "login" ? "登录问山" : "创建问山账号"}</h2>
        <button type="button" className="icon-button" aria-label="关闭账号" onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      {state.account ? <>
        <p>已登录 <strong>{state.displayName || state.account.label}</strong>。结契、小屋进度和已保存的问卦记录可在同一服务的其他设备恢复。</p>
        {state.backend && !deleting && <form className="account-form" onSubmit={event => {
          event.preventDefault();
          void transition({ op: "updateProfile", displayName: new FormData(event.currentTarget).get("displayName") });
        }}>
          <label>昵称<input name="displayName" maxLength={32} defaultValue={state.displayName} /></label>
          <button className="button secondary" type="submit" disabled={busy}>保存昵称</button>
        </form>}
        {importing ? <div className="account-row">
          <p>确认这 {localCount} 条本机游客记录属于你，再导入当前账号。</p>
          <button type="button" className="button secondary" onClick={() => setImporting(false)}>取消</button>
          <button type="button" className="button primary" disabled={busy} onClick={() => void importGuest()}>确认导入本机记录</button>
        </div> : localCount > 0 && <button type="button" className="text-button" onClick={() => setImporting(true)}>导入本机记录</button>}
        {deleting ? <form className="account-form" onSubmit={submit} key="delete">
          <p>删除会清除本账号、已绑定的灵宠和问卦记录。{emailOtp ? "请用当前邮箱的验证码确认。" : "请输入当前密码确认。"}</p>
          {emailOtp ? deletionCodeSent && <EmailCodeField /> :
            <label>当前密码<input name="password" minLength={10} maxLength={128} type="password" autoComplete="current-password" required /></label>}
          <div className="account-row"><button type="button" className="button secondary" disabled={busy} onClick={() => { setDeleting(false); setDeletionCodeSent(false); setMessage(""); }}>返回</button>
            {(!emailOtp || deletionCodeSent) && <button type="submit" className="button primary" disabled={busy}>确认删除账号</button>}
            {emailOtp && <button type="button" className={deletionCodeSent ? "text-button" : "button primary"} disabled={busy}
              onClick={() => void transition({ op: "sendDeleteCode" })}>{deletionCodeSent ? "重新发送" : "发送验证码"}</button>}</div>
        </form> : <div className="account-row">
          <button type="button" className="button secondary" disabled={busy} onClick={() => void transition({ op: "logout" })}>退出登录</button>
          <button type="button" className="text-button" onClick={() => setDeleting(true)}>删除账号</button>
        </div>}
      </> : !ready ? <p role="status">正在连接账号服务……</p> : enteringCode ? <form className="account-form" onSubmit={submit} key={mode}>
        <p>{verifyAddress}</p>
        <EmailCodeField />
        {mode === "resetPassword" && <label>新密码<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>}
        <div className="account-row">
          <button className="button primary" type="submit" disabled={busy}>{mode === "resetPassword" ? "保存新密码" :
            mode === "verifyEmail" && state.authMode === "password-email-code" ? "验证邮箱" : "验证并登录"}</button>
          <button className="text-button" type="button" disabled={busy} onClick={() => { setMode("login"); setMessage(""); }}>{emailOtp ? "更换邮箱" : signInCode ? "重新登录并发送" : "返回登录"}</button>
          {(emailOtp || mode === "verifyLoginCode") && <button className="text-button" type="button" disabled={busy}
            onClick={() => void transition({ op: "sendLoginCode", label: verifyAddress })}>重新发送</button>}
        </div>
      </form> : <form className="account-form" onSubmit={submit} key={mode}>
        <p>结契后，灵宠和小屋进度随账号保存。也可以先以游客身份问卦。</p>
        {state.backend ? <label>邮箱<input name="label" type="email" autoComplete="username" maxLength={254} required /></label> :
          <label>账户名<input name="label" aria-label="账户名" autoComplete="username" minLength={3} maxLength={31} placeholder="字母或数字" required /></label>}
        {emailOtp || requestCode ? <>
          <p>用已注册的邮箱获取登录验证码。</p>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "正在发送……" : "发送验证码"}</button>
          {hybrid && <div className="account-row">
            <button type="button" className="text-button" disabled={busy} onClick={() => { setMessage(""); setMode("login"); }}>用密码登录</button>
            <button type="button" className="text-button" disabled={busy} onClick={() => { setMessage(""); setMode("register"); }}>创建账号</button>
          </div>}
        </> : <>{mode !== "requestReset" && <label>密码<input name="password" aria-label="密码" autoComplete={mode === "login" ? "current-password" : "new-password"}
          type="password" minLength={10} maxLength={128} placeholder="至少 10 位" required /></label>}
        <div className="account-row"><button type="submit" className="button primary" disabled={busy}>{busy ? "请稍候" : mode === "login" ? "登录" :
          mode === "requestReset" ? "发送验证码" : hybrid ? "发送注册验证码" : "注册账号"}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => { setMessage(""); setMode(mode === "login" ? "register" : "login"); }}>
            {mode === "login" ? "创建账号" : mode === "requestReset" ? "返回登录" : "已有账号"}
          </button>
          {state.backend && mode === "login" && <button type="button" className="text-button" disabled={busy}
            onClick={() => { setMessage(""); setMode("requestReset"); }}>忘记密码</button>}
          {hybrid && mode === "login" && <button type="button" className="text-button" disabled={busy}
            onClick={() => { setMessage(""); setMode("sendLoginCode"); }}>用验证码登录</button>}
        </div></>}
      </form>}
      {message && <p role="status" className="account-notice">{message}</p>}
    </dialog>
  </Context.Provider>;
}

function EmailCodeField() {
  return <label>邮箱验证码<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} pattern="[0-9]{6,10}" required /></label>;
}

export function useAccount() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountProvider is required");
  return value;
}

export function AccountButton() {
  const { state, show } = useAccount();
  return <button type="button" className="icon-button" aria-label={state.account ? "我的账号" : "登录问山"} onClick={show}>
    <KeyRound size={16} />
  </button>;
}
