# QQCross topology feasibility blocker

Status: **hard blocker** for a full 8×12 board under the current rules. The previous proof that only left-border rows 1 and 2 were blocked was incomplete. A stronger contradiction affects the second top-row clue regardless of any partial left-edge exception.

## Rules used

1. The board is 8 columns × 12 rows.
2. Every cell in the top row except (0,0) is a clue cell.
3. Every cell in the left column except (0,0) is a clue cell.
4. (0,0) is the only reserved blank cell.
5. A clue may point only orthogonally: right, left, up or down.
6. Every answer has at least two letters; no one-letter filler answers.
7. Every ordinary answer must end at another in-board clue cell.
8. The only currently specified boundary exception is an 11-letter answer from (0,1) down through (11,1), ending at the bottom boundary.
9. The 11-letter answer is intended to appear only in roughly one quarter of puzzles.

## Strong contradiction: top clue (0,2)

For every left-border clue (r,0), where r is 1 through 11:

- left points outside the board;
- up and down point to mandatory clue cells in the same left border;
- therefore its only possible direction is right.

Since an answer needs at least two letters, cells (r,1) and (r,2) must both be letters for every r=1..11.

That forces the entire second column below the top edge — (1,2) through (11,2) — to be letters. But the top clue at (0,2) can only point down: its left and right neighbours are also top-row clues, and up is outside the board. Its answer therefore has to occupy all eleven cells and end at the bottom boundary.

The only specified 11-letter boundary exception is at (0,1), not (0,2). Consequently, clue (0,2) has no legal answer. This remains true even if the left-border clues in rows 1 and 2 are separately allowed to end at the right edge.

## Additional consequence for the optional 11-letter mechanic

The left-border rule also forces cells (1,1)..(11,1) to be letters. Thus clue (0,1) must also use the 11-letter bottom-boundary answer in every complete puzzle. A rule that permits it only about 25% of the time is incompatible with the mandatory full left border.

## Why a partial fix is not enough

An opt-in prototype can describe two horizontal edge slots from (1,0) and (2,0), each seven letters long. These slots are geometrically valid in isolation, but they do not solve the forced 11-letter path in column 2 and do not create a valid complete board. The option remains disabled in the production generator, and the full topology preflight still rejects the specification.

A complete solution requires an explicit rule change to at least one of the underlying constraints: the mandatory left border, minimum answer length, top clue directions, allowed boundary answers, or the frequency/number of 11-letter boundary answers. No such rule change is silently applied.

## Engineering policy

- Do not fabricate answers or letters.
- Do not reclassify ordinary letters as clue cells to conceal a broken path.
- Do not add one-letter filler answers.
- Do not call a partial board a complete scanword.
- Do not connect the experimental engine to live gameplay while this blocker remains.

The independent topology preflight returns `TOP_BORDER_SECOND_COLUMN_CONFLICT` before CSP search. This is an explicit refusal to produce an invalid puzzle, not a successful generation result.
