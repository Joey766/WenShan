"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Pet } from "@/lib/pets";
import type { Form } from "@/lib/pet-v16";
import { usePet } from "./pet-context";
import { useAccount } from "./account";
import { drivePet, type PetPose } from "./pet-motion";
import type { RoomCue } from "./room-interaction";

export function PetArt({ pet, pose = "idle", form, roomCue }: {
  pet: Pick<Pet, "id" | "name">; pose?: PetPose; form?: Form; roomCue?: RoomCue;
}) {
  const figure = useRef<HTMLSpanElement>(null);
  const rig = useRef<ReturnType<typeof drivePet>>(null);
  const { reduced } = usePet();
  const { state } = useAccount();
  const shape = form ?? (state.progress?.pet === pet.id ? state.progress.shape : "normal");

  useEffect(() => {
    if (!figure.current) return;
    const preferStillness = reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rig.current = drivePet(figure.current, pet.id, preferStillness);
    return () => { rig.current?.dispose(); rig.current = null; };
  }, [pet.id, reduced]);
  useEffect(() => { rig.current?.mode(pose); }, [pose, pet.id, reduced]);
  useEffect(() => { rig.current?.setForm(shape); }, [shape, pet.id, reduced]);
  useEffect(() => { rig.current?.setRoomCue(roomCue); }, [roomCue, pet.id, reduced]);
  return (
    <span ref={figure} className={`pet-figure character-${pet.id} pose-${pose} pet-rig`} data-companion={pet.id} data-room-form={form}>
      <span className="rig-contact" aria-hidden="true" />
      <span className="rig-action">
        <span className="rig-still">
          <img className="pet-base" src={`/art/companions-v6/${pet.id}-rig.webp`} alt={pet.name} draggable="false" />
          <img className="rig-accessory" src={`/art/companions-v6/${pet.id}-accessory.webp`} alt="" draggable="false" />
          <img className="rig-eyes" src={`/art/companions-v6/${pet.id}-eyes.webp`} alt="" draggable="false" />
        </span>
        <canvas className="rig-mesh" aria-hidden="true" />
        <canvas className="rig-sprite" aria-hidden="true" />
      </span>
    </span>
  );
}

export function SceneCompanion({ pet, pose, label, className, children }: {
  pet: Pet; pose: PetPose; label: string; className: string; children?: ReactNode;
}) {
  return <div className={`scene-companion ${className}`}>
    <PetArt pet={pet} pose={pose} />
    {children}
    <span className="pet-reaction-label" aria-live="polite">{label}</span>
  </div>;
}
