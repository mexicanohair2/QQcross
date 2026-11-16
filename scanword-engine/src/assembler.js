import { CONFIG, DIRECTIONS } from './config.js';
import { createEmptyGrid, inBounds } from './grid.js';
import { normalizeAnswer } from './dictionary.js';

function keyOf(point) {
  return point.row + ',' + point.col;
}

/**
 * Converts CSP assignments into the canonical grid/question/word structure.
 * This function assembles roles and references only; the independent validator
 * must still certify all 96 cells before a result can enter gameplay.
 */
export function assembleScanword(assignments, options = {}) {
  const errors = [];
  const grid = createEmptyGrid();
  const words = Array.isArray(assignments?.words) ? assignments.words.map(word => ({ ...word })) : [];
  const suppliedQuestions = Array.isArray(assignments?.questions) ? assignments.questions : [];
  const questionByWord = new Map(suppliedQuestions.map(question => [question.wordId, question]));
  const questions = [];
  const seenWordIds = new Set();
  const seenQuestionIds = new Set();
  const letterOwners = new Map();

  const fail = (type, message, extra = {}) => errors.push({ type, message, ...extra });

  function markQuestion(point, questionId = null) {
    if (!inBounds(point?.row, point?.col)) {
      fail('QUESTION_OUT_OF_BOUNDS', 'Вопросная клетка находится вне поля.', { point });
      return;
    }
    const cell = grid[point.row][point.col];
    if (cell.type === 'corner' || cell.type === 'letter') {
      fail('QUESTION_ROLE_CONFLICT', 'Вопросная клетка конфликтует с углом или буквой.', {
        row: point.row, col: point.col, existingType: cell.type
      });
      return;
    }
    cell.type = 'question';
    if (questionId && !cell.questionIds.includes(questionId)) cell.questionIds.push(questionId);
  }

  for (const sourceWord of words) {
    if (!sourceWord?.id || seenWordIds.has(sourceWord.id)) {
      fail('DUPLICATE_OR_MISSING_WORD_ID', 'У каждого слова должен быть уникальный ID.', {
        wordId: sourceWord?.id ?? null
      });
      continue;
    }
    seenWordIds.add(sourceWord.id);

    const answer = normalizeAnswer(sourceWord.answer, { foldYo: options.foldYo === true });
    const vector = DIRECTIONS[sourceWord.direction];
    const clue = sourceWord.clue;
    if (!vector || !inBounds(clue?.row, clue?.col) || answer.length < 2 || answer.length > CONFIG.MAX_WORD_LENGTH) {
      fail('INVALID_WORD_GEOMETRY', 'Ответ имеет некорректное направление, вопрос или длину.', {
        wordId: sourceWord.id, direction: sourceWord.direction, clue, length: answer.length
      });
      continue;
    }
    if (!Array.isArray(sourceWord.coordinates) || sourceWord.coordinates.length !== answer.length) {
      fail('INVALID_WORD_COORDINATES', 'Количество координат не совпадает с длиной ответа.', {
        wordId: sourceWord.id
      });
      continue;
    }

    const supplied = questionByWord.get(sourceWord.id);
    const questionId = supplied?.id ?? 'q_' + sourceWord.id;
    const questionText = String(sourceWord.question ?? supplied?.text ?? '').trim();
    if (!questionText) {
      fail('EMPTY_QUESTION_TEXT', 'У ответа отсутствует текст вопроса.', { wordId: sourceWord.id });
      continue;
    }
    if (seenQuestionIds.has(questionId)) {
      fail('DUPLICATE_QUESTION_ID', 'Повторяется ID вопроса.', { questionId });
      continue;
    }
    seenQuestionIds.add(questionId);

    markQuestion(clue, questionId);

    let geometryValid = true;
    for (let index = 0; index < answer.length; index++) {
      const point = sourceWord.coordinates[index];
      const expected = {
        row: clue.row + vector.dr * (index + 1),
        col: clue.col + vector.dc * (index + 1)
      };
      if (
        !inBounds(point?.row, point?.col)
        || point.row !== expected.row
        || point.col !== expected.col
      ) {
        fail('NON_CONTIGUOUS_WORD', 'Координаты ответа не соответствуют направлению.', {
          wordId: sourceWord.id, index, expected, actual: point ?? null
        });
        geometryValid = false;
        break;
      }
    }
    if (!geometryValid) continue;

    for (let index = 0; index < answer.length; index++) {
      const point = sourceWord.coordinates[index];
      const cell = grid[point.row][point.col];
      if (cell.type === 'corner' || cell.type === 'question') {
        fail('LETTER_ROLE_CONFLICT', 'Буква ответа конфликтует с вопросной клеткой.', {
          wordId: sourceWord.id, row: point.row, col: point.col, existingType: cell.type
        });
        continue;
      }
      const previous = cell.letter;
      if (previous && previous !== answer[index]) {
        fail('CROSSING_LETTER_CONFLICT', 'Пересекающиеся ответы дают разные буквы.', {
          wordId: sourceWord.id, row: point.row, col: point.col,
          previous, actual: answer[index]
        });
        continue;
      }
      cell.type = 'letter';
      cell.letter = answer[index];
      if (!cell.wordIds.includes(sourceWord.id)) cell.wordIds.push(sourceWord.id);
      const key = keyOf(point);
      if (!letterOwners.has(key)) letterOwners.set(key, new Set());
      letterOwners.get(key).add(sourceWord.id);
    }

    const terminal = {
      row: clue.row + vector.dr * (answer.length + 1),
      col: clue.col + vector.dc * (answer.length + 1)
    };
    if (sourceWord.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') {
      const exactCoordinates = sourceWord.coordinates.every((point, index) =>
        point.row === index + 1 && point.col === 1
      );
      if (
        answer.length !== 11
        || clue.row !== 0
        || clue.col !== 1
        || sourceWord.direction !== 'down'
        || !exactCoordinates
        || terminal.row !== CONFIG.HEIGHT
        || terminal.col !== 1
      ) {
        fail('INVALID_SPECIAL_BOUNDARY_WORD', 'Неверная геометрия специального ответа из 11 букв.', {
          wordId: sourceWord.id, terminal
        });
      }
    } else if (sourceWord.special === 'LEFT_BORDER_RIGHT_BOUNDARY') {
      const exactCoordinates = sourceWord.coordinates.every((point, index) =>
        point.row === clue.row && point.col === index + 1
      );
      const enabled = options.allowLeftBorderRightBoundary === true;
      if (
        !enabled
        || answer.length !== CONFIG.WIDTH - 1
        || ![1, 2].includes(clue.row)
        || clue.col !== 0
        || sourceWord.direction !== 'right'
        || !exactCoordinates
        || terminal.row !== clue.row
        || terminal.col !== CONFIG.WIDTH
      ) {
        fail('INVALID_SPECIAL_BOUNDARY_WORD', 'Исключение левой границы разрешено только для строк 1 и 2, вправо на всю ширину поля.', {
          wordId: sourceWord.id, terminal, enabled
        });
      }
    } else {
      if (sourceWord.special != null) {
        fail('UNKNOWN_SPECIAL_RULE', 'Указан неизвестный тип специального ответа.', {
          wordId: sourceWord.id, special: sourceWord.special
        });
      }
      markQuestion(terminal);
    }

    const word = {
      ...sourceWord,
      answer,
      question: questionText,
      length: answer.length,
      coordinates: sourceWord.coordinates.map(point => ({ ...point })),
      clue: { ...clue }
    };
    words[words.indexOf(sourceWord)] = word;
    questions.push({
      id: questionId,
      wordId: sourceWord.id,
      text: questionText,
      clue: { ...clue },
      direction: sourceWord.direction,
      length: answer.length,
      imageKey: sourceWord.imageKey ?? supplied?.imageKey ?? null
    });
  }

  const questionCells = grid.flat().filter(cell => cell.type === 'question').length;
  const letterCells = grid.flat().filter(cell => cell.type === 'letter').length;
  return {
    ok: errors.length === 0,
    scanword: {
      version: 1,
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      grid,
      words: words.map(word => ({ ...word })),
      questions,
      metadata: {
        seed: assignments?.seed ?? null,
        specialElevenLetterQuestion: words.some(word => word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'),
        complete: grid.every(row => row.every(cell => cell.type !== 'unassigned'))
      }
    },
    errors,
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells,
      letterCells,
      crossings: [...letterOwners.values()].filter(owners => owners.size > 1).length,
      assignedCells: questionCells + letterCells + 1
    }
  };
}
