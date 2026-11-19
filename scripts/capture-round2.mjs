import { chromium, devices } from "@playwright/test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const origin = process.argv[2] ?? "http://127.0.0.1:3100";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const proofs = "docs/round2-validation";
const expectedMode = process.argv.includes("--ollama") ? "local" : "demo";
const journeyOnly = process.argv.includes("--journey-only");
await mkdir(proofs, { recursive: true });

async function record(context, page, name, size, callback) {
  const client = await context.newCDPSession(page);
  const frames = [];
  client.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    void client.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
    if (metadata.timestamp) frames.push({ data, time: metadata.timestamp });
  });
  let summary;
  try {
    await client.send("Page.startScreencast", { format: "jpeg", quality: 79, maxWidth: size[0], maxHeight: size[1], everyNthFrame: 1 });
    summary = await callback();
  } finally {
    await client.send("Page.stopScreencast");
    await client.detach();
  }
  assert.ok(frames.length > 24, `Too few live frames for ${name}`);
  const folder = `.work/round2-capture/${name}`;
  await mkdir(folder, { recursive: true });
  const filenames = frames.map((_, i) => `${String(i).padStart(6,"0")}.jpg`);
  for (let i = 0; i < frames.length; i += 24) {
    await Promise.all(frames.slice(i, i + 24).map(({ data }, j) => writeFile(`${folder}/${filenames[i+j]}`, data, "base64")));
  }
  const captions = frames.flatMap(({ time }, i) => [
    `file '${filenames[i]}'`,
    `duration ${Math.max(1 / 120, (frames[i+1]?.time ?? time + 1 / 30) - time).toFixed(6)}`,
  ]);
  captions.push(`file '${filenames.at(-1)}'`);
  await writeFile(`${folder}/timeline.txt`, captions.join("\n") + "\n", "utf8");
  const video = `${proofs}/${name}.mp4`;
  const ffmpeg = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
    "-i", `${folder}/timeline.txt`, "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264",
    "-crf", "23", "-preset", "fast", "-movflags", "+faststart", video], { encoding: "utf8", windowsHide: true });
  assert.equal(ffmpeg.status, 0, ffmpeg.stderr || String(ffmpeg.error));
  return { path: video, capturedFrames: frames.length, capturedSeconds: +(frames.at(-1).time - frames[0].time).toFixed(2), ...summary };
}

