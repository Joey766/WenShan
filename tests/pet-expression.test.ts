import { strict as assert } from "node:assert";
import test from "node:test";
import { petExpression, type Gesture } from "../src/components/pet-expression.ts";

const body = { lift: 0, orbit: 0, nod: 0 };

test("gaze anticipates the turn, follows the paw, and settles into a smile after the hand lowers", () => {
  const glance = petExpression("qingpu", "turn", .12, -1, body);
  assert.ok(glance.gazeX < -.01 && glance.gazeY < 0);
  assert.equal(glance.smile, 0);
  const hat = petExpression("xiaogua", "scratch", .53, 1, { ...body, lift: 1 });
  assert.ok(hat.gazeX > .01 && hat.gazeY < 0 && hat.lid > .95 && hat.press < 0);
  assert.equal(hat.smile, 0);
  assert.ok(petExpression("xiaogua", "scratch", .83, 1, body).smile > .85);
});

test("different motions and personas produce coordinated distinct facial poses", () => {
  assert.ok(petExpression("xiaogua", "pout", .41, 1, body).pout > .9);
  const cloud = petExpression("yunyao", "doze", .5, 1, body);
  const star = petExpression("xuanji", "doze", .5, 1, body);
  assert.ok(cloud.lid > star.lid && star.lid > .6);
  const ring = petExpression("xuanji", "orbit", .5, 1, { ...body, orbit: -.6 });
  assert.ok(ring.gazeX < 0 && ring.smile > .35);
  const bright = petExpression("qingpu", "nod", .58, 1, body);
  assert.ok(bright.smile > .94 && bright.pout === 0);
  const motions: Gesture[] = ["stretch", "float", "tilt", "turn", "scratch", "pout", "doze", "lookUp", "orbit", "happy", "nod"];
  for (const motion of motions) {
    const end = petExpression("xiaogua", motion, 1, 1, body);
    assert.ok(Object.values(end).every(value => value === 0), motion);
  }
});
