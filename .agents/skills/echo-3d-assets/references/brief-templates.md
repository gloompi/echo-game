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

Mesh route: <scripted (default) | generated-then-cleaned | hybrid>
Generation budget: <max Higgsfield credits, default 0 = ask before any paid job>
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

Mesh route: <scripted (default) | hybrid with generated hero props>
Generation budget: <max credits, default 0 = ask>
Budgets: <default <=150k tris target, <180k hard, <=300 meshes, <12 MB GLB>
Done means: <e.g. playable graybox approved first, then art passes, tests + 2-client E2E>
```

## Defaults the agent applies silently

- Scripted route, zero paid generations until the user approves a budget.
- Character: Hider/Seeker identity kept, default animation set, skin tint regions kept.
- Map: graybox playtest before any art pass; existing gameplay metrics from `shared/`.
- Evidence: review sheet per pass, validation report, in-game screenshots.
