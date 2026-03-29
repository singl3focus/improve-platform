import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";
import { createFirstGraphTopic } from "./helpers/roadmap";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `material-pos.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Material Pos E2E";
const rootTitle = "E2E Mat Topic";

test.describe.configure({ mode: "serial" });

test.describe("Позиция материала: авто-инкремент при создании", () => {
  test("позиция в форме создания материала автоматически увеличивается", async ({ page }) => {
    await registerUser(page, { email, password, fullName });
    await createFirstGraphTopic(page, "Material Position Graph", rootTitle);

    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: rootTitle })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Добавить материал" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const positionInput = dialog.locator("input[type='number'][min='1']");
    await expect(positionInput).toHaveValue("1");

    await dialog.locator("input").first().fill("Материал 1");
    await dialog.locator("textarea").fill("Описание 1");
    await dialog.getByRole("button", { name: "Создать" }).click();

    await expect(page.locator(".topic-material-position")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(".topic-material-position").first()).toHaveText("#1");

    await page.getByRole("button", { name: "Добавить материал" }).click();
    await expect(dialog).toBeVisible();
    await expect(positionInput).toHaveValue("2");

    await dialog.locator("input").first().fill("Материал 2");
    await dialog.locator("textarea").fill("Описание 2");
    await dialog.getByRole("button", { name: "Создать" }).click();

    await expect(page.locator(".topic-material-position")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.locator(".topic-material-position").nth(0)).toHaveText("#1");
    await expect(page.locator(".topic-material-position").nth(1)).toHaveText("#2");

    await page.getByRole("button", { name: "Добавить материал" }).click();
    await expect(dialog).toBeVisible();
    await expect(positionInput).toHaveValue("3");
  });
});
