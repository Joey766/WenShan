import { chromium, expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { homes, petMotions } from "../../src/lib/pet-v16";

const names = { xiaogua: "小卦", yunyao: "云爻", qingpu: "青朴", xuanji: "玄机" };
const rooms = { xiaogua: "卦算屋", yunyao: "云栖台", qingpu: "木叶居", xuanji: "星演阁" };
const password = "V16-test-only!2026";

async function credentials(page: Page, label: string, create: boolean) {
  await page.getByRole("button", { name: "登录问山" }).click();
  if (create) await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await page.getByLabel("账户名").fill(label);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: create ? "注册账号" : "登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "我的账号" })).toBeVisible({ timeout: 18_000 });
}

test("all twenty motion sheets cycle automatically when WebGL is unavailable", async ({ baseURL }, info) => {
  test.skip(info.project.name !== "desktop-1440");
  test.setTimeout(60_000);
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : "msedge", args: ["--disable-webgl"] });
  const errors: string[] = [];
  try {
    const page = await browser.newPage({ baseURL });
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
    await page.goto("/");
    await expect(page.locator('.world-entrance [data-renderer="sheet"]')).toHaveCount(4);
    const observed = await page.locator(".world-entrance .rig-sprite").evaluateAll(canvases =>
      new Promise<Record<string, number[]>>(resolve => {
        const frames: Record<string, Set<number>> = {};
        function sample() {
          for (const canvas of canvases as HTMLCanvasElement[]) {
            const { source, frame } = canvas.dataset;
            if (source && frame) (frames[source] ??= new Set()).add(Number(frame));
          }
          if (Object.values(frames).filter(indices => indices.size >= 16).length === 20) finish();
        }
        function finish() {
          observer.disconnect();
          clearTimeout(timer);
          resolve(Object.fromEntries(Object.entries(frames).map(([path, values]) => [path, [...values]])));
        }
        const observer = new MutationObserver(sample);
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-frame", "data-source"] });
        const timer = window.setTimeout(finish, 39_000);
        sample();
      }));
    for (const { src } of Object.values(petMotions).flat()) {
      expect(observed[src]?.sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test("all four houses react to their own toys on mobile", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390");
  await page.goto("/pet-home");
  const prop = page.locator(".room-stage-toy img");
  const companion = page.locator(".room-companion .pet-rig");
  const moves = { xiaogua: "chime", yunyao: "cloud", qingpu: "dew", xuanji: "orbit" };
  for (const [id, name] of Object.entries(names) as [keyof typeof names, string][]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name: rooms[id] })).toBeVisible();
    await expect(page.locator(".room-backdrop > img")).toHaveAttribute("src", "/art/pet-v16/homes/" + id + ".webp");
    await expect(companion).toHaveAttribute("data-motion", /.+/);
    const count = Number(await companion.getAttribute("data-action-count"));
    await page.getByRole("button", { name: homes[id].toyName, exact: true }).click();
    await expect(companion).toHaveAttribute("data-room-response", moves[id]);
    await expect.poll(() => prop.evaluate(node => node.getAnimations().some(animation => animation.playState === "running"))).toBe(true);
    expect(Number(await companion.getAttribute("data-action-count"))).toBeGreaterThanOrEqual(count);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("room props, pet responses and decoration stay in the scene", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1440");
  await page.goto("/pet-home");
  const companion = page.locator(".room-companion .pet-rig");
  await expect(companion).toHaveAttribute("data-renderer", "mesh");
  await expect(page.getByRole("button", { name: "登录后结契" })).toHaveCount(0);
  await page.getByRole("button", { name: "摸摸头" }).click();
  await expect(companion).toHaveAttribute("data-room-response", "pat");
  await expect(page.locator(".room-affection")).toBeVisible();
  await page.getByRole("button", { name: "滚绒球" }).click();
  await expect(companion).toHaveAttribute("data-room-response", "ball");
  const toy = page.locator(".room-stage-toy img");
  await expect.poll(() => toy.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)).toBeLessThan(-12);
  await page.getByRole("button", { name: "放坐垫" }).click();
  await expect(companion).toHaveAttribute("data-room-response", "cushion");
  const cushion = page.getByRole("img", { name: "软坐垫" });
  await expect(cushion).toBeVisible();
  await expect(toy).toHaveAttribute("src", /shared_rolling_ball\.svg$/);
  const petBox = (await companion.boundingBox())!;
  const mat = (await cushion.boundingBox())!;
  expect(Math.abs(petBox.x + petBox.width / 2 - (mat.x + mat.width / 2))).toBeLessThan(1);
  const seatSurface = mat.y + mat.height * .61;
  expect(Math.abs(seatSurface - (petBox.y + petBox.height))).toBeLessThan(10);
  await page.getByRole("button", { name: "收坐垫" }).click();
  await expect(cushion).toHaveCount(0);
  await page.getByRole("button", { name: "布置", exact: true }).click();
  await page.getByRole("button", { name: "圆乎乎" }).click();
  await expect(companion).toHaveAttribute("data-room-form", "slightly_plump");
  await expect(companion).toHaveAttribute("data-room-response", "form");
  await page.getByRole("button", { name: "竹风铃" }).click();
  await expect(page.getByRole("img", { name: "竹风铃" })).toBeVisible();
  await expect(companion).toHaveAttribute("data-room-response", "decor");
  await expect(companion).not.toHaveAttribute("data-room-response", /.+/, { timeout: 2500 });
  await expect(companion).toHaveAttribute("data-motion", /.+/);
});

test("registered accounts bind once, save real throws and restore on a new browser session", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop-1440");
  test.setTimeout(85_000);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL, reducedMotion: "reduce" })));
  const [a, b, second] = await Promise.all(contexts.map(context => context.newPage()));
  const tag = randomUUID().slice(0, 6);
  const accountA = "north-" + tag;
  const accountB = "south-" + tag;
  try {
    await a.goto("/pet-home");
    await credentials(a, accountA, true);
    await a.getByRole("button", { name: "与它结契" }).click();
    await a.getByRole("button", { name: "再看看" }).click();
    await expect(a.getByRole("heading", { name: "小屋预览" })).toBeVisible();
    await a.getByRole("button", { name: "与它结契" }).click();
    await a.getByRole("button", { name: "确认结契" }).click();
    await expect(a.getByText("初识 · 5 XP")).toBeVisible();
    await a.getByRole("button", { name: "摸摸头" }).dblclick();
    await expect(a.getByText("初识 · 7 XP")).toBeVisible();

    const fake = await a.request.post("/api/companion", { data: { op: "touch", user_id: accountB, id: randomUUID(), what: "pat" } });
    expect(fake.status()).toBe(400);
    expect((await a.request.post("/api/companion", { data: { op: "bind", pet: "xuanji" } })).status()).toBe(409);
    expect((await a.request.post("/api/companion", { data: { op: "equip", shape: "extra_cuddly" } })).status()).toBe(403);

    await a.getByRole("link", { name: "回山海入口" }).click();
    await expect(a.locator(".world-pet")).toHaveCount(1);
    await a.getByRole("button", { name: "入山问卦" }).click();
    await a.getByLabel("心里的问题").fill("账号测试的问卦记录");
    await a.getByRole("button", { name: "掷下第一爻" }).click();
    for (let n = 2; n <= 6; n++) await a.getByRole("button", { name: "第 " + n + " 次投掷" }).click();
    await a.getByRole("button", { name: /卦成，前往观卦阁/ }).click();
    await expect(a.locator(".pavilion-pet")).toContainText("小卦");
    await a.getByRole("tab", { name: "卦象判断" }).click();
    await a.getByRole("button", { name: "保存本次问卦" }).click();
    await expect(a.getByText("已保存到账号")).toBeVisible();
    const original = await (await a.request.get("/api/companion?history=1")).json();
    expect(original.entries).toHaveLength(1);
    expect(original.progress.xp).toBe(17);

    await b.goto("/pet-home");
    await credentials(b, accountB, true);
    await b.getByRole("button", { name: names.xuanji, exact: true }).click();
    await b.getByRole("button", { name: "与它结契" }).click();
    await b.getByRole("button", { name: "确认结契" }).click();
    await expect(b.getByRole("heading", { name: rooms.xuanji })).toBeVisible();
    await expect(b.getByText("初识 · 5 XP")).toBeVisible();
    expect((await (await b.request.get("/api/companion?history=1")).json()).entries).toEqual([]);
    expect((await b.request.post("/api/companion", { data: { op: "saveHistory", entries: original.entries } })).status()).toBe(403);
    expect((await b.request.post("/api/companion", { data: { op: "clearHistory" } })).ok()).toBe(true);
    expect((await (await a.request.get("/api/companion?history=1")).json()).entries).toHaveLength(1);

    await second.goto("/pet-home");
    await credentials(second, accountA, false);
    await expect(second.getByRole("heading", { name: rooms.xiaogua })).toBeVisible();
    await expect(second.getByText("初识 · 17 XP")).toBeVisible();
    expect((await (await second.request.get("/api/companion?history=1")).json()).entries).toEqual(original.entries);
    await a.getByRole("button", { name: "我的账号" }).click();
    await a.getByRole("button", { name: "退出登录" }).click();
    await expect(a.getByRole("button", { name: "登录问山" })).toBeVisible();
    expect((await (await a.request.get("/api/companion?history=1")).json()).entries).toBeUndefined();

    expect((await second.request.post("/api/companion", { data: { op: "deleteAccount", password } })).ok()).toBe(true);
    expect((await (await second.request.get("/api/companion")).json()).account).toBeNull();
    expect((await (await b.request.get("/api/companion")).json()).progress.pet).toBe("xuanji");
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
