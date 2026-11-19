"use client";

import { ArrowRight, ScrollText, Trash2, X } from "lucide-react";
import { useState, type RefObject } from "react";
import type { SavedReading } from "@/lib/history";
import { getReading } from "@/lib/yijing";

export function HistoryDialog({ dialog, entries, openEntry, onClear, signedIn, error }: {
  dialog: RefObject<HTMLDialogElement | null>;
  entries: SavedReading[];
  openEntry: (entry: SavedReading) => void;
  onClear: () => Promise<void>; signedIn: boolean; error: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);

  return <dialog className="settings-dialog history-dialog" ref={dialog} onClose={() => { setConfirm(false); setFailed(false); }} aria-labelledby="history-title">
    <div className="dialog-head"><h2 id="history-title">问卦记录</h2><button type="button" className="icon-button" aria-label="关闭问卦记录" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
    <p className="history-explain">{signedIn ? "你手动保存的问卦会留在当前账号。" : "你手动保存的问题、起卦和对话会留在此浏览器。"}</p>
    {entries.length ? <>
      <ul className="history-list">
        {entries.map(entry => {
          const result = getReading(entry.casts);
          const date = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(entry.createdAt);
          return <li key={entry.id}><button type="button" onClick={() => { dialog.current?.close(); openEntry(entry); }}>
            <ScrollText size={17} aria-hidden="true" />
            <span><strong>{entry.question}</strong><small>{date} · {result.original.title}{result.moving.length ? ` → ${result.relating.title}` : ""}</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button></li>;
        })}
      </ul>
      {confirm ? <div className="clear-confirm"><p>清除后，{signedIn ? "当前账号" : "当前浏览器"}中的问卦记录将被移除。</p><div>
        <button type="button" className="button secondary" onClick={() => setConfirm(false)}>取消</button>
        <button type="button" className="button primary" onClick={() => {
          void onClear().then(() => setConfirm(false)).catch(() => setFailed(true));
        }}>确认清除</button>
      </div></div> :
        <button type="button" className="text-button history-clear" onClick={() => setConfirm(true)}><Trash2 size={15} /> 清除记录</button>}
    </> : <p className="muted history-empty">暂无记录。卦成后可在观卦阁保存。</p>}
    {(failed || error) && <p className="field-error" role="status">{error || "暂时无法清除记录。"}</p>}
  </dialog>;
}
