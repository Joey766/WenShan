"use client";

import { House, Mountain, Settings2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { usePet } from "./pet-context";
import { ProfileButton } from "./profile";
import { AccountButton } from "./account";

export function Seal({ small = false }: { small?: boolean }) {
  return <span className={`seal ${small ? "seal-small" : ""}`} aria-hidden="true"><Mountain size={small ? 16 : 23} strokeWidth={1.6} /></span>;
}

export function Header() {
  const { reduced, motion, systemMotion, setMotionPreference } = usePet();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  return (
    <header className="site-header">
      <div className="frame header-inner">
        <a href="/" className="brand" aria-label="问山首页"><Seal /><span className="wordmark">问山</span><span className="brand-divider" /><span className="brand-caption">山海易经</span></a>
        <nav className="header-nav" aria-label="主导航">
          <a className="nav-item" href="/"><Mountain size={16} /><span>山海入口</span></a>
          <a className="nav-item pet-home-link" aria-label="我的灵宠" href="/pet-home"><House size={16} /><span>我的灵宠</span></a>
          <ProfileButton />
          <AccountButton />
          <button type="button" className="icon-button" aria-label="体验设置" onClick={() => dialog.current?.showModal()}><Settings2 size={17} /></button>
        </nav>
      </div>
      <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title">
        <div className="dialog-head"><h2 id="settings-title">体验设置</h2><button className="icon-button" aria-label="关闭设置" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
        <label className="switch-row"><span><strong>减少动画</strong><small>{systemMotion ? "设备已启用减少动画" : "跳过镜头推进与抛币动画"}</small></span>
          <input type="checkbox" checked={reduced} disabled={systemMotion} onChange={() => setMotionPreference(!motion)} />
        </label>
      </dialog>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="frame footer-inner"><span><Seal small /> 问山</span><p>以卦观心 · 易经文化体验</p><span className="footer-note">仅供文化体验与自我反思</span></div>
    </footer>
  );
}
