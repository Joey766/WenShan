"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { companionKey, legacyCompanionKey, pets, readCompanion, type PetId } from "@/lib/pets";
import { useAccount } from "./account";

const motionKey = "wenshan.reduce-motion";
const PetContext = createContext<ReturnType<typeof useCompanion> | null>(null);

function useCompanion() {
  const { state, ready: accountReady } = useAccount();
  const [selected, setSelected] = useState<PetId | null>(null);
  const [ready, setReady] = useState(false);
  const [motion, setMotion] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);

  useEffect(() => {
    try {
      const current = localStorage.getItem(companionKey);
      const id = readCompanion(current, localStorage.getItem(legacyCompanionKey));
      setSelected(id);
      if (id && current === null) localStorage.setItem(companionKey, id);
      setMotion(localStorage.getItem(motionKey) === "1");
    } catch { /* Visitors can still choose a companion for this session. */ }
    setReady(true);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setSystemMotion(preference.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === motionKey) setMotion(event.newValue === "1");
      if (event.key === companionKey && event.newValue) setSelected(readCompanion(event.newValue, null));
    };
    onPreference();
    preference.addEventListener("change", onPreference);
    window.addEventListener("storage", sync);
    return () => {
      preference.removeEventListener("change", onPreference);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    pet: pets.find(p => p.id === (state.account ? state.progress?.pet : selected)),
    ready: ready && accountReady, reduced: motion || systemMotion, systemMotion, motion,
    setMotionPreference(value: boolean) {
      setMotion(value);
      try { localStorage.setItem(motionKey, value ? "1" : "0"); } catch { /* Session preference still applies. */ }
    },
    choose(id: PetId) {
      if (!accountReady || state.account) return;
      setSelected(id);
      try { localStorage.setItem(companionKey, id); } catch { /* Session preference still applies. */ }
    },
  };
}

export function PetProvider({ children }: { children: ReactNode }) {
  return <PetContext.Provider value={useCompanion()}>{children}</PetContext.Provider>;
}

export function usePet() {
  const state = useContext(PetContext);
  if (!state) throw new Error("PetProvider is required");
  return state;
}
