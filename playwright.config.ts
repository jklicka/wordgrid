import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { trace: 'on-first-retry' },

  projects: [
    // Mobile is the primary target, so it is the primary project. Testing this
    // game at desktop width would be testing a layout no player uses.
    {
      name: 'iPhone 13',
      testIgnore: /offline\.spec\.ts/,
      use: { ...devices['iPhone 13'], baseURL: 'http://localhost:5180' },
    },
    // The service worker only exists in a production build, so offline tests
    // run against `vite preview`, not the dev server.
    {
      name: 'offline (built)',
      testMatch: /offline\.spec\.ts/,
      use: { ...devices['iPhone 13'], baseURL: 'http://localhost:5181' },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5180',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:5181',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
