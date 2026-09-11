import rules from './rules.json';
/** Shared, renderer-independent tuning. Rust embeds this same file. */
export const CFG = Object.freeze({ ...rules, dt: 1 / rules.tickRate });
