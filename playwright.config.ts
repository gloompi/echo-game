import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.e2e.ts', timeout: 45_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3107', viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'node scripts/play.mjs', url: 'http://127.0.0.1:3107/health', reuseExistingServer: false, timeout: 30_000,
    env: { PORT: '3107', ECHO_WT_PORT: '4447', ECHO_ACCESS_KEY: '', ECHO_DELAY_MS: '3000', ECHO_PUBLIC_URL: '' },
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
