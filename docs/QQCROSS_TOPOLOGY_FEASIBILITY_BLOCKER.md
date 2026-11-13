# QQCross topology feasibility blocker — required clarification

Status: blocking for full-grid topology generation. The current border and terminal-cell requirements cannot all be true at once.

## Constraints used in this proof

1. Every cell in the top row except (0,0) is a question cell.
2. Every cell in the left column except (0,0) is a question cell.
3. A question cell has one of four orthogonal directions.
4. Answers contain at least two letters; one-letter filler answers are forbidden.
5. An ordinary answer must terminate at another in-board question cell.
6. The only boundary exception is the 11-letter answer from (0,1) downward to row 11.

## Contradiction

Take any top-row question cell (0,c), where c is from 1 through 7.

Its immediate left and right neighbours are also question cells (or the empty corner at c=1). Its upward neighbour is outside the board. Therefore its only possible answer direction is down.

Because ordinary answers need at least two letters before their terminal question cell, cells (1,c) and (2,c) must both be letter cells. This is true for every c=1..7.

Consequently, all cells (1,1)..(1,7) and (2,1)..(2,7) must be letters.

Now consider the required left-border question at (1,0). Its only possible answer direction is right: up points to the empty corner, down points to another question cell, and left is outside the board. Its answer must therefore begin at (1,1) and terminate at a later question cell in row 1.

But every cell (1,1)..(1,7) is already required to be a letter by the top-row clues. No in-board terminal question exists. The ordinary answer cannot end at the right edge under the current rules. Therefore the question at (1,0) cannot have an answer.

The same contradiction applies to (2,0). It is independent of the dictionary, CSP implementation, seed, and all other interior cells. The special 11-letter exception at (0,1) does not resolve it.

## What this means

A full 8×12 board satisfying every current rule does not exist. A generator that claims success would have to violate at least one constraint or fabricate a question/answer.

Before implementing a full topology generator, one rule must be relaxed. The smallest practical change is to permit ordinary answers from left-border clues to terminate at the right edge when the intervening cells are all valid dictionary letters. Another possible change is to exempt one or more left-border cells from the mandatory-question rule. Either change alters the current specification and must be explicitly approved.

Until this conflict is resolved, the topology module and CSP kernel are kept separate and must not be integrated into live gameplay.
