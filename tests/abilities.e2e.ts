import { test, expect } from '@playwright/test';

test('hider skin, host ability tuning and shield activate through the real game client', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await page.locator('[data-role="hider"]').click(); await page.locator('#create-room').click();
  const skin = page.locator('#lobby').getByLabel('Character skin');
  await expect(skin.locator('option')).toHaveCount(8); await skin.selectOption('jade');
  await page.locator('.balance-editor summary').click();
  await page.locator('[data-balance="shield.durationMs"]').fill('4');
  await page.locator('#save-room-settings').click();
  await expect(page.locator('#room-settings-note')).toContainText('Settings applied');
  await page.locator('.balance-editor summary').click();
  await page.locator('#start-round').click(); await expect(page.locator('#role-label')).toContainText('HIDER');
  await page.locator('#capture').click();
  await page.keyboard.down('g');
  try { await expect(page.locator('#combat-hud')).toContainText('G SHIELD · ACTIVE'); }
  finally { await page.keyboard.up('g'); }
  await page.screenshot({ path: info.outputPath('hider-shield.png') });
  expect(await page.evaluate(() => localStorage.getItem('echo-skin'))).toBe('jade');
  expect(errors).toEqual([]);
});

test('seeker switches all four weapon models and activates the possibility scan', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await page.locator('[data-role="seeker"]').click(); await page.locator('#practice').click();
  await expect(page.locator('#role-label')).toContainText('SEEKER');
  await expect(page.locator('#phase-label')).not.toHaveText('HEAD START', { timeout: 15000 });
  await page.locator('#capture').click();
  for (const [key, weapon] of [['2', 'SCATTER'], ['3', 'REPEATER'], ['4', 'WEB'], ['1', 'BLASTER']]) {
    await page.keyboard.down(key);
    try { await expect(page.locator('#combat-hud')).toContainText(`1–4 ${weapon}`); }
    finally { await page.keyboard.up(key); }
    await expect(page.locator('#combat-hud')).not.toContainText('RECOVERING');
  }
  await page.keyboard.down('b');
  try { await expect(page.locator('#combat-hud')).toContainText('B SCAN · ACTIVE'); }
  finally { await page.keyboard.up('b'); }
  await page.screenshot({ path: info.outputPath('seeker-scan.png') });
  expect(errors).toEqual([]);
});
