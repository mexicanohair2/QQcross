# Kryss public-product research for QQCross

Research date: 2026-11-13

This document records observations from public Kryss pages and the public Google Play listing. It is a product/behavior study for an independently implemented QQCross generator. It does **not** claim access to Kryss's private mobile source code or private generation pipeline, and it does not copy Kryss code, assets, puzzle text, or answer data.

## Sources inspected

- Daily crossword home: https://kryss.app/
- Russian daily crossword home: https://kryss.app/ru
- Public crossword maker: https://kryss.app/maker
- Example daily puzzle: https://kryss.app/daily-crossword/2026-11-13
- Russian Google Play listing: https://play.google.com/store/apps/details?id=app.kryds.android&hl=ru&gl=RU
- Official rules article: https://kryss.app/blogpost/how-to-play-kryss-rules-scoring-tips
- FAQ: https://kryss.app/faq

## Confirmed observations

### 1. Kryss is two related but distinct products

**Mobile game (Android listing):**
- One shared scanword board per match.
- Players take turns; each turn gives five letters and a one-minute placement window.
- Placed letters remain on the shared board and are available to the opponent as crossings.
- The listing says bonuses are awarded for completed words, correctly placed key letters, and using all five letters in one turn.
- Listed play options: solo against the computer, random opponent, or a known friend.
- The listing advertises up to 20 simultaneous matches, chat, and turn notifications.
- The Android listing reports 12 supported languages, in-app purchases and ads; the public website reports 15 languages. Treat these as separate, time-sensitive product claims rather than assuming identical language coverage.

**Daily web puzzle:**
- A separate browser-playable daily puzzle, with an archive and a public print/share flow.
- Public page says the daily puzzle is released at 00:00 UTC.
- Solving times are kept locally in the browser/device; the page says only the first solve per day counts.
- A one-letter hint is described: it reveals one letter, not the whole answer.
- The web page exposes a list of clues grouped Across/Down in addition to the interactive grid.

Do not assume that the mobile match engine, daily web puzzle renderer, and authoring tool share one generator or one data model. Public evidence does not establish that.

### 2. Grid dimensions directly match QQCross

The public maker page says:
- Across default: **8**
- Down default: **12**
- Maximum: **40 × 40**
- Grid is created by dragging to create cells.
- Its product description advertises language and difficulty selection, text or picture clues, then play/share/print/embed.

This independently corroborates QQCross's agreed **8 columns × 12 rows = 96 cells** target. In the maker UI wording, “Across 8 / Down 12” means 8 columns and 12 rows, not 8 rows by 12 columns.

The maker page embeds an editor iframe from `https://crosswordtool-canvas.vercel.app/`. The iframe's public page describes itself as a crossword maker. The public evidence does not establish that this third-party editor is Kryss's proprietary mobile generator or that its code is the same as Kryss's code. Do not use its branding/code/assets in QQCross.

### 3. Scanword construction and clue presentation

Kryss describes its arrowword format as:
- Each clue is placed inside a cell of the grid.
- A direction arrow in the clue cell shows where the answer runs.
- Answers cross; solving one word provides letters for other words.
- Picture clues are answered by naming the depicted object.
- Clues are short and non-cryptic, intended to be solved quickly.

The sample Russian daily puzzle page inspected on 2026-11-13 lists 7 Across and 7 Down clue entries, including three picture clues. This is one example, not a global quota or fixed board specification.

The page also offers an auxiliary Across/Down clue list, but its own arrowword explanation emphasizes clue cells inside the grid. For QQCross, the in-grid clue cells and arrows should remain the primary interaction; an external list must not replace the agreed grid layout.

### 4. Public export and delivery surface

The daily page publicly exposes:
- Shareable puzzle page.
- PNG and PDF print variants.
- An iframe embed for the current daily puzzle.
- A dated archive of past daily puzzles.

The public print endpoint inspected for the sample puzzle returned a rendered board image rather than a machine-readable JSON puzzle record. Therefore, it is evidence of a print/export surface, not a usable source of the private generator or puzzle database.

## What QQCross should adopt

These are high-level product/quality principles, not copied implementation:

1. **Keep the agreed 8×12 board invariant.** Every complete generated board must contain exactly 96 cell records; dimensions must be explicit and never inferred from array length.
2. **Use clue cells as first-class grid records.** Each clue cell should carry one or more answer directions, answer-slot references, and clue content. Arrows must agree with the referenced slot geometry.
3. **Treat crossings as constraints.** Every shared letter must agree across all intersecting answers. Reject accidental runs, isolated letters, and malformed/one-letter filler answers.
4. **Separate clue types.** Text clues and picture clues need explicit types and validated payloads. Picture answers should be unique within a board and the picture must unambiguously depict the answer.
5. **Quality-gate clue language.** Prefer short, direct, unambiguous Russian definitions; reject answer leakage, duplicate clue text, near-duplicate clue/answer pairs, and generic filler.
6. **Add progressive hints, not answer reveals.** A hint should expose one validated letter at a time and must not mutate unrelated cells.
7. **Keep authoring, generation, validation, rendering, and export separate.** A grid that is geometrically complete is not automatically content-valid; an image export is not a substitute for the canonical structured puzzle record.
8. **Keep multiplayer mechanics separate from scanword generation.** Five-letter turn racks, one-minute turns, scoring, and opponent state belong to match logic; they must not distort the solo scanword generator.

## What not to copy or assume

- Do not copy Kryss's proprietary source, word lists, puzzle text, illustrations, logo, or visual assets.
- Do not infer that the public web maker iframe is the mobile app's generator.
- Do not infer the private board-generation algorithm from the rendered PNG/PDF output.
- Do not copy Kryss's ads, monetization, time pressure, or product economy into QQCross; QQCross's own product requirements take priority.
- Do not assume that a web feature is also available in the Android app, or vice versa.

## QQCross verification implications

The GitHub Actions run inspected during this research was run **43419703714**, on PR #29 at head `e1e337172e8092be7945c675e5e13c26f78fcd03`.

Observed results:
- Dictionary/lexicon build and audit steps completed successfully.
- Browser tests failed in both mobile and desktop Chromium.
- The live app exposed **72** `.scan-grid-cell` elements, while the 8×12 acceptance test expected **96**.
- The measured board width was **297 px**, while the viewport-width assertion required at least **351 px** (90% of a 390 px viewport).
- The reference-anchor test read **6 columns**, while the requirement is **8**.
- Each browser project reported 37 passing and 3 failing tests.

This confirms that the production/legacy UI is still on a 6×12 = 72-cell board in the tested path. The failures are not resolved by merely documenting Kryss's dimensions. Do not weaken the 8×12 assertions to make the run green; fix the production grid dimensions, layout sizing, and clue topology, then rerun the full mobile and desktop browser suites.

## Source-code search result and limits

A targeted public GitHub search for `app.kryds.android` and Kryss crossword source code did not reveal an official source repository. This is not proof that no private or unindexed repository exists. The Android APK/XAPK was not available for inspection in this session, and the TinyFish browser automation attempt could not start because its wallet balance was negative. Static public page extraction did confirm the maker defaults and its iframe target, but did not expose the interactive editor's full client-side behavior.

The correct next technical action is to continue QQCross's independent implementation from the explicit product observations above, not to pretend the original Kryss mobile source has been recovered.
