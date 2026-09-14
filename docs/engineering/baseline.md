# Verification evidence — 14 September 2026

Branch: `refactor/quality-foundation`. This continuation starts from `5ab1cb65cd70f285b44f779099b226c4feb20d69`, following the initial foundation based on main `dfd1df1d85c558a2aac3efb4c671abaee9ae1f4a`.

## Native Windows execution

The full `pnpm verify` run passed all 15 verification groups after the Rust server decomposition, client sampling/UI extraction, typed ESLint/Prettier rollout and regression fixes. The actual production Rust server and built client were started locally, and Chromium rendered WebGL and connected over native WebTransport. No mock backend or hidden-player debug hooks were used by E2E.

Observed environment: Windows x64, Node 24.11.1, pnpm 10.23.0, Rust/Cargo 1.98.1, project TypeScript 5.9.3, Playwright 1.63.0, Vite 7.3.6. Dependencies came from the real project lockfiles; the formatter/linter installation generated a genuine pnpm lockfile update. Main and the pre-existing unfinished working directory were not modified.

| Check                                              | Observed result                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Full project TypeScript check                      | Passed, including unused-local/parameter checks                                   |
| Strict quality-tooling checkJs                     | Passed                                                                            |
| Typed ESLint + project import-boundary checker     | Passed, zero warnings                                                             |
| Prettier and rustfmt                               | Passed                                                                            |
| Quality-tooling/hook tests                         | 30 passed, 0 failed, 0 skipped                                                    |
| TypeScript unit tests                              | 129 passed, 0 failed, 0 skipped                                                   |
| Generated maps and TS/Rust fixtures                | Passed without changing fixture expectations                                      |
| Launcher integration                               | 1 passed; 1 pre-existing POSIX-only mock-tunnel lifecycle test skipped on Windows |
| Rust workspace unit/integration tests              | 79 passed, 0 failed, 0 ignored; doc-test command passed (0 doc tests)             |
| Clippy workspace/all-targets with warnings denied  | Passed                                                                            |
| Production client and release server builds        | Passed                                                                            |
| Live Rust/native Chromium WebTransport integration | 1 passed, 0 failed, 0 skipped                                                     |
| Real-app browser E2E                               | 9 passed, 0 failed; retries disabled                                              |

The nine browser tests include hider ability/skin tuning, all four seeker weapons and scan, menu/practice WebGL, two-player lobby settings, delayed-Hider feed privacy, the complete create/join/play/move/return/leave/rejoin journey, input-setting persistence, host map settings, and two-client play in both authored Blender worlds.

## Initial baseline and regressions fixed

Running the untouched starting revision on the same machine established passing compilation, Rust tests and live networking, but failed rustfmt/Clippy and the new E2E fixture. Eight of nine original browser tests passed; the ninth started tracing twice. Playwright Test now owns tracing, avoiding overlapping manual traces. Cleanup failures no longer mask the original test error.

The refactor added deterministic configuration, protocol and bounded-control-queue tests on Rust; snapshot interpolation/cache lifecycle and DOM policy tests on TypeScript; and formatter/Windows subprocess regressions in tooling. A protocol regression exposed surplus fields being accepted by serde unit variants: fieldless commands now use empty struct variants with strict negative tests.

The earlier isolated Linux checks and runner limitations recorded in the initial PR are historical; they are not the current local verification baseline. The PR's latest execution comment should identify the exact committed revision and hosted check status. Do not infer hosted CI success from this Windows run.

## Remaining scope and enforcement

Hosted Actions, Linux/macOS, Docker, public Internet UDP reachability and the POSIX-only mock-tunnel lifecycle are not established by this Windows execution. The existing multi-platform tooling jobs and Linux full-app CI remain configured; required branch protection/rulesets are still an administrator setting and have not been installed by a workflow file or local Git hook.

Further client composition extraction, full deep runtime validation of server messages, and broader legacy-JavaScript checkJs migration remain incremental improvements. Keep the PR draft while required hosted checks are failing or unverified. Update this record only with executed results; never count a skip or unavailable tool as a pass.
