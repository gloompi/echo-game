# Mirror Yard

Original Blender reconstruction of the supplied Mirror Yard concept, adapted to Echo's axis-aligned authoritative collision model. The world is 48 by 48 metres, with a complete rooftop ring, four shallow stair routes, two red crouch tunnels, a central cyan signal monument, planters, vault crates, flank lanes, and paired ground-level mirror alcoves.

- mirror-yard.blend: editable Blender 5.2 scene, opening on the presentation camera.
- preview.png: 1400 by 1050 isometric render.
- ground-view.png: 1400 by 875 courtyard render.
- map.json: authoritative collision and gameplay descriptor for integration.
- metadata.json: deterministic generator provenance and export metrics.
- validation.json: independent GLB accessor-bound audit against the map.
- Runtime export: public/assets/worlds/mirror-yard.glb.
- Generator: scripts/worlds/mirror_yard.py.

Regenerate with Blender 5.2 in background mode, setting --python-exit-code 1 before --python scripts/worlds/mirror_yard.py. Set ECHO_SKIP_RENDER=1 when only source, map and GLB regeneration are needed. No network assets, textures, fonts or dependencies are required.

All 222 physical meshes carry collisionId extras and match their map AABBs within 0.0001m. Hairline surface details and soft foliage remain cosmetic. Presentation cameras, lights and studio backdrop are excluded from GLB. Mirrors are authored as free alcoves; Echo creates the actual interactive surfaces.

An independent review executed the game's shared physics motor on all four stair routes: each reached y=3.6 without jumping. Ground spawns and mirror exits clear the actual player capsule dimensions. Live multiplayer verification belongs to the game integration.
