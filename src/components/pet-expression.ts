import type { PetId } from "../lib/pets.ts";

export type Gesture = "tilt" | "turn" | "scratch" | "pout" | "stretch" | "float" | "doze" | "lookUp" | "orbit" | "nod" | "happy";

export function smooth(amount: number) {
  const t = Math.max(0, Math.min(1, amount));
  return t * t * (3 - 2 * t);
}

function hold(t: number, arrive: number, settled: number, release: number, clear: number) {
  return smooth((t - arrive) / (settled - arrive)) * (1 - smooth((t - release) / (clear - release)));
}

type Face = {
  gazeX: number; gazeY: number; lid: number; alertness: number;
  press: number; pout: number; smile: number; focus: number;
};

export function petExpression(
  id: PetId,
  action: Gesture,
  t: number,
  side: number,
  body: { lift: number; orbit: number; nod: number },
): Face {
  const face: Face = { gazeX: 0, gazeY: 0, lid: 0, alertness: 0, press: 0, pout: 0, smile: 0, focus: 0 };
  const glance = hold(t, .015, .16, .57, .9);
  const settle = hold(t, .16, .38, .64, .96);
  const blink = (center: number) => hold(t, center - .04, center - .012, center + .009, center + .053);

  switch (action) {
    case "tilt":
      face.gazeX = side * .020 * glance;
      face.gazeY = -.007 * glance;
      face.alertness = .10 * glance;
      face.press = -.68 * settle;
      face.lid = blink(.57);
      face.focus = settle;
      break;
    case "turn":
      // Green leaf and dew are on the left. The eyes reach them before the head.
      face.gazeX = -.020 * glance;
      face.gazeY = -.013 * glance;
      face.alertness = .08 * glance;
      face.smile = .37 * hold(t, .38, .56, .68, .93);
      face.lid = blink(.69);
      face.focus = glance;
      break;
    case "scratch":
      face.gazeX = .016 * glance + .006 * body.lift;
      face.gazeY = -.012 * body.lift;
      face.press = -.52 * body.lift;
      face.lid = Math.max(blink(.53), body.lift * .27);
      face.smile = .96 * hold(t, .68, .77, .88, 1);
      face.focus = Math.max(glance, body.lift);
      break;
    case "pout":
      face.gazeX = (id === "qingpu" ? -.018 : side * -.009) * glance;
      face.gazeY = .012 * glance;
      face.press = -.53 * glance;
      face.pout = hold(t, .13, .34, .67, .94);
      face.lid = Math.max(blink(id === "qingpu" ? .55 : .63), .24 * settle);
      face.focus = face.pout;
      break;
    case "stretch":
      face.alertness = .05 * settle;
      face.gazeY = -.005 * settle;
      face.smile = .28 * hold(t, .53, .65, .78, 1);
      break;
    case "float":
      face.gazeX = .007 * glance;
      face.gazeY = -.009 * settle;
      face.lid = .33 * settle;
      face.press = -.24 * settle;
      face.focus = settle;
      break;
    case "doze": {
      const drowse = hold(t, .08, .39, .62, .93);
      face.gazeY = .012 * drowse;
      face.lid = (id === "yunyao" ? .98 : .73) * drowse;
      face.press = -.53 * drowse;
      face.alertness = .07 * hold(t, .69, .8, .88, 1);
      face.focus = drowse;
      break;
    }
    case "lookUp":
      face.gazeX = (id === "xuanji" ? .010 : .005) * glance;
      face.gazeY = -.024 * glance;
      face.alertness = .15 * glance;
      face.pout = .82 * hold(t, .24, .48, .64, .95);
      face.lid = blink(.83);
      face.focus = glance;
      break;
    case "orbit":
      face.gazeX = body.orbit * .026;
      face.gazeY = .004 * settle;
      face.alertness = .08 * settle;
      face.smile = .58 * hold(t, .37, .54, .73, .98);
      face.focus = settle;
      break;
    case "nod":
      face.gazeY = body.nod * .012;
      face.smile = hold(t, .15, .4, .76, 1);
      face.lid = face.smile * (id === "xiaogua" ? .76 : .53);
      face.focus = face.smile;
      break;
    case "happy":
      face.gazeX = side * .009 * settle;
      face.smile = hold(t, .12, .34, .73, 1);
      face.lid = face.smile * (id === "yunyao" ? .79 : .56);
      face.focus = face.smile;
      break;
  }
  return face;
}
