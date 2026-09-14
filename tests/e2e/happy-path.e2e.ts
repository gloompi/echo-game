import { test, expect } from './fixtures.js';

test('friends create, join, play, move, return to lobby, leave, and rejoin', async ({ players, request }) => {
  const { host, friend } = players;
  const health = await request.get('/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ ok: true, server: 'rust', transport: 'webtransport', protocolVersion: 3 });

  await test.step('create a private room and configure it through the real UI', async () => {
    await host.goto('/');
    await expect(host.locator('#loading')).toBeHidden();
    await host.getByRole('textbox', { name: 'YOUR CALLSIGN' }).fill('Quality Host');
    await host.getByRole('button', { name: 'Seeker', exact: true }).click();
    await host.getByRole('button', { name: /CREATE A ROOM/ }).click();
    await expect(host.locator('#lobby')).toBeVisible();
    await host.locator('#fill-bots').uncheck();
    // Drive the range control with keyboard input rather than mutating DOM state.
    const delay = host.locator('#room-delay');
    await delay.focus();
    await delay.press('Home');
    for (let step = 0; step < 5; step++) await delay.press('ArrowRight');
    await host.locator('#room-duration').fill('90');
    await host.locator('#room-seekers').fill('1');
    await host.locator('#save-room-settings').click();
  });

  const code = (await host.locator('#lobby-code-value').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  const delayValue = await host.locator('#room-delay').inputValue();

  await test.step('join from an isolated second browser and synchronize settings', async () => {
    await friend.goto('/');
    await expect(friend.locator('#loading')).toBeHidden();
    await friend.getByRole('button', { name: 'Hider', exact: true }).click();
    await friend.goto(`/?room=${encodeURIComponent(code)}`);
    await expect(friend.locator('#loading')).toBeHidden();
    await friend.locator('#join-form').getByRole('button', { name: /JOIN ROOM/ }).click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    await expect(friend.locator('.lobby-player')).toHaveCount(2);
    await expect(friend.locator('#room-delay')).toHaveValue(delayValue);
    await expect(friend.locator('#room-delay')).toBeDisabled();
    await expect(friend.locator('#start-round')).toBeDisabled();
  });

  await test.step('advance through head start into an actual hunt', async () => {
    await host.locator('#start-round').click();
    await expect(host.locator('#hud')).toBeVisible();
    await expect(friend.locator('#hud')).toBeVisible();
    await expect(host.locator('#role-label')).toContainText('SEEKER');
    await expect(friend.locator('#role-label')).toContainText('HIDER');
    await expect(friend.locator('#room-code')).toHaveText(code);
    await expect(host.locator('#phase-label')).toHaveText(/^ROUND \d+$/, { timeout: 25_000 });
    await expect(friend.locator('#phase-label')).toHaveText(/^ROUND \d+$/);
    await expect(friend.locator('#game')).toBeVisible();
  });

  await test.step('accept keyboard movement in the live game', async () => {
    await friend.locator('#capture').click();
    await friend.keyboard.down('KeyW');
    try {
      await expect.poll(async () => {
        const readout = await friend.locator('#movement-speed').innerText();
        return Number(readout.match(/·\s*([\d.]+)\s*m\/s/)?.[1] ?? 0);
      }, { timeout: 5_000, message: 'The hider movement HUD should show actual running speed.' }).toBeGreaterThan(0.5);
    } finally {
      await friend.keyboard.up('KeyW');
    }
    await friend.keyboard.press('Escape');
  });

  await test.step('return both players to the lobby, then cleanly leave and rejoin', async () => {
    await host.getByRole('button', { name: 'Pause menu' }).click();
    await host.locator('#host-return-lobby').click();
    await expect(host.locator('#lobby')).toBeVisible();
    await expect(friend.locator('#lobby')).toBeVisible();
    await friend.locator('#lobby').getByRole('button', { name: /LEAVE ROOM/ }).click();
    await expect(friend.locator('#menu')).toBeVisible();
    await expect(host.locator('.lobby-player')).toHaveCount(1);
    await friend.goto(`/?room=${encodeURIComponent(code)}`);
    await friend.locator('#join-form').getByRole('button', { name: /JOIN ROOM/ }).click();
    await expect(host.locator('.lobby-player')).toHaveCount(2);
    await expect(friend.locator('#lobby')).toBeVisible();
    await expect(friend.locator('#room-delay')).toHaveValue(delayValue);
  });
});
