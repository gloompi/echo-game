# Generated parity fixtures

Inherit root/shared/test instructions. These JSON files are generated evidence shared with Rust tests, not hand-maintained expected answers. Update the generator and inspect behavioral differences before accepting regeneration.

Use `pnpm fixtures` and `pnpm fixtures:check`; map generation uses its own existing command/check. Never alter fixtures only to hide a disagreement between the TS prediction motor and Rust authoritative simulation. Keep fixtures deterministic and free of secrets.
