# Verification infrastructure

Inherit `scripts/AGENTS.md`. These files are strict `checkJs` code covered by `tests/quality/`. They are part of the safety boundary for every subsequent change.

`verify.mjs` is the common command registry for local work and CI. Missing tools and blocked prerequisites are failures, not successful skips. Keep independent checks running after an unrelated failure and show an explicit summary. Browser checks require successful production builds.

The AST linter is intentionally a small architecture/safety policy; do not claim it replaces typed ESLint. Add tests for every new rule, including string/comment false positives and all relevant import forms. Never add exceptions solely to green a migration.

Hooks must not stash/reset user files or test a different tree than the one committed/pushed. Preserve existing custom hook configuration. Test hook behavior using temporary Git repositories. E2E startup must use the real release binary, a built client, loopback ports, sanitized environment, and isolated empty `.env`.
