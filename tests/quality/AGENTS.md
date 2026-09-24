# Tooling regressions

Inherit `tests/AGENTS.md` and `scripts/quality/AGENTS.md`. These are strict checkJs Node tests, run by `pnpm test:tools` with cross-platform filename expansion.

Use temporary Git repositories for hook/index tests and isolate global Git configuration. Never operate on the user's checkout in a test. Cover partial staging, untracked files, clean HEAD, changed revisions, alternate pushed refs, custom hooks, missing executables, and blocked prerequisites. Restore globals and remove temporary directories in finally blocks.

Git fixtures must use an actual empty global configuration file outside their worktree, never `os.devNull` or a platform-specific device path. Pass the same isolated environment to every Git subprocess, including `checkedRevision` and `installHooks`. Remove inherited `GIT_*` variables for fixture repositories only; real hooks must still respect the caller's selected repository/index. Exercise paths containing spaces, check that foreign indexes/configuration are unchanged, and keep Linux/Windows/macOS tooling CI required by `quality-gate`.
