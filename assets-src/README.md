# Art source and migration boundary

The existing visual source is preserved in `client/models.ts` (striped Hider, armored Seeker, toy blaster and procedural animation) and `client/world.ts` (arena rendering). The collision/spawn layout is now engine-independent `shared/arena.json` with metres, +Y up and character origins at the feet.

`worlds/mirror-yard/` and `worlds/neon-carnival/` contain original editable Blender environments, concept references, rendered previews and collision descriptors. Their game-ready GLBs live in `public/assets/worlds/`. See [Blender worlds](../docs/BLENDER_WORLDS.md) for rebuild commands and verification. The original three arenas remain procedural.

When adding authored assets, export runtime `.glb` files under `public/assets/`, retain the source here, use consistent scale/origin, and keep collision proxies separate from decorative meshes. Preserve the current character silhouettes and palette unless a new art direction is approved. A native engine can import exported visual assets and the shared map data; the current Three.js procedural animation code itself is not automatically portable.
