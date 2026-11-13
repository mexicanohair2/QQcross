# QQCross CSP solver kernel — Stage 5

## Scope

The module scanword-engine/src/csp.js solves a supplied set of geometric answer slots. It is deliberately not presented as the full 8×12 board generator: designing a satisfiable 96-cell clue/letter mask is a separate topology problem.

## Inputs

- slots: fixed geometric slots with two endpoint orientations for normal answers; the special bottom-boundary slot has only its one authorized orientation.
- dictionary: production dictionary records or already-normalized entries.
- options: seed, node/time budget, abort signal, answer normalization mode, required number of distinct pictures, minimum distinct logic clue cells, and whether every clue endpoint must start at least one answer.

## Constraint model

The solver assigns exactly one dictionary entry and one endpoint orientation to every supplied slot.

Hard constraints:
- answer length equals slot length;
- answer characters are valid normalized Russian letters;
- all crossing letters agree;
- an answer cannot be used twice;
- an imageKey cannot be reused;
- a clue cell cannot host two answers in the same direction;
- coordinates must match the selected direction vector exactly;
- ordinary slots must remain inside the board and terminate at their opposite question cell;
- only the named 11-letter answer may use the bottom-boundary exception;
- when enabled, every question endpoint must receive at least one outgoing clue.

Content requirements:
- default target: five distinct image answers;
- default target: at least three distinct logic clue cells.

These can be overridden in unit fixtures, but the production adapter must preserve the game's required content policy.

## Search method

1. Build normalized dictionary indexes by length and positional letter.
2. For each unassigned slot, compute the candidates that match all crossing letters and direction locks.
3. Select the slot with the smallest remaining domain (MRV); break ties by crossing degree.
4. Order candidates deterministically from the supplied seed, preferring the outstanding image/logic requirements.
5. Place a candidate using reversible state changes.
6. Propagate new crossing letters to all remaining candidate domains.
7. Backtrack immediately on an empty domain, duplicate answer, direction conflict, impossible outgoing clue, or unreachable content quota.
8. Stop on cancellation, node budget or time budget and return an explicit failure reason.

The solver does not fabricate letters or return a partial placement as success.

## Output

On success it returns:
- words with stable IDs, dictionary entry IDs, answers, clue coordinates, direction and exact letter coordinates;
- question records;
- the resolved letter map;
- per-clue direction usage;
- slot/crossing/image/logic metrics;
- seed, node count, depth and elapsed time.

A caller must still assemble the complete grid and pass it through the independent full-board validator before export or gameplay.

## Verified tests

The isolated engine CI has verified:
- cyclic clue graph orientation;
- positional candidate propagation at crossings;
- rejection of impossible intersections;
- node/time budget handling;
- special 11-letter boundary geometry;
- rejection of malformed direction/coordinate paths.

This solver kernel is not wired into app.js or live gameplay.
