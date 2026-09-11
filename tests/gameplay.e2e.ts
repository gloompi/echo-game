import { test, expect } from '@playwright/test';

test('jump/crouch bindings and sensitivity persist on this device', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.locator('#bind-crouch').click(); await page.keyboard.press('c');
  await expect(page.locator('#bind-crouch')).toHaveText('C');
  await page.locator('#bind-jump').click(); await page.mouse.wheel(0, 100);
  await expect(page.locator('#bind-jump')).toHaveText('Wheel ↓');
  await page.locator('#sensitivity').evaluate(element => { (element as HTMLInputElement).value='2.25'; element.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#sensitivity-output')).toHaveText('2.25×');
  await page.reload(); await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await expect(page.locator('#bind-crouch')).toHaveText('C');
  await expect(page.locator('#bind-jump')).toHaveText('Wheel ↓');
  await expect(page.locator('#sensitivity-output')).toHaveText('2.25×');
  await page.locator('#reset-controls').click();
  await expect(page.locator('#bind-crouch')).toHaveText('Ctrl');
  await expect(page.locator('#bind-jump')).toHaveText('Space');
});

test('host can select each map and configure reload, dash, mirrors and hopping', async ({ page }) => {
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.locator('#loading')).toBeHidden();
  await page.locator('#create-room').click();await expect(page.locator('#room-settings')).toBeVisible();
  for(const [id,name] of [['switchyard','Switchyard'],['glassworks','Glassworks'],['afterhours','Afterhours']]){
    await page.locator('#room-map').selectOption(id);
    await page.locator('#room-reload').fill('0');await page.locator('#room-dash').fill('1.2');
    await page.locator('#room-mirror').fill('60');await page.locator('#room-bhop').selectOption('auto');
    await page.locator('#save-room-settings').click();
    await expect(page.locator('#room-settings-note')).toContainText('Settings applied');
    await page.locator('#start-round').click();await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#movement-speed')).toContainText(name);
    await page.locator('#pause-button').click();await page.locator('#host-return-lobby').click();
    await expect(page.locator('#lobby')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
