# QQCross scanword engine audit — 2026-11-12

> Historical snapshot only. Its findings describe the repository on 2026-11-12 and are not the current implementation contract. The scanword engine has since been integrated into the app. The current direction invariant is **right and down only**; every reference to four-direction support in this historical audit is obsolete. Use `docs/QQCROSS_SCANWORD_ENGINE_MASTER_PROMPT.md` and `SCANWORD_REFERENCE.md` as the current contracts.

Repository: mexicanohair2/QQCross (canonical GitHub name is mexicanohair2/QQcross), default branch main.
Published site: https://mexicanohair2.github.io/QQcross/.
index.html loads audio.js, wordle.js, new-games.js, progression.js, encyclopedia.js, then app.js.
Primary scanword generation is in app.js, function buildScanword(entries). The current clue bank is data/scanword-dictionary.json.
Existing browser regression tests are in tests/qqcross.spec.js; scanword verification scripts also exist under scripts/.

## Critical findings

1. The current app.js builder declares W=6, H=12, TOTAL=W*H. This conflicts with the latest immutable requirement: 8 columns × 12 rows = 96 cells.
2. The test suite contained contradictory assertions from obsolete revisions. All generator, adapter and browser checks must enforce exactly 8 columns × 12 rows; any transposed layout is invalid.
3. Historical finding: the builder at the time used right and down. The later four-direction proposal was superseded; production answers must remain right/down-only across generation, adapter, rendering, arrows, answer traversal and hints.
4. The current builder requires a terminal clue cell after every answer. An 11-letter answer from top-row clue (0,1) cannot fit in 12 rows if a separate terminal clue cell is mandatory. The special mechanic needs an explicit boundary exception: clue at (0,1), letters at (1,1)..(11,1), no terminal cell outside the board. Do not relax ordinary word rules.
5. The current builder contains rules for picture and logic clues; existing tests have expected five distinct picture clues. Reconcile that compatibility requirement with the new specification's optional image support rather than silently removing existing content.
6. Historical finding: the prototype was not production complete at the time of this audit. The later modular engine and its adapter are now part of the live gameplay path; use current source and CI evidence rather than this old status.
7. The live renderer/game state depends on the current puzzle shape and derived maps/sets such as words, used, clueKeys, reservedKeys, expected, clueAt and wordTerminals. Build and test a compatibility adapter before switching engines.

## Non-regression requirements

Do not change Supabase schema, auth, profiles, inventory, friends, multiplayer, Wordle, classic word search, CodyCross, themes, shop, PWA/offline or no-ads behavior unless a direct engine dependency is proven. Preserve the real dictionary and image assets. Keep generation bounded and fast. Do not deploy an incomplete engine to main or GitHub Pages.