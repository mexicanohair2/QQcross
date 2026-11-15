# QQCross scanword engine audit — 2026-11-12

Repository: mexicanohair2/QQCross (canonical GitHub name is mexicanohair2/QQcross), default branch main.
Published site: https://mexicanohair2.github.io/QQCross/.
index.html loads audio.js, wordle.js, new-games.js, progression.js, encyclopedia.js, then app.js.
Primary scanword generation is in app.js, function buildScanword(entries). The current clue bank is data/scanword-dictionary.json.
Existing browser regression tests are in tests/qqcross.spec.js; scanword verification scripts also exist under scripts/.

## Critical findings

1. The current app.js builder declares W=6, H=12, TOTAL=W*H. This conflicts with the latest immutable requirement: 8 columns × 12 rows = 96 cells.
2. The test suite contains assertions from different layout revisions: one expects 12 columns × 8 rows, while a later test expects 8 columns × 12 rows. Reconcile tests to the latest 8×12 contract before claiming CI correctness.
3. The current production builder's direction list contains only right and down. The requested engine must support right, left, down and up, without breaking rendering, arrows, answer traversal or hints.
4. The current builder requires a terminal clue cell after every answer. An 11-letter answer from top-row clue (0,1) cannot fit in 12 rows if a separate terminal clue cell is mandatory. The special mechanic needs an explicit boundary exception: clue at (0,1), letters at (1,1)..(11,1), no terminal cell outside the board. Do not relax ordinary word rules.
5. The current builder contains rules for picture and logic clues; existing tests have expected five distinct picture clues. Reconcile that compatibility requirement with the new specification's optional image support rather than silently removing existing content.
6. The standalone prototype under scanword-engine/src is not production complete. It places only fixed edge anchors and does not solve the full 96-cell topology or required central clue-cell distribution. Its validator correctly rejects unassigned cells. Do not wire it into live gameplay yet.
7. The live renderer/game state depends on the current puzzle shape and derived maps/sets such as words, used, clueKeys, reservedKeys, expected, clueAt and wordTerminals. Build and test a compatibility adapter before switching engines.

## Non-regression requirements

Do not change Supabase schema, auth, profiles, inventory, friends, multiplayer, Wordle, word search, word wheel, CodyCross, themes, shop, PWA/offline or no-ads behavior unless a direct engine dependency is proven. Preserve the real dictionary and image assets. Keep generation bounded and fast. Do not deploy an incomplete engine to main or GitHub Pages.