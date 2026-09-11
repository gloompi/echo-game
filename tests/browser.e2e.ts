import { test, expect } from '@playwright/test';
test('menu initializes WebGL and hider practice without browser errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#quick-play')).toBeVisible();
  await page.locator('[data-role="hider"]').click(); await page.locator('#practice').click();
  await expect(page.locator('#hud')).toBeVisible(); await expect(page.locator('#role-label')).toContainText('HIDER');
  expect(errors).toEqual([]);
});
test('two browsers synchronize host settings, play, and return to the lobby', async ({ browser }) => {
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' }), b = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  try {
    const host = await a.newPage(), friend = await b.newPage(); const errors: string[] = [];
    host.on('pageerror', e => errors.push(e.message)); friend.on('pageerror', e => errors.push(e.message));
    await host.goto('/'); await friend.goto('/');
    await expect(host.locator('#loading')).toBeHidden(); await expect(friend.locator('#loading')).toBeHidden();
    await host.locator('[data-role="seeker"]').click(); await host.locator('#create-room').click();
    await expect(host.locator('#lobby')).toBeVisible(); await host.locator('#fill-bots').uncheck();
    await host.locator('#room-delay').evaluate((node: HTMLInputElement) => { node.value = '1.25'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await host.locator('#room-duration').fill('90'); await host.locator('#room-seekers').fill('1'); await host.locator('#save-room-settings').click();
    await expect(host.locator('#delay-output')).toHaveText('1.25s');
    const code = (await host.locator('#lobby-code-value').textContent())!.trim();
    await friend.locator('[data-role="hider"]').click(); await friend.goto(`/?room=${code}`);
    await friend.locator('#join-form button[type="submit"]').click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    await expect(friend.locator('#room-delay')).toHaveValue('1.25'); await expect(friend.locator('#room-delay')).toBeDisabled();
    await host.locator('#start-round').click();
    await expect(host.locator('#hud')).toBeVisible(); await expect(friend.locator('#hud')).toBeVisible();
    await expect(host.locator('#phase-label')).toHaveText('HEAD START');
    await expect(friend.locator('#room-code')).toHaveText(code); await expect(friend.locator('#configured-delay')).toHaveText('−1.25s');
    await host.locator('#pause-button').click(); await host.locator('#host-return-lobby').click();
    await expect(host.locator('#lobby')).toBeVisible(); await expect(friend.locator('#lobby')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await a.close(); await b.close(); }
});
test('real seeker WebSocket feed excludes current Hiders during warmup', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const ws = new WebSocket(`ws://${location.host}/socket`);
    return await new Promise<{ firstEmpty: boolean; age: number; laterVisible: boolean }>((resolve, reject) => {
      let firstEmpty = false, seen = false;
      const timer = setTimeout(() => { ws.close(); reject(new Error('Snapshot timeout')); }, 9000);
      ws.onerror = () => { clearTimeout(timer); ws.close(); reject(new Error('WebSocket error')); };
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', mode: 'practice', name: 'ProtocolTest', preference: 'seeker' }));
      ws.onmessage = event => {
        const s = JSON.parse(event.data); if (s.type !== 'snapshot') return;
        const hiders = s.players.filter((p: { role: string }) => p.role === 'hider');
        if (!seen) { firstEmpty = hiders.length === 0; seen = true; }
        if (hiders.length > 0) { clearTimeout(timer); ws.close(); resolve({ firstEmpty, age: s.now - s.viewTime, laterVisible: true }); }
      };
    });
  });
  expect(result.firstEmpty).toBe(true); expect(result.laterVisible).toBe(true); expect(result.age).toBeCloseTo(3000, 5);
});
