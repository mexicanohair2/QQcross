# QQCross scanword engine — production integration

The scanword engine is the only production path for creating scanword boards in app.js. It runs in a module Web Worker in browsers and has a bounded main-thread fallback where Workers are unavailable. The previous greedy buildScanword() generator is no longer used by gameplay.

## Canonical board contract

- Exactly 8 columns × 12 rows = 96 cells.
- The upper-left cell (0,0) is the only reserved blank corner.
- The top row has two active clue anchors: (0,1) and one interior anchor at column 4 or 5.
- The left border (rows 1–11, column 0) contains question cells.
- Columns 6 and 7 are letter-only. No question, clue, or terminal-question cell may appear in the rightmost column (7).
- Each row has exactly one registered `RIGHT_EDGE_BOUNDARY` horizontal answer, starting at the last question cell and ending with its final letter in column 7. The boundary at column 8 is not a question cell.
- Every answer has a real clue at its start; terminal-only internal endpoints are structural markers and must not duplicate clue text.
- Horizontal and vertical answers are supported in both directions.
- The optional 11-letter special answer begins at (0,1), proceeds down column 1, and ends at the lower boundary. It is requested at about 25% frequency, not on every board.

## Pipeline

1. dictionary.js normalizes Russian answers and questions, rejects malformed records and answer leakage, preserves meaningful clue variants, and builds positional-letter indexes.
2. topology-builder.js generates a seeded role mask from multiple validated geometric seeds, applies randomized transforms and cell mutations, and independently rejects masks with uncovered letters, question cells without slots, or disconnected geometry.
3. topology.js derives horizontal/vertical slots from consecutive question cells and registers the one right-edge boundary slot for each row. It checks actual 8×12 geometry and forbids question cells in column 7.
4. csp.js assigns dictionary entries to all slots using positional indexes, crossing propagation, MRV, degree tie-breaking, bounded backtracking, unique answers/questions, five distinct image assets and at least three distinct logic-clue cells.
5. assembler.js reconstructs the cell grid and word/question links.
6. validator.js independently reconstructs all answer paths and geometric slots, verifies every one of the 96 cell roles, checks that column 7 contains only covered letters, verifies exactly 12 right-edge boundary answers, checks crossing letters, unique answer/question ownership, question/answer links, dictionary metadata, picture metadata, connectedness and the optional 11-letter exception.
7. scoring.js evaluates completeness, crossings, clue length/clarity proxies, direction variety, answer-length variety, theme diversity, picture count and logic clues. A score never overrides a validation failure.
8. legacy-adapter.js converts only a validated result into the data shape already consumed by QQCross's scanword renderer, rack, hints, saves, solo, friend and ChatGPT match flows.

## Bounded generation

The engine has seed-based randomness and explicit limits for topology attempts, CSP nodes and CSP time. It returns structured failure diagnostics rather than a partial board. The module worker keeps generation off the UI thread. There are no new runtime dependencies and no Supabase schema changes.

The repository also contains `data/scanwords-1000.json`, but it is a legacy 13×13 template set and is not referenced by the active game. It does not satisfy the current 8×12 production puzzle target.

## Answer-count acceptance gap

- The production topology builder and independent validator now enforce an interim floor of **24 registered answers** per board.
- The four current base masks derive 26, 24, 24, and 24 answer slots respectively (the special mask count includes its 11-letter boundary answer).
- The user's earlier target of **34+ meaningful answers** is not yet met or proven feasible under the current constraints. The 24-answer floor is a safety guard against underfilled mutations, not a replacement for that target.
- Do not inflate counts with one-letter answers, duplicate answers, unlinked words, filler clues, or invalid edge cells. A future topology redesign must demonstrate the 34+ count with the independent validator and seeded batches before this gap can be closed.

## Production dictionary status

The repository dictionary currently has 2,289 source records, 46 picture-key records, 83 answer records of exactly 11 letters, and 709 records tagged as logic before runtime normalization. Runtime counts are reported by prepareDictionary() and the CI scanword verification. This is not a 25,000- or 50,000-word scanword dictionary.

## Verification

- npm --prefix scanword-engine test runs isolated engine tests.
- npm run test:scanword checks the production source dictionary and performs 100 seeded end-to-end generator runs with repeatability checks.
- Playwright checks the actual GitHub Pages app, portrait 8×12 geometry, all 96 cells, zero question cells in the rightmost column, picture/logic quotas, clue interaction, 95% viewport width and 85% viewport height, with all interface controls in the remaining 15%.
- A puzzle is accepted into the game only after the independent validator reports success.


## Dynamic topology sampling (seeded bridge patterns)

The production sampler proposes seeded 8×12 role masks and applies bounded mutations. Each candidate is accepted only after slot derivation, full-cell coverage, clue-cell degree checks, right-edge boundary registration, and connected-topology validation. The 11-letter boundary path is enabled only for runs that explicitly request that optional feature. Rejected masks are discarded; the generator never emits a partial board.
