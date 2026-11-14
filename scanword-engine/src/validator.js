import { CONFIG, DIRECTIONS } from './config.js';
import { canonicalAnswerKey, normalizeAnswer, normalizeQuestion, prepareDictionary } from './dictionary.js';
import { assertGridDimensions, inBounds } from './grid.js';

function pointKey(point) {
  return point.row + ',' + point.col;
}

function samePoint(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function sortedUnique(values) {
  return [...new Set(Array.isArray(values) ? values : [])].sort();
}

function sameStringSet(actual, expected) {
  const a = sortedUnique(actual);
  const e = sortedUnique(expected);
  return a.length === e.length && a.every((value, index) => value === e[index]);
}

function slotKey(axis, first, last) {
  const a = pointKey(first);
  const b = pointKey(last);
  return axis + '|' + (a < b ? a + '|' + b : b + '|' + a);
}

function makeError(type, message, extra = {}) {
  return { type, message, ...extra };
}

/**
 * Independent full-board validator.
 *
 * It reconstructs cell ownership and answer geometry from the serialized
 * words/questions; it does not trust generator validity flags or placement
 * helper internals.
 */
export function validateScanword(scanword, dictionary = [], options = {}) {
  const errors = [];
  const warnings = [];
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const add = (type, message, extra) => errors.push(makeError(type, message, extra));

  if (!scanword || typeof scanword !== 'object') {
    return {
      valid: false,
      errors: [makeError('INVALID_SCANWORD', 'Передана пустая или некорректная сетка.')],
      warnings,
      metrics: { totalCells: 0, words: 0, questions: 0, letters: 0, crossings: 0 }
    };
  }

  if (scanword.width !== CONFIG.WIDTH || scanword.height !== CONFIG.HEIGHT) {
    add('INVALID_DIMENSIONS', 'Размер должен быть строго 8×12.', {
      expected: { width: CONFIG.WIDTH, height: CONFIG.HEIGHT },
      actual: { width: scanword.width, height: scanword.height }
    });
  }

  if (!assertGridDimensions(scanword.grid)) {
    add('INVALID_GRID_SHAPE', 'Сетка должна содержать 12 строк по 8 клеток.');
    return {
      valid: false,
      errors,
      warnings,
      metrics: { totalCells: 0, words: 0, questions: 0, letters: 0, crossings: 0 }
    };
  }

  const grid = scanword.grid;
  const words = Array.isArray(scanword.words) ? scanword.words : [];
  const questions = Array.isArray(scanword.questions) ? scanword.questions : [];
  const prepared = prepareDictionary(dictionary, { foldYo: options.foldYo === true });
  warnings.push(...prepared.warnings);
  const dictionaryById = new Map(prepared.variants.map(entry => [entry.id, entry]));

  if (grid[0][0]?.type !== 'corner') {
    add('CORNER_NOT_EMPTY', 'Клетка (0,0) должна быть единственным пустым углом.', { row: 0, col: 0 });
  }

  if (options.requireTopAnchor !== false && grid[0][1]?.type !== 'question') {
    add('TOP_LEFT_BORDER_ANCHOR_MISSING', 'Клетка (0,1) должна быть вопросной.', { row: 0, col: 1 });
  }
  const requireLeftBorderClues = options.requireLeftBorderClues
    ?? (options.requireBorderClues !== false);
  if (requireLeftBorderClues) {
    for (let row = 1; row < CONFIG.HEIGHT; row++) {
      if (grid[row][0]?.type !== 'question') {
        add('LEFT_COLUMN_NOT_QUESTION', 'Левый столбец должен содержать вопросные клетки, кроме угла.', { row, col: 0 });
      }
    }
  }
  // Top-row question placement is deliberately dynamic. Any non-question
  // cell must still be covered by a reconstructed answer slot below.

  let questionCells = 0;
  let letterCells = 0;
  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      if (!cell || !['corner', 'question', 'letter'].includes(cell.type)) {
        add('UNASSIGNED_CELL', 'Каждая клетка должна быть углом, вопросом или буквой.', {
          row, col, actual: cell?.type ?? null
        });
        continue;
      }

      if (cell.type === 'corner') {
        if (row !== 0 || col !== 0) {
          add('EXTRA_CORNER', 'Пустой угол разрешён только в (0,0).', { row, col });
        }
        if (cell.letter != null || (cell.questionIds?.length ?? 0) || (cell.wordIds?.length ?? 0)) {
          add('CORNER_HAS_CONTENT', 'Пустой угол не может содержать букву, вопрос или слово.', { row, col });
        }
      } else if (cell.type === 'question') {
        questionCells++;
        if (cell.letter != null) add('QUESTION_HAS_LETTER', 'Вопросная клетка не может одновременно быть буквенной.', { row, col });
      } else if (cell.type === 'letter') {
        letterCells++;
        if (typeof cell.letter !== 'string' || !/^[А-ЯЁ]$/u.test(cell.letter)) {
          add('INVALID_LETTER', 'Буквенная клетка должна содержать одну русскую заглавную букву.', {
            row, col, actual: cell.letter ?? null
          });
        }
      }
    }
  }

  const wordById = new Map();
  const answerOwners = new Map();
  const clueDirectionUse = new Map();
  const expectedWordIds = new Map();
  const expectedLetters = new Map();
  const questionRecordsByWord = new Map();
  const terminalQuestionKeys = new Set();
  const registeredNormalSlots = new Set();
  let specialCount = 0;
  const leftBoundaryRows = new Set();

  for (const word of words) {
    if (!word || typeof word !== 'object' || !word.id) {
      add('INVALID_WORD_RECORD', 'У каждого ответа должен быть стабильный ID.');
      continue;
    }
    if (wordById.has(word.id)) {
      add('DUPLICATE_WORD_ID', 'Повторяется ID слова.', { wordId: word.id });
      continue;
    }
    wordById.set(word.id, word);

    const answer = normalizeAnswer(word.answer, { foldYo: options.foldYo === true });
    if (answer !== word.answer) {
      add('NON_NORMALIZED_ANSWER', 'Ответ должен быть нормализован до заглавных русских букв.', {
        wordId: word.id, expected: answer, actual: word.answer
      });
    }
    if (!String(word.question ?? '').trim()) {
      add('EMPTY_WORD_QUESTION', 'У каждого ответа должен быть непустой текст вопроса.', { wordId: word.id });
    }
    if (answer.length < 2 || answer.length > CONFIG.MAX_WORD_LENGTH) {
      add('ANSWER_LENGTH_OUT_OF_RANGE', 'Длина ответа должна быть от 2 до 11 букв.', {
        wordId: word.id, length: answer.length
      });
    }
    const allowedShortAnswers = new Set((options.allowedShortAnswers ?? [
      'ЁЖ', 'ЯД', 'УМ', 'ЮГ', 'АС', 'УС', 'ДО', 'РЕ', 'МИ', 'ФА', 'ЛЯ', 'СИ'
    ]).map(canonicalAnswerKey));
    if (answer.length === 2 && !allowedShortAnswers.has(canonicalAnswerKey(answer))) {
      add('UNAPPROVED_SHORT_ANSWER', 'Двухбуквенный ответ входит в утверждённый список коротких русских слов.', {
        wordId: word.id,
        answer,
        imageKey: word.imageKey ?? null
      });
    }
    if (word.length !== answer.length) {
      add('WORD_LENGTH_MISMATCH', 'Заявленная длина не совпадает с длиной ответа.', {
        wordId: word.id, expected: answer.length, actual: word.length
      });
    }
    const answerKey = canonicalAnswerKey(answer);
    if (answerOwners.has(answerKey)) {
      add('DUPLICATE_ANSWER', 'Один ответ нельзя использовать дважды в одном сканворде (включая варианты Е/Ё).', {
        wordId: word.id, otherWordId: answerOwners.get(answerKey), answer
      });
    } else {
      answerOwners.set(answerKey, word.id);
    }

    const vector = DIRECTIONS[word.direction];
    if (!vector) {
      add('INVALID_DIRECTION', 'Неизвестное направление ответа.', {
        wordId: word.id, direction: word.direction
      });
      continue;
    }

    const clue = word.clue;
    if (!inBounds(clue?.row, clue?.col)) {
      add('INVALID_CLUE_COORDINATE', 'Координата вопросной клетки находится вне поля.', {
        wordId: word.id, clue: clue ?? null
      });
      continue;
    }
    if (grid[clue.row][clue.col]?.type !== 'question') {
      add('WORD_START_NOT_QUESTION', 'Ответ должен начинаться из вопросной клетки.', {
        wordId: word.id, row: clue.row, col: clue.col
      });
    }

    const directionKey = pointKey(clue) + '|' + word.direction;
    if (clueDirectionUse.has(directionKey)) {
      add('DUPLICATE_CLUE_DIRECTION', 'Одна вопросная клетка не может иметь два ответа в одном направлении.', {
        wordId: word.id, otherWordId: clueDirectionUse.get(directionKey), row: clue.row, col: clue.col, direction: word.direction
      });
    } else {
      clueDirectionUse.set(directionKey, word.id);
    }

    if (!Array.isArray(word.coordinates) || word.coordinates.length !== answer.length) {
      add('COORDINATE_COUNT_MISMATCH', 'Число координат не совпадает с длиной ответа.', {
        wordId: word.id, expected: answer.length, actual: word.coordinates?.length ?? null
      });
      continue;
    }

    for (let index = 0; index < word.coordinates.length; index++) {
      const coordinate = word.coordinates[index];
      const expectedRow = clue.row + vector.dr * (index + 1);
      const expectedCol = clue.col + vector.dc * (index + 1);

      if (!inBounds(coordinate?.row, coordinate?.col)) {
        add('OUT_OF_BOUNDS', 'Буква ответа находится вне сетки.', {
          wordId: word.id, index, coordinate: coordinate ?? null
        });
        continue;
      }
      if (coordinate.row !== expectedRow || coordinate.col !== expectedCol) {
        add('NON_CONTIGUOUS_WORD', 'Координаты ответа не совпадают с направлением и порядком букв.', {
          wordId: word.id, index,
          expected: { row: expectedRow, col: expectedCol },
          actual: coordinate
        });
      }

      const key = pointKey(coordinate);
      const cell = grid[coordinate.row][coordinate.col];
      if (cell.type !== 'letter') {
        add('WORD_CROSSES_NON_LETTER', 'Ответ пересекает вопросную клетку или пустой угол.', {
          wordId: word.id, row: coordinate.row, col: coordinate.col, cellType: cell.type
        });
      }
      if (cell.letter !== answer[index]) {
        add('LETTER_CONFLICT', 'Буква ответа не совпадает с буквенной клеткой.', {
          wordId: word.id, row: coordinate.row, col: coordinate.col,
          expected: answer[index], actual: cell.letter ?? null
        });
      }

      if (!expectedWordIds.has(key)) expectedWordIds.set(key, new Set());
      expectedWordIds.get(key).add(word.id);

      const previousLetter = expectedLetters.get(key);
      if (previousLetter !== undefined && previousLetter !== answer[index]) {
        add('CROSSING_LETTER_CONFLICT', 'Пересекающиеся ответы содержат разные буквы.', {
          wordId: word.id, row: coordinate.row, col: coordinate.col,
          expected: previousLetter, actual: answer[index]
        });
      } else {
        expectedLetters.set(key, answer[index]);
      }
    }

    const terminal = {
      row: clue.row + vector.dr * (answer.length + 1),
      col: clue.col + vector.dc * (answer.length + 1)
    };

    if (word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') {
      specialCount++;
      const exactCoordinates = word.coordinates.every((coordinate, index) =>
        coordinate.row === index + 1 && coordinate.col === 1
      );
      if (
        answer.length !== 11
        || clue.row !== 0
        || clue.col !== 1
        || word.direction !== 'down'
        || !exactCoordinates
        || terminal.row !== CONFIG.HEIGHT
        || terminal.col !== 1
      ) {
        add('INVALID_SPECIAL_BOUNDARY_WORD', 'Исключение допускается только для ответа из 11 букв вниз из (0,1) до нижней границы.', {
          wordId: word.id, answer, clue, direction: word.direction, terminal
        });
      }
    } else if (word.special === 'LEFT_BORDER_RIGHT_BOUNDARY') {
      const exactCoordinates = word.coordinates.every((coordinate, index) =>
        coordinate.row === clue.row && coordinate.col === index + 1
      );
      const validException = options.allowLeftBorderRightBoundary === true
        && answer.length === CONFIG.WIDTH - 1
        && [1, 2].includes(clue.row)
        && clue.col === 0
        && word.direction === 'right'
        && exactCoordinates
        && terminal.row === clue.row
        && terminal.col === CONFIG.WIDTH;
      if (!validException) {
        add('INVALID_LEFT_BORDER_BOUNDARY_WORD', 'Исключение правой границы разрешено только по явному параметру для ответов из 7 букв от (1,0) или (2,0) вправо.', {
          wordId: word.id, answer, clue, direction: word.direction, terminal,
          enabled: options.allowLeftBorderRightBoundary === true
        });
      } else if (leftBoundaryRows.has(clue.row)) {
        add('DUPLICATE_LEFT_BORDER_BOUNDARY_ROW', 'В одной строке нельзя использовать два ответа левого граничного исключения.', {
          wordId: word.id, row: clue.row
        });
      } else {
        leftBoundaryRows.add(clue.row);
      }
    } else {
      if (word.special != null) {
        add('UNKNOWN_SPECIAL_RULE', 'Указан неизвестный тип специального ответа.', {
          wordId: word.id, special: word.special
        });
      }
      if (!inBounds(terminal.row, terminal.col)) {
        add('ORDINARY_WORD_ENDS_AT_BOUNDARY', 'Обычный ответ обязан завершаться вопросной клеткой внутри поля.', {
          wordId: word.id, terminal
        });
      } else if (grid[terminal.row][terminal.col]?.type !== 'question') {
        add('MISSING_TERMINAL_QUESTION', 'После последней буквы ответа должна находиться вопросная клетка.', {
          wordId: word.id, terminal
        });
      } else {
        terminalQuestionKeys.add(pointKey(terminal));
        const first = { row: clue.row, col: clue.col };
        const last = terminal;
        const axis = vector.dr === 0 ? 'horizontal' : 'vertical';
        registeredNormalSlots.add(slotKey(axis, first, last));
      }
    }

    if (dictionary.length) {
      const entry = dictionaryById.get(word.entryId);
      if (!entry) {
        add('WORD_NOT_IN_DICTIONARY', 'Ответ отсутствует в проверенной базе словаря.', {
          wordId: word.id, entryId: word.entryId ?? null
        });
      } else {
        if (entry.answer !== answer) {
          add('DICTIONARY_ANSWER_MISMATCH', 'Ответ не совпадает с записью словаря.', {
            wordId: word.id, expected: entry.answer, actual: answer
          });
        }
        if (word.question !== entry.question) {
          add('DICTIONARY_QUESTION_MISMATCH', 'Вопрос не совпадает с записью словаря.', {
            wordId: word.id, expected: entry.question, actual: word.question
          });
        }
        if ((word.imageKey ?? null) !== (entry.imageKey ?? null)) {
          add('IMAGE_METADATA_MISMATCH', 'Ключ картинки не совпадает с записью словаря.', {
            wordId: word.id, expected: entry.imageKey ?? null, actual: word.imageKey ?? null
          });
        }
        if (Boolean(word.logic) !== (entry.logic === true)) {
          add('LOGIC_METADATA_MISMATCH', 'Метка логического вопроса не совпадает с проверенной записью словаря.', {
            wordId: word.id, expected: entry.logic === true, actual: Boolean(word.logic)
          });
        }
      }
    }
  }

  if (specialCount > 1) {
    add('MULTIPLE_SPECIAL_BOUNDARY_WORDS', 'На одном поле допускается не более одного специального ответа из 11 букв.', {
      count: specialCount
    });
  }
  if (leftBoundaryRows.size > 2) {
    add('TOO_MANY_LEFT_BORDER_BOUNDARY_WORDS', 'Допускается не более двух ответов левого граничного исключения.', {
      rows: [...leftBoundaryRows]
    });
  }
  if (options.allowLeftBorderRightBoundary === true
    && options.requireBorderClues !== false
    && (leftBoundaryRows.size !== 2 || !leftBoundaryRows.has(1) || !leftBoundaryRows.has(2))) {
    add('INCOMPLETE_LEFT_BORDER_BOUNDARY_EXCEPTIONS', 'При включённом исключении должны быть закрыты оба обязательных вопроса левого края: строки 1 и 2.', {
      rows: [...leftBoundaryRows].sort((a, b) => a - b)
    });
  }

  const questionById = new Map();
  const questionIdsByCell = new Map();
  const normalizedQuestionOwners = new Map();
  for (const question of questions) {
    if (!question?.id || questionById.has(question.id)) {
      add('DUPLICATE_OR_MISSING_QUESTION_ID', 'У каждого вопроса должен быть уникальный ID.', {
        questionId: question?.id ?? null
      });
      continue;
    }
    questionById.set(question.id, question);

    const word = wordById.get(question.wordId);
    const normalizedText = normalizeQuestion(question.text);
    if (!normalizedText) {
      add('EMPTY_QUESTION_TEXT', 'Текст вопроса не может быть пустым.', { questionId: question.id });
    } else {
      const previous = normalizedQuestionOwners.get(normalizedText);
      if (previous && previous.wordId !== question.wordId) {
        const sharedPicturePrompt = Boolean(
          previous.imageKey
          && word?.imageKey
          && previous.imageKey !== word.imageKey
          && /изображено на картинке|показано на картинке/u.test(normalizedText)
        );
        if (!sharedPicturePrompt) {
          add('DUPLICATE_QUESTION_TEXT', 'Одинаковый нормализованный текст вопроса нельзя использовать для разных ответов.', {
            questionId: question.id,
            otherQuestionId: previous.questionId,
            wordId: question.wordId,
            otherWordId: previous.wordId
          });
        }
      } else if (!previous) {
        normalizedQuestionOwners.set(normalizedText, {
          questionId: question.id,
          wordId: question.wordId,
          imageKey: word?.imageKey ?? null
        });
      }
    }
    if (!word) {
      add('QUESTION_WITHOUT_WORD', 'Вопрос не связан с существующим ответом.', {
        questionId: question.id, wordId: question.wordId ?? null
      });
      continue;
    }

    if (!samePoint(question.clue, word.clue)) {
      add('QUESTION_CLUE_COORDINATE_MISMATCH', 'Вопрос привязан не к той клетке, что его ответ.', {
        questionId: question.id, wordId: word.id, expected: word.clue, actual: question.clue
      });
    }
    if (question.direction !== word.direction || question.length !== word.length || question.text !== word.question) {
      add('QUESTION_WORD_METADATA_MISMATCH', 'Текст, направление или длина вопроса не совпадают с ответом.', {
        questionId: question.id, wordId: word.id
      });
    }

    if (!questionRecordsByWord.has(word.id)) questionRecordsByWord.set(word.id, []);
    questionRecordsByWord.get(word.id).push(question.id);

    const key = pointKey(word.clue);
    if (!questionIdsByCell.has(key)) questionIdsByCell.set(key, new Set());
    questionIdsByCell.get(key).add(question.id);
  }

  for (const word of words) {
    const linked = questionRecordsByWord.get(word.id) ?? [];
    if (linked.length !== 1) {
      add('WORD_QUESTION_LINK_COUNT', 'Каждый ответ должен иметь ровно один вопрос.', {
        wordId: word.id, questionIds: linked
      });
    }
  }

  // Reconstruct every geometric run between consecutive question cells.
  // Each run with at least two letters must map to exactly one registered word.
  const discoveredSlots = new Set();
  function inspectLine(axis, fixedIndex) {
    const horizontal = axis === 'horizontal';
    const lineLength = horizontal ? CONFIG.WIDTH : CONFIG.HEIGHT;
    const positions = [];
    for (let offset = 0; offset < lineLength; offset++) {
      const row = horizontal ? fixedIndex : offset;
      const col = horizontal ? offset : fixedIndex;
      if (grid[row][col]?.type === 'question') positions.push(offset);
    }

    for (let index = 0; index < positions.length - 1; index++) {
      const start = positions[index];
      const end = positions[index + 1];
      const length = end - start - 1;
      if (length < 2) continue;

      const first = horizontal ? { row: fixedIndex, col: start } : { row: start, col: fixedIndex };
      const last = horizontal ? { row: fixedIndex, col: end } : { row: end, col: fixedIndex };
      const key = slotKey(axis, first, last);
      const matches = words.filter(word => {
        if (
          !word
          || typeof word.answer !== 'string'
          || !word.clue
          || word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
          || word.special === 'LEFT_BORDER_RIGHT_BOUNDARY'
        ) return false;
        if (!samePoint(word.clue, first) && !samePoint(word.clue, last)) return false;
        const vector = DIRECTIONS[word.direction];
        if (!vector) return false;
        const expectedTerminal = {
          row: word.clue.row + vector.dr * (word.answer.length + 1),
          col: word.clue.col + vector.dc * (word.answer.length + 1)
        };
        return samePoint(expectedTerminal, samePoint(word.clue, first) ? last : first)
          && word.answer.length === length;
      });

      if (matches.length !== 1) {
        add(
          matches.length === 0 ? 'UNREGISTERED_ANSWER_SLOT' : 'DUPLICATE_ANSWER_SLOT',
          matches.length === 0
            ? 'Между вопросными клетками найден ответный слот без зарегистрированного слова.'
            : 'Один геометрический слот назначен нескольким ответам.',
          { axis, first, last, length, wordIds: matches.map(word => word.id) }
        );
      } else {
        discoveredSlots.add(key);
      }
    }
  }

  for (let row = 0; row < CONFIG.HEIGHT; row++) inspectLine('horizontal', row);
  for (let col = 0; col < CONFIG.WIDTH; col++) inspectLine('vertical', col);

  for (const word of words) {
    if (word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
      || word.special === 'LEFT_BORDER_RIGHT_BOUNDARY') continue;
    const vector = DIRECTIONS[word.direction];
    if (!vector || !word.clue) continue;
    const terminal = {
      row: word.clue.row + vector.dr * (word.answer.length + 1),
      col: word.clue.col + vector.dc * (word.answer.length + 1)
    };
    const axis = vector.dr === 0 ? 'horizontal' : 'vertical';
    const key = slotKey(axis, word.clue, terminal);
    if (!discoveredSlots.has(key)) {
      add('WORD_WITHOUT_GEOMETRIC_SLOT', 'Ответ не совпадает ни с одним независимо восстановленным слотом.', {
        wordId: word.id, slotKey: key
      });
    }
  }

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      const key = row + ',' + col;

      if (cell?.type === 'letter') {
        const expected = expectedWordIds.get(key) ?? new Set();
        if (expected.size === 0) {
          add('ORPHAN_LETTER_CELL', 'Буквенная клетка не принадлежит ни одному ответу.', {
            row, col, letter: cell.letter ?? null
          });
        }
        if (!sameStringSet(cell.wordIds, [...expected])) {
          add('LETTER_WORD_REFERENCES_MISMATCH', 'Список слов буквенной клетки не совпадает с независимо восстановленными пересечениями.', {
            row, col, expected: [...expected].sort(), actual: sortedUnique(cell.wordIds)
          });
        }
        if ((cell.questionIds?.length ?? 0) > 0) {
          add('LETTER_HAS_QUESTION_REFERENCES', 'Буквенная клетка не может содержать ссылки на вопросы.', {
            row, col, actual: cell.questionIds
          });
        }
        const expectedLetter = expectedLetters.get(key);
        if (expectedLetter !== undefined && cell.letter !== expectedLetter) {
          add('CELL_LETTER_MISMATCH', 'Содержимое клетки не совпадает с пересекающимися ответами.', {
            row, col, expected: expectedLetter, actual: cell.letter
          });
        }
      }

      if (cell?.type === 'question') {
        const expected = questionIdsByCell.get(key) ?? new Set();
        if (expected.size === 0 && !terminalQuestionKeys.has(key)) {
          add('QUESTION_CELL_WITHOUT_QUESTION', 'Вопросная клетка не является ни началом ответа, ни его корректным конечным ограничителем.', { row, col });
        }
        if (!sameStringSet(cell.questionIds, [...expected])) {
          add('QUESTION_REFERENCES_MISMATCH', 'Список вопросов в клетке не совпадает с вопросными записями.', {
            row, col, expected: [...expected].sort(), actual: sortedUnique(cell.questionIds)
          });
        }
        if ((cell.wordIds?.length ?? 0) > 0) {
          add('QUESTION_HAS_WORD_REFERENCES', 'В вопросной клетке не должно быть ссылок на буквенные вхождения.', {
            row, col, actual: cell.wordIds
          });
        }
      }
    }
  }

  if (options.requireConnected !== false && words.length > 1) {
    const adjacency = new Map(words.map(word => [word.id, new Set()]));
    const ownersByLetter = new Map();

    for (const word of words) {
      for (const coordinate of word.coordinates ?? []) {
        const key = pointKey(coordinate);
        if (!ownersByLetter.has(key)) ownersByLetter.set(key, []);
        ownersByLetter.get(key).push(word.id);
      }
    }

    for (const owners of ownersByLetter.values()) {
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          adjacency.get(owners[i])?.add(owners[j]);
          adjacency.get(owners[j])?.add(owners[i]);
        }
      }
    }

    // A question cell is a shared junction whether a word starts there,
    // ends there, or several words terminate there. The topology validator
    // treats all endpoint pairs symmetrically, so the independent word-graph
    // validator must do the same instead of connecting only terminal→start.
    const ownersByQuestionCell = new Map();
    for (const word of words) {
      const endpoints = [word.clue];
      if (word.special !== 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
        && word.special !== 'LEFT_BORDER_RIGHT_BOUNDARY') {
        const vector = DIRECTIONS[word.direction];
        if (vector) {
          endpoints.push({
            row: word.clue.row + vector.dr * (word.answer.length + 1),
            col: word.clue.col + vector.dc * (word.answer.length + 1)
          });
        }
      }
      for (const endpoint of endpoints) {
        if (!inBounds(endpoint?.row, endpoint?.col)) continue;
        const key = pointKey(endpoint);
        if (!ownersByQuestionCell.has(key)) ownersByQuestionCell.set(key, new Set());
        ownersByQuestionCell.get(key).add(word.id);
      }
    }
    for (const owners of ownersByQuestionCell.values()) {
      const ids = [...owners];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          adjacency.get(ids[i])?.add(ids[j]);
          adjacency.get(ids[j])?.add(ids[i]);
        }
      }
    }

    const firstId = words[0]?.id;
    const reached = new Set(firstId ? [firstId] : []);
    const queue = firstId ? [firstId] : [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const next of adjacency.get(queue[cursor]) ?? []) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }

    if (reached.size !== words.length) {
      add('DISCONNECTED_WORD_GRAPH', 'Все ответы должны образовывать одну связанную структуру.', {
        connectedWords: reached.size,
        totalWords: words.length,
        disconnectedWordIds: words.filter(word => !reached.has(word.id)).map(word => word.id)
      });
    }
  }

  const imageWords = words.filter(word => word.imageKey);
  const imageKeys = imageWords.map(word => word.imageKey);
  if (imageWords.length !== requiredImageCount) {
    add('IMAGE_COUNT_MISMATCH', 'Количество картинок не совпадает с обязательным значением.', {
      expected: requiredImageCount, actual: imageWords.length
    });
  }
  if (new Set(imageKeys).size !== imageKeys.length) {
    add('DUPLICATE_IMAGE_KEY', 'Одно изображение использовано более одного раза.', { imageKeys });
  }

  {
    const count = new Set(words.filter(word => word.logic).map(word => pointKey(word.clue))).size;
    if (count < minimumLogicClueCells) {
      add('INSUFFICIENT_LOGIC_CLUES', 'Недостаточно отдельных логических вопросных клеток.', {
        expected: minimumLogicClueCells, actual: count
      });
    }
  }

  const crossings = [...expectedWordIds.values()].filter(ids => ids.size > 1).length;
  const filledCells = grid.flat().filter(cell => ['corner', 'question', 'letter'].includes(cell?.type)).length;

  if (filledCells !== CONFIG.TOTAL_CELLS) {
    add('INCOMPLETE_GRID', 'Не все 96 клеток получили корректную роль.', {
      filledCells, totalCells: CONFIG.TOTAL_CELLS
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      filledCells,
      words: words.length,
      questions: questions.length,
      questionCells,
      letters: letterCells,
      crossings,
      imageCount: imageWords.length,
      logicClueCells: new Set(words.filter(word => word.logic).map(word => pointKey(word.clue))).size,
      specialElevenLetterWords: specialCount,
      registeredNormalSlots: registeredNormalSlots.size,
      reconstructedSlots: discoveredSlots.size
    }
  };
}
