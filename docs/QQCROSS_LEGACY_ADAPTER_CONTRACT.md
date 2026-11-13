# QQCross legacy game adapter contract

Source inspected: `app.js` on `feature/qqcross-scanword-engine`, especially `makeRandomPuzzle()`, `clonePreparedScanword()`, and `renderGame(root)`.

This document records the actual consumer contract. It does not connect the new engine to gameplay.

## Legacy puzzle object

The existing game expects:

- `id`: stable puzzle identifier.
- `title`: display title.
- `w`: number of columns.
- `h`: number of rows.
- `words`: array of word records.
- `used`: Set of `"row,col"` keys for letter cells.
- `clueKeys`: Set of `"row,col"` keys for clue cells.
- `reservedKeys`: Set containing only `"0,0"` for the blank corner.
- `coverage`: exactly `1` for a fully validated board.

The new engine's dimensions must map as `w = scanword.width = 8` and `h = scanword.height = 12`. Do not transpose these fields.

## Legacy word record

`renderGame()` and `makeRandomPuzzle()` consume these fields:

| Field | Required meaning |
|---|---|
| `id` | Stable unique word ID; also used by completion state |
| `answer` | Normalized answer text |
| `sourceAnswer` | Original dictionary answer, retained for compatibility |
| `clue` | Full clue text |
| `clueShort` | Compact cell label |
| `isEmoji` | Whether the clue is an emoji/flag clue |
| `logic` | Whether this is a logic clue |
| `imageKey` | Optional key for `assets/scanword/{key}.svg` |
| `dir` | Exactly `right`, `left`, `down`, or `up` |
| `dirIndex` | Stable numeric direction index |
| `cells` | Answer-order array of `[row, col]` coordinates |
| `clueCell` | `[row, col]` coordinate of the question cell |

Suggested stable direction indexes for the adapter: right=0, down=1, left=2, up=3. The renderer uses the string `dir` for direction vectors; preserve the index only for compatibility.

## Rendering behavior

- `makeRandomPuzzle()` iterates every `word.cells` entry and builds the global `expected["row,col"] = answer[index]` map. Crossing words must therefore have identical letters at shared coordinates.
- `renderGame()` builds `clueAt` from every word's `clueCell`. Multiple words at one clue cell must remain separate records so the popup can show multiple directions.
- `renderGame()` independently computes each word's terminal question coordinate from the last cell and `dir`. A terminal-only cell is rendered as a clue cell even when no word starts there.
- If a terminal cell also starts another answer, the renderer combines the outgoing and incoming clue behavior. Do not discard terminal relationships when mapping the grid.
- Letter cells are rendered from `expected`; question cells from clue starts and computed terminals; the only reserved blank is `(0,0)`. Any remaining cell becomes a visible filler, which is forbidden for the new generator.

## Adapter safety rules

1. Run the new independent validator with the real dictionary before adapting.
2. Refuse adaptation unless validation succeeds and all 96 cells have valid roles.
3. Map coordinate objects `{row, col}` to legacy arrays `[row, col]` without changing order.
4. Preserve every word record, including multiple answers sharing one clue cell.
5. Preserve image keys and logic flags; do not infer image assets from answer text.
6. Populate `used`, `clueKeys`, and `reservedKeys` from the validated grid, not from guessed counts.
7. Never set `coverage: 1` on partial or invalid output.
8. Do not change registration, Supabase, multiplayer, inventory, hints, timers, saves, Wordle, CodyCross, or other game modes while replacing the scanword source.

## Current integration status

The current production `buildScanword(entries)` in `app.js` still constructs a **6×12** legacy board and remains the active generator. The isolated engine is **8×12** and is not yet wired to the game. The adapter must not be activated until the topology contradiction is resolved and the full-board tests pass.
