import { chromium, devices } from "@playwright/test";
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

const origin = "http://127.0.0.1:3207";
const output = process.argv[2] ?? "output/playwright/companion-motion";
const reactions = process.argv.includes("--reactions");
const expressions = process.argv.includes("--expressions");
const fullCycle = process.argv.includes("--full-cycle");
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3207"],
  { env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, windowsHide: true, stdio: "ignore" });
let browser;

function ffmpeg(args, input) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    input, windowsHide: true, encoding: "utf8", timeout: 90_000,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
}

try {
  let ready = false;
  for (let i = 0; i < 45 && !ready; i++) {
    try {
      ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      await wait(230);
    }
  }
  assert.ok(ready, "Local Next.js server did not start");
  browser = await chromium.launch({ channel: "msedge", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const failures = [];

  async function open(options) {
    const context = await browser.newContext(options);
    await context.addInitScript(() => {
      localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}');
    });
    const page = await context.newPage();
    page.on("pageerror", error => failures.push(error.message));
    await page.goto(origin);
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelectorAll('.world-entrance [data-renderer="mesh"]').length === 4);
    await page.evaluate(() => document.fonts.ready);
    return { context, page };
  }

  const { context, page } = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const actorRects = await page.locator(".world-entrance .pet-rig").evaluateAll(elements =>
    elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { id: element.dataset.companion, x, y, width, height };
    }));
  const client = await context.newCDPSession(page);
  const frames = [];
  client.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    void client.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
    if (metadata.timestamp) frames.push({ bytes: Buffer.from(data, "base64"), time: metadata.timestamp });
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 86, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
  const samplePromise = page.evaluate(async () => {
    const tracker = [...document.querySelectorAll(".world-entrance .pet-rig")];
    const observed = Object.fromEntries(tracker.map(target => [target.dataset.companion, []]));
    const start = performance.now();
    const observer = new MutationObserver(changes => {
      for (const { target } of changes) {
        const { companion, action } = target.dataset;
        observed[companion].push({ action, second: +((performance.now() - start) / 1000).toFixed(2) });
      }
    });
    for (const element of tracker) {
      observer.observe(element, { attributes: true, attributeFilter: ["data-action"] });
      if (element.dataset.action !== "idle") observed[element.dataset.companion].push({ action: element.dataset.action, second: 0 });
    }
    const times = [];
    await new Promise(resolve => {
      function frame(time) {
        times.push(time);
        if (time - start < 32_600) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    observer.disconnect();
    const gaps = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
    const seconds = (times.at(-1) - times[0]) / 1000;
    return {
      seconds: +seconds.toFixed(2), averageRafHz: +(gaps.length / seconds).toFixed(1),
      p95FrameMs: +gaps[Math.floor(gaps.length * .95)].toFixed(2),
      longestFrameMs: +gaps.at(-1).toFixed(2), frameGapsOver50Ms: gaps.filter(gap => gap > 50).length,
      observed,
    };
  });
  if (reactions || expressions) {
    for (const pet of ["小卦", "云爻", "青朴", "玄机"]) {
      const button = page.getByRole("button", { name: "选择" + pet + "同行" });
      const clicks = expressions ? 3 : 2;
      for (let i = 0; i < clicks; i++) {
        await button.click();
        await wait(240);
      }
      await page.mouse.move(0, 0);
      await wait(3400);
    }
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
  }
  const sample = await samplePromise;
  if (expressions) {
    for (const [id, action] of Object.entries({ xiaogua: "shake", yunyao: "pout", qingpu: "peek", xuanji: "pout" })) {
      assert.ok(sample.observed[id].some(move => move.action === action), id + " did not perform " + action);
    }
  }
  await client.send("Page.stopScreencast");
  await client.detach();
  assert.ok(frames.length > 350 && frames.at(-1).time - frames[0].time >= 30, "Live recording too short");
  await page.screenshot({ path: output + "/desktop.jpg", quality: 94 });
  await context.close();

  const mobile = await open({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.page.screenshot({ path: output + "/mobile.jpg", quality: 93 });
  await mobile.context.close();
  assert.deepEqual(failures, []);
  await browser.close();
  browser = undefined;
  server.kill();

  const first = frames[0].time;
  const seconds = frames.at(-1).time - first;
  const sampled = [];
  let cursor = 0;
  for (let time = 0; time <= seconds; time += 1 / 30) {
    while (cursor + 1 < frames.length && frames[cursor + 1].time <= first + time) cursor++;
    sampled.push(frames[cursor].bytes);
  }
  const whole = output + "/entrance-30s.mp4";
  const encode = ["-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  ffmpeg(["-r", "30", "-f", "image2pipe", "-vcodec", "mjpeg", "-i", "pipe:0", ...encode, whole], Buffer.concat(sampled));
  const clips = [];
  for (const { id, x, y, width, height } of actorRects) {
    const featured = expressions ? ["shake", "pout", "peek"] : reactions ? ["turn", "scratch"] : null;
    const firstMove = sample.observed[id].find(move =>
      featured ? featured.includes(move.action) : move.action !== "idle")?.second ?? 2;
    const from = fullCycle ? 0 : Math.max(0, Math.floor(firstMove - 2));
    const duration = fullCycle ? 18 : 10.5;
    const cropWidth = Math.ceil((width + 50) / 2) * 2;
    const cropHeight = Math.ceil((height + 42) / 2) * 2;
    const left = Math.floor((x - (cropWidth - width) / 2) / 2) * 2;
    const top = Math.floor((y - (cropHeight - height) / 2) / 2) * 2;
    const crop = [cropWidth, cropHeight, left, top].join(":");
    const path = output + "/" + id + "-closeup.mp4";
    ffmpeg(["-ss", String(from), "-i", whole, "-t", String(duration), "-vf", "crop=" + crop + ",scale=iw*3:ih*3:flags=lanczos",
      ...encode, path]);
    clips.push({ id, path, sourceTime: from, seconds: duration });
  }
  const stats = { browser: "Microsoft Edge (Playwright)", captureFrames: frames.length,
    captureSeconds: +seconds.toFixed(2), viewport: [1440, 900], actorRects, ...sample, clips };
  await writeFile(output + "/capture.json", JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats));
} finally {
  await browser?.close();
  server.kill();
}
