import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { registerUser } from "./helpers/auth";
import { createFirstGraphTopic } from "./helpers/roadmap";

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
    await createFirstGraphTopic(page, "Notes Graph", "Notes Test Topic");

    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Notes Test Topic" })).toBeVisible({
      timeout: 30_000
    });

    await expect(page.locator(".topic-notes")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".topic-notes").getByText("Заметки")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Пока нет заметок")).toBeVisible({ timeout: 10_000 });
  });

  test("create a note and edit it", async () => {
    await page.getByRole("button", { name: "Добавить заметку" }).click();
    await expect(page.locator(".topic-note-editor")).toBeVisible({ timeout: 10_000 });

    await page.locator(".topic-note-title-input").fill("My First Note");
    await page.locator(".topic-note-content-textarea").fill("This is e2e test content");
    await page.locator(".topic-note-content-textarea").blur();
    await page.waitForTimeout(2000);
  });

  test("note persists after page reload", async () => {
    await page.goto("/roadmap");
    await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });
    await page.locator("article.roadmap-topic-card").click();
    await expect(page).toHaveURL(/\/topics\?topicId=/, { timeout: 30_000 });

    await expect(page.locator(".topic-note-preview")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".topic-note-preview-title")).toHaveText("My First Note", {
      timeout: 10_000
    });
  });

  test("delete a note", async () => {
    await page.locator(".topic-note-preview").click();
    await expect(page.locator(".topic-note-editor")).toBeVisible({ timeout: 10_000 });

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByLabel("Delete note").click();
    await expect(page.getByText("Пока нет заметок")).toBeVisible({ timeout: 10_000 });
  });
});
