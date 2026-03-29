import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `today.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Today E2E";

test.describe.configure({ mode: "serial" });

test.describe("Today View", () => {
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

  test("today page loads via nav with empty state", async () => {
    const mainNav = page.getByRole("navigation", { name: "Основная навигация" });
    await mainNav.getByRole("link", { name: "Сегодня" }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 15_000 });

    // Page header should contain today's date
    await expect(page.locator(".today-header")).toBeVisible({ timeout: 15_000 });

    // Focus tasks section visible
    await expect(page.getByText("Фокус-задачи")).toBeVisible({ timeout: 10_000 });

    // No tasks for a fresh user
    await expect(page.getByText("На сегодня задач нет")).toBeVisible({ timeout: 10_000 });

    // Reflection section visible
    await expect(page.getByText("Микро-рефлексия")).toBeVisible({ timeout: 10_000 });
  });

  test("write and save micro-reflection", async () => {
    await page.goto("/today");
    await expect(page.locator(".today-header")).toBeVisible({ timeout: 15_000 });

    const textarea = page.locator(".today-reflection-textarea");
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    await textarea.fill("Сегодня я узнал про e2e тесты");
    // Click save button (appears when draft differs)
    await expect(page.locator(".today-reflection-save-btn")).toBeVisible({ timeout: 5_000 });
    await page.locator(".today-reflection-save-btn").click();

    // After save, the saved reflection text should appear
    await expect(page.locator(".today-reflection-text")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".today-reflection-text")).toHaveText("Сегодня я узнал про e2e тесты");
  });

  test("reflection persists after page reload", async () => {
    await page.goto("/today");
    await expect(page.locator(".today-header")).toBeVisible({ timeout: 15_000 });

    // Saved reflection should still be there
    await expect(page.locator(".today-reflection-text")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".today-reflection-text")).toHaveText("Сегодня я узнал про e2e тесты");
  });
});
