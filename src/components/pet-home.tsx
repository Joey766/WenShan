"use client";

import { ArrowLeft, Heart, LockKeyhole, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { pets, type PetId } from "@/lib/pets";
import { canDecorate, decorItems, forms, growthPhase, homes, propsRoot,
  type Decoration, type Form, type Progress } from "@/lib/pet-v16";
import { accountRequest, useAccount } from "./account";
import { usePet } from "./pet-context";
import { PetArt } from "./pet-art";
import { BindPet } from "./bind-pet";
import { roomCueDuration, toyMotions, toyPosition, type RoomCue, type RoomMove, type Toy } from "./room-interaction";

const tabs = [{ id: "daily", name: "陪伴" }, { id: "dress", name: "布置" }] as const;
type Tab = typeof tabs[number]["id"];
const rollingBall = "shared_rolling_ball";
const cushion = "shared_soft_cushion";

export function PetHome() {
  const { state } = useAccount();
  return <Room key={state.account?.label ?? "guest"} />;
}

function Room() {
  const { state, setProgress } = useAccount();
  const { pet, reduced } = usePet();
  const [preview, setPreview] = useState<PetId>();
  const [tab, setTab] = useState<Tab>("daily");
  const [shapePreview, setShapePreview] = useState<Form>("normal");
  const [decorPreview, setDecorPreview] = useState<Decoration | null>(null);
  const [heart, setHeart] = useState(0);
  const [currentToy, setCurrentToy] = useState<{ id: Toy; cue: RoomCue }>();
  const [hasCushion, setHasCushion] = useState(false);
  const [response, setResponse] = useState<RoomCue>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const companion = useRef<HTMLButtonElement>(null);
  const toySpot = useRef<HTMLButtonElement>(null);
  const toyArt = useRef<HTMLImageElement>(null);
  const decorSpot = useRef<HTMLDivElement>(null);
  const progress = state.progress;
  const current = pets.find(p => p.id === (progress?.pet ?? preview ?? pet?.id)) ?? pets[0];
  const home = homes[current.id];
  const xp = progress?.xp ?? 0;
  const real = !!progress;
  const shownForm = progress?.shape ?? shapePreview;
  const decor = progress?.decoration ?? (real ? null : decorPreview);
  const toy = currentToy?.id ?? (real && xp < 60 ? rollingBall : home.toy);
  const toyName = toy === rollingBall ? "小绒球" : home.toyName;
  const decorChoices = Object.keys(decorItems).filter(key => key === home.decor || key === "decoration_moon_lamp" ||
    key === "decoration_star_mobiles") as Decoration[];
  const nextXP = xp < 60 ? 60 : xp < 180 ? 180 : 180;

  useEffect(() => {
    if (!progress?.pet) return;
    void accountRequest<{ progress: Progress }>({ op: "visit" }).then(result => setProgress(result.progress)).catch(() => undefined);
  }, [progress?.pet]);

  useLayoutEffect(() => {
    if (!currentToy || !toyArt.current || reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { id, cue } = currentToy;
    const frames = Array.from({ length: 45 }, (_, index) => {
      const { x, y, angle } = toyPosition(toyMotions[id], index / 44, cue.travel, cue.width);
      return { transform: `translate(${x}px,${y}px) rotate(${angle}deg)` };
    });
    const animation = toyArt.current.animate(frames, { duration: roomCueDuration(cue) });
    animation.currentTime = Math.max(0, performance.now() - cue.start);
    return () => animation.cancel();
  }, [currentToy, reduced]);

  function react(move: RoomMove, target?: HTMLElement | null) {
    const body = companion.current?.getBoundingClientRect();
    const prop = target?.getBoundingClientRect();
    const width = body?.width || 1;
    const dx = body && prop ? prop.left + prop.width / 2 - (body.left + body.width / 2) : 0;
    const dy = body && prop ? prop.top + prop.height / 2 - (body.top + body.height * .48) : 0;
    const travel = prop ? -Math.sign(dx) * Math.max(0, Math.abs(dx) - width * .47 - prop.width * .21) : 0;
    const cue = { move, start: performance.now(), targetX: dx / width, targetY: dy / width, travel, width };
    setResponse(cue);
    return cue;
  }

  async function interact(what: "pat" | typeof cushion | Toy) {
    if (what === "pat") {
      react("pat");
      setHeart(previous => previous + 1);
    } else if (what === cushion) {
      setHasCushion(!hasCushion);
      if (!hasCushion) react("cushion");
      else return;
    } else if (currentToy?.id !== what || performance.now() - currentToy.cue.start >= roomCueDuration(currentToy.cue)) {
      setCurrentToy({ id: what, cue: react(toyMotions[what], toySpot.current) });
    }
    if (!real) return;
    try {
      const result = await accountRequest<{ earned: number; progress: Progress }>({ op: "touch", what, id: crypto.randomUUID() });
      setProgress(result.progress);
      setNotice(result.earned ? "+2 陪伴经验" : "陪伴已记下");
    } catch (error) { setNotice(error instanceof Error ? error.message : "互动已完成，成长暂未保存。"); }
  }

  async function customize(change: { shape?: Form; decoration?: Decoration | null }) {
    if (change.shape === shownForm || change.decoration === decor) return;
    if (!real) {
      if (change.shape) setShapePreview(change.shape);
      if (change.decoration !== undefined) setDecorPreview(change.decoration);
      react(change.shape ? "form" : "decor", decorSpot.current);
      return;
    }
    setBusy(true);
    try {
      const result = await accountRequest<{ progress: Progress }>({ op: "equip", ...change });
      setProgress(result.progress);
      react(change.shape ? "form" : "decor", decorSpot.current);
      setNotice("已保存布置");
    } catch (error) { setNotice(error instanceof Error ? error.message : "布置暂未保存。"); }
    finally { setBusy(false); }
  }

  function previewPet(id: PetId) {
    setPreview(id);
    setShapePreview("normal");
    setDecorPreview(null);
    setHeart(0);
    setCurrentToy(undefined);
    setHasCushion(false);
    setResponse(undefined);
    setNotice("");
  }

  return <main className={"pet-room room-" + current.id} style={{ "--room-glow": home.light } as CSSProperties}>
    <div className="room-backdrop" aria-hidden="true">
      <img src={`/art/pet-v16/homes/${current.id}.webp`} alt="" fetchPriority="high" />
      <div className="room-vignette" /><div className="room-cloud" /><div className="room-lamp" />
      {[0, 1, 2, 3, 4, 5].map(i => <i key={i} className="room-mote" style={{ "--mote": i } as CSSProperties} />)}
    </div>
    <div className="room-title">
      <a href="/" className="room-return"><ArrowLeft size={15} /> 回山海入口</a>
      <div className="room-kicker">{real ? current.name + "的小屋" : "灵宠居所 · 预览"}</div>
      <h1>{home.name}</h1>
      <p>{current.greeting}</p>
    </div>
    <div className="room-stage">
      <div className="room-decoration" ref={decorSpot}>
        {decor && <img key={decor} src={propsRoot + decor + ".svg"} alt={decorItems[decor].name} />}
      </div>
      {hasCushion && <img className="room-cushion" src={propsRoot + cushion + ".svg"} alt="软坐垫" />}
      <button type="button" ref={companion} aria-label={"摸摸" + current.name} className="room-companion"
        onClick={() => void interact("pat")}>
        <PetArt key={current.id} pet={current} form={shownForm} roomCue={response} />
        {heart > 0 && <Heart className="room-affection" key={heart} aria-hidden="true" />}
        <span>{current.name} <Heart size={12} /></span>
      </button>
      <button className="room-stage-toy" type="button" ref={toySpot} aria-label={"玩" + toyName}
        onClick={() => void interact(toy)}>
        <img ref={toyArt} src={propsRoot + toy + ".svg"} alt="" />
      </button>
    </div>
    <aside className="room-panel" aria-label="小屋互动">
      <header className="room-panel-heading">
        <div><h2>{real ? "相伴手札" : "小屋预览"}</h2><span>{real ? growthPhase(xp) + " · " + xp + " XP" : "体验四只的小屋"}</span></div>
        <Sparkles size={19} aria-hidden="true" />
      </header>
      {!real && <div className="room-roster" aria-label="浏览四灵宠">
        {pets.map(option => <button type="button" key={option.id} aria-pressed={option.id === current.id} onClick={() => previewPet(option.id)}>{option.name}</button>)}
      </div>}
      <div className="room-tabs" aria-label="小屋功能">
        {tabs.map(item => <button type="button" aria-pressed={item.id === tab} key={item.id} onClick={() => setTab(item.id)}>{item.name}</button>)}
      </div>
      <div className="room-panel-content">
        {tab === "daily" && <>
          {real ? <>
            <div className="room-stats"><div><strong>{progress.activeDays}</strong><span>有效相伴日</span></div>
              <div><strong>{Math.max(1, 1 + Math.floor((Date.now() - progress.boundAt) / 86_400_000))}</strong><span>结契天数</span></div></div>
            <progress max={nextXP} value={Math.min(xp, nextXP)} aria-label="成长进度" />
          </> : <p className="room-help">摸摸头，或逗它看看面前的玩具。</p>}
          <div className="room-tools">
            <button type="button" onClick={() => void interact("pat")}><Heart size={15} /> 摸摸头</button>
            <button type="button" onClick={() => void interact(rollingBall)}>滚绒球</button>
            <button type="button" aria-pressed={hasCushion} onClick={() => void interact(cushion)}>{hasCushion ? "收坐垫" : "放坐垫"}</button>
            <button type="button" disabled={real && xp < 60} onClick={() => void interact(home.toy)}>
              {real && xp < 60 && <LockKeyhole size={12} />}{home.toyName}</button>
          </div>
          {real && <details className="room-guide"><summary>四灵图鉴</summary>
            <div>{pets.map(option => <span key={option.id}><img src={`/art/pet-v16/growth/${option.id}/normal.webp`} alt="" />{option.name}</span>)}</div>
          </details>}
        </>}
        {tab === "dress" && <>
          <div className="room-forms" aria-label="团子身形">{(Object.keys(forms) as Form[]).map(form =>
            <button type="button" key={form} aria-pressed={shownForm === form} disabled={busy || real && forms[form].xp > xp}
              onClick={() => void customize({ shape: form })}>
              <img src={`/art/pet-v16/growth/${current.id}/${form}.webp`} alt="" />
              <span>{forms[form].name}</span>{real && forms[form].xp > xp && <small>{forms[form].xp} XP</small>}
            </button>)}</div>
          <div className="room-tools" aria-label="小屋装饰">
            {decorChoices.map(key => <button type="button" key={key} aria-pressed={decor === key}
              disabled={busy || real && !canDecorate(current.id, key, xp)} onClick={() => void customize({ decoration: key })}>
              {decorItems[key].name}
            </button>)}
            {decor && <button type="button" disabled={busy} onClick={() => void customize({ decoration: null })}>取下装饰</button>}
          </div>
        </>}
      </div>
      {!real && state.account && <div className="room-signon"><BindPet pet={current} /></div>}
      {notice && <p className="room-notice" role="status">{notice}</p>}
    </aside>
  </main>;
}
