# Neon Carnival

Playable interpretation of the supplied Neon Carnival concept: carousel plaza, arcade machines and rooftop, crouch tunnel and upper walkway, bumper court, ticket booths, funhouse, static mirror maze, Ferris-wheel and rollercoaster skyline.

- `neon-carnival.blend`: editable Blender scene with presentation cameras and lights.
- `reference.png`: supplied concept image, copied unchanged from the character-assets checkout.
- `overview.png`, `ground-view.png`: actual Blender renders.
- `map.json`: generated physical boxes, spawns, waypoints and portal positions consumed by the shared game map build.
- `manifest.json`: measured geometry and export metadata.
- `public/assets/worlds/neon-carnival.glb` at the repository root: runtime export.

Rebuild using `scripts/worlds/neon_carnival.py` in Blender, then `pnpm run maps` and `pnpm run fixtures`. The source script recreates the generated files, so save manual edits separately before rebuilding. Models and materials are authored geometry; no environment library or purchased asset is required.

The Ferris wheel and rollercoaster form a stationary skyline outside the play area. The slide tunnel is a crouch passage using the existing movement system. Mirror-maze panels are static physical cover; game portals are drawn by the client at server-owned map coordinates. This is a playable adaptation, not a claim of exact reproduction of every feature in the concept sheet.
