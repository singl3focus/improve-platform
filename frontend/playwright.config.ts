import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.FRONTEND_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 }
  }
});
