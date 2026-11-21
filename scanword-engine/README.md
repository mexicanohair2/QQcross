# QQCross scanword engine — production integration

The scanword engine is the only production path for creating scanword boards in app.js. It runs in a module Web Worker in browsers and has a bounded main-thread fallback where Workers are unavailable. The previous greedy buildScanword() generator is no longer used by gameplay.

## Canonical board contract

- Exactly 8 columns × 12 rows = 96 cells.
- The upper-left cell (0,0) is the only reserved blank corner.
- The left border (rows 1–11, column 0) contains question/end cells.
- (0,1) is the required top-left anchor.
- Other top-row cells may be question cells or letters, but every letter must belong to a complete horizontal answer slot between question cells.
- Question cells may start an answer, terminate one, or do both. Terminal-only question cells remain associated with their incoming answer and are validated independently.
- Answer placement supports all four directions: right, left, down and up. A slot is still accepted only when the complete path is in bounds and independently validated.
- The optional 11-letter special answer is unique: it begins at (0,1), proceeds down column 1, and uses (1,1)..(11,1). With the production sequence index it is requested no more than once in five puzzles (20%); without a sequence index the seeded fallback chance is 20%. A failed special attempt may fall back to a normal valid board.

## Difficulty policy

Every completed scanword is assigned an exact board-level distribution of 20% easy, 60% medium and 20% challenging clues. Largest-remainder apportionment is deterministic for board sizes that do not divide evenly. Difficulty is normalized to three bands and enforced by the CSP with reversible counters; the independent validator checks the final distribution. This is a content-selection constraint, not a claim that every individual clue has been manually reviewed by a linguist.

## Border feasibility

The existing validated layout supports the complete left clue edge and selected top anchors. A fully-question top row combined with a fully-question left column is rejected by the explicit topology preflight: with minimum answer length two and only the single special 11-letter path at (0,1), a top clue at (0,2) cannot be connected to an ordinary in-board slot without forcing a one-letter gap against the mandatory left clue in that row. Do not override this diagnostic with filler, a second boundary exception or orphan clues. See `docs/QQCROSS_SCANWORD_TOPOLOGY_MODEL.md` for the coordinate proof.

## Pipeline

1. dictionary.js normalizes Russian answers and questions, rejects malformed records and answer leakage, preserves meaningful clue variants, and builds positional-letter indexes.
2. topology-builder.js generates a seeded role mask from multiple validated geometric seeds, applies randomized transforms and cell mutations, and independently rejects masks with uncovered letters, question cells without slots, or disconnected geometry.
3. topology.js derives every horizontal and vertical slot from consecutive question cells. It checks actual 8×12 geometry rather than forcing a complete top row.
4. csp.js assigns dictionary entries to all slots using positional indexes, crossing propagation, MRV, degree tie-breaking, bounded backtracking, unique answers/questions, five distinct image assets and at least three distinct logic-clue cells.
5. assembler.js reconstructs the cell grid and word/question links.
6. validator.js independently reconstructs all answer paths and geometric slots, verifies every one of the 96 cell roles, checks crossing letters, unique answer/question ownership, question/answer links, dictionary metadata, picture metadata, connectedness and the optional 11-letter exception.
7. scoring.js evaluates completeness, crossings, clue length/clarity proxies, direction variety, answer-length variety, theme diversity, picture count and logic clues. A score never overrides a validation failure.
8. legacy-adapter.js converts only a validated result into the data shape already consumed by QQCross's scanword renderer, rack, hints, saves, solo, friend and ChatGPT match flows.

## Bounded generation

The engine has seed-based randomness and explicit limits for topology attempts, CSP nodes and CSP time. It returns structured failure diagnostics rather than a partial board. The module worker keeps generation off the UI thread. There are no new runtime dependencies and no Supabase schema changes.

## Production dictionary status

The current production audit reports 2,289 source records, 2,211 valid clue variants, 2,027 unique playable answers, 78 rejected records, 46 picture-key records, 83 raw 11-letter records and 709 raw logic-tagged records. The latest wording pass improved 92 short clues; 174 short prompts remain, including flag/image labels that are intentionally compact. The audit reports zero suspicious duplicate-question groups across different answers. Runtime counts are reported by prepareDictionary() and CI. This is not a 25,000- or 50,000-word scanword dictionary.

## Verification

- npm --prefix scanword-engine test runs isolated engine tests.
- npm run test:scanword checks the production source dictionary and performs 100 seeded end-to-end generator runs with repeatability checks.
- Playwright checks the actual GitHub Pages app, 8×12 geometry, all 96 cells, picture/logic quotas, clue interaction and mobile viewport constraints.
- A puzzle is accepted into the game only after the independent validator reports success.


## Dynamic topology sampling (seeded bridge patterns)

The production sampler now proposes seeded 8×12 role masks directly instead of mutating a single fixed scaffold. Each candidate is accepted only after slot derivation, full-cell coverage, clue-cell degree checks, and connected-topology validation. The 11-letter boundary path is enabled only for runs that explicitly request that optional feature. Rejected masks are discarded; the generator never emits a partial board.

## QQCross brand tile integration

The universal brand assets are local repository files: `icon.svg`, `assets/qqcross-logo.svg`, `assets/brand-tile.svg`, styled through `brand.css`. The scanword's reserved top-left coordinate (0,0) remains a logical `corner` cell; the renderer may display the signature tile there as decorative, non-interactive art. This is strictly presentation-only: it must never become a clue, answer, letter, word slot, image clue, hint target or scoring cell. Never put the tile into arbitrary empty cells or use it to hide topology gaps. Keep the 8×12/96-cell contract, all 95 other logical cell roles, validator rules, five-picture-clue quota and every game mechanic unchanged. Missing SVGs must gracefully fall back to the normal corner background. Use the same universal icon/logo family across all game modes and adapt only surrounding theme colors/contrast.
