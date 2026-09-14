# GitHub automation

Inherit the root contract. Workflow permissions are read-only unless a narrowly justified write is explicitly necessary. Do not expose secrets to fork PRs or run untrusted PR code through `pull_request_target`.

CI must invoke the same `scripts/quality/verify.mjs` groups as local verification. Keep the stable aggregate `quality-gate` job failing unless static, Rust, and browser jobs all succeed. Missing tools, cancelled/skipped prerequisites, and job startup failures are not passes. Upload failure diagnostics with bounded retention, without credentials.

No automatic formatting/commits or suppression of checks to green a PR. Version/lockfile/toolchain changes need genuine installation evidence. Branch protection requiring `quality-gate` is an admin setting and is not configured merely by this workflow file.
