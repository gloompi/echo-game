# Primary references and project decisions

Reviewed for this refactor on 2026-09-14. These references inform the repository policies; the folder layout is a project-specific design, not a language-mandated architecture.

- Rust API Guidelines: https://rust-lang.github.io/api-guidelines/checklist.html — naming, predictable APIs, useful types, documented invariants. Applied with module privacy and explicit core-crate exports.
- Clippy usage: https://doc.rust-lang.org/clippy/usage.html — standard Rust lint execution. CI uses workspace/all-target checks and denies warnings without blindly enabling every opinionated lint group.
- Tokio shared state: https://tokio.rs/tokio/tutorial/shared-state — lock scope and async boundaries. Network I/O must not hold the simulation lock.
- TypeScript checkJs: https://www.typescriptlang.org/tsconfig/checkJs.html — typecheck JavaScript using JSDoc. Applied to new quality tooling; legacy scripts are not yet fully migrated.
- typescript-eslint typed linting: https://typescript-eslint.io/getting-started/typed-linting/ — reference for the remaining typed-ESLint rollout. Not installed in this change; no fabricated dependency lockfile was introduced.
- Playwright best practices: https://playwright.dev/docs/best-practices — isolated browser state, user-facing locators, and web-first assertions. Applied to the new multiplayer journey.
- Playwright web servers: https://playwright.dev/docs/test-webserver — lifecycle-owned real-app startup and readiness checks. The project launches its actual production server on dedicated local ports.
- Git hooks: https://git-scm.com/docs/githooks — hook execution and pre-push input. Hooks are local helpers, not a replacement for required CI checks.
- OpenAI agent instructions: https://developers.openai.com/codex/guides/agents-md — directory-scoped instructions. Root instructions explicitly require reading affected subdirectories, including when an agent starts from the repository root.
- OpenAI skills: https://developers.openai.com/codex/skills — reusable repository workflows. `.agents/skills/echo-change/SKILL.md` records the change/verification procedure; agent support and invocation are not assumed to be universal.

SOLID, KISS, and YAGNI are used as design heuristics here: separate reasons for change, keep capability interfaces narrow, make dependencies explicit, and avoid speculative abstractions. Rust ownership/enum idioms and TypeScript structural interfaces are preferred over mechanically copying an object-oriented class hierarchy.
