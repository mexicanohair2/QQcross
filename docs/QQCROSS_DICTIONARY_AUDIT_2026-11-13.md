# QQCross dictionary audit — 2026-11-13

Source: `data/scanword-dictionary.json` on `feature/qqcross-scanword-engine`; measurements use the current scanword-engine validation rules, which preserve Ё separately from Е.

## Raw inventory and runtime acceptance

- Raw records: **2,287**
- Records with 2–11 Russian letters and a non-empty clue before the full validator: **2,216**
- Valid runtime variants after all checks: **2,214**
- Distinct playable answers after answer deduplication: **2,032**
- Additional variants for already-used answers: **182**
- Rejected records: **73** — 71 outside the 2–11 letter range and 2 where the full answer leaks into its clue.
- Invalid answer characters among accepted variants: **0**
- Empty clues among accepted variants: **0**
- Raw one-letter records: **32**; raw answers longer than 11 letters: **39**

## Image and logic coverage

- Image records / unique image keys / unique playable image answers: **46 / 46 / 46**
- Raw logic-tagged records: **710**
- Distinct playable answers with at least one valid logic variant: **622**
- Distinct playable answers with an image and a separate logic variant: **13**
- The same answer may have separate image and logic formulations. The runtime now retains all valid variants for CSP selection while enforcing one use of each answer per puzzle. It no longer discards a valid logic formulation just because the image variant scored higher during answer deduplication.
- The cat image entry had been incorrectly tagged as a logic clue despite using the generic image prompt. That metadata error was removed; it no longer inflates the logic-clue count.

## Question text collisions

After normalizing case, punctuation, whitespace and Ё/Е, the only shared question text across different answers is the intentional generic image prompt “Что изображено на картинке?” with distinct image keys. No other exact normalized clue collisions were found.

## Findings and limits

1. The dictionary is materially smaller than the long-term 25,000/50,000-word target. Current measured source size is 2,287 records and 2,032 distinct playable answers.
2. The 2,032 accepted answers are the practical unique-answer ceiling before board geometry, intersections and content quotas are applied.
3. There are 46 image answers and 622 distinct answers with logic variants. This is sufficient for five different image answers and three separate logic clue cells in principle, but does not prove a given board topology can satisfy every quota.
4. The 11-letter pool contains 83 raw records and 79 distinct accepted answers before topology/placement constraints.
5. Automatic checks cannot certify factual accuracy, ambiguity, clue quality, or age-appropriateness. Human review remains necessary.

## Engineering action

The CSP now indexes all valid clue variants instead of only the one preferred representative per answer. Its per-puzzle `usedAnswers` constraint still prevents duplicate answers, while allowing a logic clue to be selected even when the same answer also has an image clue. The independent validator now resolves every accepted variant ID as well. Image and logic counts are measured by distinct accepted answer, not by record count.
