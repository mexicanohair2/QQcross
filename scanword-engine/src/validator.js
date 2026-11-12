import { CONFIG, DIRECTIONS } from './config.js';
import { assertGridDimensions, inBounds } from './grid.js';
import { normalizeAnswer } from './dictionary.js';
export function validateScanword(scanword, dictionary = []) {
  const errors = [], warnings = [];
  const add = (type, message, extra = {}) => errors.push({ type, message, ...extra });
  if (!scanword || scanword.width !== CONFIG.WIDTH || scanword.height !== CONFIG.HEIGHT) add('INVALID_DIMENSIONS', 'Размер должен быть строго 8×12.');
  if (!assertGridDimensions(scanword?.grid)) { add('INVALID_GRID_SHAPE', 'Сетка должна содержать 12 строк по 8 клеток.'); return { valid: false, errors, warnings }; }
  const grid = scanword.grid, words = Array.isArray(scanword.words) ? scanword.words : [], questions = Array.isArray(scanword.questions) ? scanword.questions : [];
  if (grid[0][0].type !== 'corner') add('CORNER_NOT_EMPTY', 'Клетка (0,0) должна быть пустым углом.', { row: 0, col: 0 });
  for (let c = 1; c < CONFIG.WIDTH; c++) if (grid[0][c].type !== 'question') add('TOP_ROW_NOT_QUESTION', 'Верхняя строка должна содержать вопросные клетки.', { row: 0, col: c });
  for (let r = 1; r < CONFIG.HEIGHT; r++) if (grid[r][0].type !== 'question') add('LEFT_COLUMN_NOT_QUESTION', 'Левый столбец должен содержать вопросные клетки.', { row: r, col: 0 });
  const dictById = new Map(dictionary.map(e => [e.id, e]));
  const wordIds = new Set();
  for (const w of words) {
    if (wordIds.has(w.id)) add('DUPLICATE_WORD_ID', 'Повторяется ID слова.', { wordId: w.id });
    wordIds.add(w.id);
    if (!DIRECTIONS[w.direction]) { add('INVALID_DIRECTION', 'Неизвестное направление.', { wordId: w.id }); continue; }
    if (normalizeAnswer(w.answer) !== w.answer) add('NON_NORMALIZED_ANSWER', 'Ответ не нормализован.', { wordId: w.id });
    if (w.coordinates?.length !== w.answer?.length) add('COORDINATE_COUNT_MISMATCH', 'Число координат не совпадает с длиной ответа.', { wordId: w.id });
    for (let i = 0; i < (w.coordinates ?? []).length; i++) {
      const p = w.coordinates[i];
      if (!inBounds(p.row, p.col)) { add('OUT_OF_BOUNDS', 'Координата вне сетки.', { wordId: w.id, ...p }); continue; }
      if (grid[p.row][p.col].letter !== w.answer[i]) add('LETTER_CONFLICT', 'Буква слова не совпадает с клеткой.', { wordId: w.id, ...p, expected: w.answer[i], actual: grid[p.row][p.col].letter });
    }
    if (dictionary.length && !dictById.has(w.entryId)) add('WORD_NOT_IN_DICTIONARY', 'Ответ отсутствует в переданной базе.', { wordId: w.id });
  }
  const questionIds = new Set(questions.map(q => q.id));
  for (const q of questions) if (!words.some(w => w.id === q.wordId)) add('QUESTION_WITHOUT_WORD', 'Вопрос не связан с ответом.', { questionId: q.id });
  for (let r = 0; r < CONFIG.HEIGHT; r++) for (let c = 0; c < CONFIG.WIDTH; c++) {
    const cell = grid[r][c];
    if (!cell || !['corner', 'question', 'letter'].includes(cell.type)) add('UNASSIGNED_CELL', 'Клетка не имеет допустимой роли.', { row: r, col: c });
    if (cell.type === 'letter' && (!cell.letter || !cell.wordIds?.length)) add('ORPHAN_LETTER_CELL', 'Буквенная клетка не принадлежит ни одному слову.', { row: r, col: c });
    if (cell.type === 'question' && !cell.questionIds?.length) add('QUESTION_CELL_WITHOUT_QUESTION', 'Вопросная клетка не содержит вопросов.', { row: r, col: c });
  }
  for (const q of questions) if (!questionIds.has(q.id)) add('QUESTION_ID_MISSING', 'Некорректный ID вопроса.', { questionId: q.id });
  const filledCells = grid.flat().filter(c => c.type !== 'unassigned').length;
  if (filledCells !== CONFIG.TOTAL_CELLS) add('INCOMPLETE_GRID', 'Не все 96 клеток получили роль.', { filledCells, totalCells: CONFIG.TOTAL_CELLS });
  return { valid: errors.length === 0, errors, warnings };
}