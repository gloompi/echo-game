Pass: 1 graybox (blockout)       Source: scripts/worlds/rooftop_market.py (blob ce80c5ecf4), uncommitted on feat/rooftop-market-graybox
Decision: request-input (two-client playtest by the user before any art pass)
Overall match: n/a for art; layout vs brief checked below
Brief checks:
  - Two long sightlines: Lantern Lane z -19..-13 and Signal Lane z 13..19, 64 m each; a 2 m
    channel stays open at standing eye height, broken by 1.1 m counters (crouch cover) and
    alternating 2.6 m stalls (pockets) ....................................... pass (plan, eye-2/3)
  - One crouch tunnel: Hall tunnel, 1.6 m wide, 1.5 m clear, 10 m long; standing blocked,
    crouched passage both ways (TS test + Rust parity fixtures) ............... pass
  - Rooftop loop: NW -> N catwalk -> NE -> bridge -> Hall -> bridge -> SE -> S catwalk -> SW
    -> bridge -> Signal house -> bridge -> NW; full lap at 3.0 m in the TS test ... pass
  - Ways onto the loop: six stairs (all reach 3.0 m without jumping) plus the cargo-lift
    jump route 0 -> 1.5 -> 3.0 m ............................................... pass
  - Two mirror pairs: CYAN north court <-> south court, MAGENTA west alley <-> east alley;
    exits clear and ground-reachable ............................................ pass
  - No dead ends: courts have the ground opening, stairs/lift and a mirror; alleys connect
    both lanes; ground BFS reaches every spawn and mirror exit .................. pass
  - Landmarks readable from the plan and corners: water tower (NW roof), cargo lift (north
    court), noodle stand (centre), neon arch (Signal Lane) ...................... pass
  - Avoid empty plazas: first build left open diagonals across the market core (eye-4);
    added two inner stalls and two noodle tables. Refine round 1 of 3 ........... pass, confirm in playtest
Budgets: 163 colliders, 166 meshes, 1,992 triangles, ~195 KB GLB (validate_glb passed)
Evidence: plan.png, corner-1..4.png, eye-1..4.png, sheet.png, ../../validation-glb.json
Open questions for the playtest:
  - Is the rooftop loop too strong for Seekers (long catwalk views over both lanes)?
  - Are the lane counters (1.1 m) enough crouch cover against a 3 s delayed Seeker view?
  - The stairs have a one-frame landing hiccup at step 8 when the approach phase grazes
    the step edge (motor behaviour, also possible on existing maps); the player recovers
    within ~8 ticks. Tell me if it feels sticky.
Next change: whatever the playtest finds; then pass 2 (structure) and art passes 3-6.
