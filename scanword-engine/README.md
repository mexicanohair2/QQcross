# QQCross scanword engine — production integration

The scanword engine is the only production path for creating scanword boards in app.js. It runs in a module Web Worker in browsers and has a bounded main-thread fallback where Workers are unavailable. The previous greedy buildScanword() generator is no longer used by gameplay.

## Canonical board contract

- Exactly 8 columns × 12 rows = 96 cells.
- The upper-left cell (0,0) is the only reserved blank corner.
- The left border (rows 1–11, column 0) contains question/end cells.
- (0,1) is the required top-left anchor.
- Other top-row cells may be question cells or letters, but every letter must belong to a complete horizontal answer slot between question cells.
- Question cells may start an answer, terminate one, or do both. Terminal-only question cells remain associated with their incoming answer and are validated independently.
- Horizontal answers run right; vertical answers run down. Reverse directions are disabled in the production generator.
- The optional 11-letter special answer begins at (0,1), proceeds down column 1, and ends at the lower boundary. It is requested at about 25% frequency, not on every board.

## Pipeline

1. dictionary.js normalizes Russian answers and questions, rejects malformed records, Latin clue text and answer leakage, preserves meaningful clue variants, and builds positional-letter indexes. categories.js assigns every accepted entry to a Russian topic category and exposes category filters/statistics.
2. topology-builder.js generates a seeded role mask from multiple validated geometric seeds, applies randomized transforms and cell mutations, and independently rejects masks with uncovered letters, question cells without slots, or disconnected geometry.
3. topology.js derives every horizontal and vertical slot from consecutive question cells. It checks actual 8×12 geometry rather than forcing a complete top row.
4. csp.js assigns dictionary entries to all slots using positional indexes, crossing propagation, MRV, degree tie-breaking, bounded backtracking, unique answers/questions, zero to four distinct optional image assets and at least three distinct logic-clue cells.
5. assembler.js reconstructs the cell grid and word/question links.
6. validator.js independently reconstructs all answer paths and geometric slots, verifies every one of the 96 cell roles, checks crossing letters, unique answer/question ownership, question/answer links, dictionary metadata, picture metadata, connectedness and the optional 11-letter exception.
7. scoring.js evaluates a calibrated 0–100 quality score: validity, crossings, right/down coverage, clue readability, answer-length balance, Russian topic diversity, picture variety, logic clues, clue distribution and recent novelty. A score never overrides a validation failure.
8. history.js stores the last 12 successful boards in browser local storage, penalizes recently used answers and clue formulations, and tracks answer-set and layout reuse. Image prompts are distinguished by their actual image asset. History is a diversity preference, not a permanent ban on useful Russian words.
9. legacy-adapter.js converts only a validated result into the data shape already consumed by QQCross's scanword renderer, rack, hints, saves, solo, friend and ChatGPT match flows.

## Generation modes

- **Fast Draft** returns the first independently validated board. It favors startup speed and is the default gameplay mode.
- **Optimized** evaluates multiple independently valid boards, compares their 0–100 quality scores, and returns the best candidate. It uses a larger bounded topology budget and retains the same worker deadline and validator. The candidate pool is limited (default three) so memory and latency remain bounded.

The mode is selected with `qualityMode: 'fast'` or `qualityMode: 'optimized'`. The game adapter exposes `qualityScore` and the full quality breakdown for diagnostics.

## Bounded generation

The engine has seed-based randomness and explicit limits for topology attempts, CSP nodes and CSP time. It returns structured failure diagnostics rather than a partial board. The module worker keeps generation off the UI thread. There are no new runtime dependencies and no Supabase schema changes.

## Production dictionary status

The repository dictionary currently has 2,289 source records, 46 picture-key records, 83 answer records of exactly 11 letters, and 709 records tagged as logic before runtime normalization. Runtime counts are reported by prepareDictionary() and the CI scanword verification. This is not a 25,000- or 50,000-word scanword dictionary.

## Verification

- npm --prefix scanword-engine test runs isolated engine tests.
- npm run test:scanword checks the production source dictionary and performs 100 seeded end-to-end generator runs with repeatability checks.
- `node scripts/stress-scanword.cjs 1000` or `node scripts/stress-scanword.cjs 10000` runs sequential production batches with independent validation, right/down-only direction counts, deterministic replay, mobile timing limits, and 100/1,000/10,000 checkpoints.
- Playwright checks the actual GitHub Pages app, 8×12 geometry, all 96 cells, picture/logic quotas, clue interaction and mobile viewport constraints.
- A puzzle is accepted into the game only after the independent validator reports success.


## Dynamic topology sampling (seeded bridge patterns)

The production sampler now proposes seeded 8×12 role masks directly instead of mutating a single fixed scaffold. Each candidate is accepted only after slot derivation, full-cell coverage, clue-cell degree checks, and connected-topology validation. The 11-letter boundary path is enabled only for runs that explicitly request that optional feature. Rejected masks are discarded; the generator never emits a partial board.

## QQCross brand tile integration

The universal brand assets are local repository files: `icon.svg`, `assets/qqcross-logo.svg`, `assets/brand-tile.svg`, styled through `brand.css`. The scanword's reserved top-left coordinate (0,0) remains a logical `corner` cell; the renderer may display the signature tile there as decorative, non-interactive art. This is strictly presentation-only: it must never become a clue, answer, letter, word slot, image clue, hint target or scoring cell. Never put the tile into arbitrary empty cells or use it to hide topology gaps. Keep the 8×12/96-cell contract, all 95 other logical cell roles, validator rules, zero-to-four optional picture-clue limit and every game mechanic unchanged. Missing SVGs must gracefully fall back to the normal corner background. Use the same universal icon/logo family across all game modes and adapt only surrounding theme colors/contrast.


## Russian dictionary and category system

The scanword content bank is Russian-only. Answer strings must use Cyrillic; clue text containing Latin words is rejected during dictionary preparation. The source dictionary remains a single curated bank in `data/scanword-dictionary.json`, while `data/scanword-dictionary-categories.json` defines the category catalog and `src/categories.js` provides deterministic categorization, grouping, filtering and statistics.

Categories: animals, plants, food, nature, geography, science and technology, household objects, transport, culture, sport, people and professions, logic, concepts, and other. An explicit category or recognized tag takes priority over automatic classification. Automatic classification is a fallback and is exposed in audit statistics so uncertain entries can be manually assigned later.

## Diversity policy

A successful board is appended to a rolling 12-board history. Reuse of recently seen answers and non-image clue formulations receives a strong CSP penalty. The same generic picture prompt may be reused only when its image asset differs; the image itself is part of that clue's identity. Reuse is not prohibited forever because the curated dictionary is finite. Every board still rejects duplicate answers and duplicate clue formulations internally.
