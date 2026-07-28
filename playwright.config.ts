import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
  },
  // Mobile is the primary target, so it is the primary project. Testing this
  // game at desktop width would be testing a layout no player uses.
  projects: [{ name: 'iPhone 13', use: { ...devices['iPhone 13'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
