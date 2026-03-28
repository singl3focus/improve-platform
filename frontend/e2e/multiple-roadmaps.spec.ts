import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `multi-rm.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Multi RM E2E";

test.describe.configure({ mode: "serial" });

test.describe("Multiple Roadmaps", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
    await registerUser(page, { email, password, fullName });
  });

  test.afterAll(async () => {
    await ctx.close();
  });

  test("quick-create creates first roadmap and topic, switcher appears", async () => {
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: "Быстрое создание первой темы" })).toBeVisible({
      timeout: 30_000
    });

    await page.getByLabel("Название темы").fill("RM1 Topic");
    await page.getByRole("button", { name: "Создать первую тему" }).click();

    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });

    // Roadmap switcher should appear in sidebar
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });
  });

  test("create second roadmap via switcher", async () => {
    await page.goto("/roadmap");
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });

    // Open switcher dropdown
    await page.locator(".roadmap-switcher-trigger").click();
    await expect(page.locator(".roadmap-switcher-dropdown")).toBeVisible();

    // Click "Название новой дорожной карты" button to start creating
    await page.locator(".roadmap-switcher-new").click();

    // Fill in new roadmap title and press Enter
    const input = page.locator(".roadmap-switcher-create-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("Second Roadmap");
    await input.press("Enter");

    // Switcher should now show "Second Roadmap" as active
    await expect(page.locator(".roadmap-switcher-label")).toHaveText("Second Roadmap", { timeout: 10_000 });
  });

  test("switch back to first roadmap, topic is still there", async () => {
    await page.goto("/roadmap");
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });

    // Open dropdown
    await page.locator(".roadmap-switcher-trigger").click();
    await expect(page.locator(".roadmap-switcher-dropdown")).toBeVisible();

    // The first roadmap item (not the active one) should exist
    const items = page.locator(".roadmap-switcher-item:not(.roadmap-switcher-new)");
    await expect(items).toHaveCount(2, { timeout: 5000 });

    // Click the first item
    await items.first().click();

    // Topic card from first roadmap should be visible
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("article.roadmap-topic-card").getByText("RM1 Topic")).toBeVisible();
  });
});
