# QQCross 8×12 border constraints and the optional eleven-letter answer

Status: **the original geometric proof remains correct for its original assumptions, but it is no longer the production layout.** The current design explicitly allows selected top-row anchors, uses all four answer directions, and ends each row at a registered right-edge boundary. The rightmost column is letter-only.

## Current production rules

- Exactly 8 columns × 12 rows (96 cells).
- (0,0) is the reserved blank corner.
- The top row has two active clue anchors: (0,1) and one interior anchor at column 4 or 5.
- The left border in rows 1–11 consists of question cells.
- The entire rightmost column (column 7) contains letters only. No clue or terminal-question cell is allowed there. Column 6 is also reserved for letters so a right-edge answer always has at least two letters.
- Each row has exactly one `RIGHT_EDGE_BOUNDARY` horizontal answer. It starts at that row's final question cell, covers the remaining letters through column 7, and terminates at the outer boundary at column 8. The boundary is not a question cell.
- Every answer has a real clue at its start and is an actual dictionary entry. Every letter cell belongs to one or more registered answers.
- All four directions remain supported.
- A special 11-letter answer may run down from (0,1) through (11,1) and terminate at the bottom boundary. It remains optional, targeted at roughly 25% of successful boards.

## Historical geometric conflict

The earlier proof assumed every top-row cell from (0,1) through (0,7) was a question cell, every cell in the left border from (1,0) through (11,0) was a question cell, ordinary answers had at least two letters, and answers could only run right or down.

Under those assumptions, the question at (0,1) cannot run right because (0,2) is another question cell. It must start downward. It cannot terminate at an interior question cell (r,1): that would leave the left-border question (r,0) unable to start a two-letter answer, because its right neighbour would be a question and its next downward neighbour in column 0 would also be a question. Therefore the answer from (0,1) must continue to the bottom boundary and contains all eleven cells (1,1) through (11,1).

Consequently, under the old full-top-row and right/down-only rules, the 11-letter answer would be mandatory on every board. That conflicts with the separate requirement that it appear in only about one quarter of boards.

This proof is a geometric constraint, not a search-budget or dictionary issue. It does not invalidate the current design because the current design no longer assumes a full top row of question cells or right/down-only directions.

## Current topology strategy

- Keep the upper-left corner blank and the full left question border.
- Keep two top-row anchors so the 11-letter vertical answer can remain optional.
- Reserve column 7 for answer letters only.
- Derive a registered horizontal boundary answer for each row; never create an unlinked word or a filler-letter run.
- Let the CSP solver place real dictionary answers across all derived slots.
- Independently validate all answer paths, crossings, right-edge boundary registrations, question links, images, logic clues, and cell coverage before gameplay.
- Render terminal-only internal endpoints as structural markers, not duplicate clue prompts.

## Validation requirements

- Reject every question cell in column 7.
- Require exactly twelve valid `RIGHT_EDGE_BOUNDARY` answers, one per row.
- Reject one-letter answer gaps and any uncovered letter.
- Reconstruct every ordinary horizontal/vertical slot and every boundary slot independently.
- Verify direction, answer spelling, crossings, duplicate answers, clue links, image and logic constraints.
- Verify 8×12 dimensions and all 96 cell roles.
- On phones, target 95% viewport width and 85% viewport height, with the score/header, letter rack, timer, inventory and controls compacted into the remaining 15%.
- Measure actual 11-letter frequency across deterministic seed batches; do not infer it from the configured random probability.
