# QQCROSS — MASTER DEVELOPMENT PROMPT: FULL SCANWORD ENGINE INTEGRATION

You are the lead algorithm engineer responsible for finishing and integrating the QQCross scanword engine into the existing mobile web game. This is an execution brief, not a request for a plan. Inspect the current repository before every implementation phase, make changes on a feature branch, run real tests, fix root causes, and report only verified results.

## 0. Mission and definition of done

Deliver a production-grade generator for complete, readable, diverse QQCross scanwords on a fixed 8-column × 12-row board (96 cells). Every cell must have an explicit valid role. Every word must have a real Russian clue and dictionary answer. All intersections must match. Clues must be embedded in the grid. The optional 11-letter mechanic must occur approximately 25% of successful generated boards over a large batch. Generation must be seeded, bounded, independently validated, exportable as JSON, and compatible with the live QQCross game.

Do not call the task complete because one board was generated, code compiles, or a single unit test passes. Completion requires large seeded batches, full gameplay regression tests, and mobile viewport verification.

## 1. Mandatory repository reconnaissance

Before editing:
1. Read the latest state of repository mexicanohair2/QQCross (canonical casing may be QQcross), default branch main, and the current feature branch.
2. Inspect index.html, app.js, new-games.js, styles.css, package scripts, GitHub Actions, all scanword tests/scripts, data/scanword-dictionary.json, and image assets.
3. Map every consumer of the current puzzle object: board renderer, expected-letter map, clueAt, wordTerminals, used cells, clueKeys, reservedKeys, arrows, popup, hints, validation/checkmark, saves/restores, daily mode, solo, multiplayer and ChatGPT opponent mode.
4. Verify the real coordinate convention and convert only at the compatibility boundary. Never mix row/column and x/y internally.
5. Resolve contradictory old test assertions. The latest approved primary board is 8 columns × 12 rows, not 8×13, 12×8, 6×12 or any other size.
6. Preserve all unrelated gameplay. Do not rewrite app.js wholesale.
7. Keep main and the published site unchanged until all acceptance gates pass.

Known facts observed in the 2026-11-12 audit must be rechecked: index.html loads audio.js, wordle.js, new-games.js, progression.js, encyclopedia.js, then app.js; the primary builder is buildScanword(entries) in app.js; the clue bank is data/scanword-dictionary.json. The audited builder used W=6,H=12 and the tests contained conflicting layout revisions. See docs/QQCROSS_SCANWORD_ENGINE_AUDIT.md.

## 2. Immutable board contract

Centralize:
- WIDTH = 8
- HEIGHT = 12
- TOTAL_CELLS = 96

Rows are 0..11, columns are 0..7. grid.length must be 12 and every row must have 8 cells. (0,0) is the empty corner. (0,1)..(0,7) are question cells. (1,0)..(11,0) are question cells. All other cells must be assigned as meaningful question or letter cells. No unassigned cells, random letters, filler, dark blocks used to fake 100% fill, orphan letters, or unlinked clues.

Cell types:
- corner: only (0,0), empty and non-interactive;
- question: one or more explicitly linked clue records;
- letter: exactly one normalized letter and complete references to every word crossing the cell.

Every clue has a stable id, clue text, answer/word id, clue coordinate, direction, answer length and exact answer coordinates. A clue cell may host multiple questions in different directions up to a configured safe limit. Never allow two answers to leave one clue cell in the same direction.

Supported directions: right, left, down, up. Use one canonical direction-vector table for placement, validation, rendering arrows and traversal.

Question cells are part of the grid, not a separate detached list. Additional question cells must be distributed across the center and vary between boards; do not use a single rigid template.

## 3. Eleven-letter mechanic and geometry

Set specialElevenLetterChance = 0.25. Across a sufficiently large batch of successful boards, target approximately 25%; do not force the feature if no valid answer or valid topology exists. No artificial words, appended letters or fake suffixes.

The intended special clue is at (0,1), with an 11-letter answer running down through (1,1)..(11,1). This exactly consumes the 11 cells below the clue. Therefore this one special answer must be explicitly allowed to terminate at the bottom board edge without a separate terminal clue cell. This is a narrow, named boundary-answer exception, not a global relaxation of normal terminal rules. If the current engine assumes every answer has an in-board terminal question cell, redesign the data model to support this exception correctly.

Check answer length after normalization and before placement. Preserve Ё unless a configured dictionary policy explicitly folds Ё to Е. Use the same normalization policy for dictionary indexes, intersections, display and validation.

## 4. Dictionary and content quality

Use the actual data/scanword-dictionary.json as the production source of truth. Inspect its exact schema and content. Never invent thousands of entries or replace real clues with generic placeholders. Support JSON and CSV import in tooling, but never overwrite the production dictionary without validation.

