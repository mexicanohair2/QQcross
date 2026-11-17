# QQCross — полная проверка и исправление сканворда

Дата: 2026-11-17
Базовая ветка: `main`
Базовый commit: `981db4fa4629b0a076e7955a873831033b47d2c8`
Рабочая ветка: `work/kross-full-audit-20261117`

## Актуальные критерии приёмки

Последние прямые требования пользователя имеют приоритет над старыми тестами и устаревшими документами:

- Ни одной бессмысленной последовательности букв.
- Ни одного слова/ответа без своего зарегистрированного вопроса.
- Ни одной клетки-вопроса в крайнем правом столбце видимой сетки.
- Ни одного случайного или бесхозного filler-элемента.
- Игровая сетка использует 95% доступной ширины экрана и 85% доступной высоты; оставшееся пространство — верхняя игровая информация и нижние буквы/инструменты.
- Вся геометрия 8×12 = 96 клеток сохраняется; 4 направления, словарь, вопросы, подсказки, картинки и игровые интеграции не сокращаются ради упрощения.
- Никаких изменений Supabase schema/RLS/Auth/данных без отдельного согласования.

## Установленные исходные проблемы

1. `styles.css` последним override ограничивает доску 90vw и сохраняет широкое соотношение сторон 3:2, из-за чего поле занимает лишь небольшую долю высоты телефона.
2. `tests/qqcross.spec.js` закрепляет старое поведение: 12×8, ширину 85–91% и явное наличие вопроса в координате (0,11) видимой сетки. Этот тест не защищает новые требования.
3. `scanword-engine/src/topology-builder.js` не запрещает вопросные клетки на крайнем правом краю; текущие seed masks их содержат.
4. `scanword-engine/src/topology.js` и `validator.js` имеют ограниченные специальные исключения для краёв, но не моделируют полноценную правую границу без вопросных клеток.
5. `scanword-engine/src/legacy-adapter.js` поворачивает каноническую 8×12 сетку в 12×8; это меняет смысл краевых координат и создаёт вопросные клетки в правом видимом столбце.
6. `SCANWORD_REFERENCE.md` и master prompt содержат устаревшие утверждения о правых/верхних крайних вопросах и прежних размерах интерфейса.
7. Часть аудиторских документов описывает старый генератор в `app.js`; production уже использует `scanword-engine`. Исторические отчёты нужно явно пометить, а не выдавать за текущее состояние.

## Этапы

### A. Изоляция и базовый аудит
- Использовать отдельную ветку; `main` и опубликованный сайт не менять до прохождения проверок.
- Проверить актуальные workflow, тесты, generator → topology → CSP → assembler → independent validator → adapter → renderer.
- Зафиксировать текущие результаты CI и слабые места существующих проверок.

### B. Тесты сначала (RED)
Добавить проверки, которые должны упасть до исправления:
- canonical on-screen grid is 8 columns × 12 rows, all 96 positions explicitly represented;
- rightmost visible column has zero clue/question cells;
- every answer has exactly one real clue record and valid non-empty question text;
- no orphan letter, orphan clue, unregistered answer slot, filler or random-letter cell;
- every visible letter cell belongs to at least one validated answer;
- right-edge answer slots must start from a real clue and end at the board boundary;
- mobile and desktop geometry must satisfy 95% width / 85% height bounds without viewport overflow and leave the letter rack / tools usable.
Watch the current behavior fail for the expected contract violations before changing production code.

### C. Minimal generator/model fixes
- Enforce that the rightmost column of the canonical visible 8×12 board contains only answer letters, never question cells.
- Represent right-boundary answers as named, independently validated boundary answers. Each must have an in-grid clue cell, a real dictionary answer, a valid direction/path, correct crossings and explicit metadata.
- Reject one-letter right-edge runs and uncovered terminal cells; ensure all 96 cells have valid roles.
- Preserve all four directions, the special 11-letter answer and current picture/logic content constraints.
- Extend CSP, assembler, validator and adapter only where required; validator reconstructs the boundary slot independently.
- Restore the canonical, unrotated 8×12 presentation without breaking active-word selection, arrows, hints, answer-end markers, save/restore, online snapshots and ChatGPT turns.

### D. Responsive interface
- Give the actual board 95% of viewport width and 85% of viewport height.
- Keep score/progress above, letter rack and controls below, within the remaining interface space.
- Preserve mobile safe areas, readable clue text, cell usability, no horizontal/vertical page scroll.
- Verify 360×800, 390×844 and a desktop viewport through Playwright.

### E. Documentation and consistency
- Update `SCANWORD_REFERENCE.md`, `docs/QQCROSS_SCANWORD_ENGINE_MASTER_PROMPT.md`, engine README and this protocol where needed.
- Mark old audits/validation notes as historical when they refer to code no longer used.
- Ensure no active document contradicts the current 95%/85%, no-rightmost-clue contract.

### F. Regression verification
- Run engine tests, dictionary validation, syntax checks, first-gate seeded batches, 100-board stress batches, special 11-letter frequency, and Playwright desktop/mobile through GitHub Actions.
- Inspect detailed logs and artifacts, not status badges alone.
- Test solo start, clue popup, rack/drag, hint paths, save/restore, online match snapshot and non-scanword modes wherever they are touched.
- Do not modify Supabase; do not claim external systems checked unless current evidence supports it.

### G. Delivery
- Report changed files, commits, test counts, CI run URLs, any failures, known limitations and deployment status.
- Keep the branch isolated until all gates pass. Do not merge or publish partially verified code.

## Constraints and decision record

- The existing open PR #59 is not a safe implementation base: its draft changes reduce production directions to right/down and alter required image counts. Reuse only isolated ideas after checking them against current requirements.
- The user works from Android; validation should run remotely through GitHub Actions.
- If exact 95% width and 85% height cannot fit alongside the current interface without compromising board readability, keep the literal target and redesign/compress the surrounding UI; do not silently shrink the board or claim success based on a lower width threshold.