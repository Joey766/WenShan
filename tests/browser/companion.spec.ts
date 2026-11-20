import { expect, test, type Locator } from "@playwright/test";
import { petMotions } from "../../src/lib/pet-v16";

const xiaoguaMotions = petMotions.xiaogua.map(motion => motion.id).sort();

test("email code is the only sign-in field after sending and a rejected code can be retried", async ({ page }, info) => {
  test.skip(!["desktop-1440", "mobile-390"].includes(info.project.name));
  const guest = { account: null, progress: null, backend: "supabase", authMode: "email-otp" };
  await page.route("**/api/companion", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: guest });
    const input = route.request().postDataJSON();
    expect(input.label).toBe("test@example.invalid");
    if (input.op === "sendLoginCode") return route.fulfill({ json: { ...guest, needsConfirmation: true } });
    expect(input.op).toBe("verifyLoginCode");
    if (input.code === "000000") return route.fulfill({ status: 401, json: { error: "验证码无效或已过期。" } });
    expect(input.code).toBe("123456");
    return route.fulfill({ json: { ...guest, account: { label: input.label } } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  await page.getByRole("button", { name: "登录问山" }).click();
  const modal = page.getByRole("dialog", { name: "登录问山" });
  await expect(modal.getByText("首次验证此邮箱后，会自动创建问山账号。")).toBeVisible();
  await expect(modal.locator('input[type="password"]')).toHaveCount(0);
  await modal.getByLabel("邮箱", { exact: true }).fill("test@example.invalid");
  await modal.getByRole("button", { name: "发送验证码" }).click();
  const code = page.getByRole("textbox", { name: "邮箱验证码", exact: true });
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await code.fill("000000");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page.getByRole("status").filter({ hasText: "验证码无效或已过期。" })).toBeVisible();
  await code.fill("123456");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page.getByRole("button", { name: "我的账号" })).toBeVisible();
});

async function observeRounds(rigs: Locator, size: number) {
  return rigs.evaluateAll((elements, count) => new Promise<Record<string, string[]>>(resolve => {
    const observed: Record<string, string[]> = {};
    function sample() {
      for (const node of elements as HTMLElement[]) {
        const { companion, motion } = node.dataset;
        if (!companion || !motion) continue;
        const readings = observed[companion] ??= [];
        if (readings.length < count && readings.at(-1) !== motion) readings.push(motion);
      }
      if (elements.every(node => (observed[(node as HTMLElement).dataset.companion!]?.length ?? 0) >= count)) finish();
    }
    function finish() {
      watcher.disconnect();
      clearTimeout(timer);
      resolve(observed);
    }
    const watcher = new MutationObserver(sample);
    watcher.observe(document, { attributes: true, subtree: true, attributeFilter: ["data-motion"] });
    const timer = window.setTimeout(finish, 24_000);
    sample();
  }), size);
}

test("selection and casting preserve the automatic cycle and respect reduced motion", async ({ page }, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  const reduced = info.project.name === "mobile-375";
  const picked = page.getByRole("button", { name: "选择小卦同行" });
  const entrance = picked.locator(".pet-rig");
  if (!reduced) await expect(entrance).toHaveAttribute("data-renderer", "mesh");
  else await expect(entrance).toHaveAttribute("data-action-count", "0");
  const before = Number(await entrance.getAttribute("data-action-count"));
  await picked.click();
  expect(Number(await entrance.getAttribute("data-action-count")) - before).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "入山问卦" }).click();
  const rig = page.locator(".scene-pet .pet-rig");
  await expect(rig).toBeVisible();
  expect(Number(await rig.getAttribute("data-action-count"))).toBeGreaterThanOrEqual(before);
  await page.getByLabel("心里的问题").fill("这次想问怎么安排准备？");
  await page.getByRole("button", { name: "掷下第一爻" }).click();
  if (!reduced) {
    await expect(rig).toHaveAttribute("data-pose", "watch");
    expect(xiaoguaMotions).toContain(await rig.getAttribute("data-motion"));
    expect((await observeRounds(rig, 2)).xiaogua).toHaveLength(2);
  } else {
    await expect(rig).toHaveAttribute("data-renderer", "still");
    expect(await rig.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  }
  await expect(page.locator(".line-board .filled-line")).toHaveCount(1);
});

test("all four companions cycle through five different actions and wrap without input", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1440");
  await page.addInitScript(() => localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
  await page.goto("/");
  await page.bringToFront();
  const rigs = page.locator('.world-entrance [data-renderer="mesh"]');
  await expect(rigs).toHaveCount(4);
  const rotations = await rigs.evaluateAll(elements => elements.flatMap(element =>
    [element, element.querySelector(".rig-action")!, element.querySelector("canvas")!].map(node =>
      [getComputedStyle(node).rotate, getComputedStyle(node).transform])));
  expect(rotations.every(([rotate, transform]) => rotate === "none" && transform === "none")).toBe(true);
  const rounds = await observeRounds(rigs, 6);
  for (const [pet, motions] of Object.entries(petMotions)) {
    expect(rounds[pet]?.slice(0, 5).sort()).toEqual(motions.map(motion => motion.id).sort());
    expect(rounds[pet]?.[5]).toBe(rounds[pet]?.[0]);
  }
  expect(Object.values(rounds).map(motions => motions[0])).toEqual(["idle_sway","slow_float","shy_pout","ring_wiggle"]);
});

test("the platform, pavilion and house keep cycling with no input to the companion", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-1440");
  test.setTimeout(92_000);
  await page.addInitScript(() => localStorage.setItem("wenshan.profile.v1", '{"birth":"","gender":"undisclosed","custom":"","consent":false}'));
  await page.goto("/");
  await page.getByRole("button", { name: "选择小卦同行" }).click();
  await page.getByRole("button", { name: "入山问卦" }).click();
  const platform = page.locator(".scene-pet .pet-rig");
  await expect(platform).toHaveAttribute("data-renderer", "mesh");
  expect((await observeRounds(platform, 5)).xiaogua.sort()).toEqual(xiaoguaMotions);
  const countBefore = Number(await platform.getAttribute("data-action-count"));

  await page.getByLabel("心里的问题").fill("今日运势如何？");
  for (let i = 1; i <= 6; i++) {
    await page.getByRole("button", { name: i === 1 ? "掷下第一爻" : "第 " + i + " 次投掷" }).click();
    await page.getByRole("button", { name: "直接看结果" }).click();
  }
  await page.getByRole("button", { name: /卦成，前往观卦阁/ }).click();
  const pavilion = page.locator(".pavilion-pet .pet-rig");
  await expect(pavilion).toHaveAttribute("data-renderer", "mesh");
  expect(Number(await pavilion.getAttribute("data-action-count"))).toBeGreaterThanOrEqual(countBefore);
  expect((await observeRounds(pavilion, 5)).xiaogua.sort()).toEqual(xiaoguaMotions);

  await page.getByRole("link", { name: "我的灵宠" }).click();
  const room = page.locator(".room-companion .pet-rig");
  await expect(room).toHaveAttribute("data-renderer", "mesh");
  await expect(page.getByRole("button", { name: "动作簿" })).toHaveCount(0);
  expect((await observeRounds(room, 5)).xiaogua.sort()).toEqual(xiaoguaMotions);
});
