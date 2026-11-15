# QQCross dictionary audit and normalization — Stages 3–4

Audit source: data/scanword-dictionary.json on feature/qqcross-scanword-engine. The source JSON was inspected and is not modified by the audit or normalizer.

## Verified source inventory

- Raw records: 2,287.
- Unique playable answers after normalization and deduplication: 2,032.
- Valid source variants retained for alternate clue selection: 2,214.
- Rejected records: 73.
- Rejection reasons: 71 answer-length violations and 2 exact whole-word answer leaks.
- Empty answers: 0.
- Empty clues: 0.
- Invalid Russian answer characters: 0.
- Picture records: 46, each with a distinct imageKey.
- Records marked as logic clues: 710.
- Clues shorter than 15 characters: 266 raw records; these are review warnings, not automatic rejections.
- Clues longer than 110 characters: 0.

## Answer-length distribution in the unchanged source file

| Length | Records |
|---:|---:|
| 1 | 32 |
| 2 | 17 |
| 3 | 87 |
| 4 | 227 |
| 5 | 404 |
| 6 | 425 |
| 7 | 382 |
| 8 | 299 |
| 9 | 192 |
| 10 | 100 |
| 11 | 83 |
| 12 | 39 |

The 32 one-letter records and 39 twelve-letter records remain in the original source JSON but are not accepted as playable answers by the current 2–11 letter engine contract. Nothing was deleted from the user's dictionary.

## Duplicate handling

The source has 161 answer groups containing repeated answers, with 184 extra raw records beyond one record per unique answer.

The normalizer:
- retains every valid clue variant in the variants collection;
- exposes one best candidate per normalized answer in entries, preventing duplicate answers within a generated board;
- prefers a valid picture-answer variant when one exists, so imageKey metadata is not lost;
- gives logic clues a quality preference;
- records duplicate and short-clue warnings rather than silently deleting source data.

The source repeats the generic prompt “Что изображено на картинке?” across distinct image answers. That is intentional: each record has its own distinct imageKey. The normalizer treats distinct image-backed prompts as valid rather than reporting them as semantic duplicate clues.

## Implemented schema compatibility

The production source uses answer, clue, clueShort, imageKey and logic. The original isolated prototype expected answer and question and therefore could not read the live dictionary correctly.

The updated normalizer accepts both question and clue fields, maps clue to the internal question field, and preserves clueShort, imageKey, logic and image metadata. It assigns deterministic source-position IDs when the source record has no id.

Answer leakage checks compare whole Russian word tokens, not arbitrary substrings. This avoids rejecting valid definitions merely because the answer occurs as part of an inflected word (for example, ЧАЙ inside ЧАЙНЫХ).

Е and Ё remain distinct by default. Folding Ё to Е is an explicit option, not an implicit mutation.

## Indexing for CSP

The index layer now builds:
- byLength: candidates grouped by normalized answer length;
- byLetter: positional buckets keyed by position and letter;
- byId: direct entry lookup;
- byAnswer: normalized answer lookup.

findCandidates() intersects positional buckets and scans the smallest bucket first. This is the minimum-remaining-values foundation for the later CSP stage: a slot with more crossing letters should have a smaller candidate list and be selected earlier.

## Validation status

The isolated engine workflow has reported 24 passing tests before the latest indexing and picture-prompt regression additions. The latest changes are awaiting their next CI result at the time this document was added. Do not treat this document as a semantic human review of every clue; heuristic checks identify structural problems and review warnings, not guaranteed linguistic correctness.
