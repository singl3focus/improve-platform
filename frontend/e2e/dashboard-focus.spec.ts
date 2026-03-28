import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `focus.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Focus E2E";

test.describe("Dashboard Focus block", () => {
  test("dashboard shows focus block with empty state", async ({ page }) => {
    await registerUser(page, { email, password, fullName });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Срез обучения на сегодня" })).toBeVisible({
      timeout: 30_000
    });

    // Focus Today section should be visible
    await expect(page.getByText("Фокус на сегодня")).toBeVisible({ timeout: 15_000 });

    // Roadmap progress section should be visible
    await expect(page.getByText("Прогресс roadmap")).toBeVisible({ timeout: 15_000 });
  });
});
