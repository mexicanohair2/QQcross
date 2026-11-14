# QQCross topology feasibility — previous blocker resolved

Status: **the former contradiction was caused by an over-restrictive top-row rule**, not by the 8×12 geometry itself.

## Correct rule interpretation

The board remains exactly 8 columns × 12 rows. The (0,0) corner remains the only reserved blank cell. The left border (rows 1–11, column 0) remains question/end cells. Cell (0,1) remains the top-left question anchor.

The top row is not required to consist entirely of question cells. It may contain letters when those letters are part of a horizontal answer run bounded by two question cells. Answers can point in all four orthogonal directions.

## Why the prior proof was incomplete

The former proof assumed that (0,2) must be a question cell and therefore could only point downward. That assumption was incorrect under the agreed allowance for strategic top-row omissions.

In the new geometry, the upper row may be arranged as a horizontal chain such as question cells at (0,1), (0,4) and (0,7), with two-letter answer runs between them. The cells between those anchors are answer letters, not clue cells. Therefore (0,2) does not need a downward answer.

The left-edge answers can still start at (r,0) and travel right. Their letters occupy the second and third columns as required. Interior question cells and vertical runs are generated dynamically and create crossings between those horizontal answers.

## Optional eleven-letter answer

The special 11-letter answer remains available from (0,1) down through (11,1) to the lower boundary. Because it is optional, the generator enables this slot for only a seed-selected subset of puzzles. The ordinary top-row horizontal slot from (0,1) remains available when the special answer is absent.

The geometry and the CSP must agree on whether that special slot is present. It must never be inserted as an unassigned placeholder.

## Current engineering rules

- Keep the exact 8×12 dimensions and all 96 cell roles.
- Preserve the single reserved corner at (0,0).
- Preserve the left-border question/end cells and top-left anchor at (0,1).
- Permit letters on the top row only when a derived answer slot covers them.
- Derive horizontal and vertical slots from actual consecutive question cells.
- Reject any question cell without a valid incoming or outgoing answer slot.
- Reject any letter not covered by at least one slot.
- Allow terminal-only question cells: the renderer displays the incoming answer's clue there, while actual clue records remain linked to their start cell.
- Keep the 11-letter boundary answer optional at approximately 25% frequency.
- Run the independent full-board validator before a puzzle can enter gameplay.

The previous strict-full-top-row feasibility check is obsolete and has been replaced by a dynamic top-row anchor/coverage check.
