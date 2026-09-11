import { test, expect } from '@playwright/test';

test('menu initializes the WebGL scene without browser errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#quick-play')).toBeVisible();
  await page.locator('#practice').click(); await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#role-label')).toContainText('HIDER');
  expect(errors).toEqual([]);
});

test('two browser clients can join a private room and start a round', async ({ browser }) => {
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' }), b = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const host = await a.newPage(), friend = await b.newPage();
    await host.goto('/'); await friend.goto('/');
    await expect(host.locator('#loading')).toBeHidden(); await expect(friend.locator('#loading')).toBeHidden();
    await host.locator('[data-role="seeker"]').click(); await host.locator('#create-room').click();
    await expect(host.locator('#lobby')).toBeVisible(); await host.locator('#fill-bots').uncheck();
    const code = (await host.locator('#lobby-code-value').textContent())!.trim();
    await friend.locator('[data-modal="join"]').first().click(); await friend.locator('#join-code').fill(code); await friend.locator('#join-form button[type="submit"]').click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    await host.locator('#start-round').click();
    await expect(host.locator('#hud')).toBeVisible(); await expect(friend.locator('#hud')).toBeVisible();
    await expect(host.locator('#phase-label')).toHaveText('HEAD START');
    await expect(friend.locator('#room-code')).toHaveText(code);
  } finally { await a.close(); await b.close(); }
});

test('real WebSocket seeker feed has no current remote poses during warm-up', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const ws = new WebSocket(`ws://${location.host}/socket`);
    return await new Promise<{ firstEmpty: boolean; age: number; laterVisible: boolean }>((resolve, reject) => {
      let firstEmpty = false, seen = false;
      const timer = setTimeout(() => { ws.close(); reject(new Error('Snapshot timeout')); }, 9000);
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket error')); };
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', mode: 'practice', name: 'ProtocolTest', preference: 'seeker' }));
      ws.onmessage = event => {
        const s = JSON.parse(event.data); if (s.type !== 'snapshot') return;
        if (!seen) { firstEmpty = s.players.length === 0; seen = true; }
        if (s.players.length > 0) { clearTimeout(timer); ws.close(); resolve({ firstEmpty, age: s.now - s.viewTime, laterVisible: true }); }
      };
    });
  });
  expect(result).toEqual({ firstEmpty: true, age: 3000, laterVisible: true });
});
