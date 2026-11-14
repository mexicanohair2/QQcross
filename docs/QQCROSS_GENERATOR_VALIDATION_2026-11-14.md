# QQCross generator validation — 2026-11-14

## Tested revision

- Branch: `work/qqcross-release-hardening-20261114`
- Commit: `80aed2770b1f3a06428404d535a0d6093b029d29`
- Pull request: #30, still draft; not merged or deployed
- Production `main` and GitHub Pages were not modified

## Seeded generation gates

### First gate — 20 puzzles

- Generated: **20/20**
- Independent validator failures: **0**
- Requested 11-letter puzzles: **5**
- 11-letter puzzles actually generated: **5/5**
- Distinct puzzle fingerprints: **20/20**
- Median generation time: **716 ms**
- p95 generation time: **891 ms**
- Average answer count: **19.5**
- Average question cells: **28**
- Assigned-cell fill: **100%**
- Maximum two-letter answers: **6**
- Musical-note fillers (`ДО`, `РЕ`, `МИ`, `ФА`, `ЛЯ`, `СИ`): rejected by CSP and asserted absent

### Second gate — 100 consecutive puzzles

- Generated: **100/100**
- Independent validator failures: **0**
- Requested 11-letter puzzles: **25**
- 11-letter puzzles actually generated: **25/25**
- Missed 11-letter requests: **0**
- Median generation time: **697 ms**
- p95 generation time: **730 ms**
- Median two-letter answers per puzzle: **6**
- Maximum two-letter answers: **6**
- Musical-note fillers: asserted absent
- The sequence index is 1-based; puzzles 4, 8, 12, …, 100 are required to contain the 11-letter answer

All timings above are measured in GitHub Actions' Node.js runner. They are not measurements from a physical Honor 400 device.

## Other checks on the same revision

- Isolated scanword engine unit tests: **passed**
- QQCross dictionary/data validation: **passed**
- Playwright desktop Chromium: **passed**
- Playwright mobile Chromium: **passed**

Playwright mobile is a mobile-browser viewport test; it is not a physical-device test on an Honor 400.

## What the validator and tests establish

The production batch checks 8×12 geometry, all 96 cell roles (including the reserved corner), real dictionary membership, answer coordinates and directions, matching crossing letters, unique answers, active clue cells, grid connectedness, five distinct picture clue cells/assets, at least three logic clue cells, no orphan letter cells, and no independently reconstructed unregistered word slots.

The batch does not provide a human semantic review of all 2,289 dictionary records or prove that every clue is equally natural. That remains a content-quality review task.

## Reference comparison status

- **Kryss Maker:** `https://kryss.app/maker` is the visual/editor reference. Its page states defaults of 8 Across × 12 Down, supports text/picture clue authoring, and embeds a canvas whose visible text says “Drag to create your grid”. This is a confirmed size and editor-workflow reference, but not an automatic-placement benchmark.
- **Automatic scanword quality reference:** `https://mytoolkit.ru/scanword` describes automatic placement of user-entered answer/clue pairs with intersections, clue cells in the grid, direction arrows, and a separate report of words that could not be placed. This is the better structural comparison for generator quality. Its advertised behavior was inspected, but an interactive sample output and internal algorithm were not run or inspected.
- **Kryss screenshot:** the Dropbox asset is the visual guide for cells, clue styling, directions and screen composition. Its captured board is 13×13; QQCross remains 8×12. Exact interior clue-coordinate mapping has not yet been measured.
- Do not claim algorithmic equivalence to either reference. MyToolkit's page-level behavior is the quality target; dynamic output-level comparison remains unverified.

## Deployment packaging correction

The GitHub Pages workflow previously copied the app shell and data/assets but omitted `scanword-engine/`, even though `app.js` dynamically imports the engine and its Worker. The deployment workflow is corrected on this revision to copy the complete engine directory and assert that the Worker, generator, and legacy adapter are present in `dist/` before upload. This packaging check still needs to run on the `main` deployment after the PR is merged.

## Remaining release gates

1. Directly inspect the interactive reference canvas and map its word-placement/validation behavior, or document that the site is only a manual editor.
2. Measure the visual screenshot's cell and clue layout against the QQCross 8×12 board. The strict all-question top row is a documented geometric conflict with a full left clue border and an optional 11-letter answer; the production layout currently uses active top anchors rather than forcing dead clues.
3. Review dictionary clue semantics and game integration beyond CI; do not merge PR #30 until those remaining checks are resolved.
