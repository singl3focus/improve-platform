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

  test("create first roadmap from roadmap section, switcher appears", async () => {
    await page.goto("/roadmap");
    await page.getByRole("button", { name: "Создать первую roadmap" }).click();
    await expect(page.locator(".roadmap-create-panel")).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("Название roadmap").fill("RM1 Graph");
    await page.locator(".roadmap-type-card").first().click();
    await page.getByRole("button", { name: "Создать roadmap" }).click();

    await expect(page.locator(".roadmap-type-pill")).toContainText("Графовый roadmap", {
      timeout: 30_000
    });
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });
  });

  test("create second roadmap via switcher", async () => {
    await page.goto("/roadmap");
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });

    await page.locator(".roadmap-switcher-trigger").click();
    await expect(page.locator(".roadmap-switcher-dropdown")).toBeVisible();
    await page.locator(".roadmap-switcher-new").click();

    await expect(page.locator(".roadmap-switcher-create-panel")).toBeVisible({ timeout: 5_000 });
    await page.locator(".roadmap-switcher-create-panel .input").fill("Second Cycles");
    await page.locator(".roadmap-switcher-create-panel .roadmap-type-card").nth(2).click();
    await page
      .locator(".roadmap-switcher-create-panel")
      .getByRole("button", { name: "Создать roadmap" })
      .click();

    await expect(page.locator(".roadmap-switcher-label")).toHaveText("Second Cycles", {
      timeout: 10_000
    });
    await expect(page.locator(".roadmap-type-pill")).toContainText("Cycles roadmap", {
      timeout: 10_000
    });
  });

  test("switch back to first roadmap", async () => {
    await page.goto("/roadmap");
    await expect(page.locator(".roadmap-switcher")).toBeVisible({ timeout: 10_000 });

    await page.locator(".roadmap-switcher-trigger").click();
    await expect(page.locator(".roadmap-switcher-dropdown")).toBeVisible();

    const items = page.locator(".roadmap-switcher-item:not(.roadmap-switcher-new)");
    await expect(items).toHaveCount(2, { timeout: 5_000 });
    await items.first().click();

    await expect(page.locator(".roadmap-switcher-label")).toHaveText("RM1 Graph", {
      timeout: 10_000
    });
    await expect(page.locator(".roadmap-type-pill")).toContainText("Графовый roadmap");
  });
});
