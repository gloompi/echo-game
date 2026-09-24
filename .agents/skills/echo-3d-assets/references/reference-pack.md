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

1. **Budget first.** Without a budget in the brief, ask before any paid job. For a batch,
   tell the user how many jobs you will submit. `higgsfield generate cost ...` gives an
   estimate where supported.
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

## Mesh route: generated-then-cleaned

Only when the brief selects it. `multi_image_to_3d` accepts one to four images; pass the
approved front/side/back (and three-quarter) turnaround and request texture if needed.
Treat the result as a sculpt reference or starting mesh, never as game-ready:

- Keep the raw download in `refs/` with its provenance entry.
- In Blender: fix scale, origin and facing; remove floaters and interior faces;
  retopologize or decimate into a separate game mesh within the triangle target; unwrap;
  bake or reassign materials to the project's flat stylized palette; then rig.
- Everything after the download must be reproducible from the authoring script or the
  saved `.blend`, and reviewed with the same loop as a scripted model.

## Supplied references

User-supplied images are authoritative for design. Record them in `provenance.json` with
`source: user`. If one is missing or unreadable, say so. Do not invent a substitute (a
missing third concept must not become an imagined map).
