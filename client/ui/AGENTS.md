# Browser presentation

Inherit `client/AGENTS.md`. UI modules receive explicit state and narrow DOM bindings; do not import `main.ts` or own transport/simulation authority. Keep event registration and disposal ownership explicit. Render only changed text/structure, never use player-supplied HTML, and bound/reset view caches when leaving a room. Pure view-model tests and real browser journeys must cover changes.
