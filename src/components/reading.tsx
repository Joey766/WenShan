
"use client";

import { ArrowRight, ArrowUpRight, Bookmark, BookOpenText, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { demoReading, fortuneFromCast, judgementPhrases, preparedDetails, type Message, type ReadingAnswer,
  type ReadingDetails, type ReadingEvent, type ReadingPhase, type ReadingRequest } from "@/lib/interpretation";
import { readingEvidence } from "@/lib/knowledge";
import type { Pet } from "@/lib/pets";
import { getReading, type Coins } from "@/lib/yijing";
import { HexagramGlyph } from "./hexagram";
import { SceneCompanion } from "./pet-art";
import { useProfile } from "./profile";
import { accountRequest, useAccount } from "./account";

const activity = {
  identifying: "正在识别卦象",
  checking: "正在准备解读",
  connecting: "正在据卦起意",
  explaining: "正在生成白话解读",
};

async function ask(input: ReadingRequest, signal: AbortSignal, update: (event: ReadingEvent) => void): Promise<ReadingAnswer> {
  try {
    const response = await fetch("/api/reading", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify(input), signal,
    });
    if (response.ok && response.body) {
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const event = JSON.parse(line) as ReadingEvent;
            if ("answer" in event) return event.answer;
            update(event);
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return demoReading(input);
}


type Tab = "classics" | "analysis";
const sampleKey = "wenshan.fortune-timing.v1";
function timingSamples(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(sampleKey) ?? "[]") as unknown;
    if (Array.isArray(saved)) return saved.filter(n => typeof n === "number" && n > 0 && n < 116).slice(-5);
  } catch { /* Timing is optional. */ }
  return [];
}

function estimateText(start: number, elapsed: number, measured: boolean) {
  const prefix = measured ? "按近期耗时" : "粗略估计";
  if (elapsed >= start * 1.27) return "比预计久，仍在生成";
  const lower = Math.max(5, Math.round(start * .72 - elapsed));
  const upper = Math.max(lower + 5, Math.round(start * 1.27 - elapsed));
  return prefix + "还需约 " + lower + "–" + upper + " 秒";
}


const sectionTitles = new Set(["卦象依据", "大白话"]);
function AnswerCopy({ text }: { text: string }) {
  return text.split(/\n+/).filter(Boolean).map((line, index) => <p key={index}
    className={sectionTitles.has(line) ? "reading-subtitle" : index === 0 ? "reading-lead" : undefined}>{line}</p>);
}

