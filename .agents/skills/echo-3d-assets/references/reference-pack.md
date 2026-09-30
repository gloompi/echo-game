# Reference pack

Model from references that answer measurable questions. A single cinematic image hides the
back, sides, part boundaries and true proportions; a pack removes that guesswork.

## Folder and provenance

```text
assets-src/<characters|worlds|props>/<id>/refs/
  00-hero-<letter>.png        concept candidates; the approved one is recorded below
  01-front.png 02-side.png 03-back.png 04-three-quarter.png   character turnaround
  10-part-<name>.png          isolated parts when useful (helmet, blaster, hair block)
  20-plan.png 21-view-<n>.png map plan sketch and key eye-level views
  provenance.json
```

`provenance.json` holds one entry per image: `file`, `source` (`user`, `higgsfield`,
`blender-render`), `model`, `prompt`, `inputs` (files used as image references), `jobId`,
`createdAtUtc`, `approved` (true/false/null) and `note` (why it was kept or rejected). Keep
rejected takes with a one-line reason; they prevent repeating a failed direction. Never
record signed URLs, tokens or account data.

## Generation (Higgsfield)

Use the installed `higgsfield-generate` skill and the Higgsfield CLI with the user's
selected workspace. Discover current model IDs with `higgsfield model list --json`; model
names in this file are examples, not pinned choices.

1. **Budget first.** The brief's credit budget covers concepts, turnarounds, mesh
   generation, extraction and rigging together ([job log](#budget-and-job-log)). Spend
   within it without asking per job; ask only to exceed it.
2. **Hero concepts (2-4).** Vary silhouette, proportions and material language
   deliberately, not just colour. Include the identity constraints in every prompt. Save
   each result under a stable letter.
3. **Stop for approval.** Present the candidates with direct file paths. Do not generate
   turnarounds from an unapproved concept.
4. **Turnaround from the approved image**, passing it as the image reference (a
   Nano Banana-class reference model suits character consistency). Ask for strict
   orthographic front, side and back in an A-pose (characters) with flat, even lighting, a
   neutral grey background, the full body including feet and hands, no perspective and no
   props added. For maps, ask for a top-down plan sketch and eye-level views of the named
   landmarks instead.
5. **Check every image** at full size before using it: identity kept, same proportions
   across views, feet and hands visible, no invented equipment, no perspective drift.
   Retry a failed image at most twice within budget, then report the problem.
6. **Job safety.** Save the job ID immediately. After a wait timeout, recover with
   `higgsfield generate list --json` / `generate get <id> --json` /
   `generate wait <id>`; never resubmit a job that may still be running.

## Mesh route: generate, then clean up live

This is the default route. Generate the starting mesh into the open Blender from the
approved references and clean it up live
([live-blender.md](live-blender.md#4-generate-into-the-scene)):

- Characters: the approved front/side/back turnaround into a multiview-to-3D job (order
  front, side, back), or the front view into a single-image job, then the plugin's
  auto-rig once cleaned.
- Props: a single-image job from an isolated part sheet (`10-part-<name>.png`), or a
  text-to-3D job when no sheet exists.
- Map props: extract them from the approved concept sheets and eye-level views with the
  `sam_3_3d` job, one prompted object per job, so the props match the approved art.

A generated mesh is a starting point, never game-ready: keep the raw download in `refs/`,
then fix scale, facing and origin, remove floaters and interior faces, remesh to the
triangle target, replace materials with the flat palette and rig, all live. Review it
with the same loop as any other asset.

## Budget and job log

Log every paid job in `provenance.json` as soon as it is submitted: `jobId`, `model`,
`inputs`, `estimatedCredits`, `credits` (as returned), `purpose`, `result` (the kept file)
and `approved`. Keep a running total against the brief's budget in the review record.
Credits are shared with other sessions, so count your own job IDs, not the account
balance. Estimates as of 2026-09-30 (re-check with `higgsfield generate cost`):

| Job                                                               | Credits                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| Concept image (GPT Image 2.5 high) / turnaround (Nano Banana Pro) | 2.75 / 2                                   |
| `tripo_h3_1_image_to_3d`, `tripo_h3_1_multiview_to_3d`            | 9                                          |
| `hunyuan3d_v3_image_to_3d`                                        | 11                                         |
| `tripo_3d` standard / detailed                                    | 5 / 12.5                                   |
| `hunyuan3d_v3_1_text_to_3d`                                       | 7                                          |
| `sam_3_3d` extraction, auto-rig, remesh, retexture, Meshy jobs    | not estimable: record the returned credits |

## Supplied references

User-supplied images are authoritative for design. Record them in `provenance.json` with
`source: user`. If one is missing or unreadable, say so. Do not invent a substitute (a
missing third concept must not become an imagined map).