Each accepted record should have stable id, answer, question, optional difficulty, part of speech, tags, source, and optional image metadata. Validate:
- record shape and required fields;
- Russian alphabet and allowed symbols after normalization;
- answer length;
- empty, malformed, ambiguous and answer-leaking clues;
- duplicate normalized answers and exact/near duplicate questions;
- vague prompts, low-value one-letter/function-word answers, repeated templates;
- excessive simple arithmetic, specialist or encyclopedic wording inappropriate for normal play;
- image metadata points to an existing asset and matches the answer.

Keep Ё policy explicit and configurable. Do not silently collapse Е/Ё when that can create ambiguity. Build indexes by answer length and by (position,letter); add other indexes only where they improve measured performance.

Semantic quality cannot be perfectly proven by string rules. Separate objective errors from warnings/review flags. Never claim that a heuristic similarity check proves semantic uniqueness.

Preserve existing gameplay-specific content rules where appropriate. The current builder/tests have picture-clue and logic-clue expectations, including five distinct picture clues in some tests. Reconcile this with the new spec's optional images; do not silently break the existing game. Missing image assets must not break generation.

## 5. Algorithm architecture

Use independent modules for config, coordinates/directions, dictionary validation/indexes, board state, reversible mutations, clue topology/slot planning, candidate compatibility, intersections, bounded CSP/backtracking, central clue placement, full-grid completion, independent validation, scoring/history, JSON import/export, QQCross adapter and tests.

Use a real constraint-satisfaction approach:
- pre-index candidates by length and positional letters;
- plan feasible answer slots from clue anchors and a topology model;
- select the most constrained unfilled slot first (MRV), with degree/coverage tie-breaks;
- rank candidates by compatibility, clue quality, diversity and recent-use penalty;
- verify every intersection and cell role before committing a placement;
- use reversible trail/undo or safe snapshots;
- backtrack when a choice blocks remaining slots or leaves impossible cells;
- use seeded pseudo-randomness only for controlled tie-breaking and variety;
- use bounded restarts with varied topology seeds;
- enforce hard node/time limits and cancellation;
- cache compatibility results;
- record deepest dead-end diagnostics.

Do not greedily scatter words and invent questions afterwards. Do not fill gaps with random letters. Do not return a partial board as success.

Solve the central hard problem explicitly: all 96 cells must form a coherent scanword topology. A board full of letters is not necessarily a valid scanword. Every answer run must map to exactly one registered clue and direction; detect accidental unregistered horizontal/vertical runs. Do not leave letters without clues or clues without answers. Use a topology/slot model and CSP/exact-cover-style constraints rather than a superficial coverage counter.

## 6. Independent validator

The validator must not call generator placement internals or trust generator flags. Independently reconstruct expected cell memberships from words/questions and compare them cell by cell.

Verify:
- exact 12×8 shape and 96 cells;
- correct corner and required border clues;
- valid cell types only;
- unique question/word ids and complete links;
- every word has exactly one clue record;
- dictionary identity and normalized answer correctness;
- non-empty, non-answer-leaking clues;
- valid direction, bounds, contiguous coordinates and matching length;
- clue coordinate and direction match the word;
- every letter matches at every coordinate;
- all crossing letters agree and cell word references are complete;
- no word crosses a clue/corner;
- no conflicting overlaps;
- no accidental unregistered answer runs;
- no orphan letters, empty clues or unassigned cells;
- connectivity requirements;
- ordinary terminal/boundary rules;
- special 11-letter exception only at (0,1), down through row 11, and only for a real 11-letter dictionary answer;
- image uniqueness/count rules where enabled.

Return structured errors: type, row, col, ids, expected, actual, and readable message. Warnings are separate. Any error means valid=false. Invalid boards cannot be exported or started in gameplay.

## 7. Scoring, diversity and history

Score 0..100 only after validation. A high score never overrides invalidity. Include correctness, clue quality flags, completeness, meaningful crossings, answer-length diversity, question uniqueness, image diversity, clue distribution, central topology, connectivity, recency and readability. Return raw metrics as well as score.

Keep bounded history (e.g. last 100 successful boards): answer ids, clue ids, topology signature, clue coordinates, direction counts and seed. Penalize recent reuse without banning words forever. Detect repeated combinations and near-identical layouts. Same seed + same dictionary/config/version must reproduce the same board. Different seeds should produce meaningful structural/content diversity, not just reorder identical words.

## 8. Live QQCross integration

Do not integrate the prototype until it passes standalone full-grid batches. Build an adapter that returns exactly the shape consumed by current app.js. Inspect all consumers first. Do not guess fields or duplicate state.

