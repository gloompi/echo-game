# Refactor evidence and remaining verification

Date: 2026-09-14. Starting main commit: `dfd1df1d85c558a2aac3efb4c671abaee9ae1f4a`. Work branch: `refactor/quality-foundation`.

## Observed passing checks

- 34 isolated network tests passed: 13 unchanged connection/WebTransport tests from the starting revision plus 21 new policy/lifecycle tests. Sources were transpiled using the available TypeScript 5.8.3 compiler and executed with Node 22.16.0. This is not the repository's locked `tsx`/TypeScript installation and not the entire TS test suite.
- 22 new verification/lint/hook tooling tests passed with Node 22.16.0. Hook tests used actual temporary Git repositories.
- Strict typechecking passed for `clock.ts`, `invite.ts`, and `transport-config.ts` with TypeScript 5.8.3.
- Strict `checkJs` passed for the new quality scripts/tests using TypeScript 5.8.3 and the available Node declarations, not a frozen project install.

## Not established

No passing result is claimed for the full project typecheck, all-source lint, complete TS suite, Rust compilation/formatting/Clippy/tests, production build, fixture parity, launcher/network integration, or actual browser E2E. The Rust/history tests and new E2E have been added but were not executed against the real application here.

The authoring environment had no Cargo/Rust/pnpm or project dependency installation, and direct network downloads were unavailable. A diagnostic GitHub Actions run also failed before recording any build/test steps: https://github.com/gloompi/echo-game/actions/runs/34839797366 (including a retry). The connector returned no step/log evidence explaining the startup failure. Its cause was not established; this is not evidence that project tests failed or passed. The temporary diagnostic workflow is removed from the final tree.

## Merge blockers / unfinished work

1. Restore a runner or development environment with the real locked dependencies and Rust toolchain. Run `pnpm verify` and fix every failure, including likely pre-existing Rust formatting/Clippy debt. Run the actual two-browser journey and retain its diagnostics.
2. Configure required `quality-gate` branch protection/ruleset after verifying its job name on the PR. Repository instructions/hooks alone cannot guarantee every future session obeys them.
3. Continue decomposing `client/main.ts` and `echo-server/src/main.rs`, complete deep server-message validation, migrate legacy JS tooling to typechecked code, and add a complete typed-ESLint/style-formatter setup with a genuine lockfile update. These are not completed by the smaller AST checker or module split.

Keep the PR draft while required checks are failing or unverified. Do not replace this evidence with an all-green statement merely because configuration files exist. Future sessions should update this document only with observed results tied to their revision.
