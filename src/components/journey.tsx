"use client";

import { Check, Coins as CoinIcon, Mountain, ScrollText, SkipForward } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { clearReadings, historyKey, parseHistory, saveReading, type SavedReading } from "@/lib/history";
import type { Message } from "@/lib/interpretation";
import { pets, type Pet } from "@/lib/pets";
import { getReading, tossCoins, type Coins } from "@/lib/yijing";
import type { Progress } from "@/lib/pet-v16";
import { Divination } from "./divination";
import { Entrance } from "./entrance";
import { HexagramGlyph } from "./hexagram";
import { usePet } from "./pet-context";
import { ReadingScene } from "./reading";
import { HistoryDialog } from "./history-dialog";
import { World } from "./world";
import { accountRequest, useAccount } from "./account";

const acts = [
  { title: "山海入口", icon: Mountain }, { title: "问心台", icon: CoinIcon }, { title: "观卦阁", icon: ScrollText },
] as const;
const fogDuration = 1380;
const roadDuration = 2260;

function alignEntranceRoad(scene: HTMLElement) {
  const image = scene.querySelector<HTMLImageElement>(".world-0 .world-plate img");
  if (!image?.naturalWidth || !image.clientWidth) return;
  const portrait = image.currentSrc.includes("scene-0-portrait.webp");
  const width = image.clientWidth;
  const height = image.clientHeight;
  const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const fittedWidth = image.naturalWidth * cover;
  const fittedHeight = image.naturalHeight * cover;
  const origin = (height - fittedHeight) * (portrait ? .55 : .5) + fittedHeight * .522;
  const offset = (x: number, zoom: number) => {
    const shift = (.5 - x) * fittedWidth * zoom;
    const visibleMargin = width * (zoom - 1) * .46;
    return Math.max(-visibleMargin, Math.min(visibleMargin, shift)) + "px";
  };
  scene.style.setProperty("--road-eye", (Math.max(.36, Math.min(.68, origin / height)) * 100) + "%");
  scene.style.setProperty("--road-near", offset(portrait ? .52 : .512, 1.11));
  scene.style.setProperty("--road-bend", offset(portrait ? .682 : .556, 1.77));
  scene.style.setProperty("--road-tip", offset(portrait ? .592 : .535, 2.14));
}

export function JourneyEntry() {
  const { state } = useAccount();
  return <Journey key={state.account?.label ?? "guest"} />;
}