The current game uses classic scripts. Do not add an asynchronous module dependency that races app.js startup. If using ES modules, explicitly coordinate initialization and failure handling, or build a compatible local classic bundle. No external CDN dependency for the generator.

Preserve all existing behavior:
- registration, login, guest mode, profiles and Supabase/RLS;
- solo, friends, online multiplayer and ChatGPT opponent;
- 90-second turn timer and inventory refill/turn rules;
- magnifier, clock, trash, bulb/hints, scoring and rewards;
- save/restore, match history and daily deterministic puzzles;
- Wordle, word search, word wheel and CodyCross;
- themes, shop, progression, PWA/offline and no-ads behavior.

Do not modify Supabase schema or unrelated modes to solve a generator problem. Keep changes small and reversible. If renderer changes are needed, isolate them and add tests.

Do not block app boot. Target under 500 ms for ordinary in-game board start on a modern phone. Use a Worker only if it remains compatible with mobile browsers and offline mode. Always enforce budgets and show a recoverable error when generation fails.

## 9. JSON format

Export a versioned self-contained document:
- version, width=8, height=12;
- grid[12][8], each cell with coordinates, type, letter where applicable, questionIds and wordIds;
- questions[] with id, text, word id, clue row/col, direction, length, coordinates and optional image;
- words[] with id, dictionary entry id, answer, clue id/text, start, direction, length and coordinates;
- metadata: valid, score, raw metrics, generation time, seed, dictionary version/hash, generator version, specialElevenLetterQuestion.

Import validates before use. Export refuses invalid boards. JSON round-trip must preserve all semantics.

## 10. Required automated tests

Fixtures: broad valid Russian dictionary, duplicates, invalid characters, empty/wrong clues, tiny pool, no 11-letter answer, multiple 11-letter answers, dense compatible pool, sparse incompatible pool, image entries and Ё/Е ambiguity.

Test:
1. exact 8×12 and all 96 cells;
2. all top/left clues and empty corner;
3. central clues in multiple quadrants;
4. all four directions;
5. multiple questions in one clue cell in distinct directions;
6. no same-direction conflict;
7. exact intersections and complete word references;
8. no orphan/unassigned cells;
9. no accidental unregistered runs;
10. every word/question/dictionary record matches;
11. special 11-letter coordinates and exact length;
12. 25% special frequency across at least 400 successful boards, reporting success denominator separately from failed attempts;
13. batches of 1, 10, 100 and 400+ seeded boards;
14. same-seed determinism and different-seed diversity;
15. history penalties and bounded memory;
16. insufficient/incompatible dictionary fails safely and quickly;
17. time/node budget and cancellation;
18. JSON round-trip/import/export;
19. existing primary gameplay and all unrelated game modes;
20. mobile 360×800 and 390×844: no horizontal overflow, board fits agreed viewport constraints, clues readable, controls and rack usable;
21. no uncaught page errors, no boot timeout and no startup regression.

A test that only checks valid=true is insufficient. Inspect actual words, clues, coordinates, crossings and every cell. Run the full existing suite. Fix root causes and rerun.

## 11. Rollout

1. Implement and test in isolation inside this repository.
2. Generate and audit representative boards.
3. Build the compatibility adapter.
4. Feature-flag integration on a feature branch; retain rollback path.
5. Run all generator and game regression tests.
6. Verify GitHub Actions and Pages artifact.
7. Merge/deploy to main only after all acceptance gates pass.
8. Verify the published mobile site after deployment.

Never push a partial engine to production just to show progress. If a constraint is geometrically impossible, demonstrate the coordinate conflict and propose the smallest explicit alternative. Never silently change 8×12.

## 12. Delivery report

Report files changed, algorithm details, adapter mapping, actual batch pass/fail counts, 11-letter frequency and denominator, runtime metrics, regression results, limitations, branch/PR/commit links and deployment status. Never claim completion, integration, testing or deployment without current-run evidence.

The user works only from an Android phone and expects repository-side execution through connected tools. Do not ask them to use a PC, terminal, Node, VPS, Docker, Android Studio or local APK builds.

## 13. Immediate next actions

1. Re-fetch current repository state and verify the audit.
2. Reconcile stale test dimensions to the approved 8×12 contract.
3. Prove the board topology and the special 11-letter boundary path.
4. Fix the current prototype's incomplete slot plan before runtime integration.
5. Build the independent validator, including accidental-run detection.
6. Run dense fixture batches and refine CSP/backtracking until complete boards are reliably generated.
7. Build the compatibility adapter against actual app.js consumers.
8. Feature-flag the new engine and preserve rollback.
9. Run the entire suite and mobile regressions.
10. Merge/deploy only after all gates pass.

The only acceptable success is a real, fully playable, fully validated 8×12 QQCross scanword — never a decorative grid, random filler, partial board or unverified demo.