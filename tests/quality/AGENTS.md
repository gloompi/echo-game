# Tooling regressions

Inherit `tests/AGENTS.md` and `scripts/quality/AGENTS.md`. These are strict checkJs Node tests, run by `pnpm test:tools` with cross-platform filename expansion.

Use temporary Git repositories for hook/index tests and isolate global Git configuration. Never operate on the user's checkout in a test. Cover partial staging, untracked files, clean HEAD, changed revisions, alternate pushed refs, custom hooks, missing executables, and blocked prerequisites. Restore globals and remove temporary directories in finally blocks.
