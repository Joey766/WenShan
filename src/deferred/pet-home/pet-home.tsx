"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Feather, Hand, Heart, Lock, MessageCircle, Orbit, Sparkles, Sprout, Utensils } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { decorations, growth, pets, type Action, type Mood } from "./growth";
import { PetArt } from "@/components/pet-art";
import { usePet } from "./growth-context";

const actions = [
  { id: "pat", name: "摸摸头", icon: Hand, reply: "唔……再摸一下也可以。" },
  { id: "feed", name: "喂食", icon: Utensils, reply: "这口好吃！给你也留一口。" },
  { id: "jump", name: "跳一跳", icon: Sparkles, reply: "看，我比刚才跳得高一点。" },
  { id: "chat", name: "聊聊天", icon: MessageCircle, reply: "" },
] as const;
const moodText: Record<Mood, string> = { normal: "安稳", sleepy: "有点困倦", revived: "恢复元气", happy: "开心" };

export function PetHome() {
  const { ready, pet, profile, choose, act, decorate, clock } = usePet();
  const [moment, setMoment] = useState<{ mood: Mood; action: Action; reply: string; count: number }>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decorateDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleAction(item: typeof actions[number]) {
    if (!pet || !profile) return;
    const restoring = profile.sleepy;
    act(item.id);
    setMoment(previous => ({
      mood: restoring ? "revived" : "happy", action: item.id,
      reply: restoring ? "醒啦！你一来，整间屋子都暖了。" : item.reply || pet.chat,
      count: (previous?.count ?? 0) + 1,
    }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoment(undefined), 3400);
  }

  const progress = profile ? growth(profile, clock) : null;
  const mood = moment?.mood ?? (profile?.sleepy ? "sleepy" : "normal");
  const message = moment?.reply ?? (profile?.sleepy ? "呼……等你等得打了个盹。" : pet?.greeting);
  const pose = moment?.action === "jump" && mood !== "revived" ? "jump" : mood === "normal" ? "idle" : mood;

  return (
    <main className="frame pet-home-page">
      <Link className="back-link" href="/"><ArrowLeft size={16} /> 回山海入口</Link>
      <div className="act-heading"><div>
        <p className="eyebrow"><span className="label-rule" /> 灵宠居所</p>
        <h1>{pet ? pet.home : "灵宠居所"}</h1><p>{pet ? `${pet.name}的小天地。在这儿坐一会儿吧。` : "选一位同行灵宠，去它的小天地坐坐。"}</p>
      </div>{pet && <div className="act-tag"><span /> {pet.trait}</div>}</div>
      {pet && profile && progress ? (
        <>
          <div className="home-grid">
            <section className={`home-scene scene-panel room-${pet.id} decor-${profile.decoration}`} aria-label={`${pet.name}的住所`}>
              <img className="room-background" src={`/art/home-${pet.id}.webp`} alt="" />
              <div className="room-decor" aria-hidden="true">{profile.decoration === "blossom" ? "✿　　✿　　✿" : profile.decoration === "starlight" ? "✦　　·　　✧　　·　　✦" : ""}</div>
              <div className="scene-label"><Sprout size={14} /> {pet.home}</div>
              <div className="room-pet"><p className="speech-bubble" aria-live="polite">{message}</p><PetArt key={`${pet.id}-${moment?.count ?? 0}`} pet={pet} pose={pose} /><div className="room-shadow" /></div>
            </section>
            <section className="paper care-card" aria-labelledby="care-title">
              <div className="card-heading"><h2 id="care-title">{pet.name}</h2><span className="level-tag">Lv. {progress.level}</span></div>
              <dl className="pet-stats">
                <div><dt><CalendarDays size={16} /> 陪伴</dt><dd>{progress.days} 天</dd></div>
                <div><dt><Heart size={16} /> 状态</dt><dd aria-live="polite">{moodText[mood]}</dd></div>
                <div><dt><Sprout size={16} /> 成长</dt><dd>{progress.progress} / 20</dd></div>
              </dl>
              <progress className="growth-progress" aria-label="当前等级成长进度" value={progress.progress} max={20} />
              <div className="care-actions">{actions.map(item => <button key={item.id} className="button secondary" onClick={() => handleAction(item)}><item.icon size={16} /> {item.name}</button>)}</div>
              <button className="decor-button" onClick={() => decorateDialog.current?.showModal()}><Feather size={17} /> 居所装饰 <ArrowRight size={14} /></button>
            </section>
          </div>
          <dialog className="settings-dialog" ref={decorateDialog} aria-labelledby="decor-title">
            <form className="dialog-head" method="dialog"><h2 id="decor-title">居所装饰</h2><button className="button secondary">完成</button></form>
            <div className="decoration-list">{decorations.map(item => <button key={item.id}
              aria-pressed={profile.decoration === item.id} disabled={progress.level < item.level} onClick={() => decorate(item.id)}>
              <span><Orbit size={17} /> {item.title}</span><small>{progress.level < item.level ? <><Lock size={13} /> Lv. {item.level} 解锁</> : profile.decoration === item.id ? <Check size={16} /> : "可使用"}</small>
            </button>)}</div>
          </dialog>
        </>
      ) : <section className="paper empty-home"><Sprout size={27} /><p>{ready ? "你还没有选同行的灵宠。" : "正在寻找你的灵宠。"}</p></section>}
      <section className="companion-select home-selection" aria-labelledby="other-homes">
        <div className="selection-heading"><div><p className="eyebrow"><span className="label-rule" /> 四灵小住</p><h2 id="other-homes">{pet ? "探望其他灵宠" : "选择一位灵宠"}</h2></div></div>
        <div className="pet-selection-grid">{pets.map(p => <button key={p.id} className={`pet-choice ${pet?.id === p.id ? "pet-chosen" : ""}`} disabled={!ready}
          style={{ "--pet-tone": p.color } as CSSProperties} aria-pressed={pet?.id === p.id}
          onClick={() => { setMoment(undefined); choose(p.id); window.scrollTo({ top: 0, behavior: "instant" }); }}>
          <PetArt pet={p} /><span className="choice-text"><strong>{p.name}</strong><small>{p.home}</small></span>
          <span className="choice-check" aria-hidden="true">{pet?.id === p.id && <Check size={13} />}</span>
        </button>)}</div>
      </section>
    </main>
  );
}
