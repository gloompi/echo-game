# Real multiplayer browser tests

Inherit `tests/AGENTS.md`. Use separate browser contexts for independent players. Drive the actual UI with role/label selectors or existing stable IDs; await state with Playwright assertions instead of fixed sleeps or direct DOM mutation.

The happy path must go beyond a visible menu/HUD: create a private room, change host settings, join a friend, verify synchronization/permissions, reach the hunt, move, return to lobby, leave, and rejoin. Preserve protocol/privacy tests in the existing root E2E suite.

Always close both contexts and save diagnostics for both on failure. No network mocking, public tunnel, reused developer server, or privileged hidden-position hooks. Run `pnpm test:e2e` to build first; `test:e2e:built` is only for already-built artifacts, including CI.
