import { defineConfig } from '@playwright/test';
import { seedData } from './src/domain/seed';

const seededStorage = JSON.stringify(seedData());
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173/learnflow/',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:4173',
          localStorage: [{ name: 'learnflow:v1:/learnflow/', value: seededStorage }],
        },
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort --base /learnflow/',
    url: 'http://127.0.0.1:4173/learnflow/',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
