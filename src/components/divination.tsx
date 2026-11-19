"use client";

import dynamic from "next/dynamic";
import { ArrowRight, CircleDot, RotateCw, SkipForward, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { coinFace, lineFromCoins, type Coins } from "@/lib/yijing";
import type { Pet } from "@/lib/pets";
import { SceneCompanion } from "./pet-art";
import { LineBoard } from "./hexagram";

const CoinStage = dynamic(() => import("./coin-stage"), { ssr: false });
const tossDuration = 1740;

export function Divination({ pet, visible, question, setQuestion, casts, addCast, proceed, reduced, getCoins }: {
  pet: Pet; question: string; setQuestion: (text: string) => void; casts: Coins[];
  addCast: (result: Coins) => void; proceed: () => void; reduced: boolean;
  visible: boolean; getCoins: () => Promise<Coins>;
}) {
  const [pending, setPending] = useState<Coins>();
  const [started, setStarted] = useState<number>();
  const [validation, setValidation] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [castError, setCastError] = useState("");
  const requestingRef = useRef(false);
  const active = useRef<Coins | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = casts.at(-1);
  const lastLine = last && lineFromCoins(last);
  const complete = casts.length === 6;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function settle() {
    const result = active.current;
    if (!result) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    active.current = null;
    setPending(undefined);
    setStarted(undefined);
    addCast(result);
  }

  async function throwCoins(event: FormEvent) {
    event.preventDefault();
    if (active.current || requestingRef.current || complete) return;
    if (!question.trim()) {
      setValidation(true);
      document.getElementById("question")?.focus();
      return;
    }
    requestingRef.current = true;
    setRequesting(true);
    setCastError("");
    try {
      const result = await getCoins();
      if (reduced) { addCast(result); return; }
      active.current = result;
      setPending(result);
      setStarted(performance.now());
      timer.current = setTimeout(settle, tossDuration);
    } catch (failure) { setCastError(failure instanceof Error ? failure.message : "投掷失败，请再试一次。"); }
    finally { requestingRef.current = false; setRequesting(false); }
  }

  return (
    <div className="world-cast" data-drawing={!!pending}>
      <div className="scene-heading">
        <div className="world-kicker"><i /> 三钱起卦</div>
        <h1 tabIndex={-1} id="act-title">问心台</h1>
        <p>投三枚铜钱，六次成卦。</p>
      </div>
        <form id="casting-form" className="paper casting-form" onSubmit={throwCoins}>
          <div className="field"><label htmlFor="question">心里的问题</label>
            <textarea id="question" value={question} maxLength={240} rows={2} readOnly={casts.length > 0 || !!pending || requesting}
              onChange={event => { setQuestion(event.target.value); setValidation(false); }}
              placeholder="例如：我今天运气好吗？" aria-invalid={validation} aria-describedby={validation ? "question-error" : undefined} />
            {validation && <p className="field-error" id="question-error">先写下你想问的一件事。</p>}
            {castError && <p className="field-error" role="alert">{castError}</p>}
          </div>
        </form>
        <div className="terrace">
          <img className="world-ring" src="/art/world/ring.webp" alt="" />
          <CoinStage coins={pending ?? last} started={started} reduced={reduced} />
          {visible && <SceneCompanion className="scene-pet" pet={pet} label={pet.name}
            pose={pending ? "watch" : "idle"} />}
          {pending && <button type="button" className="ghost-button toss-skip" onClick={settle}><SkipForward size={14} /> 直接看结果</button>}
        </div>
        <div className="cast-controls">
          {complete ? <button type="button" className="button primary" onClick={proceed}><Sparkles size={17} /> 卦成，前往观卦阁 <ArrowRight size={16} /></button> :
            <button type="submit" form="casting-form" className="button primary" disabled={!!pending || requesting}><CircleDot size={17} /> {requesting ? "准备铜钱" : pending ? "铜钱飞起" : casts.length ? `第 ${casts.length + 1} 次投掷` : "掷下第一爻"}</button>}
          {!pending && last && lastLine && <span className="mobile-result" aria-hidden="true">
            {last.map(coin => coinFace[coin][0] + coin).join(" · ")}　{lastLine.value} {lastLine.name}{lastLine.moving ? " · 动爻" : ""}
          </span>}
        </div>
        <section className="paper cast-card" aria-labelledby="cast-title">
          <div className="card-heading"><h2 id="cast-title">六爻</h2><span className="cast-count"><b>{casts.length}</b> / 6</span></div>
          <p className="muted micro">由初爻起，自下向上</p>
          <LineBoard lines={casts.map(lineFromCoins)} />
          <div className="cast-result" aria-live="polite" aria-atomic="true">
            {pending ? <span className="result-wait"><RotateCw size={15} /> 铜钱正在翻转</span> : last && lastLine ? <>
              <span className="result-title">第 {casts.length} 掷 <b>{lastLine.value} · {lastLine.name}{lastLine.moving ? " · 动爻" : ""}</b></span>
              <div className="coin-values">{last.map((coin, i) => <span key={i} data-coin={coin}>{coinFace[coin]} <b>{coin}</b></span>)}</div>
            </> : <span className="muted">正面 3，反面 2。三枚面值相加定爻。</span>}
          </div>
          {casts.length > 1 && <details className="toss-history"><summary>查看每掷面值</summary>
            <ol>{casts.map((coins, i) => <li key={i}><span>第 {i + 1} 掷</span><span>{coins.join(" + ")} = {lineFromCoins(coins).value}</span></li>)}</ol>
          </details>}
        </section>
    </div>
  );
}
