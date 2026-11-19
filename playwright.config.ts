import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3191";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "msedge",
    launchOptions: { args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: "mobile-375", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, reducedMotion: "reduce" } },
  ],
  webServer: {
    command: "npm run start -- --port 3191",
    url: baseURL,
    reuseExistingServer: false,
    env: { NEXT_TELEMETRY_DISABLED: "1", OLLAMA_MODEL: "wenshan-unavailable-test", OLLAMA_BASE_URL: "http://127.0.0.1:3192", WENSHAN_ACCOUNTS_DATA: "memory://" },
  },
});
