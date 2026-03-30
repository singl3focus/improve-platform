import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `e2e.profile.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Иван Петров";

test.describe.configure({ mode: "serial" });

test.describe("Profile flow", () => {
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

  test("sidebar shows user initials and full name", async () => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    const identity = page.locator(".user-identity");
    await expect(identity).toBeVisible({ timeout: 15_000 });
    await expect(identity.locator(".user-avatar")).toContainText("ИП");
    await expect(identity.locator(".user-full-name")).toHaveText(fullName);
  });

  test("clicking avatar navigates to /profile", async () => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await page.locator(".user-identity").click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test("profile page shows user info", async () => {
    await page.goto("/profile");

    await expect(page.locator(".profile-name")).toHaveText(fullName, { timeout: 15_000 });
    await expect(page.locator(".profile-meta-card")).toHaveCount(4);
    await expect(page.locator(".profile-meta-card").nth(1)).toContainText(email);
    await expect(page.locator(".profile-meta-card").nth(2).locator("strong")).toContainText(/\S+/);
  });

  test("profile page allows changing full name", async () => {
    const newName = "Иван Сидоров";
    await page.goto("/profile");
    await expect(page.locator(".profile-name")).toBeVisible({ timeout: 15_000 });

    await page.locator(".profile-section-card").first().locator("input[type='text']").fill(newName);
    await page.locator(".profile-section-card").first().locator("button[type='submit']").click();

    await expect(page.locator(".profile-success").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".profile-name")).toHaveText(newName);
    await expect(page.locator(".user-full-name")).toHaveText(newName);
  });

  test("profile page shows error on wrong current password", async () => {
    await page.goto("/profile");
    await expect(page.locator(".profile-name")).toBeVisible({ timeout: 15_000 });

    const passwordSection = page.locator(".profile-section-card").nth(2);
    await passwordSection.locator("input").nth(0).fill("wrongpassword");
    await passwordSection.locator("input").nth(1).fill("NewPassword123!");
    await passwordSection.locator("button[type='submit']").click();

    await expect(page.locator(".profile-error").first()).toBeVisible({ timeout: 10_000 });
  });
});
