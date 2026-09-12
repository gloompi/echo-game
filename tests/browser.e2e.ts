import { connectPeer } from './webtransport-peer.mjs';
import type { Snapshot } from '../shared/types.js';
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
  const baseURL = test.info().project.use.baseURL;
  const a = await browser.newContext({ baseURL }), b = await browser.newContext({ baseURL });
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
test('real seeker WebTransport feed excludes current Hiders during warmup', async ({ page }) => {
  await page.goto('/');
  const peer = await connectPeer(page, { type: 'join', mode: 'practice', name: 'ProtocolTest', preference: 'seeker' });
  try {
    const first = await peer.wait((s: Snapshot) => s.type === 'snapshot');
    expect(first.players.filter((p: { role: string }) => p.role === 'hider')).toHaveLength(0);
    const later = await peer.wait((s: Snapshot) => s.type === 'snapshot' && s.players.some(p => p.role === 'hider'));
    expect(later.now - later.viewTime).toBeCloseTo(3000, 5);
  } finally { await peer.close(); }
});
