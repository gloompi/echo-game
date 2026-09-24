import { test, expect } from '@playwright/test';

test('two clients load and play both authored Blender worlds', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const baseURL = info.project.use.baseURL;
  const a = await browser.newContext({ baseURL }),
    b = await browser.newContext({ baseURL });
  try {
    const host = await a.newPage(),
      friend = await b.newPage(),
      errors: string[] = [];
    for (const page of [host, friend]) page.on('pageerror', (error) => errors.push(error.message));
    await host.goto('/');
    await friend.goto('/');
    await expect(host.locator('#loading')).toBeHidden();
    await expect(friend.locator('#loading')).toBeHidden();
    await host.locator('[data-role="seeker"]').click();
    await host.locator('#create-room').click();
    await expect(host.locator('#lobby')).toBeVisible();
    await host.locator('#fill-bots').uncheck();
    const code = (await host.locator('#lobby-code-value').textContent())!.trim();
    await friend.locator('[data-role="hider"]').click();
    await friend.goto(`/?room=${code}`);
    await friend.locator('#join-form button[type="submit"]').click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    for (const [roundIndex, [id, name]] of [
      ['mirror-yard', 'Mirror Yard'],
      ['neon-carnival', 'Neon Carnival'],
    ].entries()) {
      await host.locator('#room-map').selectOption(id);
      await host.locator('#save-room-settings').click();
      await expect(host.locator('#room-settings-note')).toContainText('Settings applied');
      await expect(friend.locator('#room-map')).toHaveValue(id);
      for (const page of [host, friend]) {
        await expect(page.locator('#game')).toHaveAttribute('data-world-map', id);
        await expect(page.locator('#game')).toHaveAttribute('data-world-asset', 'loaded', {
          timeout: 30_000,
        });
        expect(
          Number(await page.locator('#game').getAttribute('data-world-meshes')),
        ).toBeGreaterThan(30);
      }
      await host.locator('#start-round').click();
      await expect(host.locator('#hud')).toBeVisible();
      await expect(friend.locator('#hud')).toBeVisible();
      await expect(friend.locator('#movement-speed')).toContainText(name);
      await friend.locator('#capture').click();
      // Focus before checking: a background page may still show the previous lobby's HUD.
      await expect(friend.locator('#phase-label')).toHaveText(
        `ROUND ${String(roundIndex + 1).padStart(2, '0')}`,
        { timeout: 15_000 },
      );
      await friend.keyboard.down('w');
      await friend.waitForTimeout(650);
      await friend.keyboard.up('w');
      await friend.screenshot({ path: info.outputPath(`${id}-hider.png`) });
      await host.bringToFront();
      await expect(host.locator('#phase-label')).toHaveText(
        `ROUND ${String(roundIndex + 1).padStart(2, '0')}`,
      );
      await host.screenshot({ path: info.outputPath(`${id}-seeker.png`) });
      await host.locator('#pause-button').click();
      await host.locator('#host-return-lobby').click();
      await expect(friend.locator('#lobby')).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
