# QQCross scanword topology model — Stage 2

## Fixed coordinate contract

- Width: 8 columns; column indices 0 through 7.
- Height: 12 rows; row indices 0 through 11.
- Total: 96 cells.
- Grid access: grid[row][col].
- The only empty corner is (0,0).
- Every cell has exactly one role: corner, question or letter.
- The whole top edge except (0,0) and the whole left edge except (0,0) are question cells.

## Geometric answer slots

A normal candidate answer is a continuous run of at least two letter cells between two consecutive question cells in one row or one column.

Each horizontal slot retains two possible orientations:
- right, starting from its left question cell;
- left, starting from its right question cell.

Each vertical slot retains two possible orientations:
- down, starting from its upper question cell;
- up, starting from its lower question cell.

The topology stage records candidate geometry. The later CSP stage must choose one orientation and one real dictionary entry for every selected answer slot. A geometric slot is not yet a solved word.

A one-letter gap is never promoted to an answer. Its letter still has to belong to a valid crossing answer, or the topology is rejected as containing an orphan.

## Cell coverage and connectedness

Every question cell must bound at least one candidate answer slot. Every letter cell must be contained in at least one candidate slot. A horizontal and vertical slot may cross at a letter cell.

When connectedness is requested, the validator builds a graph of question cells. Slot endpoints create graph edges, and crossing slots connect their clue endpoints. All question cells must be reachable from one another.

## Full-border feasibility constraint

The combined requirement that every top-edge cell (0,1)..(0,7) and every left-edge cell (1,0)..(11,0) be an active clue cell is not currently compatible with the ordinary slot rules:

1. The required top clue at (0,2) can only create a normal in-board answer by running down column 2 to an interior question cell (r,2).
2. Row r also has a required left-edge clue at (r,0). Since (r,2) is the next question cell in that row, only (r,1) lies between the two clues: a one-letter answer, which is explicitly forbidden.
3. If column 2 has no interior question cell, the top clue at (0,2) has no normal slot. Reaching the bottom edge instead would require another 11-letter boundary exception in column 2, while the sole permitted 11-letter answer is fixed at (0,1) down column 1.
4. The left-edge clue at (r,0) cannot be rescued vertically because all adjacent cells in column 0 are also question cells.

The function analyzeRequiredBorderFeasibility({ requireFullTopRow: true }) now reports this conflict explicitly rather than claiming the full-border pattern is feasible. This preflight does not change the production topology.

The smallest established layout that preserves the no-one-letter rule, the complete left border and the unique special 11-letter path is the previously documented reference layout: top clue anchors at columns 1, 4 and 7, with additional clues distributed inside the grid. Enforcing every top-row cell as a clue requires an explicit change to at least one other rule; the generator must not silently invent one-letter answers, extra 11-letter boundary answers or unlinked clue cells.

## Special 11-letter boundary rule

The only answer allowed to terminate at the edge without a second in-board question cell is the special answer:
- clue: (0,1);
- direction: down;
- answer cells: (1,1) through (11,1);
- length: exactly 11.

All eleven cells must be letters and the path must be uninterrupted. No other answer receives an edge-terminal exception.

## Implemented files

- scanword-engine/src/topology.js: coordinate helper, candidate-slot extraction, orientation options, special-boundary recognition and role/coverage validator.
- scanword-engine/tests/topology.test.js: unit tests for horizontal/vertical slots, four directions, one-letter gaps, the special exception and invalid cell coverage.

## Stage boundary

This is the geometric model, not a production generator. It does not yet select answer words, solve the complete 96-cell topology, guarantee that every slot has a matching dictionary entry, or alter live QQCross gameplay. Those remain later CSP and integration tasks.
