import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("enter follows the source path before fog reveals the platform", async ({ page }, info) => {
  const faults: string[] = [];
  page.on("pageerror", error => faults.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  await expect(page.getByText("选择一只你喜欢的灵宠，一起入山问卦。")).toBeVisible();
  await expect(page.locator(".world-0 .world-plate img")).toHaveJSProperty("complete", true);
  await page.getByRole("button", { name: "选择小卦同行" }).click();
  const road = await page.locator(".entry-dock .world-primary").evaluate(async button => {
    const plate = document.querySelector(".world-0 .world-plate")!;
    const image = plate.querySelector("img")!;
    const scene = document.querySelector<HTMLElement>(".journey")!;
    (button as HTMLButtonElement).click();
    while (scene.dataset.passage !== "enter") {
      if (scene.classList.contains("journey-1")) return null;
      await new Promise(requestAnimationFrame);
    }
    const camera = plate.getAnimations()[0];
    const cover = document.querySelector(".passage-ink")!;
    const startOpacity = Number(getComputedStyle(cover).opacity);
    const frames = (camera.effect as KeyframeEffect).getKeyframes();
    return {
      source: image.currentSrc, startOpacity,
      eye: parseFloat(scene.style.getPropertyValue("--road-eye")), bend: parseFloat(scene.style.getPropertyValue("--road-bend")),
      frames: frames.map(frame => String(frame.transform)),
    };
  });
  if (info.project.name === "mobile-375") {
    expect(road).toBeNull();
  } else {
    expect(road).toBeTruthy();
    expect(road?.startOpacity).toBeLessThan(.15);
    expect(road?.eye).toBeGreaterThan(36);
    expect(road?.bend).toBeLessThan(0);
    const midpoint = road?.frames.find(frame => frame.includes("1.77"));
    expect(midpoint).toBeTruthy();
    expect(road?.source).toContain(info.project.name.startsWith("mobile") ? "scene-0-portrait.webp" : "scene-0.webp");
    await expect(page.getByRole("button", { name: "跳过转场" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "问心台" })).toBeVisible();
  await expect(page.locator(".cloud-passage")).toHaveCount(0);
  expect(faults).toEqual([]);
});

test("choose each companion, persist on reload, go through all three acts, and receive one fortune", async ({ page, isMobile, request }, info) => {
  const faults: string[] = [];
  page.on("pageerror", error => faults.push(error.message));
  const artProof = process.env.WENSHAN_PROOFS ? `output/playwright/round3/${info.project.name}` : null;
  if (artProof) await mkdir(artProof, { recursive: true });
  await page.goto("/");
  if (artProof) await page.screenshot({ path: `${artProof}/onboarding.jpg`, quality: 91 });
  await page.getByRole("button", { name: "跳过" }).click();
  await expect(page.getByRole("heading", { name: "入山问心" })).toBeVisible();
  await expect(page.getByRole("link", { name: /灵宠居所/ })).toHaveCount(0);
  const pets = page.locator(".world-pet");
  await expect(pets).toHaveCount(4);
  for (const choice of await pets.all()) {
    await choice.click();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
  }
  await page.reload();
  await expect(pets.last()).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("wenshan.companion.v1"))).toBe("xuanji");
  async function scene(name: string) {
    await expect(page.locator(".world-plate img")).toHaveJSProperty("complete", true);
    expect(await page.locator(".world-plate img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const metrics = await page.evaluate(() => {
      const rect = document.querySelector(".journey")!.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height, innerWidth, innerHeight,
        document.documentElement.scrollWidth, document.documentElement.scrollHeight];
    });
    expect(metrics[0]).toBe(0);
    expect(metrics[1]).toBe(0);
    expect(metrics[2]).toBe(metrics[4]);
    expect(Math.abs(metrics[3] - metrics[5])).toBeLessThanOrEqual(1);
    expect(metrics[6]).toBe(metrics[4]);
    expect(metrics[7]).toBe(metrics[5]);
    if (artProof) await page.screenshot({ path: `${artProof}/${name}.jpg`, quality: 92 });
  }
  await scene("entrance");

  await page.getByRole("button", { name: "入山问卦" }).click();
  await expect(page.getByRole("heading", { name: "问心台" })).toBeVisible();
  await expect(page.locator(".cloud-passage")).toHaveCount(0);
  await expect(page.locator(".scene-pet")).toContainText("玄机");
  if (!isMobile) await expect(page.locator(".webgl-host canvas")).toBeVisible();
  await page.getByRole("button", { name: "掷下第一爻" }).click();
  await expect(page.getByText("先写下你想问的一件事。")).toBeVisible();
  await page.getByLabel("心里的问题").fill("我下周的考试能过吗？");
  await expect(page.getByText("补充背景（选填）")).toHaveCount(0);
  const names: Record<number, string> = { 6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳" };
  const casts: number[][] = [];
  for (let i = 1; i <= 6; i++) {
    await page.getByRole("button", { name: i === 1 ? "掷下第一爻" : `第 ${i} 次投掷` }).click();
    await expect(page.locator(".cast-result")).toContainText(`第 ${i} 掷`);
    const faces = await page.locator(".coin-values [data-coin]").evaluateAll(items => items.map(item => Number(item.getAttribute("data-coin"))));
    expect(faces).toHaveLength(3);
    expect(faces.every(value => value === 2 || value === 3)).toBeTruthy();
    casts.push(faces);
    const sum = faces.reduce((a, b) => a + b, 0);
    await expect(page.locator(".cast-result")).toContainText(`${sum} · ${names[sum]}`);
    await expect(page.locator(".line-board li").nth(i - 1)).toContainText(names[sum]);
  }
  await scene("divination");

  const sent = page.waitForRequest(req => req.url().endsWith("/api/reading") && req.method() === "POST");
  await page.getByRole("button", { name: "卦成，前往观卦阁" }).click();
  await expect(page.getByRole("heading", { name: "观卦阁" })).toBeVisible();
  await expect(page.locator(".cloud-passage")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "我下周的考试能过吗？" })).toBeVisible();
  await expect(page.locator(".reading-lead")).toHaveText(/考运(?:偏吉|中平|偏慎)/u);
  await expect(page.getByRole("textbox", { name: "追问" })).toHaveCount(0);
  await expect(page.getByText("传统文化娱乐体验，非现实预测")).toBeVisible();
  expect((await sent).postDataJSON()).toEqual({ question: "我下周的考试能过吗？", coins: casts });
  await page.getByRole("tab", { name: "经文与白话" }).click();
  await expect(page.locator(".hexagram-comparison .line-mark")).toHaveCount(12);
  await expect(page.getByRole("link", { name: /维基文库/ })).toHaveAttribute("href", /zh\.wikisource\.org/);
  await scene("classics");
  await page.getByRole("tab", { name: "卦象判断" }).click();
  await expect(page.getByText("演示模式 · Mock")).toHaveCount(1);
  await expect(page.locator(".pavilion-pet")).toContainText("玄机");
  await expect(page.getByText("卦象依据", { exact: true })).toBeVisible();
  await expect(page.getByText("大白话", { exact: true })).toBeVisible();
  await scene("analysis");
  expect(await page.evaluate(() => localStorage.getItem("wenshan.readings.v1"))).toBeNull();
  await page.getByRole("button", { name: "保存本次问卦" }).click();
  await expect(page.getByText("已保存到此浏览器")).toBeVisible();
  await page.getByRole("button", { name: "再问一卦" }).click();
  await expect(page.getByRole("heading", { name: "入山问心" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  const rejected = await request.post("/api/reading", { data: { question: "测试", coins: [[2, 3, 4]], history: [] } });
  expect(rejected.status()).toBe(400);
  const rejectedBirth = await request.post("/api/reading", { data: { question: "测试", coins: casts, history: [], profile: { birth: "2000-04-12" } } });
  expect(rejectedBirth.status()).toBe(400);
  expect(faults).toEqual([]);
});

test("recover the legacy companion, reopen and clear a local record, and verify the guest room is available", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  await page.evaluate(() => {
    localStorage.setItem("wenshan.pet.v1", JSON.stringify({ chosen: "qingpu", profiles: { qingpu: { xp: 24 } } }));
    localStorage.setItem("wenshan.readings.v1", JSON.stringify([{
      id: "known-test", createdAt: Date.now(), pet: "qingpu", question: "此前的问题", background: "",
      casts: [[3,3,3],[3,3,3],[3,3,3],[3,3,3],[3,3,3],[3,3,3]],
      messages: [{ role: "assistant", content: "此前的解读", mode: "demo" }],
    }]));
  });
  await page.reload();
  await expect(page.locator(".world-pet").nth(2)).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("wenshan.companion.v1"))).toBe("qingpu");
  await page.getByRole("button", { name: "问卦记录" }).click();
  await page.getByRole("button", { name: /此前的问题/ }).click();
  await page.getByRole("tab", { name: "经文与白话" }).click();
  await expect(page.getByRole("heading", { name: "乾为天" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "坤为地" })).toBeVisible();
  await expect(page.getByText(/^用九/)).toBeVisible();
  await page.getByRole("tab", { name: "卦象判断" }).click();
  await expect(page.getByText("此前的解读")).toBeVisible();
  await page.getByRole("button", { name: "再问一卦" }).click();
  await page.getByRole("button", { name: "问卦记录" }).click();
  await page.getByRole("button", { name: "清除记录" }).click();
  await page.getByRole("button", { name: "确认清除" }).click();
  await expect(page.getByText("暂无记录。卦成后可在观卦阁保存。")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("wenshan.readings.v1"))).toBeNull();
  expect((await request.get("/pet-home")).status()).toBe(200);
});

