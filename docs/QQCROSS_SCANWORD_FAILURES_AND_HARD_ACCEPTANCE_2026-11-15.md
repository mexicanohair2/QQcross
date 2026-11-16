# QQCross — hard acceptance contract for a real scanword (2026-11-15)

This document is a mandatory implementation and review gate. It exists because a previous generated example was presented as a scanword even though it failed the basic definition of one. Do not repeat that failure. A diagram, role mask, random letter matrix, or topology preview is not a playable scanword and must never be presented as one.

## 1. Non-negotiable board geometry

- The board is exactly **8 columns wide × 12 rows high**: 96 cells.
- Canonical coordinates are `row: 0..11`, `col: 0..7`. Never transpose them.
- Only `(0,0)` is the intentionally empty corner.
- The other 95 cells must each be a meaningful question cell or a letter cell belonging to one or more real answers.
- No empty cells, blank placeholders, decorative dark blocks, arbitrary letters, filler, or disconnected fragments may be accepted as a completed board.
- Preserve the mobile fit: the whole 8×12 board and the controls required to play it must be visible in the agreed phone viewport without horizontal scrolling. Do not change board dimensions to hide a layout defect.

## 2. Direction semantics — the exact failure to prevent

The direction is defined from the clue cell to the first answer letter, not by the orientation of the word slot and not by the direction in which a renderer happens to iterate cells.

- A question in the **top row** is a vertical clue: its answer starts immediately below it and runs **DOWN**.
- A question in the **left column** (except the corner) is a horizontal clue: its answer starts immediately to its right and runs **RIGHT**.
- Interior question cells may carry one or more real clues in different directions. Every displayed arrow must correspond to a registered clue record and its actual answer coordinates.
- A cell may be both the terminal boundary of one answer and the start of another answer in a different direction. That is not permission to display only one arbitrary arrow: the UI must preserve and expose every registered clue direction.
- Never infer an arrow from a neighbouring slot, array order, first question id, or CSS position. Render from the authoritative question records.
- For every word, assert: first answer coordinate = clue coordinate + direction vector; all later coordinates are contiguous; answer characters match those cells in order.
- No two words may use the same clue cell and direction. Multiple clues at one cell are allowed only in distinct directions and only when every answer is valid.

**Important geometry caveat:** do not silently force seven top-row downward clues if doing so makes the full left border impossible to fill with answers of at least two letters. The special 11-letter vertical answer at `(0,1)` occupies `(1,1)..(11,1)`; on ordinary boards the left-border answers need their first letters in column 1, so placing an interior clue in column 2 would leave a one-letter horizontal answer. Resolve this as a constraint problem, not by weakening answer quality or inventing boundary exceptions. The approved minimum is: every top-row clue that is designated as a start must visibly point DOWN; the mandatory top-left anchor may use the explicitly modelled ordinary-board role where needed. Any proposed change to this rule must be demonstrated by a valid 8×12 example and independent validator tests before approval.

## 3. Real word network and crossings

- Every answer must come from the production Russian dictionary and have its own meaningful clue.
- Every answer must intersect at least one other answer; the overall answer graph must be connected.
- Intersections are shared letter cells, not merely touching edges. The character at every crossing must be identical for every participating answer.
- A question cell is never a letter cell. A word may not pass through a question cell or the empty corner.
- A clue without an answer is invalid. An answer without a registered clue is invalid. A letter not owned by an answer is invalid.
- Detect accidental horizontal or vertical runs that look like answers but have no registered clue record. Do not count them as words.
- No one-letter answers. Two-letter answers are permitted only from a reviewed, explicit allow-list and must not be used as filler. Avoid pronouns, prepositions, particles, interjections, musical notes, and arbitrary abbreviations.
- A valid scanword is not a word-search grid and not a collection of separate crossword rows. It must have the connected scanword topology of the Kryss reference.

## 4. Interior question density and multi-direction cells

- Questions must appear in the top/left borders and be distributed through the central area, not concentrated into one strip or only at the far right.
- Interior question placement must create genuine answer starts and ends and useful crossings in both axes.
- Prefer interior clue cells that support two or more valid directions when the geometry and dictionary permit it.
- A clue cell may support up to the configured safe number of distinct directions. The UI must show a small, legible arrow for each direction without obscuring the clue.
- A user must be able to tap a multi-clue cell and choose the exact clue/direction; no clue may be hidden behind another.
- Do not use a rigid repeated template. Seeded generation should produce materially different, validator-approved layouts while preserving the same visual language.

## 5. Required content and picture clues

- Keep the five-picture requirement where the active game mode expects it: five distinct picture clues with five distinct assets/subjects, not repeated pictures or near-identical easy clip-art.
- Picture clues must be recognizable but not trivial. Avoid generic low-effort symbols when a richer, accurate visual clue exists.
- Include company/brand picture clues where the dictionary and licensed/available assets support them. A company picture must identify the intended company, not a random logo or unrelated object. Brand names are clue answers only when they are valid dictionary entries and their clue is unambiguous.
- Missing or broken image assets must be caught before the puzzle is accepted; do not silently substitute unrelated images.
- Preserve the separate logic-question minimum and the user's desired moderate difficulty: slightly more challenging than the easiest examples, never artificially obscure.
- Never leak the answer in its own clue. Reject duplicate clue text for different answers and flag near-duplicate templates for editorial review.

## 6. Eleven-letter mechanic

- Preserve the exact optional 11-letter answer: a real normalized dictionary answer of exactly 11 letters, starting at clue cell `(0,1)`, running DOWN through `(1,1)..(11,1)`.
- This is a named and narrowly scoped bottom-boundary exception; no other word may silently end outside the board.
- Target exactly one such puzzle in every four successfully issued puzzles when the sequence index is available (or 25% by seeded probability for independent calls).
- If the 11-letter answer is not scheduled, do not fake one, truncate one, or describe a shorter answer as 11 letters.
- A two-clue alternative is allowed only as two separate real answers with two separate clue records and valid crossings; it does not count as the 11-letter mechanic.

