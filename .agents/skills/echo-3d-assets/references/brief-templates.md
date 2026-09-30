# Brief templates

A brief is the contract for one asset. Copy the relevant template into the request (or
into `assets-src/<kind>/<id>/brief.md`). Leave a line blank to accept the stated default.

## Character brief

```text
Asset: character
ID: <hider-v2 | seeker-v2 | ...>            # folder + GLB name
Role: <hider | seeker>
Replaces in game: <yes, after approval | no, side-by-side only>

Identity to keep: <e.g. striped shirt, blocky toy-like proportions, brown hair>
Identity changes (explicit): <none | describe>   # default none; see root AGENTS.md
Style words: <e.g. chunky designer-toy, bevelled blocks, clean flat colours, readable at 15 m>
Avoid: <e.g. realistic anatomy, noisy textures, thin parts>
References: <paths/URLs of images I supply, or "generate">

Mesh route: <generated + auto-rigged, cleaned up live (default) | hand-modeled live>
Generation budget: <max Higgsfield credits, default 60>
Triangle target: <default 6-10k, hard cap 15k>
Animations: <default set in character.md, or list>
Skins: <keep tint regions for current skin palettes: yes (default) | no>
Done means: <e.g. approved turnaround match + clean validation + in-game screenshots>
```

## Map brief

```text
Asset: world map
ID: <kebab-case, new id or one to replace>
Replaces: <new map | replaces mirror-yard | replaces neon-carnival>
Name shown in menu: <...>
Players: <e.g. 4-10>        Size (half extent m): <default 32>

Theme and mood: <e.g. rain-slick rooftop market at night, cyan/magenta signage>
Gameplay goals: <e.g. two long sightlines broken by market stalls, one crouch tunnel,
                 rooftop loop, 2 mirror pairs, no dead-end hiding spots>
Landmarks: <3-6 memorable named places>
Avoid: <e.g. open empty plazas, maze corridors, props that hide a whole player silently>
References: <paths/URLs of images I supply, or "generate">

Mesh route: <scripted colliders + props extracted from concept sheets, cleaned up live (default)>
Generation budget: <max credits, default 120>
Budgets: <default <=150k tris target, <180k hard, <=300 meshes, <12 MB GLB>
Done means: <e.g. playable graybox approved first, then art passes, tests + 2-client E2E>
```

## Prop brief

```text
Asset: prop
ID: <kebab-case>                           # folder + GLB name
Used in: <map ids or character (e.g. seeker blaster)>
Look: <style words, colours, size in metres>
References: <part sheet / concept sheet paths, or "generate">
Mesh route: <generated, cleaned up live (default) | extracted from a concept sheet | hand-modeled live>
Generation budget: <max credits, default 20>
Triangle target: <default 3k, hard cap 6k>
```

## Defaults the agent applies silently

- Generated into the open Blender, then cleaned up live there with screenshots.
- Credit budget: character 60, prop 20, map 120. That covers concepts, turnarounds, two
  mesh attempts (characters and props) or about eight extractions (maps), and rigging.
  Spend within it without asking per job; ask before exceeding it.
- Never hand-write procedural geometry in place of a generation the budget allows.
- Character: Hider/Seeker identity kept, default animation set, skin tint regions kept.
- Map: graybox playtest before any art pass; existing gameplay metrics from `shared/`.
- Evidence: review sheet per pass, validation report, in-game screenshots.