export function ReadingScene({ pet, question, casts, restart, saved, save }: {
  pet: Pet; question: string; casts: Coins[]; restart: () => void;
  saved?: Message[]; save: (messages: Message[]) => Promise<string>;
}) {
  const result = getReading(casts);
  const { original, relating, moving, specialText } = readingEvidence(result);
  const [tab, setTab] = useState<Tab>("analysis");
  const [pose, setPose] = useState<"idle" | "thinking" | "reading" | "happy">("idle");
  const [phase, setPhase] = useState<ReadingPhase | "cancelled" | null>(null);
  const [answer, setAnswer] = useState<ReadingAnswer>();
  const [draft, setDraft] = useState("");
  const [timing, setTiming] = useState<{ began: number; typical: number; measured: boolean }>();
  const [elapsed, setElapsed] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [gloss, setGloss] = useState<ReadingDetails>();
  const [glossWaiting, setGlossWaiting] = useState(false);
  const [glossStatus, setGlossStatus] = useState("");
  const active = useRef<AbortController>(null);
  const activeGloss = useRef<AbortController>(null);
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabBody = useRef<HTMLDivElement>(null);
  const profile = useProfile();
  const { state: account, show: showAccount } = useAccount();
  const profileRef = useRef(profile.context);
  profileRef.current = profile.context;
  const busy = phase !== null && phase !== "cancelled";
  const archived = saved?.find((item): item is Extract<Message, { role: "assistant" }> => item.role === "assistant");
  const current = answer ?? (archived ? {
    mode: archived.mode, text: archived.content, fallbackSections: archived.fallbackSections,
  } : undefined);
  const curated = preparedDetails(result);
  const details = curated ?? gloss ?? archived?.details;
  const glossSource = curated ? "编者白话" : "AI 白话";
  const cloudNotice = answer?.notice;
  const quotaReached = cloudNotice === "cloud-quota" || cloudNotice === "cloud-account-quota";
  const canRetry = !quotaReached && (phase === "cancelled" || current?.mode === "demo");
  const initialJudgement = fortuneFromCast({ question, coins: casts }, result).directAnswer;

  useEffect(() => {
    if (!timing) return;
    const update = () => setElapsed(Math.floor((performance.now() - timing.began) / 1000));
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [timing]);

  async function run(cloudConsent = false) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setAnswer(undefined);
    setDraft("");
    setPhase("identifying");
    setPose("thinking");
    setSaveStatus("");
    const samples = timingSamples();
    const ordered = samples.slice().sort((a, b) => a - b);
    const began = performance.now();
    setElapsed(0);
    setTiming({ began, typical: ordered[Math.floor(ordered.length / 2)] ?? 22, measured: !!samples.length });
    clearTimeout(poseTimer.current ?? undefined);
    try {
      const input = cloudConsent ? { question, coins: casts, cloudConsent: true } : { question, coins: casts, profile: profileRef.current };
      if (cloudConsent) {
        await accountRequest().catch(() => undefined);
        controller.signal.throwIfAborted();
      }
      const next = await ask(input, controller.signal, event => {
        if (controller.signal.aborted) return;
        if ("phase" in event) setPhase(event.phase);
        if ("delta" in event) setDraft(text => text + event.delta);
      });
      if (controller.signal.aborted) return;
      if (next.mode !== "demo") {
        const seconds = (performance.now() - began) / 1000;
        try { localStorage.setItem(sampleKey, JSON.stringify([...samples, seconds].slice(-5))); }
        catch { /* Timing is optional. */ }
      }
      setAnswer(next);
      setDraft("");
      setTiming(undefined);
      setPhase(null);
      setPose("reading");
      poseTimer.current = setTimeout(() => setPose("happy"), 1330);
    } catch { /* A cancelled reading does not create a history entry. */ }
    finally { if (active.current === controller) active.current = null; }
  }

  useEffect(() => {
    const wait = saved?.some(item => item.role === "assistant") ? undefined : setTimeout(() => { void run(); }, 125);
    return () => {
      clearTimeout(wait);
      active.current?.abort();
      active.current = null;
      activeGloss.current?.abort();
      activeGloss.current = null;
      clearTimeout(poseTimer.current ?? undefined);
    };
  }, [casts, question, saved]);

  async function fetchGlosses() {
    if (activeGloss.current) return;
    const controller = new AbortController();
    activeGloss.current = controller;
    setGlossWaiting(true);
    setGlossStatus("");
    try {
      if (account.backend && account.account) await accountRequest().catch(() => undefined);
      const response = await fetch("/api/reading", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "classics", coins: casts }), signal: controller.signal,
      });
      const data = response.ok ? await response.json() as { details?: ReadingDetails; notice?: string } : {};
      if (controller.signal.aborted) return;
      if (data.details) setGloss(data.details);
      else if (data.notice === "cloud-quota" || data.notice === "cloud-account-quota")
        setGlossStatus("云端 AI 调用额度已达上限，可继续核对经文与编者释意。");
      else if (data.notice === "cloud-sign-in") setGlossStatus("登录后可查看云端 AI 逐句白话。经文与编者释意仍可阅读。");
      else setGlossStatus("逐句白话暂不可用，仍可核对经文与编者释意。");
    } catch {
      if (!controller.signal.aborted) setGlossStatus("逐句白话暂不可用，仍可核对经文与编者释意。");
    } finally {
      if (activeGloss.current === controller) { activeGloss.current = null; setGlossWaiting(false); }
    }
  }

  function cancel() {
    active.current?.abort();
    active.current = null;
    setDraft("");
    setTiming(undefined);
    setPhase("cancelled");
    setPose("idle");
  }
  function select(next: Tab) {
    setTab(next);
    tabBody.current?.scrollTo(0, 0);
  }
  function tabKey(event: KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = tab === "classics" ? "analysis" : "classics";
    select(next);
    document.getElementById("scroll-tab-" + next)?.focus();
  }
  async function saveAnswer() {
    if (!current) return;
    const messages: Message[] = answer ? [{ role: "assistant", mode: answer.mode, content: answer.text, fallbackSections: answer.fallbackSections }] : saved ?? [];
    setSaveStatus(await save(messages));
  }

  return (
    <section className="world-reading">
      <div className="scene-heading">
        <div className="world-kicker"><i /> 展卷观卦</div>
        <h1 tabIndex={-1} id="act-title">观卦阁</h1>
        <p>{moving.length ? moving.length + " 爻有变 · 请展卷" : "六爻皆静 · 请展卷"}</p>
      </div>
      <SceneCompanion className="pavilion-pet" pet={pet} pose={pose}
        label={pet.name + " · " + (pose === "thinking" ? "在想" : pose === "reading" ? "看古卷" : pose === "happy" ? "解读已呈上" : "候卷")}>
        {pose === "reading" && <ArrowUpRight className="scroll-gesture" aria-hidden="true" />}
      </SceneCompanion>
      <div className="world-scroll" id="scroll" aria-label="问卦长卷">
        <header className="world-scroll-head">
          <div className="world-kicker"><i /> 本次所问</div>
          <div className="world-scroll-question"><h2>{question}</h2></div>
          <div className="world-scroll-tabs" role="tablist" aria-label="长卷章节" onKeyDown={tabKey}>
            <button type="button" role="tab" id="scroll-tab-analysis" aria-controls="scroll-analysis" aria-selected={tab === "analysis"}
              tabIndex={tab === "analysis" ? 0 : -1} onClick={() => select("analysis")}><Sparkles size={14} /> 卦象判断</button>
            <button type="button" role="tab" id="scroll-tab-classics" aria-controls="scroll-classics" aria-selected={tab === "classics"}
              tabIndex={tab === "classics" ? 0 : -1} onClick={() => select("classics")}><BookOpenText size={14} /> 经文与白话</button>
          </div>
        </header>
        <div ref={tabBody} className="world-scroll-body" tabIndex={0} aria-label="长卷阅读区域">
          <section id="scroll-analysis" role="tabpanel" aria-labelledby="scroll-tab-analysis" hidden={tab !== "analysis"}>
            <div className="reading-cast-summary" aria-label="本次起卦">
              <span>本卦 · {original.name}</span>
              <span>{moving.length ? "动爻 · " + moving.map(line => line.label).join("、") : "六爻皆静"}</span>
              <span>变卦 · {relating.name}</span>
            </div>
            <div className={"message message-assistant" + (busy ? " stream-draft" : "")}
              data-testid={busy && draft ? "reading-draft" : undefined}>
              <span className="message-label">{current ? current.mode === "cloud" ? "云端 AI · Gemini" :
                current.mode === "local" ? "本地 AI · Ollama" : "演示模式 · Mock" : "卦象已定"}</span>
              {!!current?.fallbackSections && <small className="muted"> · {current.fallbackSections} 节使用内置释意</small>}
              <AnswerCopy text={current?.text ?? (draft || initialJudgement)} />
            </div>
            {answer?.notice === "cloud-consent" && <p className="muted">
              可选用 Gemini 解读。本次问题和卦象会发送给 Google。免费服务可能使用内容改进产品，请勿发送私人信息。
            </p>}
            {cloudNotice === "cloud-sign-in" && <p role="status" className="muted">请登录已验证邮箱的账号，再选择是否使用 Gemini。</p>}
            {cloudNotice === "cloud-quota" && <p role="status" className="muted">网站云端 AI 调用额度已达上限。当前显示内置释意。</p>}
            {cloudNotice === "cloud-account-quota" && <p role="status" className="muted">本账号的云端 AI 调用额度已达上限。当前显示内置释意。</p>}
            {answer?.notice === "cloud-unavailable" && <p role="status" className="muted">云端 AI 暂不可用。当前显示内置释意。</p>}
          </section>
          <section id="scroll-classics" role="tabpanel" aria-labelledby="scroll-tab-classics" hidden={tab !== "classics"}>
            <div className="hexagram-comparison">
              <div><span>本卦 · 第 {original.number} 卦</span><HexagramGlyph lines={original.lines} moving={result.moving} /><h3>{original.title}</h3><small>{original.upper}上 · {original.lower}下</small></div>
              <ArrowRight size={17} aria-hidden="true" />
              <div><span>变卦 · 第 {relating.number} 卦</span><HexagramGlyph lines={relating.lines} /><h3>{relating.title}</h3><small>{relating.upper}上 · {relating.lower}下</small></div>
            </div>
            <div className="classics">
              <h3>本卦卦辞</h3>
              {judgementPhrases(original.classical.judgement).map((line, i) => <div className="text-pair" key={i}>
                <blockquote>{line}</blockquote>
                {details?.phrases[i] && <p><b>{glossSource}</b> {details.phrases[i]}</p>}
              </div>)}
              <p className="plain-reading"><strong>编者释意</strong>　{original.commentary.plain}</p>
              {!curated && details?.theme && <p><strong>AI 象意</strong>　{details.theme}</p>}
              {!details && <button type="button" className="text-button" disabled={glossWaiting} onClick={fetchGlosses}>{glossWaiting ? "正在逐句释读…" : "查看逐句白话"}</button>}
              {glossStatus && <p className="muted" role="status">{glossStatus}</p>}
              <h3>动爻与爻辞</h3>
              {moving.length ? <ul className="moving-text">{moving.map((line, i) => <li key={line.position}>
                {line.text} <small>{line.from ? "阳变阴" : "阴变阳"}</small>
                {details?.lines[i] && <p className="line-gloss"><strong>{glossSource}</strong>　{details.lines[i]}</p>}
              </li>)}</ul> : <p>六爻皆静，变卦与本卦相同。</p>}
              {specialText && <><h3>全动附文</h3><blockquote>{specialText}</blockquote></>}
              {!!moving.length && <><h3>变卦卦辞</h3><blockquote>{relating.classical.judgement}</blockquote>
                <p><strong>变化主题</strong>　{details?.relating ?? relating.commentary.plain}</p></>}
              <details><summary>展开全部六条爻辞</summary><ol>{original.classical.lines.map(line => <li key={line}>{line}</li>)}</ol></details>
              <div className="source-links"><a href={original.classical.source} target="_blank" rel="noreferrer">维基文库 · 本卦原文</a>
                {!!moving.length && <a href={relating.classical.source} target="_blank" rel="noreferrer">变卦原文</a>}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">社区经文整理许可</a></div>
            </div>
          </section>


        </div>
        <footer className="world-scroll-foot">
          <div className="reading-activity">
            {busy && phase && <><span role="status">{activity[phase]}</span>
              {timing && <small className="reading-estimate">{estimateText(timing.typical, elapsed, timing.measured)}</small>}
              <button type="button" className="text-button" onClick={cancel}><X size={14} /> 取消</button></>}
            {phase === "cancelled" && <span>已取消本次解读。</span>}
            {canRetry && !busy && <button type="button" className="text-button" onClick={() => {
              select("analysis");
              if (cloudNotice && !account.account) showAccount();
              else void run(Boolean(cloudNotice));
            }}>
              <RefreshCw size={14} /> {cloudNotice ? !account.account ? "登录后使用 Gemini" : "发送本次问题给 Gemini" : "重试本地 AI"}</button>}
          </div>
          <div className="reading-actions">
            <button className="button secondary" onClick={restart}><RotateCcw size={14} /> 再问一卦</button>
            <span className="muted micro" role="status">{saveStatus}</span>
            <button className="button secondary" disabled={busy || !current} onClick={saveAnswer}><Bookmark size={14} /> 保存本次问卦</button>
          </div>
          <p className="reading-disclaimer">传统文化娱乐体验，非现实预测</p>
        </footer>
      </div>
    </section>
  );
}
