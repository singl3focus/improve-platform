import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";
import { createFirstGraphTopic } from "./helpers/roadmap";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `roadmap.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Roadmap E2E";
const rootTitle = "E2E Root";

test.describe.configure({ mode: "serial" });

test.describe("Roadmap graph: направления, стрелки, без перекрытий", () => {
  test("корневая тема → три направления (слева, справа, ниже), стрелки, карточки не пересекаются", async ({
    page
  }) => {
    await registerUser(page, { email, password, fullName });
    await createFirstGraphTopic(page, "Roadmap Graph E2E", rootTitle);
    await expect(page.getByRole("heading", { name: "Дорожная карта обучения" })).toBeVisible();

    const rootMenu = page.getByRole("button", { name: `Действия для темы «${rootTitle}»` });

    async function createFromMenu(direction: "left" | "right" | "below", title: string) {
      await rootMenu.click();
      const itemName =
        direction === "left"
          ? "Создать слева"
          : direction === "right"
            ? "Создать справа"
            : "Создать ниже";
      await page.getByRole("menuitem", { name: itemName }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox").first().fill(title);
      await dialog.getByRole("button", { name: itemName }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await page.keyboard.press("Escape");
    }

    await createFromMenu("left", "E2E Left");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(2, { timeout: 30_000 });

    await createFromMenu("right", "E2E Right");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(3, { timeout: 30_000 });

    await createFromMenu("below", "E2E Below");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(4, { timeout: 30_000 });

    const arrowPaths = page.locator(
      "svg.roadmap-connections path.roadmap-connection:not(.roadmap-connection-preview)"
    );
    await expect(arrowPaths).toHaveCount(3);

    const noTileOverlap = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>(".roadmap-topic-card")];
      const rects = nodes.map((el) => el.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapW > 4 && overlapH > 4) {
            return { ok: false as const, i, j, overlapW, overlapH };
          }
        }
      }
      return { ok: true as const };
    });

    expect(noTileOverlap.ok, noTileOverlap.ok ? "" : JSON.stringify(noTileOverlap)).toBe(true);
    await expect(page.getByText("заблокирован", { exact: false })).toHaveCount(0);
    await expect(page.getByText("blocked", { exact: false })).toHaveCount(0);
    await expect(page.locator("ul.roadmap-graph-nodes")).toBeVisible();

    const pathDs = await page
      .locator("svg.roadmap-connections path.roadmap-connection:not(.roadmap-connection-preview)")
      .evaluateAll((paths) => paths.map((p) => p.getAttribute("d") ?? ""));
    expect(pathDs).toHaveLength(3);
    for (const d of pathDs) {
      expect(d.length).toBeGreaterThan(12);
    }

    await expect(page).toHaveScreenshot("roadmap-viewport-four-topics.png", {
      animations: "disabled",
      fullPage: false,
      maxDiffPixelRatio: 0.12
    });
  });

  test("дочерние темы «снизу» располагаются горизонтально в строку", async ({ page }) => {
    const belowRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const belowEmail = `roadmap-below.${belowRunId}@example.com`;
    const parentTitle = "E2E Below Parent";

    await registerUser(page, { email: belowEmail, password, fullName: "Below E2E" });
    await createFirstGraphTopic(page, "Below Graph E2E", parentTitle);

    const parentMenu = page.getByRole("button", { name: `Действия для темы «${parentTitle}»` });

    async function createBelow(title: string) {
      await parentMenu.click();
      await page.getByRole("menuitem", { name: "Создать ниже" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox").first().fill(title);
      await dialog.getByRole("button", { name: "Создать ниже" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await page.keyboard.press("Escape");
    }

    await createBelow("E2E Below 1");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(2, { timeout: 30_000 });

    await createBelow("E2E Below 2");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(3, { timeout: 30_000 });

    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>(".roadmap-topic-card")];
      return cards.map((el) => {
        const r = el.getBoundingClientRect();
        return { title: el.textContent?.trim().slice(0, 30) ?? "", top: r.top, left: r.left };
      });
    });

    const below1 = layout.find((c) => c.title.includes("Below 1"));
    const below2 = layout.find((c) => c.title.includes("Below 2"));
    expect(below1).toBeTruthy();
    expect(below2).toBeTruthy();
    expect(Math.abs(below1!.top - below2!.top)).toBeLessThan(10);
    expect(Math.abs(below1!.left - below2!.left)).toBeGreaterThan(50);

    const arrowPaths = page.locator(
      "svg.roadmap-connections path.roadmap-connection:not(.roadmap-connection-preview)"
    );
    await expect(arrowPaths).toHaveCount(2);

    const noOverlap = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>(".roadmap-topic-card")];
      const rects = nodes.map((el) => el.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapW > 4 && overlapH > 4) return { ok: false as const, i, j };
        }
      }
      return { ok: true as const };
    });
    expect(noOverlap.ok, noOverlap.ok ? "" : JSON.stringify(noOverlap)).toBe(true);
  });

  test("дочерние темы «справа» располагаются вертикально в столбец", async ({ page }) => {
    const rightRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rightEmail = `roadmap-right.${rightRunId}@example.com`;
    const parentTitle = "E2E Right Parent";

    await registerUser(page, { email: rightEmail, password, fullName: "Right E2E" });
    await createFirstGraphTopic(page, "Right Graph E2E", parentTitle);

    const parentMenu = page.getByRole("button", { name: `Действия для темы «${parentTitle}»` });

    async function createRight(title: string) {
      await parentMenu.click();
      await page.getByRole("menuitem", { name: "Создать справа" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox").first().fill(title);
      await dialog.getByRole("button", { name: "Создать справа" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
      await page.keyboard.press("Escape");
    }

    await createRight("E2E Right 1");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(2, { timeout: 30_000 });

    await createRight("E2E Right 2");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(3, { timeout: 30_000 });

    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>(".roadmap-topic-card")];
      return cards.map((el) => {
        const r = el.getBoundingClientRect();
        return { title: el.textContent?.trim().slice(0, 30) ?? "", top: r.top, left: r.left };
      });
    });

    const right1 = layout.find((c) => c.title.includes("Right 1"));
    const right2 = layout.find((c) => c.title.includes("Right 2"));
    expect(right1).toBeTruthy();
    expect(right2).toBeTruthy();
    expect(Math.abs(right1!.left - right2!.left)).toBeLessThan(10);
    expect(Math.abs(right1!.top - right2!.top)).toBeGreaterThan(50);

    const arrowPaths = page.locator(
      "svg.roadmap-connections path.roadmap-connection:not(.roadmap-connection-preview)"
    );
    await expect(arrowPaths).toHaveCount(2);

    const noOverlap = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>(".roadmap-topic-card")];
      const rects = nodes.map((el) => el.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapW > 4 && overlapH > 4) return { ok: false as const, i, j };
        }
      }
      return { ok: true as const };
    });
    expect(noOverlap.ok, noOverlap.ok ? "" : JSON.stringify(noOverlap)).toBe(true);
  });
});
