import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `review.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Review E2E";

test.describe("Weekly Review", () => {
  test("weekly review page loads and shows empty state", async ({ page }) => {
    await registerUser(page, { email, password, fullName });

    await page.goto("/weekly-review");
    await expect(page).toHaveURL(/\/weekly-review/);

    // Weekly review page should have the main heading
    await expect(page.getByRole("heading", { name: "Обзор недели" })).toBeVisible({
      timeout: 30_000
    });
  });
});
