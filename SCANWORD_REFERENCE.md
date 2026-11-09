# QQCross scanword reference specification

Reference asset (Dropbox): `/Screenshot_20261105_010300_app_kryds_android_MessagingUnityPlayerActivity.jpg`

## Confirmed visual structure (transcribed from the uploaded screenshot)
- The board is portrait **8 columns × 12 rows** (96 square cells), almost the full phone width, with a narrow, even gap.
- The score/player header is above the board. The inventory/tool row, large green confirm control, and letter rack are below it.
- Top-edge clue cells occupy row 0, columns 1–7. They point down. The top-left square (row 0, column 0) is a separate utility/blank square, not a clue.
- Left-edge clue cells occupy rows 1–11, column 0. They point right.
- Interior clue-cell coordinates (row, column), zero-based: **(2,4), (3,2), (4,3), (5,6), (5,7), (6,4), (6,5), (8,2), (8,3), (10,4), (11,4)**.
- Five interior/edge cells in the screenshot split two prompts inside one tile: **(2,4), (3,2), (4,3), (6,5), (8,3)**. Both prompts must remain visible in the cell, stacked, with their own direction marks.
- Seven illustrated clue cells are visible in the reference: top edge at (0,2) and (0,3), and left edge at (1,0), (5,0), (6,0), (9,0), and (11,0).
- This is a total of 29 clue tiles and 34 visible clue prompts (counting the five split tiles twice). The clue wording and answer content must be QQCross's own, not copied from the reference game.
- The reference uses small, unobtrusive direction triangles near the clue-cell edge; they must not cover the clue text.

## Implementation guardrails
- Never change the grid dimensions, board proportions, cell proportions, spacing, clue placement rules, arrows, or vertical composition without checking this reference first.
- Keep the board large and centered in the available phone game area; it must not shrink to a small tile or force horizontal/vertical scrolling.
- Keep top-edge starts downward and left-edge starts rightward; allow left/up directions only for interior clue cells, where they are needed to preserve the connected scanword structure.
- Keep the score area above the board and letter rack/confirm control below it.
- Keep clue contents generated from QQCross data; do not copy the reference game's questions or answers.

## Verification note
The implementation target is an 8 × 12 portrait board with real clue cells on both the top and left edges (the top-left corner is blank). Every answer must end at another playable clue cell; each clue cell must be a real word start or terminal. Every remaining square must be a letter or a deliberately styled dark blocker, never an empty question placeholder. Arrows are limited to right and down. The screenshot is the visual source of truth; exact interior clue coordinates still need to be transcribed before claiming a pixel-perfect cell-by-cell match.
