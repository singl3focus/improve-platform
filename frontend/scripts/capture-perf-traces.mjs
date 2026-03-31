import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3001";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `perf.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Perf Trace";

const outputDir = path.join(process.cwd(), "perf-traces", new Date().toISOString().replace(/[:.]/g, "-"));

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function registerUser(page) {
  await page.goto(`${baseURL}/register`, { waitUntil: "networkidle" });
  await page.locator("#full-name").fill(fullName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.waitForURL(/\/(today|dashboard)/, { timeout: 30_000 });
}

async function createRoadmapAndTopics(page) {
  await page.goto(`${baseURL}/roadmap`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Создать первую roadmap" }).click();
  await page.locator(".roadmap-create-panel").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByLabel("Название roadmap").fill("Perf Graph");
  await page.locator(".roadmap-type-card").first().click();
  await page.getByRole("button", { name: "Создать roadmap" }).click();

  await page.getByRole("button", { name: "Добавить первую тему" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await dialog.getByRole("textbox").first().fill("Perf Root");
  await dialog.getByRole("button", { name: "Добавить тему" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });

  const rootMenu = page.getByRole("button", { name: "Действия для темы «Perf Root»" });
  for (const [menuLabel, title] of [
    ["Создать слева", "Perf Left"],
    ["Создать справа", "Perf Right"],
    ["Создать ниже", "Perf Below"]
  ]) {
    await rootMenu.click();
    await page.getByRole("menuitem", { name: menuLabel }).click();
    dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await dialog.getByRole("textbox").first().fill(title);
    await dialog.getByRole("button", { name: menuLabel }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
}

async function seedTopicContent(page) {
  await page.locator("article.roadmap-topic-card").filter({ hasText: "Perf Root" }).click();
  await page.waitForURL(/\/topics\?topicId=/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Perf Root" }).waitFor({ state: "visible", timeout: 30_000 });

  for (let index = 1; index <= 3; index++) {
    await page.locator(".topic-checklist .topic-panel-add-button").click();
    let dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await dialog.locator("input").first().fill(`Задача ${index}`);
    await dialog.getByRole("button", { name: "Создать" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }

  for (let index = 1; index <= 4; index++) {
    await page.locator(".topic-materials .topic-panel-add-button").click();
    let dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await dialog.locator("input").first().fill(`Материал ${index}`);
    await dialog.locator("textarea").fill(`Описание ${index}`);
    await dialog.getByRole("button", { name: "Создать" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
}

async function startTrace(page) {
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  await page.evaluate(() => {
    window.__perfObserverState = {
      longTasks: [],
      layoutShifts: []
    };

    if (!window.__perfLongTaskObserverInstalled) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfObserverState.longTasks.push({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      }).observe({ type: "longtask", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__perfObserverState.layoutShifts.push({
            value: entry.value,
            startTime: entry.startTime
          });
        }
      }).observe({ type: "layout-shift", buffered: true });

      window.__perfLongTaskObserverInstalled = true;
    } else {
      window.__perfObserverState.longTasks = [];
      window.__perfObserverState.layoutShifts = [];
    }
  });

  const streamPromise = new Promise((resolve) => {
    client.once("Tracing.tracingComplete", resolve);
  });

  await client.send("Tracing.start", {
    categories: [
      "-*",
      "devtools.timeline",
      "disabled-by-default-devtools.timeline",
      "disabled-by-default-devtools.timeline.frame",
      "blink.user_timing",
      "loading",
      "v8.execute"
    ].join(","),
    options: "sampling-frequency=10000",
    transferMode: "ReturnAsStream"
  });

  return { client, streamPromise };
}

async function stopTrace(client, streamPromise) {
  await client.send("Tracing.end");
  const { stream } = await streamPromise;
  let trace = "";
  while (true) {
    const chunk = await client.send("IO.read", { handle: stream });
    trace += chunk.data ?? "";
    if (chunk.eof) break;
  }
  await client.send("IO.close", { handle: stream });
  return trace;
}

function summarizeTrace(traceJson) {
  const trace = JSON.parse(traceJson);
  const events = Array.isArray(trace.traceEvents) ? trace.traceEvents : [];
  const heavyEvents = events
    .filter((event) => event && event.ph === "X" && typeof event.dur === "number")
    .map((event) => ({
      name: event.name,
      durationMs: event.dur / 1000
    }))
    .filter((event) => event.durationMs >= 20)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  const byName = new Map();
  for (const event of heavyEvents) {
    byName.set(event.name, (byName.get(event.name) ?? 0) + 1);
  }

  return {
    heavyEvents,
    heavyEventCounts: Object.fromEntries(byName.entries())
  };
}

async function captureScenario(page, name, action) {
  const { client, streamPromise } = await startTrace(page);
  await action();
  await page.waitForTimeout(700);
  const traceJson = await stopTrace(client, streamPromise);
  const observerState = await page.evaluate(() => window.__perfObserverState);

  const tracePath = path.join(outputDir, `${name}.trace.json`);
  await fs.writeFile(tracePath, traceJson, "utf8");

  const summary = summarizeTrace(traceJson);
  const totalLayoutShift = (observerState.layoutShifts ?? []).reduce((sum, item) => sum + item.value, 0);
  return {
    name,
    tracePath,
    longTaskCount: observerState.longTasks?.length ?? 0,
    longestLongTaskMs: Math.max(0, ...(observerState.longTasks ?? []).map((item) => item.duration)),
    totalLayoutShift,
    topEvents: summary.heavyEvents.slice(0, 5)
  };
}

async function traceDashboard(page) {
  await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Срез обучения на сегодня/ }).waitFor({ state: "visible", timeout: 30_000 });
  return captureScenario(page, "dashboard-scroll", async () => {
    for (let step = 0; step < 4; step++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(180);
    }
    for (let step = 0; step < 4; step++) {
      await page.mouse.wheel(0, -900);
      await page.waitForTimeout(180);
    }
  });
}

async function traceRoadmap(page) {
  await page.goto(`${baseURL}/roadmap`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Дорожная карта обучения" }).waitFor({ state: "visible", timeout: 30_000 });
  const canvas = page.locator(".roadmap-graph-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Roadmap canvas is not visible.");

  return captureScenario(page, "roadmap-pan-zoom", async () => {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -700);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(200);
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 220, centerY + 40, { steps: 16 });
    await page.mouse.move(centerX + 120, centerY - 20, { steps: 16 });
    await page.mouse.up();
  });
}

async function traceRoadmapLongSession(page) {
  await page.goto(`${baseURL}/roadmap`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Дорожная карта обучения" }).waitFor({ state: "visible", timeout: 30_000 });
  const canvas = page.locator(".roadmap-graph-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Roadmap canvas is not visible.");

  return captureScenario(page, "roadmap-long-session-pan-zoom", async () => {
    await page.waitForTimeout(6000);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -700);
    await page.waitForTimeout(220);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(220);
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 220, centerY + 40, { steps: 20 });
    await page.mouse.move(centerX + 120, centerY - 20, { steps: 20 });
    await page.mouse.up();
  });
}

async function traceTopic(page) {
  await page.goto(page.url().includes("/topics?topicId=") ? page.url() : `${baseURL}/topics`, {
    waitUntil: "networkidle"
  });
  await page.getByRole("heading", { name: "Perf Root" }).waitFor({ state: "visible", timeout: 30_000 });
  return captureScenario(page, "topic-scroll", async () => {
    for (let step = 0; step < 4; step++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(180);
    }
    for (let step = 0; step < 4; step++) {
      await page.mouse.wheel(0, -700);
      await page.waitForTimeout(180);
    }
  });
}

async function main() {
  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await registerUser(page);
  await createRoadmapAndTopics(page);
  await seedTopicContent(page);

  const topicSummary = await traceTopic(page);
  const roadmapSummary = await traceRoadmap(page);
  const roadmapLongSessionSummary = await traceRoadmapLongSession(page);
  const dashboardSummary = await traceDashboard(page);

  const summary = {
    generatedAt: new Date().toISOString(),
    baseURL,
    traces: [dashboardSummary, roadmapSummary, roadmapLongSessionSummary, topicSummary]
  };

  const summaryPath = path.join(outputDir, "summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify({ outputDir, summary }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