async function portrait(browser, mobile) {
  return browser.newContext(mobile ? {
    ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
  } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
}

async function enter(page, name) {
  await page.getByRole("button", { name: `选择${name}同行` }).click();
  await page.getByRole("button", { name: "入山问卦" }).click();
  await page.getByRole("heading", { name: "问心台" }).waitFor();
  await page.locator(".cloud-passage").waitFor({ state: "detached" });
}

async function idleSample(page) {
  return page.evaluate(async () => {
    const duration = 30_200;
    const times = [];
    const actions = {};
    const root = document.querySelector(".world-entrance");
    const tracked = [...root.querySelectorAll(".pet-rig")];
    for (const rig of tracked) actions[rig.dataset.companion] = [];
    const observer = new MutationObserver(changes => {
      for (const { target } of changes) {
        const { companion, action } = target.dataset;
        if (companion && action && action !== "idle") actions[companion].push(action);
      }
    });
    for (const rig of tracked) observer.observe(rig, { attributes: true, attributeFilter: ["data-action"] });
    const mist = document.querySelector(".world-mist-far");
    const mistBefore = getComputedStyle(mist).transform;
    const beginning = performance.now();
    await new Promise(resolve => {
      function sample(now) {
        times.push(now);
        if (now - beginning < duration) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
    observer.disconnect();
    const deltas = times.slice(1).map((t, i) => t - times[i]).sort((a,b) => a-b);
    const nth = percentile => +deltas[Math.floor(deltas.length * percentile)].toFixed(2);
    return {
      measuredSeconds: +((times.at(-1)-times[0])/1000).toFixed(2),
      meanFps: +(1000 * (times.length-1) / (times.at(-1)-times[0])).toFixed(1),
      frameMsP50: nth(.50), frameMsP95: nth(.95), frameMsMax: +deltas.at(-1).toFixed(2),
      frameGapsOver50Ms: deltas.filter(value => value > 50).length,
      mistMoved: mistBefore !== getComputedStyle(mist).transform, actions,
    };
  });
}

const browser = await chromium.launch({
  channel: "msedge", headless: true,
  args: ["--enable-unsafe-swiftshader", "--disable-background-timer-throttling"],
});
const report = { origin, expectedMode, clips: [] };
if (journeyOnly) {
  try {
    const previous = JSON.parse(await readFile(resolve(proofs, "motion-metrics.json"), "utf8"));
    report.clips = previous.clips.filter(item => !item.path.includes(`journey-${expectedMode}`));
  } catch { /* A journey-only run may also start with an empty proof directory. */ }
}
try {
  for (const mobile of journeyOnly ? [] : [false, true]) {
    const context = await portrait(browser, mobile);
    await context.addInitScript(() => localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("heading", { name: "入山问心" }).waitFor();
    await wait(650);
    const proof = await record(context, page, mobile ? "mobile-idle-30s" : "desktop-idle-30s",
      mobile ? [390,844] : [1067,667], () => idleSample(page));
    assert.ok(proof.measuredSeconds >= 30 && proof.mistMoved);
    assert.ok(Object.values(proof.actions).every(actions => actions.length >= 2));
    report.clips.push(proof);
    await context.close();
  }

  const context = await portrait(browser, false);
  await context.addInitScript(() => localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
  const page = await context.newPage();
  await page.goto(origin);
  const labels = ["小卦", "云爻", "青朴", "玄机"];
  const keys = ["xiaogua", "yunyao", "qingpu", "xuanji"];
  const petsFolder = `${proofs}/companion-frames`;
  await mkdir(petsFolder, { recursive: true });
  for (const [index, name] of journeyOnly ? [] : labels.entries()) {
    const pet = page.getByRole("button", { name: `选择${name}同行` });
    await pet.screenshot({ path: `${petsFolder}/${keys[index]}-idle.jpg`, quality: 92 });
    await pet.click();
    await wait(620);
    await pet.screenshot({ path: `${petsFolder}/${keys[index]}-click.jpg`, quality: 92 });
    await page.getByRole("button", { name: "入山问卦" }).click();
    await page.locator(".cloud-passage").waitFor({ state: "detached" });
    await page.getByLabel("心里的问题").fill("复习时如何检查做题节奏？");
    await page.getByRole("button", { name: "掷下第一爻" }).click();
    await page.locator('.scene-pet .pet-rig[data-action="watch"]').waitFor();
    await wait(310);
    await page.locator(".scene-pet").screenshot({ path: `${petsFolder}/${keys[index]}-watch.jpg`, quality: 92 });
    await page.locator('.scene-pet .pet-rig[data-action="surprise"]').waitFor();
    await wait(410);
    await page.locator(".scene-pet").screenshot({ path: `${petsFolder}/${keys[index]}-landing.jpg`, quality: 92 });
    await page.reload();
  }

  report.clips.push(await record(context, page, `journey-${expectedMode}`, [1067,667], async () => {
    await page.getByRole("button", { name: "选择小卦同行" }).click();
    await wait(2680);
    await enter(page, "小卦");
    await page.getByLabel("心里的问题").fill("两周后有一门数学考试，及格线 60，目前模拟 68 左右，我能通过吗？");
    const casts = [];
    for (let i = 1; i <= 6; i++) {
      await page.getByRole("button", { name: i === 1 ? "掷下第一爻" : `第 ${i} 次投掷` }).click();
      await page.locator(".cast-result").getByText(`第 ${i} 掷`, { exact: false }).waitFor();
      casts.push(await page.locator("[data-coin]").evaluateAll(items => items.map(item => Number(item.dataset.coin))));
    }
    await page.getByRole("button", { name: "卦成，前往观卦阁" }).click();
    await page.getByRole("heading", { name: "观卦阁" }).waitFor();
    await page.locator(".cloud-passage").waitFor({ state: "detached" });
    await wait(2100);
    await page.getByRole("tab", { name: "解读与追问" }).click();
    const marker = page.getByText(expectedMode === "local" ? "本地 AI · Ollama" : "演示模式 · Mock", { exact: true });
    await marker.first().waitFor({ timeout: 120_000 });
    await page.getByRole("textbox", { name: "追问", exact: true }).fill("如果最后两道大题经常来不及，我应先练什么？");
    await page.getByRole("button", { name: "发送追问" }).click();
    await marker.nth(1).waitFor({ timeout: 120_000 });
    await wait(2000);
    return { tosses: casts, responses: 2, mode: expectedMode };
  }));
  await context.close();
} finally {
  await browser.close();
  await writeFile(resolve(proofs,"motion-metrics.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}
