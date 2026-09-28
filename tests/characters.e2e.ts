import { test, expect } from '@playwright/test';

test('the authored Hider model loads and animates for a Hider and a Seeker', async ({
  browser,
}, info) => {
  test.setTimeout(90_000);
  const baseURL = info.project.use.baseURL;
  const a = await browser.newContext({ baseURL }),
    b = await browser.newContext({ baseURL });
  try {
    const host = await a.newPage(),
      friend = await b.newPage(),
      errors: string[] = [];
    for (const page of [host, friend]) {
      page.on('pageerror', (error) => errors.push(error.message));
      // WebGL shader and skinning failures are logged, not thrown.
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
    }
    await host.goto('/');
    // The menu stage shows the model before any room exists. The attribute is static asset
    // state, never actor data.
    await expect(host.locator('#game')).toHaveAttribute('data-hider-model', 'loaded', {
      timeout: 30_000,
    });
    await host.locator('[data-role="seeker"]').click();
    await host.locator('#create-room').click();
    await expect(host.locator('#lobby')).toBeVisible();
    await host.locator('#fill-bots').uncheck();
    const code = (await host.locator('#lobby-code-value').textContent())!.trim();
    await friend.goto('/');
    await friend.locator('[data-role="hider"]').click();
    await friend.goto(`/?room=${code}`);
    await friend.locator('#join-form button[type="submit"]').click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    await expect(friend.locator('#game')).toHaveAttribute('data-hider-model', 'loaded', {
      timeout: 30_000,
    });
    // A non-classic skin recolours the hoodie through the shared tint material.
    await friend.locator('#lobby').getByLabel('Character skin').selectOption('ember');
    await host.locator('#start-round').click();
    await expect(friend.locator('#role-label')).toContainText('HIDER');
    await expect(host.locator('#role-label')).toContainText('SEEKER');
    await friend.bringToFront();
    await friend.locator('#capture').click();
    const readout = friend.locator('#movement-speed'),
      keys = friend.keyboard;
    // Run, then crouch, through the real input path; the HUD readout names each state. (Slides
    // are left to the unit tests: under a software renderer the server may not see sprint speed
    // before the crouch arrives.)
    await keys.down('w');
    try {
      await expect(readout).toContainText(/\b([1-9]|1\d)\.\d m\/s · HOP/);
      await friend.screenshot({ path: info.outputPath('hider-running.png') });
      await keys.down('ControlLeft');
      await expect(readout).toContainText('CROUCHED');
      await friend.screenshot({ path: info.outputPath('hider-crouched.png') });
    } finally {
      await keys.up('ControlLeft');
      await keys.up('w');
    }
    await expect(readout).toContainText('HOP:');
    await friend.screenshot({ path: info.outputPath('hider-standing.png') });
    await host.bringToFront();
    await host.screenshot({ path: info.outputPath('seeker.png') });
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