function Journey() {
  const { pet, choose, reduced } = usePet();
  const { state, ready, setProgress } = useAccount();
  const [act, setAct] = useState(0);
  const [question, setQuestion] = useState("");
  const [casts, setCasts] = useState<Coins[]>([]);
  const [guide, setGuide] = useState<Pet>();
  const [resume, setResume] = useState<SavedReading>();
  const [entries, setEntries] = useState<SavedReading[]>([]);
  const record = useRef<{ id: string; createdAt: number; question?: string } | undefined>(undefined);
  const [historyError, setHistoryError] = useState("");
  const history = useRef<HTMLDialogElement>(null);
  const [passage, setPassage] = useState<"enter" | "reading" | null>(null);
  const nextAct = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const main = useRef<HTMLElement>(null);
  const cameraFrame = useRef(0);
  const companion = guide ?? pet;
  const currentAct = companion ? act : 0;
  const opening = !!passage;
  const account = state.account?.label;

  useEffect(() => {
    if (account && pet) void accountRequest<{ progress: Progress }>({ op: "visit" }).then(result =>
      setProgress(result.progress)).catch(() => undefined);
  }, [account, pet?.id]);

  function showAct(target: number) {
    setAct(target);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function clearPassage() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (nextAct.current !== null) showAct(nextAct.current);
    nextAct.current = null;
    setPassage(null);
  }

  function travel(target: 1 | 2) {
    if (nextAct.current !== null) return;
    if (target === 1 && pet) setGuide(pet);
    if (reduced) { showAct(target); return; }
    const road = target === 1;
    if (road && main.current) alignEntranceRoad(main.current);
    const duration = road ? roadDuration : fogDuration;
    nextAct.current = target;
    setPassage(road ? "enter" : "reading");
    timers.current = [
      setTimeout(() => showAct(target), duration * (road ? .737 : .56)),
      setTimeout(clearPassage, duration),
    ];
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (main.current && ((device.deviceMemory !== undefined && device.deviceMemory <= 4) ||
        (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 4) || device.connection?.saveData)) {
      main.current.dataset.quality = "lite";
    }
    const upcoming: HTMLImageElement[] = [];
    const preload = window.setTimeout(() => {
      const portrait = matchMedia("(max-aspect-ratio: 4/5)").matches ? "-portrait" : "";
      for (const scene of [1, 2]) {
        const image = new Image();
        image.fetchPriority = "low";
        image.src = `/art/world/scene-${scene}${portrait}.webp`;
        upcoming.push(image);
        void image.decode().catch(() => undefined);
      }
    }, 260);
    const change = () => {
      if (main.current) main.current.dataset.hidden = document.hidden ? "true" : "false";
    };
    document.addEventListener("visibilitychange", change);
    return () => {
      document.removeEventListener("visibilitychange", change);
      cancelAnimationFrame(cameraFrame.current);
      window.clearTimeout(preload);
      upcoming.length = 0;
    };
  }, []);
  useEffect(() => {
    if (!currentAct || opening) return;
    main.current?.querySelector<HTMLElement>("#act-title")?.focus({ preventScroll: true });
  }, [currentAct, opening]);

  function restart() {
    setQuestion("");
    setCasts([]);
    setGuide(undefined);
    setResume(undefined);
    record.current = undefined;
    showAct(0);
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }
  async function openHistory() {
    if (!ready) return;
    setHistoryError("");
    setEntries([]);
    history.current?.showModal();
    try {
      setEntries(account ? (await accountRequest<{ entries: SavedReading[] }>(undefined, "?history=1")).entries :
        parseHistory(localStorage.getItem(historyKey)));
    } catch { setHistoryError("暂时无法读取问卦记录。"); }
  }

  async function clearHistory() {
    if (account) await accountRequest({ op: "clearHistory" });
    else clearReadings();
    setEntries([]);
  }
  function openEntry(entry: SavedReading) {
    if (!pet) choose(entry.pet);
    setGuide(pet);
    setQuestion(entry.question);
    setCasts(entry.casts);
    setResume(entry);
    record.current = { id: entry.id, createdAt: entry.createdAt, question: entry.question };
    showAct(2);
  }
  async function getCoins() {
    if (!account) return tossCoins();
    const text = question.trim();
    if (!record.current || !casts.length && record.current.question !== text) {
      record.current = { id: crypto.randomUUID(), createdAt: Date.now(), question: text };
    }
    const result = await accountRequest<{ coins: Coins; progress: Progress }>({
      op: "cast", id: record.current.id, question: text, index: casts.length,
    });
    setProgress(result.progress);
    return result.coins;
  }

  async function saveEntry(messages: Message[]) {
    if (!companion || casts.length !== 6) return "暂时无法保存这条记录";
    record.current ??= { id: crypto.randomUUID(), createdAt: Date.now() };
    const entry = { id: record.current.id, createdAt: record.current.createdAt, pet: companion.id,
      question: question.trim(), background: resume?.background ?? "", casts, messages };
    try {
      if (account) {
        await accountRequest({ op: "saveHistory", entries: [entry] });
        return "已保存到账号";
      }
      saveReading(entry);
      return "已保存到此浏览器";
    } catch { return account ? "账号记录未能保存，请重试" : "浏览器未允许本地保存"; }
  }
  const travelReading = passage === "reading" && casts.length === 6 ? getReading(casts) : null;
  function look(event: PointerEvent<HTMLElement>) {
    if (reduced || event.pointerType === "touch" || opening || cameraFrame.current) return;
    const x = event.clientX / window.innerWidth - .5;
    const y = event.clientY / window.innerHeight - .5;
    cameraFrame.current = requestAnimationFrame(() => {
      main.current?.style.setProperty("--look-x", `${(x * 15).toFixed(2)}px`);
      main.current?.style.setProperty("--look-y", `${(y * 10).toFixed(2)}px`);
      cameraFrame.current = 0;
    });
  }

  return (
    <main ref={main} tabIndex={-1} className={`journey journey-${currentAct} ${opening ? "journey-passage" : ""}`}
      data-passage={passage ?? undefined} style={{ "--road-time": roadDuration + "ms" } as CSSProperties}
      onPointerMove={look} onPointerLeave={() => { main.current?.style.setProperty("--look-x", "0px"); main.current?.style.setProperty("--look-y", "0px"); }}>
      <World key={currentAct} scene={currentAct} />
      <nav className="frame journey-rail" aria-label="问山旅程">
        <ol>
          {acts.map(({ title, icon: Icon }, i) => <li key={title} className={`rail-step ${i === currentAct ? "rail-current" : ""} ${i < currentAct ? "rail-complete" : ""}`} aria-current={i === currentAct ? "step" : undefined}>
            <span className="rail-icon">{i < currentAct ? <Check size={15} /> : <Icon size={15} />}</span>
            <span>{title}</span>
          </li>)}
        </ol>
      </nav>
      {currentAct === 0 && <Entrance enter={() => travel(1)} leaving={passage === "enter"} openHistory={() => void openHistory()} />}
      {currentAct < 2 && <div className="cast-host" data-visible={currentAct === 1} inert={currentAct !== 1 || opening}>
        <Divination pet={companion ?? pets[0]} visible={currentAct === 1} question={question} setQuestion={setQuestion}
          casts={casts} addCast={result => setCasts(items => items.length < 6 ? [...items, result] : items)}
          proceed={() => travel(2)} reduced={reduced} getCoins={getCoins} />
      </div>}
      {currentAct === 2 && companion && <ReadingScene key={resume?.id ?? "current"} pet={companion} question={question.trim()}
        casts={casts} restart={restart} saved={resume?.messages} save={saveEntry} />}
      <HistoryDialog dialog={history} entries={entries} openEntry={openEntry} onClear={clearHistory} signedIn={!!account} error={historyError} />
      {passage && <div className={`cloud-passage passage-${passage}`} aria-label="场景转场">
        <div className="passage-ink" /><div className="passage-fog fog-near" /><div className="passage-fog fog-far" />
        {travelReading && <div className="rising-glyph"><HexagramGlyph lines={travelReading.original.lines} moving={travelReading.moving} /></div>}
        <button type="button" className="button secondary passage-skip" onClick={clearPassage}><SkipForward size={15} /> 跳过转场</button>
      </div>}
    </main>
  );
}
