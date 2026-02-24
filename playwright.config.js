const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PLAYWRIGHT_PORT || '4173';

module.exports = defineConfig({
  testDir: './tests/ui',
  timeout: 180000,
  expect: {
    timeout: 30000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    port: Number(PORT),
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    {
      name: 'chromium',
      use: process.env.CI
        ? { ...devices['Desktop Chrome'] }
        : { ...devices['Desktop Chrome'], channel: 'chrome' }
    }
  ]
});
