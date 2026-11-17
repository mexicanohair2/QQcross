# QQCross dictionary audit — current snapshot (2026-11-18)

Source: `data/scanword-dictionary.json` on the Kross working branch. Counts below were recomputed from the current source file. This is a structural/content-integrity audit, not a human review of every clue.

## Source inventory

- Raw records: **2,289**.
- Records with 2–11 letters and a non-empty clue: **2,218**.
- Unique playable answers with the default Ё-preserving normalization: **2,036**.
- Unique playable answers if Ё is explicitly folded to Е: **2,034**.
- Unique answers across the complete raw file, including non-playable lengths: **2,105** with Ё preserved; **2,103** when folded to Е.
- Repeated answer groups in the raw file: **161**, with **184** extra raw records beyond one record per unique answer.
- Repeated answer groups in the playable-length subset: **159**, with **182** additional valid clue variants.
- Rejected by the current 2–11 letter range: **71** records — 32 one-letter answers and 39 twelve-letter answers.
- Empty answers, empty clues, and invalid answer characters: **0**.
- Exact duplicate answer/clue pairs: **0**.
- Ambiguous non-image clue texts shared by different answers: **0**.
- Answer leakage detected in clue/clueShort/question variants: **0** after the current content fixes.
- Picture records and distinct image keys: **46 / 46**.
- Records tagged as logic clues: **709**; distinct playable answers with a logic variant: **622**.
- Records with exactly 11 answer letters: **83**.
- Clues shorter than 15 characters: **266** review warnings; clues longer than 110 characters: **0**.

## Answer-length distribution

| Length | Raw records |
|---:|---:|
| 1 | 32 |
| 2 | 19 |
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

The source retains all records; the production engine only accepts 2–11 letter answers. Nothing was silently deleted.

## Duplicate and image handling

The source intentionally retains multiple clue variants for some answers. The runtime groups by normalized answer, retains valid clue variants for CSP selection, and enforces one use of each answer per generated board. The generic image prompt “Что изображено на картинке?” is allowed only with distinct image keys; the validator does not treat it as an ambiguous ordinary clue.

## Answer-leakage check

Both the CI data validator and the runtime dictionary validator check displayed `clue`, `clueShort`, and `question` variants for the normalized answer inside individual word tokens. For answers of three or more letters they catch inflected/compound leaks; for two-letter answers the runtime check requires an exact token to avoid broad substring false positives. This does not concatenate adjacent words. The nine affected clue records found during this audit were rewritten, and the СУД short clue was synchronized. Current source scan: **0 leaks**.

## Runtime normalization

- Ё remains distinct from Е by default.
- Folding Ё to Е is an explicit option, not an implicit mutation.
- All 46 picture assets have distinct image keys.
- The 83 eleven-letter records remain available for the optional special topology, subject to crossing and CSP constraints.

## Limits and outstanding work

- The separate scanword clue bank is **2,289 records**, not 25,000 or 50,000. The general Russian lexicons are larger, but words without verified definitions are not automatically converted into scanword/CodyCross clues.
- The dictionary audit cannot certify factual accuracy, ambiguity, or naturalness of every clue. The 266 short-clue warnings and semantic review remain open.
- The current topology still produces only 24–26 answer slots in its base masks; the 34+ meaningful-answer target is not met. See `docs/QQCROSS_TOPOLOGY_FEASIBILITY_BLOCKER.md`.
- No current-head CI result is available yet. Do not treat the code or data changes as fully verified until the current branch's dictionary, engine, seeded generator, and browser checks run successfully.
