# Architecture and invariants

## Information boundary

The server owns positions, physics time, roles, hit points, ammo, timers, collision checks and pose history. Clients submit bounded movement/aim inputs, never an authoritative position or frame duration. Tick duration is fixed at 1/30 second. Snapshots are sent at approximately 15 Hz.

`Room.snapshot(viewer, now)` is the only snapshot serializer. A seeker receives their own current `self` motor and the history sample at `now - 3000` for everyone else. A hider receives current peers and, optionally, their own old pose. `roster` carries names, role and non-spatial score/alive metadata, not transforms. Seeker warm-up produces no historical players until sufficient history exists; it never substitutes present coordinates.

Other players' event positions, aim and animated poses are held back as well. A seeker's own shot feedback remains immediate, including a successful current-position hit: this is the intended weapon mechanic, not passive location disclosure. Alive status, roster membership, score and round-end notifications are current non-spatial metadata. The alpha does not conceal those metadata side channels.

Browser interpolation operates only on already-filtered snapshots. There is no hidden live enemy array on a seeker client. The 100 ms smoothing buffer and network transit sit on top of the server holdback. Reconciliation replays unacknowledged inputs over the current authoritative self motor, with small corrections smoothed visually.

## Hit detection and movement

Hitscan blaster rays originate from the seeker's current server eye position and aim. Static cover, ground and arena boundaries clip the ray. The closest current live hider is tested with a body AABB. Hitboxes are never rewound. Two hits eliminate a hider for this round. This intentionally differs from competitive FPS lag compensation: a high-ping seeker gets no rewind advantage.

Movement uses a cylinder approximation against shared AABB cover, gravity, jumping, sprint stamina, small step climbing and dash collision substeps. It is character-controller physics, not a general rigid-body solver. Player/player body collision is intentionally absent; otherwise collision with an unseen current hider could disclose that position. Visual character limbs are stylized and not independent hitboxes. Cosmetic arena props do not all collide; structural cover and platforms use the shared map.

## Rooms and lifecycle

Single server process, in-memory rooms, no persistence. Up to eight participants per room; bots fill to four when enabled. Private rooms require host start, transfer host ownership after disconnect, and defer late arrivals to the next round. Public rooms admit late human arrivals as hiders. Practice rooms reject invitations.

A round gives hiders five seconds to move while the seeker can only look. The hunt runs for 120 seconds. All hiders caught means seeker victory; time expiration or no remaining seeker means hider victory. Ten seconds of results precede the next round. Scores persist for the session; reconnecting creates a new player identity. The last human disconnect destroys the room. Role preferences are not a guarantee of the chosen role when a valid roster requires otherwise.

Seeker bots read the same history samples as human seekers, with a modest velocity-based lead; they do not aim at live hider positions. Hider bots can react to live seekers. Pathfinding is intentionally simple waypoint steering, not a navigation mesh. Bot difficulty and small-room balance need playtesting.

## Transport and safety limits

WebSocket JSON, 2 KiB maximum incoming payload, no compression, validated finite values, monotonic bounded input sequence, server-clamped axes/aim, 90 messages per second per connection, join deadline, heartbeat, and outbound backpressure cutoff. Clients send approximately 30 input messages per second. Stale inputs stop moving after 300 ms, subject to normal controller deceleration.

Same-origin upgrade checks apply by default. `ALLOWED_ORIGINS` supports an explicit comma-separated allowlist behind a reverse proxy. Non-browser clients without an Origin header are permitted. This is not authentication or complete anti-cheat: malicious hider clients know present positions and could share them out of band. Spectator collusion is not prevented. Deploy only behind HTTPS for public play; add edge rate limiting and process supervision before broader use.

Limits are conservative initial safeguards, not load-test results. The per-IP connection limit uses the direct socket peer, not untrusted X-Forwarded-For; a reverse proxy can put all players behind the same 24-connection cap. For larger deployments, configure trusted-proxy accounting deliberately rather than blindly trusting a forwarded header.

## Next engineering work

Finish real-browser/build verification and generate the dependency lockfile first. Then run two-human internet playtests: assess hitbox feel, camera framing, visual readability, bot navigation, buffering under jitter, and whether two-hit captures produce enough successful predictions. Multiple seekers, reconnect tokens, latency instrumentation and deployment automation are future work, not implemented features.
