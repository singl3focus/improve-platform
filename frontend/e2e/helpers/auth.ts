import type { Page } from "@playwright/test";

export async function registerUser(
  page: Page,
  params: { email: string; password: string; fullName: string }
): Promise<void> {
  await page.goto("/register");
  await page.locator("#full-name").fill(params.fullName);
  await page.locator("#email").fill(params.email);
  await page.locator("#password").fill(params.password);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.waitForURL(/\/(today|dashboard)/, { timeout: 30_000 });
}
