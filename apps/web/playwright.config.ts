import { defineConfig, devices } from '@playwright/test';

// Runs against the Vite dev server and a local Supabase (`pnpm db:start`).
// Sign-in uses the dev email/password form (VITE_ENABLE_DEV_LOGIN=true).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /pwa\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /pwa\.spec\.ts/ },
    // The service worker only registers in production builds, so the PWA
    // check runs against `vite preview` of a real build.
    {
      name: 'pwa',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' },
      testMatch: /pwa\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm exec vite --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command:
        'pnpm exec vite build --outDir dist-e2e --emptyOutDir && pnpm exec vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
