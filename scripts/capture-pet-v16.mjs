import { chromium, devices } from "@playwright/test";
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";

const origin = "http://127.0.0.1:3208";
const cycleProof = process.argv.includes("--cycle");
const roomProof = process.argv.includes("--room-interactions");
const output = roomProof ? "output/playwright/pet-room-interactions" : cycleProof ? "output/playwright/pet-cycle" : "output/playwright/pet-v16";
const mobileRoomsOnly = process.argv.includes("--mobile-rooms");
const roster = [["xiaogua","小卦","卦算屋"], ["yunyao","云爻","云栖台"], ["qingpu","青朴","木叶居"], ["xuanji","玄机","星演阁"]];
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3208"], {
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", WENSHAN_ACCOUNTS_DATA: "memory://",
    ...(cycleProof ? { OLLAMA_MODEL: "" } : {}) }, windowsHide: true, stdio: "ignore",
});

async function record(page, filename, work, width, height) {
  const frames = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
    if (metadata.timestamp) frames.push({ frame: Buffer.from(data, "base64"), time: metadata.timestamp });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 84, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  const stats = await work();
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  assert.ok(frames.length > 60, "Not enough actual browser frames");
  const start = frames[0].time;
  const length = frames.at(-1).time - start;
  const samples = [];
  for (let t = 0, index = 0; t < length; t += 1 / 30) {
    while (index + 1 < frames.length && frames[index + 1].time <= start + t) index++;
    samples.push(frames[index].frame);
  }
  const path = output + "/" + filename + ".mp4";
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", "-r", "30", "-f", "image2pipe", "-vcodec", "mjpeg", "-i", "pipe:0",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "fast", "-crf", "21",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", path], { input: Buffer.concat(samples), encoding: "utf8", windowsHide: true, timeout: 90_000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return { path, seconds: +length.toFixed(2), actualFrames: frames.length, ...stats };
}

const home = page => page.goto(origin + "/pet-home");
const acceptRoom = async (page, name) => {
  await page.getByRole("heading", { name }).waitFor();
  await page.locator(".room-backdrop > img").evaluate(img => img.decode());
  await page.locator('.room-companion [data-renderer="mesh"]').waitFor();
};

