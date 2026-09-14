> Historical transport-migration record below. For the current refactor and native verification results, read [the engineering verification record](engineering/baseline.md).

# WebTransport and abilities validation — 12 September 2026

## Source and integration

Applied all 32 files from the recovered `echo-upgrade` package after its apply
script verified every SHA-256 against `manifest.json`. Its supported base matches
current main: `2f60e54aeb5135ee2cf513d074a6d34f5a93b497`.
Work is on `feat/echo-webtransport-abilities`; main is not merged or modified.

Integration fixes include wtransport stream-opening error types, a strict
TypeScript test inference error, protocol-v3 network/browser/launcher tests,
configurable weapon and teleport timing assertions, regenerated movement fixtures,
real Cargo and pnpm lockfiles, LF checkout rules for generated fixtures, and
CI/Docker/hosting documentation for the separate UDP listener. Network tests
allocate TCP and UDP ports independently because Windows reserves different ranges.
Browser tests start this checkout on dedicated ports and never reuse an unknown server.

## Observed passes

Validated with Node 24.11.1, pnpm 10.23.0, Cargo 1.98.1 and Playwright Chromium 153
on Windows. Docker also built and exercised the Linux image.

| Check                                           | Result                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | Pass; actual generated lockfile retained                                                                             |
| `pnpm run build:client`                         | Full strict TypeScript check and Vite production build pass                                                          |
| `pnpm run test:ts`                              | 80 pass, 0 fail, 0 skipped                                                                                           |
| `pnpm run fixtures:check`                       | Maps and both generated fixture files match                                                                          |
| `cargo test --workspace --no-fail-fast`         | 66 pass, including 13 new ability tests and both TS/Rust motor-parity suites                                         |
| `cargo build --release --locked -p echo-server` | Windows release build passes                                                                                         |
| `pnpm run test:network`                         | Real Chromium-to-Rust WebTransport integration passes; no mocked TLS/QUIC                                            |
| Browser tests                                   | 7 pass: the existing 5-test suite plus 2 new ability UI tests                                                        |
| `pnpm run test:launcher` on Windows             | Configuration guard passes; POSIX mock lifecycle test skips Windows                                                  |
| Launcher tests in Linux web-build container     | Both pass, including keyed invite registration and child-process shutdown                                            |
| `docker compose config --quiet`                 | Pass                                                                                                                 |
| `docker build`                                  | Linux frontend and Rust release image build passes                                                                   |
| Linux container runtime                         | Read-only, unprivileged container serves HTTP and completes native browser QUIC join/snapshots through published UDP |

The real network check covers invitation-key rejection, settings authority and
round immutability, delayed hider poses and nonspatial roster, zero delay, movement
acknowledgements, public-URL control token, twelve-player capacity and host transfer.
Browser checks cover two independent client contexts, all three maps, control
preferences, skin selection, host shield tuning, shield activation, all four weapon
models and scan activation. Shield and seeker HUD screenshots were visually reviewed.

## Remaining unverified work

- External-network multiplayer, router/CGNAT/firewall/relay behavior, and a real
  public frontend tunnel paired with a reachable game UDP endpoint.
- Non-Chromium browsers, custom trusted TLS deployment, live certificate rotation,
  blocked UDP, and reconnect after network interruption. Session resume is not implemented.
- Latency/loss/reordering soak tests, sustained capacity and coordinated play balance.
- Detailed visual/gameplay review of every skin, muzzle during recoil/crouch/reload,
  low-ceiling slides, blood feedback, crowd-control effects and scan-region bounds.
- Hosted CI status is separate from these observed local checks; inspect the
  workflow for the pushed commit rather than treating local passes as a CI result.

No Internet playtest, latency guarantee or competitively proven balance is claimed.