test("optional profile can be set, edited, and cleared without outgoing profile data", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("出生日期", { exact: true }).fill("2000-04-12");
  await page.getByRole("combobox", { name: "性别" }).selectOption("other");
  await page.getByRole("button", { name: "保存资料" }).click();
  await page.reload();
  await page.getByRole("button", { name: "个人资料", exact: true }).click();
  await expect(page.getByLabel("出生日期", { exact: true })).toHaveValue("2000-04-12");
  await expect(page.getByRole("combobox", { name: "性别" })).toHaveValue("other");
  await expect(page.getByRole("checkbox", { name: /允许将年龄段/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: "性别" }).selectOption("undisclosed");
  await page.getByRole("button", { name: "保存资料" }).click();
  await page.getByRole("button", { name: "个人资料", exact: true }).click();
  await page.getByRole("button", { name: "清除资料" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("wenshan.profile.v1")!))).toEqual({
    birth: "", gender: "undisclosed", custom: "", consent: false,
  });
});

test("a cast uses all filled facts after per-reading consent", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("wenshan.profile.v1", JSON.stringify({
    birth: "2001-01-01", gender: "woman", custom: "", consent: true, nickname: "测试昵称", role: "求职中", city: "上海",
  })));
  await page.goto("/");
  await page.getByRole("button", { name: "选择小卦同行" }).click();
  await page.getByRole("button", { name: "入山问卦" }).click();
  await page.getByLabel("心里的问题").fill("这周面试能通过吗？");
  await page.getByText("补充问卦背景（选填）").click();
  await expect(page.getByRole("checkbox", { name: "本次解读结合我的个人资料" })).not.toBeChecked();
  await page.getByLabel("关注时间").selectOption("本周");
  await page.getByLabel("补充背景", { exact: true }).fill("二面已结束，正在等待通知。");
  await page.getByRole("checkbox", { name: "本次解读结合我的个人资料" }).check();
  await expect(page.getByText("出生城市 · 上海", { exact: true })).toBeVisible();
  for (let index = 0; index < 6; index++)
    await page.getByRole("button", { name: index ? `第 ${index + 1} 次投掷` : "掷下第一爻" }).click();
  const request = page.waitForRequest(req => req.url().endsWith("/api/reading") && req.method() === "POST");
  await page.getByRole("button", { name: "卦成，前往观卦阁" }).click();
  const input = (await request).postDataJSON();
  expect(input).toMatchObject({ focus: { period: "本周" }, background: "二面已结束，正在等待通知。", profileConsent: true });
  expect(input.profile).toMatchObject({ role: "求职中", expression: "女", birth: "2001-01-01", calendar: "solar", nickname: "测试昵称", city: "上海" });
  expect(input.coins).toHaveLength(6);
});