let browser;
const reports = [];
try {
  let ready = false;
  for (let retry = 0; retry < 45 && !ready; retry++) {
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1200) })).ok; }
    catch { await wait(250); }
  }
  assert.ok(ready);
  browser = await chromium.launch({ channel: "msedge", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const viewports = [["desktop", 1440, 900], ["mobile", 390, 844]];
  for (const [name, width, height] of mobileRoomsOnly ? viewports.slice(1) : viewports) {
    const ctx = await browser.newContext({ ...(name === "mobile" ? devices["iPhone 13"] : {}),
      viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("wenshan.profile.v1",
      '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
    if (roomProof) {
      await home(page);
      await page.getByRole("button", { name: "小卦", exact: true }).click();
      await acceptRoom(page, "卦算屋");
      const button = label => page.getByRole("button", { name: label, exact: true });
      const play = async () => {
        if (name === "desktop") {
          await wait(500);
          await button("摸摸头").click();
          await wait(1350);
          await button("滚绒球").click();
          await wait(1910);
          await button("铜钱摇铃").click();
          await wait(1600);
        }
        await button("放坐垫").click();
        await wait(1250);
        await page.screenshot({ path: output + "/" + name + "-cushion.jpg", quality: 94, fullPage: true });
        await button("布置").click();
        await button("软糯糯").click();
        await wait(1100);
        await button("竹风铃").click();
        await wait(1300);
        await page.screenshot({ path: output + "/" + name + "-decoration.jpg", quality: 94, fullPage: true });
      };
      if (name === "desktop") reports.push(await record(page, "desktop-interactions", async () => {
        await play();
        return { viewport: name };
      }, width, height));
      else await play();
      assert.deepEqual(errors, []);
      await ctx.close();
      continue;
    }
    if (!mobileRoomsOnly) {
      await page.goto(origin);
      await page.bringToFront();
      await page.waitForFunction(() => document.querySelectorAll('.world-entrance [data-renderer="mesh"]').length === 4);
      await page.screenshot({ path: output + "/" + name + "-entrance.jpg", quality: 94 });
      const idle = await record(page, name + "-idle", () => page.evaluate(async () => {
      const rigs = [...document.querySelectorAll(".world-entrance .pet-rig")];
      const actions = Object.fromEntries(rigs.map(rig => [rig.dataset.companion, new Set()]));
      const times = [];
      const start = performance.now();
      await new Promise(resolve => {
        const sample = time => {
          times.push(time);
          for (const rig of rigs) {
            if (rig.dataset.action !== "idle") actions[rig.dataset.companion].add(rig.dataset.motion ?? rig.dataset.action);
          }
          if (time - start < 31_500) requestAnimationFrame(sample);
          else resolve();
        };
        requestAnimationFrame(sample);
      });
      const gaps = times.slice(1).map((time, i) => time - times[i]).sort((a,b) => a-b);
      return { p95Ms: +gaps[Math.floor(gaps.length * .95)].toFixed(2),
        gapsOver50Ms: gaps.filter(ms => ms > 50).length,
        actions: Object.fromEntries(Object.entries(actions).map(([id, observed]) => [id, [...observed]])) };
      }), width, height);
      assert.ok(idle.seconds >= 30 && Object.values(idle.actions).every(actions => actions.length === 5));
      reports.push({ name, idle });
    }

    if (cycleProof && name === "desktop" && !mobileRoomsOnly) {
      reports.at(-1).journey = await record(page, "desktop-cycle-journey", async () => {
        await page.getByRole("button", { name: "选择小卦同行" }).click();
        await page.getByRole("button", { name: "入山问卦" }).click();
        await page.locator('.scene-pet [data-renderer="mesh"]').waitFor();
        await page.mouse.move(0, 0);
        await wait(5700);
        await page.getByLabel("心里的问题").fill("今日运势如何？");
        for (let n = 1; n <= 6; n++) {
          await page.getByRole("button", { name: n === 1 ? "掷下第一爻" : "第 " + n + " 次投掷" }).click();
          if (n !== 1) await page.getByRole("button", { name: "直接看结果" }).click();
        }
        await page.getByRole("button", { name: /卦成，前往观卦阁/ }).click();
        await page.locator('.pavilion-pet [data-renderer="mesh"]').waitFor();
        await page.mouse.move(0, 0);
        await wait(6500);
        await page.getByRole("link", { name: "我的灵宠" }).click();
        await acceptRoom(page, "卦算屋");
        await page.mouse.move(0, 0);
        await wait(6300);
        return {};
      }, width, height);
    }
    await home(page);
    for (const [id, pet, room] of roster) {
      await page.getByRole("button", { name: pet, exact: true }).click();
      await acceptRoom(page, room);
      await page.screenshot({ path: output + "/" + name + "-" + id + ".jpg", quality: 92, fullPage: true });
    }
    if (name === "desktop") {
      await page.getByRole("button", { name: "小卦", exact: true }).click();
      await acceptRoom(page, "卦算屋");
      const play = await record(page, "desktop-room-play", async () => {
        await wait(650);
        await page.getByRole("button", { name: "摸摸头" }).click();
        await wait(1600);
        await page.getByRole("button", { name: "铜钱摇铃", exact: true }).click();
        await wait(1700);
        await page.mouse.move(0, 0);
        await wait(3300);
        await page.getByRole("button", { name: "布置", exact: true }).click();
        await page.getByRole("button", { name: "圆乎乎" }).click();
        await page.getByRole("button", { name: "竹风铃" }).click();
        await wait(2700);
        return {};
      }, width, height);
      reports.at(-1).play = play;
      await page.screenshot({ path: output + "/desktop-xiaogua-round.jpg", quality: 94 });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  if (!mobileRoomsOnly) await writeFile(output + "/capture.json", JSON.stringify(reports, null, 2) + "\n");
  console.log(mobileRoomsOnly ? "Four mobile rooms captured." : JSON.stringify(reports));
} finally {
  await browser?.close();
  server.kill();
}
