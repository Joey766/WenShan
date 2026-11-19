import { chromium } from "@playwright/test";
import { deepEqual, equal, ok } from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

const origin = "http://127.0.0.1:3218";
const folder = "assets/derived/pet-expression-sheets";
const metadata = JSON.parse(await readFile("src/data/pet-v16-motions.json", "utf8"));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3218"], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", WENSHAN_ACCOUNTS_DATA: "memory://", OLLAMA_MODEL: "" },
  stdio: "ignore", windowsHide: true,
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1200) })).ok; }
    catch { await wait(300); }
  }
  ok(ready, "Local production preview did not start");
  browser = await chromium.launch({ channel: "msedge", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}');
    Math.random = () => .5;
    const queue = new Map();
    let id = 0;
    window.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
    window.cancelAnimationFrame = id => queue.delete(id);
    window.advanceCompanionExport = now => {
      const batch = [...queue.entries()];
      queue.clear();
      for (const [, callback] of batch) callback(now);
    };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, options) {
      return original.call(this, kind, kind === "webgl" ? { ...options, preserveDrawingBuffer: true } : options);
    };
  });
  await page.goto(origin);
  await page.bringToFront();
  await page.addStyleTag({ content: ".world-pet .pet-rig { width: 500px !important; } .world-pet .character-qingpu { width: 442px !important; }" });
  await page.waitForFunction(() => document.querySelectorAll('.world-entrance [data-renderer="mesh"]').length === 4, undefined, { polling: 80 });
  const boards = await page.evaluate(() => {
    const feet = { xiaogua: .977, yunyao: .98, qingpu: .978, xuanji: .979 };
    const rigs = [...document.querySelectorAll(".world-entrance .pet-rig")];
    const actors = rigs.map(rig => ({ rig, id: rig.dataset.companion, canvas: rig.querySelector("canvas.rig-mesh"), sheet: null, done: new Set() }));
    const output = [];
    const cellWidth = 540;
    const cellHeight = 410;
    for (let elapsed = 0; elapsed <= 20_500 && output.length < 20; elapsed += 1000 / 90) {
      window.advanceCompanionExport(elapsed);
      for (const actor of actors) {
        const motion = actor.rig.dataset.motion;
        const duration = Number(actor.rig.dataset.motionDuration) * 1000;
        if (!motion || !duration || actor.done.has(motion)) continue;
        if (actor.sheet?.motion !== motion) {
          const board = document.createElement("canvas");
          board.width = cellWidth * 4;
          board.height = cellHeight * 4;
          actor.sheet = { motion, duration, start: elapsed, frame: 0, board, context: board.getContext("2d") };
        }
        const take = actor.sheet;
        if (elapsed - take.start + .01 < (take.duration - 24) * take.frame / 15) continue;
        const { canvas } = actor;
        const x = take.frame % 4 * cellWidth + (cellWidth - canvas.width) / 2;
        const footRow = canvas.height * ((feet[actor.id] + .06) / 1.12);
        const y = Math.floor(take.frame / 4) * cellHeight + 395 - footRow;
        take.context.save();
        take.context.beginPath();
        take.context.rect(take.frame % 4 * cellWidth, Math.floor(take.frame / 4) * cellHeight, cellWidth, cellHeight);
        take.context.clip();
        take.context.drawImage(canvas, Math.round(x), Math.round(y));
        take.context.restore();
        take.frame++;
        if (take.frame === 16) {
          output.push({ id: actor.id, motion, png: take.board.toDataURL("image/png").split(",")[1] });
          actor.done.add(motion);
        }
      }
    }
    return output;
  });
  equal(boards.length, 20, "The preview must render 20 complete sequences");
  for (const [id, actions] of Object.entries(metadata)) {
    deepEqual(boards.filter(board => board.id === id).map(board => board.motion).sort(), actions.map(action => action.id).sort());
  }
  deepEqual(errors, []);
  for (const board of boards) {
    await mkdir(folder + "/" + board.id, { recursive: true });
    await writeFile(folder + "/" + board.id + "/" + board.motion + ".png", board.png, "base64");
  }
  console.log("Rendered 20 transparent 2160 × 1640 sheets from the runtime in Edge.");
} finally {
  await browser?.close();
  server.kill();
}
