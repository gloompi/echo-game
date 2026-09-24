import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

interface Players {
  host: Page;
  friend: Page;
}

/** Separate real browser contexts, with diagnostics retained for either player's failure. */
export const test = base.extend<{ players: Players }>({
  players: async ({ browser, baseURL, viewport }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    let fixtureFailed = false;
    let cleanupErrors: unknown[] = [];
    try {
      const hostContext = await browser.newContext({ baseURL, viewport });
      contexts.push(hostContext);
      const friendContext = await browser.newContext({ baseURL, viewport });
      contexts.push(friendContext);
      // Playwright Test owns tracing for every context through the configured trace policy.
      const host = await hostContext.newPage();
      const friend = await friendContext.newPage();
      for (const [name, page] of [
        ['host', host],
        ['friend', friend],
      ] as const) {
        page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
        });
      }
      await use({ host, friend });
      expect(errors, 'Neither player should encounter an unhandled browser error.').toEqual([]);
    } catch (error) {
      fixtureFailed = true;
      throw error;
    } finally {
      const failed =
        fixtureFailed || testInfo.status !== testInfo.expectedStatus || errors.length > 0;
      // Always attempt every cleanup. Diagnostic failures must not hide the original test failure.
      const cleanup = await Promise.allSettled(
        contexts.map(async (context, index) => {
          try {
            if (failed) {
              const page = context.pages()[0];
              if (page && !page.isClosed()) {
                await page
                  .screenshot({ path: testInfo.outputPath(`player-${index}.png`) })
                  .catch(() => {});
              }
            }
          } finally {
            await context.close();
          }
        }),
      );
      if (errors.length) {
        await testInfo.attach('browser-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain',
        });
      }
      if (!failed) {
        const rejected = cleanup.filter(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        cleanupErrors = rejected.map((result): unknown => result.reason);
      }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Browser cleanup failed.');
  },
});

export { expect };
