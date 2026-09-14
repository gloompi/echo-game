# Verification and quality gates

## Set up a checkout

Use Node 22 (at least 22.13) or Node 24+, the `pnpm@10.23.0` declared in `package.json`, and Rust stable with rustfmt and Clippy. Dependency installations must use genuine checked-in lockfiles.

```sh
pnpm install --frozen-lockfile
rustup component add rustfmt clippy
pnpm exec playwright install --with-deps chromium
pnpm hooks:install
```

The package `prepare` script also attempts local hook installation. It skips CI/non-Git archives and preserves an existing different `core.hooksPath`; it does not silently replace a user's hook system. No remote repository change installs hooks in a checkout that has not run setup.

## Commands

| Command                  | Scope                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm verify`            | All static, Rust, production-build, network, and browser checks   |
| `pnpm verify:quick`      | Static and Rust checks, excluding production/browser work         |
| `pnpm typecheck`         | Existing strict project TypeScript check                          |
| `pnpm typecheck:tools`   | Strict checkJs for new quality scripts and their tests            |
| `pnpm lint:ts`           | Typed ESLint plus custom AST safety/import boundaries             |
| `pnpm lint:rust`         | Workspace/all-target Clippy, locked dependencies, warnings denied |
| `pnpm format:rust:check` | Workspace rustfmt check, no file mutation                         |
| `pnpm format:rust`       | Apply rustfmt; review and stage the resulting changes             |
| `pnpm test:tools`        | Verification/lint/hook regression tests                           |
| `pnpm test`              | TS unit, quality-tool, and Rust workspace tests                   |
| `pnpm test:network`      | Real Rust/Chromium WebTransport integration                       |
| `pnpm test:e2e`          | Build release server/client, then run all browser E2E             |
| `pnpm test:e2e:built`    | E2E only; requires already-built current artifacts                |

`verify.mjs` defines the command registry. CI invokes `--group static`, `--group rust`, and `--group browser`; local full verification invokes all three. It records independent failures and marks dependent browser checks BLOCKED when a build prerequisite fails. Missing executables, nonzero exits, blocked tests, and cancelled jobs must not be reported as success.

The static group also checks generated maps/parity fixtures and launcher integration. The Rust group runs formatting, Clippy, and workspace unit/integration/doc tests. Browser builds come from the current source; the workflow never reuses an arbitrary developer server.

`pnpm format:check` checks hand-maintained code, styles and documentation with the exactly pinned Prettier version. `pnpm format` applies Prettier and rustfmt; inspect that diff separately from behavioral changes. Generated JSON fixtures/maps retain generator-owned formatting and are validated by `fixtures:check`.

## Git hooks and exact-tree safety

Pre-commit runs quick verification only when all non-ignored work is staged. It refuses partial staging and untracked files so tests cannot accidentally validate unstaged fixes instead of the committed version. It compares the index tree before/after verification. Pre-push requires a clean HEAD, checks the pushed commit matches HEAD, runs full verification, and checks the revision again. Hooks never stash/reset or modify source.

With a custom hook system, explicitly chain `node scripts/quality/hook.mjs pre-commit` and `node scripts/quality/hook.mjs pre-push`, preserving Git's pre-push stdin. This strict policy favors correctness over partially staged commit convenience.

Hooks can be bypassed. GitHub Actions has a stable aggregate job named `quality-gate`, which fails unless static, Rust, browser, and Linux/Windows/macOS tooling jobs all succeed. **An administrator must still configure a main-branch rule/ruleset requiring `quality-gate` and preventing merges while it is failing or pending. That setting was not configured by this change.** Keep this PR draft until all required checks pass. A workflow file alone does not enforce branch protection.

## Real application E2E

`serve-e2e.mjs` runs the actual release Rust binary with the built client. It uses HTTP `127.0.0.1:3107` and WebTransport UDP `127.0.0.1:4447`, sanitized game configuration, and a temporary working directory containing an empty `.env`. It never shares publicly or inherits a developer playtest key/TLS/public-endpoint configuration. The process is terminated and its temporary directory removed after the suite.

The new two-context journey creates/configures a private room, joins a friend, checks host permissions/settings synchronization, reaches a real hunt, drives keyboard movement, returns both players to the lobby, and exercises leave/rejoin. Existing browser, gameplay, abilities, worlds, and delayed-feed tests remain in the suite. Movement HUD assertions check user-visible behavior, not an independent server-acknowledgement proof; live network and simulation tests cover authority separately.

Playwright Test configuration owns tracing for all browser contexts; fixtures must not manually start tracing again. It captures screenshots/traces on failure and browser exceptions/console errors from both players. CI retains `test-results/` and `playwright-report/` for seven days. Do not attach secrets or hidden Hider positions to diagnostics.

## Execution evidence and remaining scope

See `baseline.md` for revision-specific execution evidence. Local verification now runs on a real Windows machine with frozen project dependencies, Rust, Chromium/WebGL and WebTransport. A local success does not imply hosted Actions, Linux/macOS, Docker or public-Internet UDP reachability have been independently validated. Required `quality-gate` branch rules remain a repository-administration setting, not a local hook.

Further client composition extraction, deep runtime server-message validation, broader legacy-JS checkJs coverage, and toolchain/action pinning are separate improvements. Do not remove or weaken existing gates while pursuing them.
