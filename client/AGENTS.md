# Browser TypeScript

Inherit the root engineering contract. This directory is browser code; do not import Node built-ins, server code, tooling, or tests.

## Design and structure

Keep features cohesive: network policies and session lifecycle live in `network/`; pure authorized-observation sampling lives in `game/`; DOM bindings and roster panels live in `ui/`. Three.js rendering and player controls remain separate concerns. Root `network.ts` is an explicit compatibility facade, not a second implementation. Keep `main.ts` as the composition boundary and extract its remaining responsibilities incrementally with regression coverage; do not create a generic `utils` dumping ground or circular barrel imports.

Apply single responsibility to reasons for change, not arbitrary line counts. Depend on small structural interfaces or callbacks at I/O boundaries. Prefer composition over inheritance. Shared simulation imports point inward to `shared/`, never the reverse.

## TypeScript and asynchronous code

Use strict types, discriminated unions, named domain values, `unknown` at JSON/I/O boundaries, and explicit type-only imports. A cast is not runtime validation. Avoid `any`, double casts, non-null assertions, and ignored promises as substitutes for correct state handling. Use `const` unless reassignment is necessary; name booleans for their meaning and use units in time/distance names.

Every timer, listener, stream, animation loop, and GPU resource needs a documented owner and cleanup path. Cancellation and stale async completions must not mutate a new room/session. Handle promise failures intentionally; only suppress a failure where disposal or another documented fallback makes it harmless.

## Rendering

The server owns authority; visuals consume authorized snapshots only. Dispose owned geometries/materials/textures when their owner ends, but do not dispose shared cached resources from one consumer. Keep bounded pools/caches and reuse hot-loop scratch values where measured. Do not replace predictable mutation with allocation-heavy immutable copies just for style. UI updates should avoid unchanged DOM writes.

Run affected unit tests, root typecheck/lint, then full verification. Rendering, input, room, transport, and lifecycle changes require actual browser E2E evidence. No current-Hider-position diagnostic backdoors.

Run `pnpm lint:ts` with type-aware ESLint and `pnpm format:check`. Public Three.js constructor generics sometimes widen to `any`: narrow runtime classes and local values explicitly rather than propagating untyped material/geometry state. Scratch pose caches must clear or overwrite absent optional fields, not retain old shield/skin/warp data.
