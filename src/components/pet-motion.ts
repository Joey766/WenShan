import type { PetId } from "@/lib/pets";
import { forms, petMotions, type Form, type MotionIndex } from "@/lib/pet-v16";
import { openCompanionMesh, type CompanionFrame } from "./companion-mesh";
import { openPetSheets } from "./pet-sprite";
import { petExpression, smooth, type Gesture } from "./pet-expression";
import { sampleRoomResponse, type RoomCue } from "./room-interaction";

export type PetPose = "idle" | "happy" | "sleepy" | "revived" | "watch" | "thinking" | "curious" | "reading" | "jump";

type Profile = {
  cycle: number; sway: number; breath: number; bend: number; fullness: number; side: number;
  headSway: { amplitude: number; start: number; end: number };
  pace: number;
  order: readonly MotionIndex[];
  blink: [number, number];
};

const profiles = {
  xiaogua: { cycle: 5.1, sway: 7.7, breath: .015, bend: .024, fullness: .024, side: -1,
    headSway: { amplitude: .066, start: .16, end: .88 },
    pace: .84, order: [0, 1, 2, 3, 4], blink: [3.0, 5.7] },
  yunyao: { cycle: 6.9, sway: 10.8, breath: .023, bend: .018, fullness: .034, side: 1,
    headSway: { amplitude: .046, start: .19, end: .91 },
    pace: .96, order: [1, 3, 0, 2, 4], blink: [4.1, 7.2] },
  qingpu: { cycle: 5.9, sway: 8.6, breath: .016, bend: .023, fullness: .028, side: -1,
    headSway: { amplitude: .043, start: .24, end: .83 },
    pace: .90, order: [2, 1, 4, 0, 3], blink: [3.6, 6.9] },
  xuanji: { cycle: 7.4, sway: 12.0, breath: .013, bend: .016, fullness: .021, side: 1,
    headSway: { amplitude: .035, start: .30, end: .91 },
    pace: 1.04, order: [3, 2, 4, 1, 0], blink: [4.8, 8.8] },
} satisfies Record<PetId, Profile>;

const gestures = {
  tilt: { duration: [2.80, 3.45], bend: .046, breath: -.012 },
  turn: { duration: [2.50, 3.15], bend: .013, breath: .004 },
  scratch: { duration: [2.85, 3.45], bend: .020, breath: -.004 },
  pout: { duration: [2.5, 3.1], bend: .004, breath: .008 },
  stretch: { duration: [3.1, 3.9], bend: .023, breath: .035 },
  float: { duration: [3.25, 4.0], bend: .021, breath: .014 },
  doze: { duration: [2.6, 3.3], bend: .019, breath: -.016 },
  lookUp: { duration: [2.7, 3.4], bend: .016, breath: .023 },
  orbit: { duration: [2.65, 3.4], bend: .018, breath: -.005 },
  nod: { duration: [2.2, 2.85], bend: .009, breath: .023 },
  happy: { duration: [2.04, 2.65], bend: .025, breath: .046 },
} satisfies Record<Gesture, { duration: [number, number]; bend: number; breath: number }>;

const between = (left: number, right: number) => left + (right - left) * Math.random();
const clamp = (number: number, low: number, high: number) => Math.max(low, Math.min(high, number));
const wave = (time: number, period: number) => Math.sin(time * Math.PI * 2 / period);

type Step = (seconds: number) => void;
const actors = new Set<Step>();
let raf = 0;
let lastFrame: number | undefined;

function tick(now: number) {
  raf = 0;
  const seconds = lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, .2);
  lastFrame = now;
  for (const actor of actors) actor(seconds);
  wake();
}

function wake() {
  if (!raf && actors.size && !document.hidden) raf = requestAnimationFrame(tick);
}

function visibility() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastFrame = undefined;
  wake();
}

function register(step: Step) {
  if (!actors.size) document.addEventListener("visibilitychange", visibility);
  actors.add(step);
  wake();
  return () => {
    actors.delete(step);
    if (!actors.size) {
      document.removeEventListener("visibilitychange", visibility);
      visibility();
    }
  };
}

