"use client";

import { useRef, useState } from "react";
import { accountRequest, useAccount } from "./account";
import type { Pet } from "@/lib/pets";
import type { Progress } from "@/lib/pet-v16";

export function BindPet({ pet }: { pet?: Pet }) {
  const { setProgress } = useAccount();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function bind() {
    if (!pet || busy) return;
    setBusy(true);
    try {
      const result = await accountRequest<{ progress: Progress }>({ op: "bind", pet: pet.id });
      setProgress(result.progress);
      dialog.current?.close();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "结契失败。"); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="button primary world-primary" disabled={!pet} onClick={() => {
      setError("");
      dialog.current?.showModal();
    }}>与它结契</button>
    <dialog className="settings-dialog" ref={dialog} aria-labelledby="bind-title">
      <div className="dialog-head"><h2 id="bind-title">与{pet?.name}结契</h2></div>
      <p>结契后，{pet?.name}会长期陪你问卦，也会在自己的小屋里等你。请确认这就是你选中的灵宠。</p>
      <div className="account-row">
        <button type="button" className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>再看看</button>
        <button type="button" className="button primary" disabled={busy} onClick={() => void bind()}>确认结契</button>
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
    </dialog>
  </>;
}
