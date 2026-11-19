import type { PetId } from "@/lib/pets";
import { smooth } from "./pet-expression";

export const toyMotions = {
  shared_rolling_ball: "ball",
  xiaogua_coin_toy: "chime",
  yunyao_cloud_ball: "cloud",
  qingpu_dew_ball: "dew",
  xuanji_orbit_ball: "orbit",
} as const;

export type Toy = keyof typeof toyMotions;
export type ToyMotion = typeof toyMotions[Toy];
export type RoomMove = ToyMotion | "pat" | "cushion" | "decor" | "form";
export type RoomCue = {
  move: RoomMove;
  start: number;
  targetX: number;
  targetY: number;
  travel: number;
  width: number;
};

const durations = { ball: 1750, chime: 1450, cloud: 2000, dew: 1800, orbit: 1850,
  pat: 1050, cushion: 1150, decor: 1250, form: 1050 } satisfies Record<RoomMove, number>;

const isToy = (move: RoomMove): move is ToyMotion => move === "ball" || move === "chime" ||
  move === "cloud" || move === "dew" || move === "orbit";

export const roomCueDuration = (cue: RoomCue) => durations[cue.move];

export function toyPosition(move: ToyMotion, phase: number, travel: number, width: number) {
  const approach = smooth(phase / .47) * (1 - smooth((phase - .59) / .41));
  const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, phase))) ** 2;
  const swing = Math.sin(phase * Math.PI * 5) * arc;
  switch (move) {
    case "ball": return { x: travel * approach, y: 0, angle: travel * 1.8 * approach };
    case "chime": return { x: travel * .61 * approach, y: -.05 * width * arc, angle: swing * 26 };
    case "cloud": return { x: travel * .76 * approach, y: -.19 * width * arc, angle: swing * 9 };
    case "dew": return { x: travel * approach, y: -.12 * width * Math.abs(swing), angle: travel * approach };
    case "orbit": return { x: travel * .87 * approach, y: -.068 * width * arc, angle: travel * 1.25 * approach + swing * 12 };
  }
}

const character = {
  xiaogua: { settle: .83, bright: .91, listen: .008 },
  yunyao: { settle: 1.12, bright: .71, listen: .004 },
  qingpu: { settle: .94, bright: .79, listen: .010 },
  xuanji: { settle: .70, bright: .60, listen: .006 },
} satisfies Record<PetId, { settle: number; bright: number; listen: number }>;

export function sampleRoomResponse(cue: RoomCue | undefined, pet: PetId, now: number) {
  if (!cue) return;
  const t = Math.max(0, (now - cue.start) / durations[cue.move]);
  if (t >= 1) return;

  const { move, width, targetX, targetY } = cue;
  const { settle, bright, listen } = character[pet];
  const strength = smooth(t / .23) * (1 - smooth((t - .55) / .45));
  const tracksProp = move === "decor" || isToy(move);
  const prop = isToy(move) ? toyPosition(move, t, cue.travel, width) : { x: 0, y: 0 };
  const nestle = move === "cushion" || move === "pat";
  const focus = tracksProp ? .88 * strength : .38 * strength;
  const gazeX = Math.tanh((targetX + prop.x / width) * 1.15) * .018;
  const gazeY = Math.tanh((targetY + prop.y / width) * 1.3) * .014;
  return {
    focus,
    gazeX: tracksProp ? gazeX : 0,
    gazeY: tracksProp ? gazeY : 0,
    blink: nestle ? strength * (move === "pat" ? .93 : .66) : 0,
    smile: strength * bright * (nestle || move === "form" ? 1 : .46),
    bend: tracksProp ? gazeX * strength * .49 : 0,
    breath: strength * settle * (move === "cushion" ? -.026 : move === "form" ? -.017 : 0),
    headY: strength * (nestle ? .008 * settle : tracksProp ? gazeY * .52 - listen : .002),
    turn: tracksProp ? gazeX * strength * .53 : 0,
  };
}
