import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: `http://127.0.0.1:4173${process.env.PLAYWRIGHT_BASE_PATH || "/"}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: `http://127.0.0.1:4173${process.env.PLAYWRIGHT_BASE_PATH || "/"}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
