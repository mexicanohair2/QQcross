# QQCross scanword engine — production integration

The scanword engine is the only production path for creating scanword boards in app.js. It runs in a module Web Worker in browsers and has a bounded main-thread fallback where Workers are unavailable. The previous greedy buildScanword() generator is no longer used by gameplay.

## Canonical board contract

- Exactly 8 columns × 12 rows = 96 cells.
- The upper-left cell (0,0) is the only reserved blank corner.
- The left border (rows 1–11, column 0) contains question/end cells.
- (0,1) is the required top-left anchor.
- Other top-row cells may be question cells or letters, but every letter must belong to a complete horizontal answer slot between question cells.
- Question cells may start an answer, terminate one, or do both. Terminal-only question cells remain associated with their incoming answer and are validated independently.
- Horizontal and vertical answers are supported in both directions.
- The optional 11-letter special answer begins at (0,1), proceeds down column 1, and ends at the lower boundary. It is requested at about 25% frequency, not on every board.

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

The repository dictionary currently has 2,287 source records, 46 picture-key records, 83 answer records of exactly 11 letters, and 709 records tagged as logic before runtime normalization. Runtime counts are reported by prepareDictionary() and the CI scanword verification. This is not a 25,000- or 50,000-word scanword dictionary.

## Verification

- npm --prefix scanword-engine test runs isolated engine tests.
- npm run test:scanword checks the production source dictionary and performs 100 seeded end-to-end generator runs with repeatability checks.
- Playwright checks the actual GitHub Pages app, 8×12 geometry, all 96 cells, picture/logic quotas, clue interaction and mobile viewport constraints.
- A puzzle is accepted into the game only after the independent validator reports success.
