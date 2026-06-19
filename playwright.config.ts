import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-api.mjs",
      port: 5999,
      reuseExistingServer: false,
    },
    {
      command: "PORT=4173 BASE_PATH=/ VITE_API_TARGET=http://127.0.0.1:5999 pnpm --filter @workspace/nutrition-app dev",
      port: 4173,
      reuseExistingServer: false,
    },
  ],
});
