# Art source and migration boundary

The procedural visual source is preserved in `client/models.ts` (armored Seeker, toy blaster, procedural animation, and the striped Hider that now shows only while the authored Hider loads or if it fails) and `client/world.ts` (arena rendering). `characters/hider-hoodie/` holds the authored Hider's brief, references, reviews and `.blend`; its runtime GLB is `public/assets/characters/hider-hoodie.glb`. The collision/spawn layout is now engine-independent `shared/arena.json` with metres, +Y up and character origins at the feet.

`worlds/mirror-yard/` and `worlds/neon-carnival/` contain original editable Blender environments, concept references, rendered previews and collision descriptors. Their game-ready GLBs live in `public/assets/worlds/`. See [Blender worlds](../docs/BLENDER_WORLDS.md) for rebuild commands and verification. The original three arenas remain procedural.

New characters, props and maps follow the [3D asset pipeline](../docs/3D_ASSET_PIPELINE.md). The existing worlds and procedural characters are technical baselines, not quality targets for that work.

When adding authored assets, export runtime `.glb` files under `public/assets/`, retain the source here, use consistent scale/origin, and keep collision proxies separate from decorative meshes. Preserve the current character silhouettes and palette unless a new art direction is approved. A native engine can import exported visual assets and the shared map data; the current Three.js procedural animation code itself is not automatically portable.
