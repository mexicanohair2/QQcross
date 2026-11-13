QQCross scanword engine — integration prototype

This directory is an experimental engine source area inside the existing QQCross repository. It is NOT yet connected to live gameplay. Do not import it from app.js or replace buildScanword() until the full-grid topology, independent validator, dictionary integration, and mobile/regression tests pass.

## Canonical format

- 8 columns × 12 rows, 96 cells.
- Rows 0..11; columns 0..7.
- (0,0) is the only reserved blank corner.
- Top row and left column (except the corner) are clue cells.
- The optional 11-letter answer is specified from (0,1) down to the bottom boundary, with a target frequency around 25%.

## Implemented isolated modules

- `config.js`, `grid.js`: canonical dimensions and cell model.
- `dictionary.js`: Russian normalization, entry validation, duplicate handling and positional indexes.
- `topology.js`: derives geometric slots and independently validates cell roles/coverage; preflight checks mandatory-border feasibility.
- `csp.js`: bounded CSP/backtracking, MRV, degree tie-break, crossing propagation, seed-based ordering, cancellation, image/logic quotas, unique answers and normalized clue text.
- `assembler.js`: converts CSP assignments into the canonical clue/letter grid and crossing references. It does not mark partial output as complete.
- `validator.js`: independently reconstructs answer geometry, validates dictionary references, question/answer links, crossings, image keys, connectedness and all 96 cell roles.
- `history.js`: tracks word combinations, exact structures and normalized clue reuse.

## Measured dictionary status

The current source dictionary has 2,287 records, 2,034 unique accepted answers after normalization/deduplication, 46 unique image keys and 46 unique accepted image answers, plus 610 unique accepted logic-tagged answers. See `docs/QQCROSS_DICTIONARY_AUDIT_2026-11-13.md`. This is not a 25,000- or 50,000-word dictionary.

## Blocking topology issue

The full-border rules force both columns 1 and 2 below the top row to be letters, because every clue in the mandatory left border can only point right and every answer needs at least two letters. The top clue (0,2) can only point down, so it would need an 11-letter answer terminating at the bottom boundary. The only current exception is the 11-letter answer from (0,1). In addition, (0,1) itself must use that 11-letter exception in every complete puzzle, which conflicts with the requested roughly 25% frequency. See `docs/QQCROSS_TOPOLOGY_FEASIBILITY_BLOCKER.md`.

The prototype contains an opt-in helper for the two seven-letter horizontal edge slots at (1,0) and (2,0). These are only partial geometry helpers; they do not solve the full topology conflict. They are not enabled by the generator or live gameplay.

The isolated generator runs the deterministic feasibility preflight and refuses the current rule set before randomized placement. It must not fabricate words, use one-letter fillers, or mark an incomplete layout as valid.

## Verification and integration status

The existing production `app.js` generator is still the legacy 6×12 implementation. The browser acceptance checks require 8×12, but those requirements are not yet met. The experimental engine is not wired into gameplay. The real renderer contract is documented in `docs/QQCROSS_LEGACY_ADAPTER_CONTRACT.md`.

Production currently uses classic scripts, primary generation in `app.js`, and `data/scanword-dictionary.json`. A compatibility adapter must preserve renderer, expected, clueAt, wordTerminals, hints, saves, daily mode, solo, multiplayer and AI flows. No live gameplay change is made by adding this directory.