test("a cancelled reading discards delayed output and can retry without replacing the cast", async ({ page }) => {
  let requests = 0;
  let releaseFirst!: () => void;
  const delayed = new Promise<void>(resolve => { releaseFirst = resolve; });
  const answer = (text: string) => JSON.stringify({ answer: { mode: "demo", text } }) + "\n";
  await page.route("**/api/reading", async route => {
    const sequence = ++requests;
    if (sequence === 1) await delayed;
    await route.fulfill({ contentType: "application/x-ndjson", body: answer(sequence === 1 ? "迟到的回答" : "重试完成") }).catch(() => undefined);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  await page.evaluate(() => localStorage.setItem("wenshan.readings.v1", JSON.stringify([{
    id: "cancel-test", createdAt: Date.now(), pet: "xiaogua", question: "同一次问题", background: "",
    casts: [[3,3,3],[3,3,3],[3,3,3],[3,3,3],[3,3,3],[3,3,3]], messages: [],
  }])));
  await page.getByRole("button", { name: "问卦记录" }).click();
  await page.getByRole("button", { name: /同一次问题/ }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("已取消本次解读。")).toBeVisible();
  await page.getByRole("button", { name: "重试本地 AI" }).click();
  await expect(page.getByText("重试完成")).toBeVisible();
  releaseFirst();
  await expect(page.getByText("迟到的回答")).toHaveCount(0);
  await page.getByRole("tab", { name: "经文与白话" }).click();
  await expect(page.getByRole("heading", { name: "乾为天" })).toBeVisible();
});

test("the browser displays partial model text and an estimate before the final reply", async ({ page }) => {
  await page.addInitScript(() => {
    const load = window.fetch;
    window.fetch = (input, init) => {
      if (input !== "/api/reading") return load(input, init);
      const encode = new TextEncoder();
      let finish!: () => void;
      const state = window as typeof window & { finishReadingForTest?: () => void };
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (row: object) => controller.enqueue(encode.encode(JSON.stringify(row) + "\n"));
          send({ phase: "identifying" });
          send({ phase: "connecting" });
          send({ delta: "今日球运偏慎，进球的兆头还弱。" });
          setTimeout(() => {
            send({ phase: "explaining" });
            send({ delta: "\n\n卦象依据\n本卦「离」，初爻与四爻动，转为「艮」。" });
            finish = () => {
              send({ answer: { mode: "local", text: "今日球运偏慎，进球的兆头还弱。\n\n卦象依据\n本卦「离」，初爻与四爻动，转为「艮」。\n\n大白话\n球场云气稍沉，卦里起伏犹在。" } });
              controller.close();
            };
          }, 950);
        },
      });
      state.finishReadingForTest = () => finish();
      return Promise.resolve(new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } }));
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过" }).click();
  await page.evaluate(() => localStorage.setItem("wenshan.readings.v1", JSON.stringify([{
    id: "sport-test", createdAt: Date.now(), pet: "xiaogua", question: "我踢球能进球嘛", background: "",
    casts: [[3,3,3],[2,3,3],[2,2,3],[3,3,3],[2,3,3],[2,2,3]], messages: [],
  }])));
  await page.getByRole("button", { name: "问卦记录" }).click();
  await page.getByRole("button", { name: /我踢球能进球嘛/ }).click();
  await expect(page.locator(".reading-cast-summary")).toContainText("本卦 · 离");
  await expect(page.locator(".reading-estimate")).toBeVisible();
  const initialEstimate = await page.locator(".reading-estimate").textContent();
  await expect(page.getByTestId("reading-draft")).toContainText("球运偏慎");
  await expect(page.getByText("正在生成白话解读")).toBeVisible();
  await expect(page.locator(".reading-estimate")).not.toHaveText(initialEstimate!);
  await expect(page.getByText("本地 AI · Ollama")).toHaveCount(0);
  await page.evaluate(() => (window as typeof window & { finishReadingForTest?: () => void }).finishReadingForTest?.());
  await expect(page.getByText("本地 AI · Ollama")).toBeVisible();
  await expect(page.getByTestId("reading-draft")).toHaveCount(0);
});
