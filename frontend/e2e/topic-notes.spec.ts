import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { registerUser } from "./helpers/auth";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `notes.${runId}@example.com`;
const password = "E2ePassword123!";
const fullName = "Notes E2E";

test.describe.configure({ mode: "serial" });

test.describe("Topic Notes", () => {
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

  test("topic workspace shows notes section with empty state", async () => {
    // Create a topic via quick-create
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: "Быстрое создание первой темы" })).toBeVisible({
      timeout: 30_000
    });
    await page.getByLabel("Название темы").fill("Notes Test Topic");
    await page.getByRole("button", { name: "Создать первую тему" }).click();
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });

    // Navigate to topic workspace
    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Notes Test Topic" })).toBeVisible({
      timeout: 30_000
    });

    // Notes section should be visible
    await expect(page.locator(".topic-notes")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".topic-notes").getByText("Заметки")).toBeVisible({ timeout: 10_000 });

    // Empty state
    await expect(page.getByText("Пока нет заметок")).toBeVisible({ timeout: 10_000 });
  });

  test("create a note and edit it", async () => {
    // Click "Добавить заметку"
    await page.getByRole("button", { name: "Добавить заметку" }).click();

    // Note editor should appear
    await expect(page.locator(".topic-note-editor")).toBeVisible({ timeout: 10_000 });

    // Type title and content
    await page.locator(".topic-note-title-input").fill("My First Note");
    await page.locator(".topic-note-content-textarea").fill("This is e2e test content");

    // Blur to trigger auto-save
    await page.locator(".topic-note-content-textarea").blur();

    // Wait for save (debounce + network)
    await page.waitForTimeout(2000);
  });

  test("note persists after page reload", async () => {
    await page.goto("/roadmap");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });
    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });

    // Note should still be visible as a preview
    await expect(page.locator(".topic-note-preview")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".topic-note-preview-title")).toHaveText("My First Note", {
      timeout: 10_000
    });
  });

  test("delete a note", async () => {
    // Open note editor
    await page.locator(".topic-note-preview").click();
    await expect(page.locator(".topic-note-editor")).toBeVisible({ timeout: 10_000 });

    // Accept the confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Click delete
    await page.getByLabel("Delete note").click();

    // Note should be removed, empty state should return
    await expect(page.getByText("Пока нет заметок")).toBeVisible({ timeout: 10_000 });
  });
});
