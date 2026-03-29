import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";
import { createFirstGraphTopic } from "./helpers/roadmap";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `goal.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Goal E2E";

test.describe.configure({ mode: "serial" });

test.describe("Topic Goal and Confidence (Feature 3)", () => {
  test("topic workspace shows goal placeholder for empty goal", async ({ page }) => {
    await registerUser(page, { email, password, fullName });
    await createFirstGraphTopic(page, "Goal Graph", "Goal Test Topic");

    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Goal Test Topic" })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByText("Добавьте цель")).toBeVisible({ timeout: 10_000 });
  });
});
