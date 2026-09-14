# Blender worlds

Mirror Yard and Neon Carnival are original Blender environments based on the two supplied concept images. They are additional selectable maps; Afterhours, Switchyard and Glassworks remain available. A third concept reference was not present in the supplied assets and has no invented map entry.

| Map | Editable source | Authoring script | Runtime model |
| --- | --- | --- | --- |
| Mirror Yard | `assets-src/worlds/mirror-yard/mirror-yard.blend` | `scripts/worlds/mirror_yard.py` | `public/assets/worlds/mirror-yard.glb` |
| Neon Carnival | `assets-src/worlds/neon-carnival/neon-carnival.blend` | `scripts/worlds/neon_carnival.py` | `public/assets/worlds/neon-carnival.glb` |

Each source directory also contains its generated `map.json`, Blender previews and authoring metadata. These models use original geometry and materials rather than downloaded environment meshes. The reference images establish visual direction; the playable layouts are adaptations with measured stairs, passages, cover, spawn points and mirror exits.

## Rebuilding

Run these commands from the repository root in Git Bash, using Blender 5.2:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-exit-code 1 --python scripts/worlds/mirror_yard.py
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-exit-code 1 --python scripts/worlds/neon_carnival.py
pnpm run maps
pnpm run fixtures
pnpm run fixtures:check
pnpm run test:ts
pnpm run test:rust
pnpm run build
pnpm run test:e2e
```

The scripts regenerate the `.blend`, GLB, collision descriptor and previews together. Rerunning a script replaces its generated `.blend`; preserve independent manual Blender edits before regenerating. Runtime models are served by the normal built application and require no additional asset service.

## Coordinates and gameplay

The game and glTF files use metres with +Y up. The authoring scripts map game `(x, y, z)` to Blender `(x, -z, y)`; Blender's glTF exporter converts the mesh back to the game orientation. Runtime loading applies no compensating rotation or scale.

Physical meshes and their AABB descriptors originate from the same authoring definitions. `pnpm run maps` incorporates both `assets-src/worlds/*/map.json` files into the checked-in `shared/maps.json`, which the TypeScript and Rust engines consume. A missing descriptor fails map generation. Collision, movement, shots and mirror transfers never use imported mesh geometry as authority. `shared/arena.json` remains authoritative for the original Afterhours layout.

Small surface details and foliage are decorative. Mirrors and their interaction prompts are created at runtime from shared map data. Blender cameras, presentation lights and backdrop are excluded from the runtime exports; the game keeps its own lighting.

## Loading and verification

`client/world-assets.ts` maps the two map IDs to their GLBs. An arena starts with a procedural rendering of its authoritative layout and swaps the visual group after the model loads. Missing or invalid art retains that fallback. A model finishing after its arena was disposed is released without entering another map's scene. Loaded models own their meshes, materials and textures; they do not share disposal with character resources.

`arena.ready`, `arena.assetStatus` and `scene.userData.worldAsset` describe static asset loading only. They contain no current or delayed actor poses. Loading the art cannot bypass the server-confirmed map selection or Echo's hidden-Hider rules.

The map tests check finite positive geometry, map bounds, unique IDs, clear spawns, paired mirror exits and connected ground routes. Dedicated traversal checks exercise authored stairs and crouch passages. The generated gameplay fixtures replay those movements through Rust for motor parity. Browser checks must additionally confirm successful GLB loading, gameplay views and multi-client map changes; Blender renders alone do not establish in-game appearance or multiplayer behavior.

## Verified delivery, 2026-09-14

- Both saved `.blend` files reopened in Blender 5.2. `scripts/worlds/validate_sources.py` independently checked source geometry, units, collider bounds and GLB contents. Each world folder contains `source-validation.json`.
- Mirror Yard: 222 collision boxes, 234 runtime mesh primitives, 76,832 triangles, 4,726,780-byte GLB.
- Neon Carnival: 122 collision boxes, 137 runtime mesh primitives, 141,472 triangles, 4,896,424-byte GLB.
- TypeScript tests, all 66 Rust tests, six movement fixtures and eleven gameplay fixtures passed. The client and locked release server builds passed.
- All eight browser tests passed in the initial full run. After correcting the menu's map count, a subsequent full run passed seven tests but encountered Chromium `ERR_NO_BUFFER_SPACE` while opening the world test's second page, before joining a room. Isolated reruns passed; the final strengthened world test passed in 1.3 minutes, positively checking the current hunt round after focusing each client. Two real WebTransport clients loaded both GLBs, received the same host-selected map, entered rounds and returned to the lobby. Actual gameplay screenshots were inspected alongside the Blender renders and retained as `gameplay-hider.png` and `gameplay-seeker.png` in each source folder.
- `Cargo.lock` was regenerated by Cargo because the existing lock disagreed with the already-declared `wtransport = 0.7.2` server dependency. No dependency declarations or movement motors were changed.

The third requested concept was unavailable. This delivery includes the two identified worlds only. The visual designs are playable adaptations; the carnival skyline rides are static scenery. Public hosting and external-network multiplayer were not exercised in this task.

Export/loading references: [Blender glTF manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html) and [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
