# Art source and migration boundary

The existing visual source is preserved in `client/models.ts` (striped Hider, armored Seeker, toy blaster and procedural animation) and `client/world.ts` (arena rendering). The collision/spawn layout is now engine-independent `shared/arena.json` with metres, +Y up and character origins at the feet.

This directory is reserved for future original `.blend`, texture and authored animation source, with an asset manifest recording origins/licenses. It intentionally does not contain placeholder binary models or pretend that Blender/GLB assets were created during the server migration.

When adding authored assets, export runtime `.glb` files under `public/assets/`, retain the source here, use consistent scale/origin, and keep collision proxies separate from decorative meshes. Preserve the current character silhouettes and palette unless a new art direction is approved. A native engine can import exported visual assets and the shared map data; the current Three.js procedural animation code itself is not automatically portable.
