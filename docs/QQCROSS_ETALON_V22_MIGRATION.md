# QQCross — migration to scanword ETALON v2.2

Status: **geometry prototype verified; not yet connected to production gameplay**.

Checkpoint date: 2026-11-19.
Base: main at 4ac5d8822b9a80f6baab1420fe67759944a875bf.
Feature branch: feature/etalon-v22-topology-20261119.

## What is confirmed

The active production engine still uses a superseded topology model. Its current main implementation:
- allows letters in the top row instead of requiring seven clue cells there;
- derives both forward and reverse orientations;
- accepts right, left, down and up directions;
- only recognizes a limited set of old boundary exceptions;
- targets fewer than 34 slots in its topology builder.

That is not compatible with ETALON v2.2. PR #64 is based on the same older geometry and remains open; it is not a safe production base.

The new geometry module contains three distinct fixed 8×12 masks. Each independently validates with:
- 96 assigned cells and one reserved corner at (0,0);
- all seven cells in the top row and all eleven cells in the left column as clue cells;
- only right/down answer directions;
- at least one outgoing answer from every question cell;
- complete letter-cell coverage;
- one connected answer structure;
- 34 real geometric answer slots;
- exactly five two-letter slots, matching the currently curated short-answer pool;
- two mandatory 11-letter vertical boundary answers beginning at (0,1) and (0,2).

The geometry validator reconstructs outgoing slots from the role grid; it does not trust a generator-provided valid flag.

## Why the old 24–28 result was misleading

The earlier search and the PR #64 feasibility note explored an older board model with a dynamic top border, a limited set of right-edge exceptions, and four answer directions. It did not search the immutable ETALON v2.2 geometry. Its maximum of roughly 24–28 slots is therefore not evidence that the current 34-answer target is geometrically impossible.

The three certified masks in topology-v22.js demonstrate that the target is geometrically reachable under the v2.2 border/direction/coverage contract. This is a topology result only; it does not yet prove that every slot can be filled by a real dictionary entry.

## Remaining work before production integration

1. Add or curate four shared clue-cell pairings for the masks that start two answers from one question cell. Both answers from a shared clue cell must use one coherent prompt, not two competing clue texts. Pairing candidates must be reviewed for exact answer lengths and crossing compatibility.
2. Extend the CSP slot contract to support a single right/down orientation and generic right/bottom boundary terminals. Remove all production use of left/up directions and the obsolete optional single-11-letter plan.
3. Update assembly so boundary-terminated answers do not create phantom off-board question cells, while every in-board terminal is reconstructed correctly.
4. Extend the independent full puzzle validator to rebuild every right/down outgoing slot, require both top-row 11-letter answers, permit one shared clue for two directions at the same cell only, and reject all other duplicate clue text.
5. Solve all 34 slots against the real dictionary, including exactly five distinct image objects and at least three separate logic-clue cells. The current dictionary has 2,289 source records before runtime deduplication; this is not the 50,000-word long-term target.
6. Validate the renderer/legacy adapter and mobile viewport. The current engine adapter rotates the canonical 8×12 board; the visual direction and top/left clue placement need an explicit acceptance check.
7. Run at least 50 successful seeded end-to-end puzzles, a larger seed-diversity batch, the complete engine tests, Playwright on mobile/desktop, and manual solve checks.
8. Do not route gameplay to this module until all preceding checks pass. Keep main, existing auth, Supabase, inventory, friends, multiplayer and other game modes untouched.

## Explicit non-goals in this stage

- No main-branch changes.
- No merge or Pages deployment.
- No Supabase schema changes.
- No removal of the existing production path before the replacement is fully validated.
