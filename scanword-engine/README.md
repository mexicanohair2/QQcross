QQCross scanword engine — integration prototype

This directory is an experimental engine source area inside the existing QQCross repository. It is NOT yet connected to live gameplay. Do not import it from app.js or replace buildScanword() until the full-grid topology, independent validator, dictionary integration, and mobile/regression tests pass.

Fixed format: 8 columns × 12 rows, 96 cells; rows 0..11; columns 0..7; (0,0) is the empty corner; top row and left column (except the corner) are clue cells. The 11-letter answer target is 25% across large seeded batches and is optional if no valid placement exists.

Current prototype limitations: the placement kernel is bounded and checks intersections, but it only tries fixed edge anchors and does not yet solve the full 96-cell topology or varied central clue-cell structure. Its validator rejects unassigned cells, so partial boards are not returned as success. Unit tests are not proof of production generation quality.

Integration contract: production currently uses classic scripts, primary generation in app.js, and data/scanword-dictionary.json. A compatibility adapter must preserve renderer, expected, clueAt, wordTerminals, hints, saves, daily mode, solo, multiplayer and AI flows. No live gameplay change is made by adding this directory.