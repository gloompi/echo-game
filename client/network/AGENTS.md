# Connection feature

Inherit `client/AGENTS.md`. Keep pure policies (`clock.ts`, `invite.ts`, `transport-config.ts`) independent of DOM globals and transport construction. `connection.ts` owns the session and timers; the WebTransport adapter owns streams and queue limits. Preserve existing root entry points during migrations.

- Inject a monotonic clock and browser environment for deterministic tests; do not replace production transport with a test implementation in E2E.
- Check generation identity after awaited work and after callbacks that can synchronously close/reconnect. Close must be idempotent and clear handles before invoking external cleanup.
- Keep reliable input order and bounded queues. Reject congestion rather than silently dropping simulation inputs. Discard stale snapshots without moving time backwards.
- Validate untrusted discovery values before use. Preserve protocol-version checks, certificate pins, local-host routing, and fragment-only invitation keys.
- Test duplicate/out-of-order snapshots, reconnect races, invalid time measurements, malformed configuration, sync failures, and cancellation. Keep transport integration separate from unit fakes.

A complete deep server-message schema is not implemented yet; do not describe the current envelope guard as full validation.
