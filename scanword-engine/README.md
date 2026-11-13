QQCross scanword engine — integration prototype

This directory is an experimental engine source area inside the existing QQCross repository. It is NOT yet connected to live gameplay. Do not import it from app.js or replace buildScanword() until the full-grid topology, independent validator, dictionary integration, and mobile/regression tests pass.

## Canonical format

- 8 columns × 12 rows, 96 cells.
- Rows 0..11; columns 0..7.
- (0,0) is the only empty corner.
- Top row and left column (except the corner) are clue cells.
- The optional 11-letter answer starts at (0,1), goes down to (11,1), and has a 25% target frequency only across successful generation batches.

## Implemented isolated modules

- `config.js`, `grid.js`: canonical dimensions and cell model.
- `dictionary.js`: Russian normalization, entry validation, duplicate handling and positional indexes.
- `topology.js`: derives geometric slots and independently validates cell roles/coverage.
- `csp.js`: bounded CSP/backtracking, MRV, degree tie-break, crossing propagation, seed-based ordering, cancellation, image/logic quotas, unique answers and normalized clue text, with the standard picture prompt reusable only for distinct image keys.
- `assembler.js`: converts CSP assignments into the canonical clue/letter grid and crossing references. It does not mark partial output as complete.
- `validator.js`: independently reconstructs answer geometry, validates dictionary references, question/answer links, crossings, image keys, connectedness and all 96 cell roles.
- `history.js`: tracks word combinations, exact structures and normalized clue reuse.

## Measured dictionary status

The current source dictionary has 2,287 records, 2,034 unique accepted answers after normalization/deduplication, 46 unique image keys and 46 unique accepted image answers, plus 610 unique accepted logic-tagged answers. See `docs/QQCROSS_DICTIONARY_AUDIT_2026-11-13.md`. This is not a 25,000- or 50,000-word dictionary.

## Blocking topology issue

The strict border and terminal-question rules are mutually incompatible at left-border cells (1,0) and (2,0): every top clue must point down, forcing all cells (1,1)..(2,7) to be letters, while the first two left-border clues have no legal outgoing answer of at least two letters. Ordinary answers are not allowed to end at the outer edge. See `docs/QQCROSS_TOPOLOGY_FEASIBILITY_BLOCKER.md`.

No relaxation has been enabled. The engine must not fabricate words, permit one-letter fillers, or claim that a full 8×12 board exists under the contradictory rules.

## Verification status

The isolated engine unit suite currently passes **49/49** tests in GitHub Actions. This validates modules and test fixtures, not full-board generation.

The full scanword verification still fails in the existing production `app.js` generator before integration; its current legacy implementation is 6×12, not the new 8×12 engine. Browser acceptance assertions now target 8×12 and five distinct picture clues, but the latest Playwright run was cancelled, so there is no successful end-to-end confirmation. The new engine is not wired into gameplay. The real renderer contract is documented in `docs/QQCROSS_LEGACY_ADAPTER_CONTRACT.md`.

## Integration contract

Production currently uses classic scripts, primary generation in `app.js`, and `data/scanword-dictionary.json`. A compatibility adapter must preserve renderer, expected, clueAt, wordTerminals, hints, saves, daily mode, solo, multiplayer and AI flows. No live gameplay change is made by adding this directory.