function spring(frequency: number, drag: number) {
  let value = 0;
  let speed = 0;
  return (toward: number, dt: number) => {
    const steps = Math.max(1, Math.ceil(dt / .02));
    const interval = dt / steps;
    const decay = Math.exp(-drag * interval);
    for (let step = 0; step < steps; step++) {
      speed = (speed + (toward - value) * frequency * interval) * decay;
      value += speed * interval;
    }
    return value;
  };
}

const companionActions: Record<PetId, readonly [Gesture, Gesture, Gesture, Gesture, Gesture]> = {
  xiaogua: ["stretch", "tilt", "pout", "scratch", "nod"],
  yunyao: ["stretch", "float", "doze", "lookUp", "happy"],
  qingpu: ["stretch", "turn", "pout", "scratch", "nod"],
  xuanji: ["stretch", "lookUp", "doze", "orbit", "happy"],
};

type Action = { index: MotionIndex; start: number; duration: number; side: number; strength: number; dwell: number };
type Cycle = { slot: number; count: number; time: number; phase: number; action: Action };
const lastCycle = new Map<PetId, Cycle>();

export function drivePet(root: HTMLElement, id: PetId, reduced: boolean) {
  const profile = profiles[id];
  const canvas = root.querySelector("canvas")!;
  const sprite = root.querySelector<HTMLCanvasElement>(".rig-sprite")!;
  const previous = lastCycle.get(id);
  delete root.dataset.action;
  delete root.dataset.motion;
  delete root.dataset.motionDuration;
  root.dataset.actionCount = String(reduced ? 0 : previous?.count ?? 0);
  root.dataset.renderer = "still";
  let pose: PetPose = "idle";
  let form: Form = "normal";
  let roomCue: RoomCue | undefined;
  let action = previous?.action;
  let slot = previous?.slot ?? 0;
  let actionCount = previous?.count ?? 0;
  let disposed = false;
  let time = previous?.time ?? 0;
  let nextBlink = time + profile.blink[0] * between(.46, .86);
  let blinkLength = .23;
  let nextLook = time + between(2, 4);
  let aim = 0;
  const phase = previous?.phase ?? between(0, 6);
  const bend = spring(85, 11);
  const crown = spring(44, 9);
  const head = spring(146, 15);
  const volume = spring(100, 13);
  const gazeX = spring(140, 17);
  const gazeY = spring(165, 19);
  const mouth = spring(80, 12);
  const lips = spring(108, 16);
  const smile = spring(126, 17);
  const shapeWidth = spring(60, 14);
  const turnFace = spring(125, 15);
  const roomNod = spring(122, 16);
  const roomLids = spring(180, 23);
  const follow = spring(63, 7);
  const accent = spring(id === "yunyao" ? 36 : 51, 8);
  const charm = spring(68, 6.8);
  const art = new Image();
  let rig: ReturnType<typeof openCompanionMesh> = null;
  let sheets: ReturnType<typeof openPetSheets> | undefined;
  let removeFrame: (() => void) | undefined;
  let resize: ResizeObserver | undefined;

  function announce(index: MotionIndex, duration: number) {
    root.dataset.action = companionActions[id][index];
    root.dataset.motion = petMotions[id][index].id;
    root.dataset.actionCount = String(actionCount);
    root.dataset.motionDuration = String(duration);
  }

  function begin(start: number) {
    const index = profile.order[slot];
    const name = companionActions[id][index];
    const duration = between(...gestures[name].duration) * profile.pace;
    actionCount++;
    announce(index, duration);
    const side = name === "scratch" ? 1 : name === "turn" ? -1 : profile.side * (Math.random() < .21 ? -1 : 1);
    return { index, start, duration, side,
      strength: between(.94, 1.13), dwell: between(.52, .67) };
  }

  function frame(dt: number) {
    time += dt;
    action ??= begin(time);
    const end = action.start + action.duration;
    const nextSlot = (slot + 1) % profile.order.length;
    if (time >= end) {
      slot = nextSlot;
      action = begin(end);
    }
    const progress = clamp((time - action.start) / action.duration, 0, 1);
    const response = roomCue && sampleRoomResponse(roomCue, id, performance.now());
    if (response && roomCue) {
      if (root.dataset.roomResponse !== roomCue.move) root.dataset.roomResponse = roomCue.move;
    } else if (roomCue) {
      roomCue = undefined;
      delete root.dataset.roomResponse;
    }
    if (!rig) {
      sheets ??= openPetSheets(sprite);
      const next = profile.order[(slot + 1) % profile.order.length];
      if (sheets?.draw(petMotions[id][action.index].src, petMotions[id][next].src, progress) && root.dataset.renderer !== "sheet") {
        root.dataset.renderer = "sheet";
      }
      if (response) {
        sprite.style.translate = `${(response.bend * 100).toFixed(2)}% 0`;
        sprite.style.setProperty("--room-sprite-height", (1 + response.breath - response.headY * .7).toFixed(4));
      } else if (sprite.style.translate) {
        sprite.style.removeProperty("translate");
        sprite.style.removeProperty("--room-sprite-height");
      }
      return;
    }
    if (time >= nextLook) {
      aim = between(-.0038, .0038);
      nextLook = time + between(2.7, 5.3);
    }

    const name = companionActions[id][action.index];
    const intent = gestures[name];
    const { strength, side, dwell } = action;
    const gesture = smooth((progress - .065) / .32) * (1 - smooth((progress - dwell) / (1 - dwell))) * strength;
    const { amplitude, start: swayStart, end: swayEnd } = profile.headSway;
    const swayProgress = clamp((progress - swayStart) / (swayEnd - swayStart), 0, 1);
    // A softer return stroke follows the first curious tilt. Keep the lower body quiet.
    const swayAmount = Math.sin(Math.PI * swayProgress) * wave(swayProgress, 1) * (1 - .45 * swayProgress);
    const tilting = name === "tilt";
    const headShift = head(tilting ? amplitude * swayAmount * side * strength : 0, dt);
    const pouting = name === "pout" ? gesture : 0;
    const floating = name === "float" ? gesture : 0;
    const looking = name === "lookUp" ? gesture : 0;
    const dozing = name === "doze" ? gesture : 0;
    const nod = name === "nod" ? wave(progress, .52) * gesture : 0;
    const orbital = name === "orbit" ? wave(progress, .78) * gesture : 0;
    const cheer = name === "happy" ? wave(progress, .63) * gesture : 0;
    const turning = name === "turn" ? side * gesture : 0;
    const scratching = name === "scratch";
    const lift = scratching ? smooth((progress - .25) / .24) * (1 - smooth((progress - .76) / .19)) : 0;
    const rubbing = clamp((progress - .46) / .30, 0, 1);
    const rub = scratching ? wave(rubbing, .5) * Math.sin(Math.PI * rubbing) : 0;
    const face = petExpression(id, name, progress, side, { lift, orbit: orbital, nod });
    const slow = wave(time + phase, profile.sway) * .76 + wave(time + phase * .4, profile.sway * .63) * .26;
    const breathing = wave(time + phase * .5, profile.cycle);
    const bodyGesture = intent.bend * side * gesture;
    const weight = bend(profile.bend * slow + bodyGesture * (tilting ? .52 : 1) + (response?.bend ?? 0), dt);
    const delayed = crown(weight, dt);
    const breath = volume(profile.breath * breathing + intent.breath * gesture + (response?.breath ?? 0), dt);
    const lag = follow((delayed - weight) * .24 - headShift * .16, dt);
    const tip = accent(lag * .48, dt);
    const pendant = charm(lag + (delayed - weight) * .32, dt);
    const elapsedBlink = time - nextBlink;
    let blink = 0;
    if (elapsedBlink >= 0) {
      const progress = elapsedBlink / blinkLength;
      blink = smooth(progress / .39) * (1 - smooth((progress - .54) / .46));
      if (progress >= 1) {
        nextBlink = time + between(...profile.blink);
        blinkLength = between(.20, .31);
      }
    }

    const focus = response?.focus ?? 0;
    const shapeWeight = root.dataset.roomForm ? 2.6 : 1;
    const picture: CompanionFrame = {
      bend: weight * .80 + delayed * .20,
      breath,
      fullness: profile.fullness * breathing * .58 - breath * .45 + weight * .10 + shapeWidth(forms[form].width * shapeWeight, dt),
      headX: weight * .30 + headShift * .66 + turning * .006 - lift * .005,
      headY: -breath * .34 + lift * .003 + pouting * .004 - floating * .019 - looking * .023 + nod * .031 +
        roomNod(response?.headY ?? 0, dt),
      headRoll: clamp(delayed * .25 + headShift * .32 + turning * .009 - lift * .008 + cheer * .024 + dozing * .013, -.028, .028),
      faceTurn: turnFace(turning * .013 * (1 - focus) + (response?.turn ?? 0), dt),
      gazeX: gazeX(clamp((aim * (1 - face.focus * .8) + face.gazeX) * (1 - focus) + (response?.gazeX ?? 0) * focus, -.026, .026), dt),
      gazeY: gazeY(face.gazeY * (1 - focus) + (response?.gazeY ?? 0) * focus + (pose === "watch" ? -.004 : pose === "reading" ? .003 : 0), dt),
      blink: Math.max(blink * (1 - .87 * face.focus), face.lid * (1 - .61 * focus), clamp(roomLids(response?.blink ?? 0, dt), 0, 1)),
      alertness: Math.max(face.alertness, focus * .52),
      mouth: mouth(face.press * (1 - focus * .5), dt),
      pout: clamp(lips(face.pout * (1 - Math.max(focus, response?.smile ?? 0)), dt), 0, 1),
      smile: clamp(smile(Math.max(face.smile, response?.smile ?? 0), dt), 0, 1),
      accent: clamp(tip + orbital * .071 + looking * .018, -.055, .055),
      charm: clamp(pendant + nod * .072, -.052, .052),
      orbit: orbital * .024,
      paw: { lift, rub },
    };
    rig.draw(picture);
  }

  function fit() {
    rig?.resize(canvas.clientWidth, canvas.clientHeight);
  }

  function contextLost(event: Event) {
    event.preventDefault();
    rig = null;
    root.dataset.renderer = "still";
  }

  if (!reduced) {
    if (action) announce(action.index, action.duration);
    art.src = "/art/companion-expressions/" + id + ".webp";
    void art.decode().then(() => {
      if (disposed) return;
      rig = openCompanionMesh(canvas, id, art);
      if (!rig) {
        removeFrame ??= register(frame);
        return;
      }
      canvas.addEventListener("webglcontextlost", contextLost);
      canvas.addEventListener("webglcontextrestored", start);
      start();
    }).catch(() => { if (!disposed) removeFrame ??= register(frame); });
  }

  function start(event?: Event) {
    if (event) rig = openCompanionMesh(canvas, id, art);
    if (!rig) return;
    fit();
    if (!resize) {
      resize = new ResizeObserver(fit);
      resize.observe(canvas);
    }
    frame(0);
    sheets = undefined;
    root.dataset.renderer = "mesh";
    removeFrame ??= register(frame);
  }

  return {
    setRoomCue(value: RoomCue | undefined) {
      roomCue = value;
      if (!value) delete root.dataset.roomResponse;
    },
    setForm(value: Form) {
      form = value;
    },
    mode(next: PetPose) {
      pose = next;
      root.dataset.pose = next;
    },
    dispose() {
      if (action && !reduced) lastCycle.set(id, { slot, count: actionCount, time, phase, action });
      disposed = true;
      removeFrame?.();
      resize?.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", start);
      rig?.dispose();
    },
  };
}
