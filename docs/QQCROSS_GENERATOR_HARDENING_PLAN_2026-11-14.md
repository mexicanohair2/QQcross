# QQCross generator hardening plan — 2026-11-14

## Goal

Continue the existing draft PR #30 on `work/qqcross-release-hardening-20261114`. Do not merge or deploy until the generator, browser tests, and mobile layout checks pass. Keep the current Supabase schema and user data untouched.

## Current verified baseline

- Main still contains the legacy 6×12 generator; PR #30 is the modular 8×12 implementation.
- The modular engine has passed a 100-seed production batch: 100/100 valid boards, 19/100 optional eleven-letter boards, median 488 ms, p95 1496 ms.
- A dedicated eleven-letter run passed independently with answer `ФОТОАППАРАТ`, 5 distinct pictures, 3 logic clue cells, 19 crossings, and a successful independent validation.
- Desktop Playwright passed on the latest observed PR run; the mobile job was still running at the time of this plan.
- Older runs exposed two fixed defects: CSP time-budget failure for a difficult 11-letter seed and rendering only four of five picture clues. The latest verification path now exercises both cases.

## Engineering rulings and constraints

1. Preserve the proven modular pipeline (seeded geometry → derived slots → CSP → assembler → independent validator → legacy adapter). Do not revive the old greedy app.js generator.
2. Do not accept a partial grid or trust generator metadata. The validator must independently reconstruct all word slots, crossing letters, cell roles, clue links, and dictionary membership.
3. Preserve the sole 11-letter special case at clue (0,1), down column 1, rows 1–11. It remains optional and statistically near one in four.
4. **Top-border feasibility:** a completely question-filled top row (cells (0,1)..(0,7)) conflicts with a fully question-filled left border, minimum two-letter answers, no dead clues, right/down-only answers, and only one optional eleven-letter boundary exception. In an ordinary board without the special answer, (0,1) cannot start right because (0,2) is also a clue. If it starts down, that vertical answer needs a later clue in column 1; but any such clue in rows 1..11 is adjacent to the mandatory left-border clue in column 0, leaving that left-border clue with no valid horizontal answer. The special eleven-letter path solves column 1 only on the optional subset of boards, not on the remaining boards. Do not hide this contradiction with one-letter filler or dead clues. Keep (0,1) as the top anchor and place additional top-row clues only where they create real answer slots, while preserving the complete left border. This is a deliberate, documented deviation from the literal all-seven-top-cells rule until the design constraints are changed together.
5. Current engine exposes four orientations for each geometric slot. Any change to direction policy must be tested together with topology, CSP, renderer, hints, and validator; never silently discard a valid orientation and cause generation failures.
6. Do not change accounts, Supabase schema, profiles, inventory, friends, multiplayer state, Wordle, or the other game modes as a side effect of generator work.

## Implementation sequence

### A. Topology quality and reproducibility
- Replace the three near-identical fixed scaffold choices with bounded seeded mutations of validated scaffold candidates.
- Keep the left border, top anchor, blank corner, 8×12 shape, connectedness, and complete geometric coverage.
- Reject any candidate with an uncovered letter, question without a slot, one-letter answer slot, malformed answer slot, or disconnected clue graph.
- Keep the optional eleven-letter boundary path exact and isolated.
- Preserve seed determinism and explicit work/time budgets.

### B. Tests first
- Add regression tests proving topology diversity across many seeds, border/corner rules, slot direction/coordinate integrity, complete cell coverage, and special-boundary isolation.
- Run the new tests before implementation and confirm they fail for the current three-scaffold builder.
- Implement the smallest change that satisfies the tests.
- Run the full engine test suite and the 100-seed production verification after each topology change.

### C. Production integration regression
- Verify the Web Worker and bounded fallback return only independently validated scanwords.
- Verify the legacy adapter preserves existing QQCross board fields and that gameplay, hints, autosave, daily board, and friend/solo/ChatGPT match entry points consume the same 8×12 puzzle schema.
- Keep the existing user data and Supabase schema untouched.

### D. Release gates
- Require green engine unit tests, dictionary audit, scanword verification, desktop Playwright, and mobile Playwright.
- Review all new CI logs, not merely the workflow summary.
- Keep PR #30 draft until every acceptance gate is green; do not merge or deploy an incomplete version.

## Acceptance criteria for this workstream

- 8 columns × 12 rows, exactly 96 assigned cells.
- Upper-left corner is the only blank cell; left border is question cells; (0,1) remains the top anchor.
- Every other top-row question is placed only when it bounds a real answer; no forced dead clues or filler words.
- Every letter belongs to at least one reconstructed dictionary answer.
- Every answer is a real, unique dictionary word with matching clue and coordinates; crossing letters agree.
- No accidental unregistered word runs, unlinked answers, or dangling clue cells.
- 5 distinct picture clue assets on separate clue cells; at least 3 distinct logic-clue cells.
- Optional eleven-letter boards occur in a measured range near 25%, with the exact boundary exception.
- Seeded generation is deterministic, bounded, and runs off the UI thread where Workers are supported.
