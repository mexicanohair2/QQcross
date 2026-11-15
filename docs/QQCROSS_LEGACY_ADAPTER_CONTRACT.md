# QQCross legacy game adapter contract

Source inspected: app.js, especially makeRandomPuzzle(), clonePreparedScanword(), renderGame(root), and the match start paths.

The new geometric engine is integrated through scanword-engine/worker.js and scanword-engine/src/legacy-adapter.js. The adapter accepts only a puzzle that has passed the engine's independent validator.

## Legacy puzzle object

The existing game expects:

- id: unique puzzle identifier.
- title: display title.
- w: number of columns, exactly 8.
- h: number of rows, exactly 12.
- words: array of word records.
- used: Set of "row,col" keys for letter cells.
- clueKeys: Set of "row,col" keys for all question/end cells.
- reservedKeys: Set containing only "0,0".
- coverage: exactly 1 for a fully validated board.

Do not transpose dimensions. The engine's width is 8 and height is 12.

## Legacy word record

The renderer and scoring code consume these fields:

| Field | Meaning |
|---|---|
| id | Unique word ID used by completion state |
| answer | Normalized answer text |
| sourceAnswer | Original dictionary answer |
| clue | Full clue text |
| clueShort | Compact cell label |
| isEmoji | Whether the clue contains an emoji/flag |
| logic | Whether this is a logic clue |
| imageKey | Optional key for assets/scanword/{key}.svg |
| dir | right, left, down, or up |
| dirIndex | right=0, down=1, left=2, up=3 |
| cells | Answer-order array of [row, col] coordinates |
| clueCell | [row, col] coordinate of the start question |
| special | Optional special boundary mechanic |

## Rendering behavior

- makeRandomPuzzle() iterates every word.cells entry and builds expected["row,col"] = answer[index]. Crossing words must have identical letters at shared coordinates.
- renderGame() builds clueAt from every word's clueCell. Multiple words at one clue cell remain separate records so the popup can show all directions.
- renderGame() independently computes every answer's terminal question coordinate from the last cell and direction.
- A terminal-only cell is rendered as a question/end cell using the incoming word. It does not need a second, unrelated clue record.
- If a terminal cell also starts another answer, the renderer combines incoming and outgoing clue behavior.
- Letter cells are rendered from expected; question cells from clue starts and computed terminals; (0,0) is the only reserved blank. Any remaining cell becomes a visible filler and is rejected by the new validator.

## Adapter safety rules

1. Generate and independently validate using the real dictionary before adaptation.
2. Refuse adaptation unless all 96 cells have valid roles.
3. Map coordinate objects {row, col} to [row, col] without changing answer order.
4. Preserve every word record, including multiple answers sharing one clue cell.
5. Preserve image keys and logic flags from dictionary metadata.
6. Populate used, clueKeys, and reservedKeys from the certified grid.
7. Never set coverage: 1 on partial or invalid output.
8. Do not change Supabase or unrelated modes when replacing the scanword source.

## Production integration

The app now requests generation from a module Web Worker. It uses the CSP engine, then the independent validator, and only then converts the result through legacy-adapter.js. The old greedy buildScanword() implementation was removed from the gameplay path. The existing renderer, letter rack, hints, local/online match state, and account systems continue consuming the same legacy puzzle shape.
