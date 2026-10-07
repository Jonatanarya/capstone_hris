import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch:
    process.env.HRIS_E2E_MODE === "live"
      ? "**/live.spec.ts"
      : "**/hris.spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start --port 5173`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
