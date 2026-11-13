# QQCross dictionary audit — 2026-11-13

Source: `data/scanword-dictionary.json` on `feature/qqcross-scanword-engine`.

## Raw inventory

- Total records: **2,287**
- Valid Russian answer records with 2–11 letters and non-empty clue: **2,216**
- Unique accepted answers after answer deduplication: **2,034**
- Duplicate answer records among accepted entries: **182**
- Records with one-letter answers: **32** (rejected by the engine)
- Records with answers longer than 11 letters: **39** (rejected by the engine)
- Invalid answer characters: **0**
- Empty clues: **0**
- Image records: **46**
- Unique image keys: **46**
- Logic-tagged raw records: **710**
- Unique accepted answers carrying an image after answer deduplication: **17**
- Unique accepted logic answers after answer deduplication: **496**

## Question text collisions

The audit normalized question text for case, punctuation and repeated whitespace. It found no non-picture question collisions between different accepted answers.

The 45 apparent cross-answer collisions are the intentional shared picture prompt “Что изображено на картинке?” attached to different image keys. The dictionary loader already has a narrow exception for this exact class when image keys differ.

## Findings and limits

1. The dictionary is materially smaller than the long-term 25,000/50,000-word target. Current measured source size is 2,287 records, not tens of thousands.
2. The 2,034 accepted unique answers are the realistic upper bound for the current dictionary before topology/placement constraints and content quotas are applied.
3. Only 17 unique accepted answers carry image metadata after answer deduplication. This is enough to select five distinct image answers in principle, but the actual slot lengths and intersections may make a given board unsatisfiable.
4. The 11-letter pool contains 83 raw records before duplicate/quality filtering. The exact usable unique count must be taken from `prepareDictionary` at runtime.
5. Automatic text checks cannot certify that every clue is factually correct, unambiguous, or age-appropriate. Human review remains necessary for semantic quality.

## Engineering action

The CSP solver now treats normalized duplicate question text as a hard uniqueness constraint, in addition to unique answers. This prevents two different answers with punctuation/case/spacing variants of the same clue from appearing on one board. The shared picture prompt remains reusable only because each image clue has a distinct asset key; the solver still prevents reuse of an image key.

The audit is informational and does not modify or discard source dictionary records.
