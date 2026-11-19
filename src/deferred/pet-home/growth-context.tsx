"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { emptySave, interact, parsePetSave, pets, petStorageKey, selectPet, setDecoration,
  type Action, type Decoration, type PetId, type PetSave } from "./growth";

const motionKey = "wenshan.reduce-motion";
const PetContext = createContext<ReturnType<typeof useLocalPet> | null>(null);

function useLocalPet() {
  const [save, setSave] = useState(emptySave);
  const current = useRef(emptySave);
  const [ready, setReady] = useState(false);
  const [motion, setMotion] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);
  const [clock, setClock] = useState(0);

  function commit(next: PetSave) {
    current.current = next;
    setSave(next);
    try { localStorage.setItem(petStorageKey, JSON.stringify(next)); } catch { /* Session state remains usable. */ }
  }

  useEffect(() => {
    let latest = emptySave;
    try {
      latest = parsePetSave(localStorage.getItem(petStorageKey));
      setMotion(localStorage.getItem(motionKey) === "1");
    } catch { /* Storage may be disabled. */ }
    if (latest.chosen) commit(selectPet(latest, latest.chosen));
    setClock(Date.now());
    setReady(true);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setSystemMotion(preference.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === motionKey) setMotion(event.newValue === "1");
      if (event.key === petStorageKey) {
        const next = parsePetSave(event.newValue);
        current.current = next;
        setSave(next);
      }
    };
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    onPreference();
    preference.addEventListener("change", onPreference);
    window.addEventListener("storage", sync);
    return () => {
      preference.removeEventListener("change", onPreference);
      window.removeEventListener("storage", sync);
      window.clearInterval(timer);
    };
  }, []);

  const pet = pets.find(p => p.id === save.chosen);
  return {
    pet, ready, clock,
    profile: pet ? save.profiles[pet.id] : undefined,
    reduced: motion || systemMotion,
    systemMotion,
    motion,
    setMotionPreference(value: boolean) {
      setMotion(value);
      try { localStorage.setItem(motionKey, value ? "1" : "0"); } catch { /* Session preference still applies. */ }
    },
    choose(id: PetId) { commit(selectPet(current.current, id)); },
    act(action: Action) { commit(interact(current.current, action)); },
    decorate(id: Decoration) { commit(setDecoration(current.current, id)); },
  };
}

export function PetProvider({ children }: { children: ReactNode }) {
  return <PetContext.Provider value={useLocalPet()}>{children}</PetContext.Provider>;
}

export function usePet() {
  const state = useContext(PetContext);
  if (!state) throw new Error("PetProvider is required");
  return state;
}
