"use client";

import { ArrowRight, Check, History, Mountain, Sparkles } from "lucide-react";
import { useState } from "react";
import { pets, type PetId } from "@/lib/pets";
import { usePet } from "./pet-context";
import { PetArt } from "./pet-art";
import { useAccount } from "./account";
import { BindPet } from "./bind-pet";

export function Entrance({ enter, leaving, openHistory }: { enter: () => void; leaving: boolean; openHistory: () => void }) {
  const { pet, choose, ready } = usePet();
  const { state } = useAccount();
  const [candidate, setCandidate] = useState<PetId>();
  const pendingBind = !!state.account && !state.progress;
  const selected = pendingBind ? pets.find(p => p.id === candidate) : pet;
  const roster = state.progress && pet ? [pet] : pets;

  return (
    <section className="world-entrance" aria-labelledby="entry-title">
      <div className="world-name">
        <div className="world-kicker"><i /> 山海入口 <i /></div>
        <h1 id="entry-title">入山问心</h1>
        <p>{state.progress && pet ? pet.name + "在这里等你，一起入山问卦。" : "选择一只你喜欢的灵宠，一起入山问卦。"}</p>
      </div>
      {roster.map(p => (
        <button key={p.id} type="button" aria-label={`选择${p.name}同行`} aria-pressed={pet?.id === p.id}
          className={`world-pet world-pet-${p.id}`} disabled={!ready || leaving}
          onClick={() => {
            if (pendingBind) setCandidate(p.id);
            else choose(p.id);
          }}>
          <PetArt pet={p} />
          <span className="world-pet-tag">{p.name} {selected?.id === p.id && <Check size={13} />}</span>
        </button>
      ))}
      <div className="entry-dock">
        <span className="entry-guide" aria-live="polite">{selected ?
          <><Sparkles size={13} /> {selected.name}{pendingBind ? " · 待结契" : "与你同行"}</> : "点选山中的灵宠"}</span>
        {pendingBind ? <BindPet pet={selected} /> :
          <button className="button primary world-primary" disabled={!ready || !pet || leaving} onClick={enter}>入山问卦 <ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
      <div className="world-coordinate"><Mountain size={15} /> 山海之间 · 问心之旅</div>
      <button className="world-utility history-button" type="button" disabled={leaving} onClick={openHistory}><History size={17} /> 问卦记录</button>
    </section>
  );
}
