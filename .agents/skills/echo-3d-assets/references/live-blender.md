# Live Blender: generate, then clean up

Work in the user's open Blender so they can watch every step, and judge real viewport
screenshots while you work. The default route is: generate the mesh into the scene with
the Higgsfield plugin, then clean it up and fix it live through the Blender MCP.
Background Blender (`--background`) is only for the review renders and validation of a
saved file, never for modeling.

## 1. Connect both toolsets first

Two MCPs drive the same Blender at once, and both are deferred in Claude Code. Load them
in one call before anything else:

```text
ToolSearch select:mcp__Blender__get_objects_summary,mcp__Blender__execute_blender_code,
mcp__Blender__get_screenshot_of_window_as_image,mcp__Blender__get_screenshot_of_area_as_image,
mcp__Blender__jump_to_view3d_object_by_name,mcp__Blender__search_api_docs,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__get_host_status,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_image_to_3d,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_generate_3d,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_generation_status,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_import_model,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_list_models,
mcp__45cdf358-6949-4a44-8980-0f1e8d139866__bl_screenshot
```

The Higgsfield connector ID can differ per install; if the `select:` misses, search for
`bl_image_to_3d`. Then call `get_objects_summary` (Blender MCP) and `get_host_status`
(Higgsfield, expect `"blr": true`).

- Blender MCP fails: tell the user to start Blender 5.2 with the MCP add-on
  (Preferences > System > Network > Allow Online Access, then Add-ons > MCP > Start). It
  listens on `localhost:9876`.
- Higgsfield shows `blr: false`: ask the user to open the plugin's MCP tab in Blender and
  reconnect (or run `bpy.ops.higgsfield.restart_mcp()`). The plugin connects out to the
  hosted bridge, so it does not compete with the Blender MCP for a port.

Do not fall back to background or procedural modeling without the user's agreement.

## 2. Open the asset file without losing the user's work

Check `bpy.data.is_dirty` and `bpy.data.filepath` first. If the open file has unsaved
changes, ask before switching files. Then open `assets-src/<kind>/<id>/<id>.blend`, or for
a new asset start from an empty scene and `save_as` to that path immediately. Save after
every accepted step (`bpy.ops.wm.save_mainfile()`).

## 3. Set up the scene

- Metric units, scale 1. The character stands at the origin facing Blender -Y.
- Load the reference crops as image empties (`empty_display_type = 'IMAGE'`): front crop
  in the XZ plane behind the model, side crop in the YZ plane, scaled so the reference
  figure is 2.16 m tall with its feet at z = 0. Put them in a `Refs` collection that is
  hidden from render and excluded from export.
- Add the collision guide (cylinder radius 0.36 m, height 2.16 m, wireframe display) in a
  `Guides` collection, also excluded from export. It is the proxy the generated mesh must
  fit.
- One collection per part group (`Head`, `Torso`, `Arms`, `Legs`, `Gear`), clear object
  names (`hood`, `visor`, `glove.L`).

## 4. Generate into the scene

