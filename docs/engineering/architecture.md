# Architecture and refactoring decisions

## Dependency direction

`client -> shared` and `echo-server -> echo-core`. Browser presentation and server I/O are outer layers. Pure simulation/contracts are inward layers. The TS and Rust motors are separate implementations linked by shared JSON and parity fixtures, not shared executable WASM code.

The JS AST checker enforces production import boundaries. Review is still required for global API access, Rust dependencies, side effects, protocol changes, and resource ownership.

## Implemented structure

```text
client/
  network.ts                    compatibility export
  network/
    connection.ts               session lifecycle and callbacks
    clock.ts                    monotonic time estimate and snapshot ordering
    invite.ts                   fragment-safe invitation policy
    transport-config.ts         discovery validation and endpoint policy
  transport.ts                  WebTransport streams and bounded queues
  main.ts                       existing composition/rendering entry point
shared/                         TS contracts, prediction, shared JSON
crates/
  echo-core/src/
    lib.rs                      explicit public facade
    config.rs                   checked-in rules/movement data
    world.rs                    collision/navigation/map data
    settings.rs                 host-tunable values and validation
    types.rs                    simulation values and wire-facing state
    history.rs                  bounded historical pose sampling
    physics.rs                  authoritative movement
    room.rs, room/combat.rs      room and combat policies
    balance.rs                  ability/weapon/skin balance
  echo-server/src/              HTTP, WebTransport, startup, orchestration
scripts/quality/                verification, lint, hooks, E2E process ownership
tests/quality/                  regressions for the verification infrastructure
tests/e2e/                     real multiplayer journey and player fixtures
.agents/skills/echo-change/      repeatable agent workflow
```

Keep explicit facades while migrating consumers instead of making unrelated path changes throughout the repository. Add a feature directory when it has multiple cohesive responsibilities, not a folder for every function.

## Principles applied

Single responsibility separates connection lifecycle, clock estimation, invitation construction, endpoint validation, and stream mechanics. Dependency inversion is a small `GameTransport` interface and an injected environment/clock, not a dependency-injection framework. Interface segregation means callers receive the capabilities they need; substitutable adapters must preserve ordering, failure, and cleanup contracts. Extend with another implementation only for a real requirement, not speculative SOLID compliance.

Rust uses module privacy and explicit reexports rather than object hierarchies. Domain state remains ordinary structs/enums. Ownership, `Result`, bounded collections, and explicit time make behavior easier to test. Named history frames and a separate interpolation policy improve readability without changing wire shape or normal sampling behavior; non-finite sample times now fail closed.

KISS/YAGNI and measured performance are constraints: do not trade a predictable hot loop for allocations or trait/closure machinery without a benefit. Cache and pool ownership must stay explicit.

## Deliberately incomplete migrations

This change is a foundation, not a complete decomposition of every file. `client/main.ts` still combines rendering, input, presentation, and orchestration; `echo-server/src/main.rs` still combines configuration, HTTP, session handling, and scheduling. Extract these incrementally behind regression tests after a real all-green baseline is available.

The WebTransport adapter still checks only the server-message envelope, not a complete deep schema. New quality scripts have strict checkJs coverage; older `.mjs` scripts do not yet all have it. The JS AST checker is narrow and has no general style formatter; a complete typed ESLint/Prettier rollout requires a genuine dependency install, lockfile update, and reviewed whole-repository fixes. Do not confuse these remaining tasks with completed checks.
