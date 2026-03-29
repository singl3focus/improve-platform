import { expect, type Page } from "@playwright/test";

export async function createGraphRoadmap(page: Page, roadmapTitle: string) {
  await page.goto("/roadmap");
  await page.getByRole("button", { name: "Создать первую roadmap" }).click();
  await expect(page.locator(".roadmap-create-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Название roadmap").fill(roadmapTitle);
  await page.locator(".roadmap-type-card").first().click();
  await page.getByRole("button", { name: "Создать roadmap" }).click();
  await expect(page.locator(".roadmap-type-pill")).toContainText("Графовый roadmap", {
    timeout: 30_000
  });
}

export async function createFirstGraphTopic(
  page: Page,
  roadmapTitle: string,
  topicTitle: string
) {
  await createGraphRoadmap(page, roadmapTitle);
  await page.getByRole("button", { name: "Добавить первую тему" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("textbox").first().fill(topicTitle);
  await dialog.getByRole("button", { name: "Добавить тему" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.locator("article.roadmap-topic-card")).toHaveCount(1, { timeout: 30_000 });
}