Spend within the brief's credit budget without asking per job
([reference-pack.md](reference-pack.md#budget-and-job-log) for the job log).

1. **Estimate.** The connector has no estimate tool, so run
   `higgsfield generate cost <job_type> --image <file> ...` (non-spending; local images
   are uploaded for the estimate). If a model cannot be estimated, use the credits its
   submission returns as the first data point and record that.
2. **Pick the job from the live catalog** (`bl_list_models`, `higgsfield model get <id>`
   for parameters). Current good fits, not pinned choices:

   | Asset                          | Job                                                      | Tool                                                           |
   | ------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------- |
   | Character from turnaround      | `tripo_h3_1_multiview_to_3d` (front/side/back, in order) | CLI `generate create` (multi-image), then import               |
   | Character/prop from one image  | `tripo_h3_1_image_to_3d`, `hunyuan3d_v3_image_to_3d`     | `bl_image_to_3d(image_path, job_type)`                         |
   | Prop from a text description   | `tripo_3d`, `hunyuan3d_v3_1_text_to_3d`                  | `bl_generate_3d(prompt, job_type)`                             |
   | Map props from a concept sheet | `sam_3_3d` (extract objects, optional `prompt`)          | CLI `generate create sam_3_3d --image ... --prompt "<object>"` |

   Characters generate in a clean A-pose with no props, so auto-rig works (section 6).

3. **Submit once,** log the job ID and returned credits in `provenance.json`, then poll
   `bl_generation_status(job_id)` (or `higgsfield generate wait <id>`). A slow job is
   resumed, never resubmitted.
4. **Import** the finished GLB into a `Generated` collection with `bl_import_model`
   (`url` from the status, or a local `path` for CLI results). Also download the raw GLB to
   `refs/raw-<jobId>.glb` and keep it untouched; do not record the signed URL.
5. Screenshot the import next to the guide and the reference crops. If it misses the
   identity or proportions badly, regenerate from a better source image (within budget)
   rather than trying to sculpt a wrong mesh into shape.

## 5. Clean up live, in small visible steps

One change per `execute_blender_code` call (keep each call short, well under 100 lines),
so the user sees the model improve piece by piece. For each step:

1. Say in one line what you are about to fix.
2. Run the code. Typical cleanup order: scale to 2.16 m with feet at the origin and facing
   -Y, apply transforms; delete floaters and interior faces; merge by distance and fix
   normals; remesh (`bpy.ops.higgsfield.remesh(target_polycount=..., topology='triangle')`
   or Blender's decimate) toward the triangle target; separate into the part collections;
   square off and bevel shapes the style needs blocky; replace the generated textures
   with the flat palette materials (`tint_light`, `tint_dark`, own colours). Rebuild a part
   by hand only where the generated one stays poor, using real modeling operations
   (primitives, extrude, inset, bevel, mirror, shrinkwrap, solidify, booleans), never
   hundreds of vertices by formula.
3. Frame it (`jump_to_view3d_object_by_name`) and take a viewport screenshot
   (`get_screenshot_of_area_as_image` for the 3D view, or the window).
4. Compare against the reference crop: silhouette, proportion, placement. Name the
   concrete problem ("hood 15% too narrow in front view") and fix it before moving on.
5. Save the file. Append the accepted code to `assets-src/<kind>/<id>/build-log.py` with a
   one-line comment, and note generation job IDs there too, so the asset can be audited.

Blender 5 gives new materials a white Principled BSDF node, so `diffuse_color` alone does
not change the material preview; set the node's Base Color (and Emission) instead. Check
placement with numbers too (bounding values in `result`), not only screenshots: a part can
look recessed from one angle and stick out in the side view.

Switch the viewport between front (numpad 1), side (numpad 3) and perspective views by
setting `region_3d.view_perspective` / `view_rotation` in code when you need a matching
angle for the reference. Use solid shading with object colours for form passes and
material preview for material passes.

## 6. Auto-rig (characters)

After the mesh is cleaned, joined into the export mesh(es) and at final scale, select it
and run the plugin's rigger through the MCP:

```python
bpy.ops.higgsfield.auto_rig(use_height=True, height_meters=2.16)
```

It spends credits (log it) and imports the rigged result. Then, live: rename bones to the
contract names in [character.md](character.md#rig), add `root` at the feet and the
Seeker's `weapon_socket`, check the deform bone count and 4 influences per vertex, and
test crouch, slide and wave extremes before authoring clips. Rigid parts (visor, armour
plates) may need their weights cleaned to one bone.

## 7. Pass checkpoints

At the end of each pass (review-loop.md), run the background review renders on the saved
`.blend` for the fixed-angle sheet, write the review record, show the user the sheet and
one live viewport screenshot, and stop if the phase asks for approval.

## 8. Worlds

The layout script remains the source of `map.json` and of the tagged collider meshes
(gameplay data must be reproducible). Run it to create or update the `Colliders`
collection in the open `.blend`. Then dress the map live in separate `Art` collections
with props extracted from the approved concept sheets (section 4, `sam_3_3d`), cleaned up
as in section 5 and fitted inside or flush to their colliders. The layout script must
update colliders in place and never delete the `Art` collections. Export the runtime GLB
from the saved file with the documented glTF flags.
