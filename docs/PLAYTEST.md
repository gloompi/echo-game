# First multiplayer playtest

1. Install dependencies, run `npm test`, `npm run typecheck`, and `npm run build`. Record any errors before changing dependency versions. Run `npm run dev` and open the page on a desktop browser with WebGL2 enabled. Check the developer console for errors. The menu should render a striped hider, armored seeker and a magenta/cyan echo.
2. Try Practice as a hider, then as a seeker. Confirm movement, jump, sprint/stamina, dash, wave, ammo/reload and escape/resume. Check stairs, wall sliding and camera obstruction near cover. The seeker is first person; the hider is third person. Verify shadows and sound controls.
3. In two browser windows or on two computers, create a private room. Disable bot fill. Set one role to seeker, the other to hider. Join using the six-character room code, then start from the host. Hiders get a five-second head start; seekers can look but cannot move or shoot until it ends.
4. Stand both players in the open east outer lane. Have the hider stand still for at least three seconds, then strafe sideways and wave. The seeker should see the old location for three seconds while the hider sees their own optional echo. Seekers should not see a live duplicate, live positional nameplate or live remote VFX.
5. Shoot the stale location. Confirm no damage and the echo feedback. Fire at the real current location communicated by the second tester: a correct prediction should tag the hider even if the old model is elsewhere. Repeat behind solid cover: cover must block the ray. Two current hits catch the hider.
6. Confirm a frozen hider can be caught, a moving hider can bait, a seeker cannot shoot during head start or results, ammo stops at zero, and reload takes 1.5 seconds. Test the final capture, timeout victory, results countdown and automatic next round.
7. Exercise disconnect/host transfer and a private late join. The late arrival should wait until the next round. Open two Quick play sessions: they should meet on this same server and a late quick-play entrant should be a live hider. A practice room must not accept an invited second player.
8. Repeat with browser network throttling and, later, separate internet connections. Observe prediction correction and delayed character smoothing. The expected view age is 3000 ms plus transport and interpolation, not exactly three seconds under arbitrary jitter. Leaving a tab or opening the menu must stop its input; it must not pause the shared round.

## Browser automation

`npx playwright install chromium` then `npm run test:e2e`. The tests start the development servers and check menu initialization, room flow, and delayed WebSocket payloads. Screenshots and traces are saved on failures. These tests were authored but could not be executed in the network-isolated authoring environment.

## Hosting note

An invitation is only useful when the address is reachable. A `localhost` invite points to the recipient's own machine. Use a LAN address for the same network, or a production HTTPS address/tunnel for internet friends. The latter must forward WebSocket upgrades to `/socket`. Do not expose the Vite development server as the permanent public deployment.
