import { test, expect, type Page } from "@playwright/test";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `e2e.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "E2E User";

function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Основная навигация" });
}

test.describe.configure({ mode: "serial" });

test.describe("MVP UI flows (Docker stack)", () => {
  test("unauthenticated user is redirected from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register → dashboard, main nav, topics, settings, history, logout, login", async ({
    page
  }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Создать аккаунт" })).toBeVisible();

    await page.locator("#full-name").fill(fullName);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Создать аккаунт" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Срез обучения на сегодня" })).toBeVisible({
      timeout: 30_000
    });

    await mainNav(page).getByRole("link", { name: "Дорожная карта" }).click();
    await expect(page).toHaveURL(/\/roadmap/);
    await expect(page.locator(".roadmap-roadmap-create-entry, .roadmap-create-panel, .roadmap-topic-mutation-panel, .roadmap-empty-panel-typed").first()).toBeVisible({
      timeout: 30_000
    });

    await mainNav(page).getByRole("link", { name: "Задачи" }).click();
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole("heading", { name: "Мой канбан" })).toBeVisible({ timeout: 30_000 });

    await mainNav(page).getByRole("link", { name: "Материалы" }).click();
    await expect(page).toHaveURL(/\/materials/);
    await expect(page.locator(".materials-library-header h2")).toBeVisible({
      timeout: 30_000
    });

    // /topics без topicId редиректит на /roadmap (см. app/(private)/topics/page.tsx)
    await page.goto("/topics");
    await expect(page).toHaveURL(/\/roadmap/);
    await expect(page.getByRole("heading", { name: "Дорожная карта обучения" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();

    await page.goto("/dashboard/history");
    await expect(page.locator(".history-view h2")).toBeVisible({
      timeout: 30_000
    });

    await mainNav(page).getByRole("link", { name: "Дашборд" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Срез обучения на сегодня" })).toBeVisible({
      timeout: 30_000
    });
  });
});
