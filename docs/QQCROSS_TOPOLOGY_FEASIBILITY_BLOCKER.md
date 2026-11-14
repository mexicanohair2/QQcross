# QQCross 8×12 border constraints and the optional eleven-letter answer

Status: **three requested geometry rules cannot all be satisfied at the same time.** The production topology keeps the full left question border, right/down-only answers, and an optional 11-letter boundary answer. To preserve those three rules, it uses selected question anchors rather than making every cell in the top row a question.

## Fixed board rules

- Exactly 8 columns × 12 rows (96 cells).
- (0,0) is the reserved blank corner.
- (0,1) is a question cell.
- The left border in rows 1–11 consists of question cells.
- Every answer uses real dictionary entries and runs right or down.
- Every letter cell belongs to one or more registered words, and every question cell is active.
- A special 11-letter answer may run down from (0,1) to the bottom boundary.

## The geometric conflict

Assume every top-row cell from (0,1) through (0,7) is a question cell, every cell in the left border from (1,0) through (11,0) is a question cell, ordinary answers must have at least two letters, and answers may only run right or down.

The question at (0,1) cannot run right because (0,2) is another question cell. It therefore must start downward. It cannot terminate at an interior question cell (r,1): that would leave the left-border question (r,0) unable to start a two-letter answer, because its right neighbour would be a question and its next downward neighbour in column 0 would also be a question. Therefore the answer from (0,1) must continue to the bottom boundary and contains all eleven cells (1,1) through (11,1).

Consequently, under the exact full-top-row rule, the 11-letter answer is mandatory on every board. That conflicts with the separate requirement that it appear in only about one quarter of boards.

This is a geometric constraint, not a search-budget or dictionary issue.

## Current production compromise

The current generator preserves:
- the 8×12 board and all 96 cell roles;
- the blank upper-left corner;
- the complete left question border;
- the (0,1) top-left question anchor;
- right/down answer directions only;
- real dictionary answers, independent validation, and an optional 11-letter answer targeted at roughly 25%.

To make the long answer optional, additional top-row cells are allowed to be letters where they belong to a valid horizontal answer. The top row therefore contains multiple question anchors, not seven question cells in every board.

This is a deliberate, documented deviation from the strict full-top-row requirement. It must not be described as satisfying that rule.

## Validation requirements

- Derive answer slots from the actual question/letter role grid.
- Reject question cells without a valid clue/answer relationship.
- Reject any letter not covered by a valid word.
- Reconstruct every ordinary horizontal and vertical slot independently.
- Verify direction, answer spelling, crossings, duplicate answers, question links, image and logic constraints.
- Validate the complete board before it enters gameplay.
- Measure actual 11-letter frequency across deterministic seed batches; do not infer it from the configured random probability.
