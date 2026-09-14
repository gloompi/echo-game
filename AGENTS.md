# Echo engineering contract

Read this file before changing the repository. Also read the `AGENTS.md` files on the path to every area you will edit; do not assume your agent automatically loads instructions outside its working directory. More specific instructions supplement this contract, not the gameplay/privacy invariants.

## Non-negotiable gameplay and privacy

- Room delay is host-configurable from 0 to 10000 whole milliseconds, default 3000, and immutable during a hunt. Only Hiders are delayed for Seekers. Self movement and allied Seekers are live.
- The Rust server samples and withholds Hider poses. Missing history must never fall back to current poses. Never expose current hidden transforms in roster fields, diagnostics, scene objects, shadows, spatial events, or browser test hooks.
- Shots test PRESENT authoritative positions, not historical echoes. Generic lag-compensation rewinds would undo Echo's mechanic.
- `shared/rules.json`, `shared/arena.json`, and the documented generated map/fixture pipeline define shared gameplay data. Motor changes require TS/Rust fixture parity review and tests. These are separate TS/Rust implementations, not one shared WASM motor.
- Rendering and UI never own game authority. Preserve the striped blocky Hider, blue armored Seeker, orange blaster, and cyan/magenta art direction unless explicitly asked to change them.

## Change workflow

1. Read `docs/engineering/architecture.md`, the relevant scoped instructions, and `docs/engineering/baseline.md`. Use `.agents/skills/echo-change/SKILL.md` for the repeatable workflow.
2. Work on a feature branch. Inspect the existing diff before editing. Never reset, stash, force-push, overwrite, or silently include another person's work.
3. Identify the owning layer and observable behavior. Add a focused regression test before a bug fix. Keep mechanical moves separate from behavior changes where practical.
4. Prefer cohesive features, small explicit interfaces, composition, and pure policy functions. Apply SOLID pragmatically: no inheritance hierarchy, trait, service container, or abstraction without a concrete need. KISS and YAGNI apply equally to architecture.
5. Run `pnpm verify:quick` during iteration and `pnpm verify` before declaring completion. Review the final diff after verification, including generated files and lockfiles.
6. Report the exact checks executed, outcomes, and environment limitations. Missing tools, skipped jobs, compilation errors, and blocked prerequisites are NOT passes. Keep the PR draft while required checks remain unverified or failing. Never disable a check, broaden an exclusion, or add a type/lint suppression just to make a refactor pass.

## Quality and dependencies

Node is frontend/build/launcher tooling; the game server is `crates/echo-server`. Use the pinned pnpm version in `package.json`, frozen pnpm lockfile installation, and Cargo `--locked`. Verify dependency changes against primary documentation, generate real lockfiles, and review them. Never invent lockfile contents or checksums.

The root `pnpm verify` command is the common contract for local work, Git hooks, and CI. Hooks are installed per checkout, can be bypassed, and do not replace required GitHub checks. See `docs/engineering/verification.md` for their deliberately strict staging policy and remaining repository-administration setup.

The current JS lint is a small AST-based architecture/safety checker, not a complete typed ESLint configuration. Legacy JS tooling and large client/server entry points still need further migration; see the baseline rather than assuming this branch completed every refactor.

## Local play and secrets

`pnpm play` binds loopback. Only explicit `pnpm share` may start a public tunnel, publishing the built app rather than Vite or the source tree. Tests must never share publicly. Preserve invitation keys in URL fragments across copy/rejoin flows. Do not commit `.env`, access keys, control tokens, TLS private keys, or tunnel credentials, or include them in logs/test artifacts. A PC-hosted tunnel is for private playtests, not production uptime.
