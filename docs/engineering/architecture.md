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
  game/snapshot-buffer.ts       bounded authorized-observation interpolation
  ui/dom.ts                     required-element bindings and idempotent text updates
  ui/roster-panels.ts            lobby/score rendering and cache ownership
  main.ts                       remaining game/render composition
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
  echo-server/src/
    main.rs                     executable entry point only
    runtime.rs                  startup/shutdown ownership
    config.rs                   validated configuration with injectable values
    state.rs                    server state and monotonic clock
    protocol.rs, security.rs    wire contracts, origin/endpoint policies
    http.rs                     API handlers and static assets
    commands.rs                 room orchestration and bounded control enqueue
    sessions.rs                 WebTransport stream/session lifecycle
    simulation.rs               fixed-rate scheduling
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

## Remaining incremental work

The server executable is decomposed and its configuration, protocol, queue, core/parity, and real-network behavior are tested. Client observation sampling and roster presentation are extracted and tested; `client/main.ts` still composes input, prediction, camera/rendering and HUD state. Further extraction should preserve gameplay behavior and resource ownership rather than create abstractions solely to hit a line count.

Typed ESLint now covers all TypeScript and recommended ESLint covers JavaScript. Prettier and rustfmt cover hand-maintained source. Strict checkJs covers quality tooling, not every legacy `.mjs` script yet. The browser transport's server-message guard still validates only the envelope rather than a complete deep schema. These remain separate follow-up improvements; do not claim runtime schema validation just because types/lint pass.

## Resource and protocol regressions discovered during execution

Snapshot scratch caches now release absent players and clear on room/map/round changes. Reused poses explicitly overwrite missing optional fields, preventing stale shield/skin/warp state. Interpolation keeps the older observation's discrete state and never extrapolates current hidden-player positions.

Serde tagged unit variants accepted extra fields despite the container's unknown-field policy. Fieldless commands now use empty struct variants and negative tests; valid protocol-v3 payloads are unchanged. Control enqueue uses bounded synchronous `try_send`, not an async wrapper under the simulation mutex.
