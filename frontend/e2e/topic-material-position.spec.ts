import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `material-pos.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Material Pos E2E";
const rootTitle = "E2E Mat Topic";

test.describe.configure({ mode: "serial" });

test.describe("Позиция материала: авто-инкремент при создании", () => {
  test("позиция в форме создания материала автоматически увеличивается", async ({ page }) => {
    await registerUser(page, { email, password, fullName });

    // Создаём корневую тему через roadmap quick-create
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: "Быстрое создание первой темы" })).toBeVisible({
      timeout: 30_000
    });
    await page.getByLabel("Название темы").fill(rootTitle);
    await page.getByRole("button", { name: "Создать первую тему" }).click();
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });

    // Переходим на страницу темы по клику на карточку
    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: rootTitle })).toBeVisible({ timeout: 30_000 });

    // Открываем форму создания материала — позиция должна быть "1" (нет материалов)
    await page.getByRole("button", { name: "Добавить материал" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const positionInput = dialog.locator("input[type='number'][min='1']");
    await expect(positionInput).toHaveValue("1");

    // Заполняем форму и создаём первый материал
    await dialog.locator("input").first().fill("Материал 1");
    await dialog.locator("textarea").fill("Описание 1");
    await dialog.getByRole("button", { name: "Создать" }).click();

    // Ждём обновления списка — должен появиться #1
    await expect(page.locator(".topic-material-position")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(".topic-material-position").first()).toHaveText("#1");

    // Открываем форму снова — позиция должна быть "2"
    await page.getByRole("button", { name: "Добавить материал" }).click();
    await expect(dialog).toBeVisible();
    await expect(positionInput).toHaveValue("2");

    // Создаём второй материал
    await dialog.locator("input").first().fill("Материал 2");
    await dialog.locator("textarea").fill("Описание 2");
    await dialog.getByRole("button", { name: "Создать" }).click();

    // Ждём обновления списка — должны быть #1 и #2
    await expect(page.locator(".topic-material-position")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.locator(".topic-material-position").nth(0)).toHaveText("#1");
    await expect(page.locator(".topic-material-position").nth(1)).toHaveText("#2");

    // Открываем форму снова — позиция должна быть "3"
    await page.getByRole("button", { name: "Добавить материал" }).click();
    await expect(dialog).toBeVisible();
    await expect(positionInput).toHaveValue("3");
  });
});