## 7. Generator architecture

- Keep the legacy generator intact as a fallback snapshot; do not silently modify it.
- Use the modular topology + bounded CSP/backtracking generator and the independent validator.
- Plan the clue/answer topology before assigning words. Use indexed dictionary candidates, MRV, crossing arc consistency, seeded tie-breaking, reversible placement, bounded restarts, cancellation and diagnostics.
- Do not greedily scatter words and invent clues later.
- Do not fill remaining cells with random letters or fake clues.
- A timeout, exhausted search, missing image quota, invalid dictionary, or incomplete board is a failed generation, never a successful partial puzzle.
- Keep all production integrations (solo, daily, multiplayer, ChatGPT opponent, hints, checkmark, save/restore, clue popups and inventory) compatible. Preserve unrelated game modes and account data.

## 8. Independent acceptance validator

The validator must independently reconstruct board ownership from serialized words/questions; it must not trust generator booleans or internal placement flags. Reject a board if any of these fail:

1. Exact 12 rows × 8 columns and 96 cells.
2. Exactly one empty corner at `(0,0)`.
3. All other 95 cells have a valid question/letter role.
4. Required top and left clue anchors exist.
5. Top-row starting clues point DOWN; left-column starting clues point RIGHT, with only the documented top-left special/ordinary exception.
6. Every question record has non-empty text, stable ids, a real word id, a valid direction and exact coordinates.
7. Every word belongs to the production dictionary and has a valid clue.
8. Every answer length and every coordinate match exactly.
9. Every crossing letter agrees; every letter cell has complete word ownership.
10. No orphan letters, dead clues, one-letter answers, unregistered runs, conflicting overlaps or duplicate clue directions.
11. The word-intersection graph is connected.
12. No ordinary answer ends at the outer board boundary.
13. The exact 11-letter boundary exception is used only when scheduled and only at the approved coordinate/direction.
14. Required five distinct picture clues/assets and the minimum logic clues are present.
15. Clue text is not empty, duplicated, answer-leaking or an obvious low-value placeholder.
16. The rendered arrow for each clue matches the clue record, not merely the underlying slot.

Return structured errors with type, row, col, word/question ids, expected and actual values. Warnings must remain separate from errors. Any error means `valid=false`; invalid boards cannot be exported or launched.

## 9. Required regression tests

Add tests for each of the seven observed failures:

- Wrong dimensions / transposed 12×8 versus 8×12.
- Top-row clue arrow points right instead of down.
- Answers are not connected by shared letter cells.
- A clue cell could support several legitimate downward words, but the generator creates only one or none.
- Any of the 95 playable cells is unassigned or has no answer/clue ownership.
- The scheduled 11-letter answer is absent, malformed, or not represented by the exact special boundary rule.
- Empty cells remain in the output or are hidden by styling.

Also test:
- A fixed, human-readable reference fixture with all coordinates printed.
- Multiple distinct seeded layouts.
- At least 100 consecutive successful generation requests with independent validation.
- Exactly 25 scheduled 11-letter boards in a 100-board sequence (or a clearly reported, seeded statistical result when no sequence index is used).
- No duplicate answers/questions and no prohibited two-letter fillers.
- Five distinct, valid picture clues, including supported company/brand image entries.
- Desktop and mobile Playwright tests, plus a screenshot/visual audit at the real phone viewport.
- Generation latency, worker cancellation and failure behavior.
- Full gameplay regression: solo, daily, multiplayer, ChatGPT opponent, hints, checkmark, save/restore, clue popup, inventory, and mode switching.

## 10. Visual acceptance — compare with the supplied Kryss reference

- Recreate the scanword grammar, not just a generic crossword appearance.
- Clue cells sit inside the grid and show their direction clearly.
- Letter cells are visually distinct from clue cells.
- Central clues are distributed naturally.
- The board has a coherent, dense, fully occupied shape; no random letter soup, blank holes, disconnected mini-boards or giant unbroken strips.
- Picture clues are integrated into the grid and are varied, accurate and visually clear.
- Keep the established calm dark/burgundy visual style and avoid harsh white/neon effects.
- On phone, fit the complete 8×12 board into the agreed viewport; do not solve overflow by shrinking text until it is unreadable.

## 11. Work protocol and honest reporting

1. Re-read this contract and inspect the current branch/files before each implementation phase.
2. Make changes on a feature branch. Do not change `main`, production Supabase data or the published site until all acceptance gates pass.
3. Fix root causes in topology, CSP, assembly, validator and rendering; do not patch a screenshot or suppress a test.
4. Run the actual engine tests, dictionary audit, seeded batches, browser tests and build. If a test cannot be run, state exactly why.
5. Inspect the produced grid and the clue-direction metadata, not just a green CI badge.
6. Compare the final output with the supplied Kryss screenshot and reference workflow.
7. Report separately what was changed, what passed, what failed, and what remains unverified. Never claim a playable scanword based on a schematic or an unverified commit.

## 12. Immediate postmortem checklist for the rejected example

The rejected example failed because it:
- was not 8 columns × 12 rows;
- sent top-row clues to the right instead of down;
- showed disconnected, unrelated answers;
- ignored multiple valid downward starts from the same clue region;
- left cells empty/unassigned;
- omitted the scheduled 11-letter answer or a valid two-clue alternative;
- visibly contained empty cells while being labelled complete.

The replacement must pass every relevant validator and visual gate before it is shown as a finished scanword. If it does not, label it a draft topology only and explain the exact failed checks.
