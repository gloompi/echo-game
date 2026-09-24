# Node and authoring tools

Inherit the root contract. Node code is tooling, not a second game server. Use ESM and Node built-ins with `node:` imports. New JavaScript should have JSDoc/`checkJs` coverage or be TypeScript; legacy scripts outside `quality/` are not yet fully checkJs-migrated.

Resolve paths relative to `import.meta.url`, not the caller's assumed directory. Prefer argument arrays and no shell; when Windows requires a command shim, use only fixed reviewed arguments. Propagate nonzero exit codes and missing tools, clean up children in failure paths, and never leave a tunnel/server running after tests.

Generated outputs must have a reproducible `--check` path. Do not mutate source or lockfiles as a side effect of verification. Do not print `.env`, invitation keys, tokens, or private certificate material.
