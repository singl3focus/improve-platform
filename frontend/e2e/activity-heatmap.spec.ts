import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `heatmap.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Heatmap E2E";

test.describe("Activity Heatmap on Dashboard", () => {
  test("dashboard shows activity heatmap section with stats", async ({ page }) => {
    await registerUser(page, { email, password, fullName });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Срез обучения на сегодня" })).toBeVisible({
      timeout: 30_000
    });

    // Heatmap section should be visible
    await expect(page.locator(".heatmap-section")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Активность")).toBeVisible({ timeout: 10_000 });

    // Streak and active days stats should be displayed
    await expect(page.getByText(/Серия:/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Активных дней:/)).toBeVisible({ timeout: 10_000 });

    // SVG heatmap grid should be rendered
    await expect(page.locator(".heatmap-svg")).toBeVisible({ timeout: 10_000 });

    // Legend should be visible
    await expect(page.getByText("Меньше")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Больше")).toBeVisible({ timeout: 5_000 });
  });
});
