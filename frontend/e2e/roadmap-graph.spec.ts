import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

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

    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: "Быстрое создание первой темы" })).toBeVisible({
      timeout: 30_000
    });

    await page.getByLabel("Название темы").fill(rootTitle);
    await page.getByRole("button", { name: "Создать первую тему" }).click();

    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });
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
      const submit =
        direction === "left"
          ? "Создать слева"
          : direction === "right"
            ? "Создать справа"
            : "Создать ниже";
      await dialog.getByRole("button", { name: submit }).click();
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
            return {
              ok: false as const,
              i,
              j,
              overlapW,
              overlapH
            };
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

    // Визуальная регрессия по видимой области (viewport): размеры .roadmap-graph / сетки
    // могут долго меняться из‑за пересчёта canvas, из‑за чего toHaveScreenshot по элементу нестабилен.
    await expect(page).toHaveScreenshot("roadmap-viewport-four-topics.png", {
      animations: "disabled",
      fullPage: false,
      maxDiffPixelRatio: 0.12
    });
  });
});
