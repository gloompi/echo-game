---
name: echo-change
description: Make or review changes in Echo's browser client, shared simulation contracts, Rust server/core, tests, assets, or tooling while preserving delayed-observation gameplay and running the repository quality gates. Use for bug fixes, refactors, features, dependency changes, and verification changes in this repository.
---

# Echo change workflow

1. Read root `AGENTS.md`, the instructions on each affected directory path, and `docs/engineering/baseline.md`. Inspect branch, current diff, and relevant tests before editing. Do not assume historical test results describe the current revision.
2. Name the owning feature/layer, required observable behavior, and trust boundaries. Review delayed-Hider privacy, present-time hits, host authorization, and TS/Rust movement parity whenever touched.
3. Add a focused regression or acceptance scenario. Use pure/injected dependencies in unit tests, but real app/transport in integration and E2E. Do not add hidden authoritative-position test backdoors.
4. Make the smallest cohesive implementation change. Separate moves from behavior changes where practical. Preserve public entry points and serialized contracts during architecture migrations. Avoid speculative abstractions.
5. Run targeted tests for feedback, then `pnpm verify:quick`. Before declaring the change ready, run `pnpm verify` against the actual resulting revision. Install required tools and Chromium using `docs/engineering/verification.md`; never convert unavailable checks into success.
6. Review the final diff, generated files, lockfiles, resource cleanup, and credentials. Confirm no user work was lost or inadvertently included and no check was weakened. CI and local commands must agree.
7. Handoff with scope, behavior changes, exact executed commands/results, and remaining risks. Keep the PR draft when any required gate is failing or unverified. An instruction, hook, or test file being present is not evidence that it ran.
