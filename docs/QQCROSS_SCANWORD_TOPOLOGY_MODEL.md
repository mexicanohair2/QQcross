# QQCross scanword topology model — right/down-only production contract

## Fixed coordinate contract

- Width: 8 columns; column indices 0 through 7.
- Height: 12 rows; row indices 0 through 11.
- Total: 96 logical cells.
- Grid access: `grid[row][col]`.
- `(0,0)` is the single reserved structural corner.
- Every other cell must have exactly one role: `question` or `letter`.
- The left border `(1,0)..(11,0)` contains question cells.
- `(0,1)` is the required top anchor. Other top-row cells are dynamic and may be questions only when they bound a real answer slot.

## Allowed answer geometry

The only production answer directions are:

- `right`: the clue is the left endpoint; letters proceed toward increasing columns.
- `down`: the clue is the upper endpoint; letters proceed toward increasing rows.

`left` and `up` are rejected by topology, coordinate helpers, CSP, assembler, independent validator and legacy adapter. No caller-supplied option may re-enable them.

A normal slot is a continuous run of at least two letter cells between consecutive question cells in one row or one column. A horizontal slot is derived only from its left question cell and a vertical slot only from its upper question cell. The topology stage creates exactly one direction option per slot.

A one-letter gap is never promoted to an answer. Its letter must belong to another valid crossing answer or the topology is rejected.

## Cell coverage and connectedness

- All 96 positions have explicit roles, including the structural corner.
- Exactly one cell has role `corner`: `(0,0)`.
- Every question cell must be linked to at least one answer.
- Every letter cell must belong to at least one registered answer.
- Crossing letters must agree exactly.
- Every reconstructed answer run must map to a registered clue and dictionary entry.
- Unregistered runs, orphan letters, dangling clues, duplicate answers and conflicting question links reject the board.

When connectedness is requested, the independent validator reconstructs the clue/answer graph and verifies that the playable structure is connected.

## Special 11-letter boundary rule

The only answer allowed to terminate at the board edge without a second in-board question cell is:

- clue: `(0,1)`;
- direction: `down`;
- answer cells: `(1,1)` through `(11,1)`;
- length: exactly 11.

All eleven cells must be letters and the path must be uninterrupted. No other answer receives an edge-terminal exception.

## Enforcement modules

- `scanword-engine/src/config.js`: dimensions and canonical allowed directions.
- `scanword-engine/src/topology.js`: coordinate helper and one-way slot derivation.
- `scanword-engine/src/csp.js`: rejects reverse directions even when requested by callers.
- `scanword-engine/src/assembler.js`: rejects invalid directions and conflicting placements.
- `scanword-engine/src/validator.js`: independently reconstructs and checks the completed board.
- `scanword-engine/src/legacy-adapter.js`: final production boundary; accepts only right/down answers.
- `scanword-engine/tests/topology.test.js`, `csp.test.js`, `core.test.js`, and `legacy-adapter.test.js`: regression coverage.
