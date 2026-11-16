import { CONFIG, DIRECTIONS } from './config.js';

export const CELL_ROLES = Object.freeze(['corner', 'question', 'letter', 'junction']);
export const MIN_ANSWER_LENGTH = 2;

/**
 * Reports the fixed 8x12 layout contract: an anchored top-row short answer,
 * a fully clued left border, and an empty top-left corner.
 */
export function analyzeRequiredBorderFeasibility(options = {}) {
  const width = options.width ?? CONFIG.WIDTH;
  const height = options.height ?? CONFIG.HEIGHT;
  if (width !== CONFIG.WIDTH || height !== CONFIG.HEIGHT) {
    return {
      feasible: null,
      reason: 'UNSUPPORTED_DIMENSIONS',
      width,
      height,
      conflicts: [],
      message: 'Генератор QQCross поддерживает только поле 8×12.'
    };
  }
  return {
    feasible: true,
    reason: 'FIXED_TOP_SHORT_ANSWER_AND_LEFT_BORDER',
    width,
    height,
    requiredTopAnchor: { row: 0, col: 1 },
    requiredTopHorizontalAnswer: { start: { row: 0, col: 1 }, end: { row: 0, col: 5 }, length: 3 },
    requiredLeftBorderRows: Array.from({ length: height - 1 }, (_, index) => index + 1),
    conflicts: [],
    message: 'Верхняя подсказка образует горизонтальный ответ из трёх букв; левый столбец, кроме угла, остаётся вопросным.'
  };
}

function keyOf(point) {
  return point.row + ',' + point.col;
}

function point(row, col) {
  return { row, col };
}

function hasValidShape(grid) {
  return Array.isArray(grid)
    && grid.length === CONFIG.HEIGHT
    && grid.every(row => Array.isArray(row) && row.length === CONFIG.WIDTH);
}

export function isQuestionRole(cell) {
  return cell?.type === 'question' || cell?.type === 'junction';
}

export function isLetterRole(cell) {
  return cell?.type === 'letter' || cell?.type === 'junction';
}

export function clueAllowsDirection(cell, direction) {
  if (cell?.type === 'question') return true;
  return cell?.type === 'junction'
    && Array.isArray(cell.clueDirections)
    && cell.clueDirections.includes(direction);
}

function makeSlot(axis, first, last, coordinates, grid) {
  const forwardDirection = axis === 'horizontal' ? 'right' : 'down';
  const reverseDirection = axis === 'horizontal' ? 'left' : 'up';
  const forward = coordinates.map(item => ({ ...item }));
  const reverse = [...forward].reverse().map(item => ({ ...item }));
  const directionOptions = [];

  if (clueAllowsDirection(grid[first.row][first.col], forwardDirection)) {
    directionOptions.push({
      clueCell: { ...first },
      terminalCell: { ...last },
      direction: forwardDirection,
      coordinates: forward.map(item => ({ ...item }))
    });
  }
  if (clueAllowsDirection(grid[last.row][last.col], reverseDirection)) {
    directionOptions.push({
      clueCell: { ...last },
      terminalCell: { ...first },
      direction: reverseDirection,
      coordinates: reverse.map(item => ({ ...item }))
    });
  }
  if (!directionOptions.length) return null;

  return {
    id: axis[0] + ':' + keyOf(first) + '>' + keyOf(last),
    axis,
    length: coordinates.length,
    endpoints: [{ ...first }, { ...last }],
    coordinates: forward,
    directionOptions,
    special: null
  };
}

/**
 * Returns the answer coordinates for a clue, direction and answer length.
 * The same function is used by the topology layer and future CSP placement.
 */
export function getAnswerCoordinates(clueCell, direction, length) {
  const vector = DIRECTIONS[direction];
  if (!vector || !Number.isInteger(length) || length < 1) return null;

  const coordinates = [];
  for (let index = 1; index <= length; index++) {
    const row = clueCell.row + vector.dr * index;
    const col = clueCell.col + vector.dc * index;
    if (row < 0 || col < 0 || row >= CONFIG.HEIGHT || col >= CONFIG.WIDTH) return null;
    coordinates.push({ row, col });
  }
  return coordinates;
}

/**
 * Derives geometric candidate slots from a role grid.
 *
 * A normal answer slot is a run of at least two letter cells between two
 * consecutive question cells. The only permitted directions are right and down.
 *
 * One-letter gaps are intentionally not promoted to answers.
 */
export function deriveWordSlots(grid, options = {}) {
  const errors = [];
  const warnings = [];
  const slots = [];

  if (!hasValidShape(grid)) {
    return {
      slots,
      errors: [{
        type: 'INVALID_GRID_SHAPE',
        message: 'Сетка должна содержать 12 строк по 8 клеток.'
      }],
      warnings
    };
  }

  function scanLine(axis, fixedIndex) {
    const horizontal = axis === 'horizontal';
    const lineLength = horizontal ? CONFIG.WIDTH : CONFIG.HEIGHT;
    const questionPositions = [];

    for (let offset = 0; offset < lineLength; offset++) {
      const row = horizontal ? fixedIndex : offset;
      const col = horizontal ? offset : fixedIndex;
      const cell = grid[row][col];
      const axisDirections = horizontal ? ['right', 'left'] : ['down', 'up'];
      if (cell.type === 'question'
        || (cell.type === 'junction' && axisDirections.some(direction => clueAllowsDirection(cell, direction)))) {
        questionPositions.push(offset);
      }
    }

    for (let index = 0; index < questionPositions.length - 1; index++) {
      const from = questionPositions[index];
      const to = questionPositions[index + 1];
      const length = to - from - 1;
      if (length <= 0) continue;

      const first = horizontal ? point(fixedIndex, from) : point(from, fixedIndex);
      const last = horizontal ? point(fixedIndex, to) : point(to, fixedIndex);
      const coordinates = [];
      let malformed = false;

      for (let offset = from + 1; offset < to; offset++) {
        const row = horizontal ? fixedIndex : offset;
        const col = horizontal ? offset : fixedIndex;
        const cell = grid[row][col];

        if (!isLetterRole(cell)) {
          malformed = true;
          errors.push({
            type: 'NON_LETTER_INSIDE_SLOT',
            message: 'Между соседними вопросными клетками находится клетка, которая не является буквой.',
            row,
            col,
            axis
          });
        }
        coordinates.push(point(row, col));
      }

      if (malformed) continue;

      if (length < MIN_ANSWER_LENGTH) {
        warnings.push({
          type: 'SINGLE_LETTER_GAP',
          message: 'Однобуквенный промежуток не является ответом и должен покрываться пересекающим словом.',
          axis,
          first,
          last,
          coordinates
        });
        continue;
      }

      if (length > CONFIG.MAX_WORD_LENGTH) {
        errors.push({
          type: 'SLOT_TOO_LONG',
          message: 'Длина слота превышает максимальную длину словаря.',
          axis,
          first,
          last,
          length
        });
        continue;
      }

      const slot = makeSlot(axis, first, last, coordinates, grid);
      if (slot) slots.push(slot);
    }

    // A clue at the first question may point back to the outer left/top edge.
    if (options.allowOuterBoundarySlots === true && questionPositions.length > 0) {
      const from = questionPositions[0];
      const cluePoint = horizontal ? point(fixedIndex, from) : point(from, fixedIndex);
      const direction = horizontal ? 'left' : 'up';
      const length = from;
      if (clueAllowsDirection(grid[cluePoint.row][cluePoint.col], direction)
        && length >= (options.minimumOuterBoundaryLength ?? MIN_ANSWER_LENGTH)
        && length <= CONFIG.MAX_WORD_LENGTH) {
        const clue = cluePoint;
        const terminal = horizontal
          ? { row: fixedIndex, col: -1, boundary: true }
          : { row: -1, col: fixedIndex, boundary: true };
        const coordinates = Array.from({ length }, (_, index) => horizontal
          ? point(fixedIndex, from - index - 1)
          : point(from - index - 1, fixedIndex));
        slots.push({
          id: 'outer-boundary-reverse:' + axis + ':' + keyOf(clue),
          axis,
          length,
          endpoints: [{ ...clue }, terminal],
          coordinates,
          directionOptions: [{
            clueCell: { ...clue },
            terminalCell: { ...terminal },
            direction,
            coordinates: coordinates.map(item => ({ ...item }))
          }],
          special: 'OUTER_BOUNDARY'
        });
      }
    }

    // A clue at the last question may point to the outer right/bottom edge.
    if (options.allowOuterBoundarySlots === true && questionPositions.length > 0) {
      const from = questionPositions[questionPositions.length - 1];
      const cluePoint = horizontal ? point(fixedIndex, from) : point(from, fixedIndex);
      const direction = horizontal ? 'right' : 'down';
      const length = lineLength - from - 1;
      if (clueAllowsDirection(grid[cluePoint.row][cluePoint.col], direction)
        && length >= (options.minimumOuterBoundaryLength ?? MIN_ANSWER_LENGTH)
        && length <= CONFIG.MAX_WORD_LENGTH) {
        const clue = cluePoint;
        const terminal = horizontal
          ? { row: fixedIndex, col: CONFIG.WIDTH, boundary: true }
          : { row: CONFIG.HEIGHT, col: fixedIndex, boundary: true };
        const coordinates = Array.from({ length }, (_, index) => horizontal
          ? point(fixedIndex, from + index + 1)
          : point(from + index + 1, fixedIndex));
        slots.push({
          id: 'outer-boundary:' + axis + ':' + keyOf(clue),
          axis,
          length,
          endpoints: [{ ...clue }, terminal],
          coordinates,
          directionOptions: [{
            clueCell: { ...clue },
            terminalCell: { ...terminal },
            direction,
            coordinates: coordinates.map(item => ({ ...item }))
          }],
          special: 'OUTER_BOUNDARY'
        });
      }
    }
  }

  for (let row = 0; row < CONFIG.HEIGHT; row++) scanLine('horizontal', row);
  for (let col = 0; col < CONFIG.WIDTH; col++) scanLine('vertical', col);

  // The only permitted answer that ends at the outer board edge:
  // clue (0,1), direction down, exactly eleven letters at (1,1)..(11,1).
  if (options.allowSpecialElevenBoundary !== false) {
    const clue = grid[0][1];
    const coordinates = Array.from({ length: 11 }, (_, index) => point(index + 1, 1));
    const uninterrupted = clue.type === 'question'
      && coordinates.every(item => grid[item.row][item.col].type === 'letter');

    if (uninterrupted) {
      slots.push({
        id: 'special-eleven:0,1>bottom-boundary',
        axis: 'vertical',
        length: 11,
        endpoints: [
          point(0, 1),
          { row: CONFIG.HEIGHT, col: 1, boundary: true }
        ],
        coordinates,
        directionOptions: [{
          clueCell: point(0, 1),
          terminalCell: { row: CONFIG.HEIGHT, col: 1, boundary: true },
          direction: 'down',
          coordinates: coordinates.map(item => ({ ...item }))
        }],
        special: 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
      });
    }
  }

  // Opt-in exception for the two forced horizontal answers from the left edge.
  // It is disabled by default and is accepted only for rows 1 and 2.
  if (options.allowLeftBorderRightBoundary === true) {
    for (const row of [1, 2]) {
      const clue = grid[row][0];
      const coordinates = Array.from({ length: CONFIG.WIDTH - 1 }, (_, index) => point(row, index + 1));
      const uninterrupted = clue.type === 'question'
        && coordinates.every(item => grid[item.row][item.col].type === 'letter');

      if (uninterrupted) {
        slots.push({
          id: 'special-left-right:' + row + ',0>right-boundary',
          axis: 'horizontal',
          length: CONFIG.WIDTH - 1,
          endpoints: [
            point(row, 0),
            { row, col: CONFIG.WIDTH, boundary: true }
          ],
          coordinates,
          directionOptions: [{
            clueCell: point(row, 0),
            terminalCell: { row, col: CONFIG.WIDTH, boundary: true },
            direction: 'right',
            coordinates: coordinates.map(item => ({ ...item }))
          }],
          special: 'LEFT_BORDER_RIGHT_BOUNDARY'
        });
      }
    }
  }

  return { slots, errors, warnings };
}

function collectSlotCoverage(slots) {
  const letterCoverage = new Map();
  const clueCoverage = new Map();

  for (const slot of slots) {
    for (const coordinate of slot.coordinates) {
      const key = keyOf(coordinate);
      letterCoverage.set(key, (letterCoverage.get(key) ?? 0) + 1);
    }

    for (const option of slot.directionOptions ?? []) {
      const clue = option.clueCell;
      if (clue && !clue.boundary) {
        const key = keyOf(clue);
        clueCoverage.set(key, (clueCoverage.get(key) ?? 0) + 1);
      }
    }
  }

  return { letterCoverage, clueCoverage };
}

/**
 * Independent geometry/role validator. It does not inspect or trust generator
 * validity flags. Dictionary matching and final answer correctness are checked
 * by the separate scanword validator.
 */
export function validateTopology(grid, options = {}) {
  const errors = [];
  const warnings = [];

  if (!hasValidShape(grid)) {
    return {
      valid: false,
      errors: [{
        type: 'INVALID_GRID_SHAPE',
        message: 'Сетка должна содержать 12 строк по 8 клеток.'
      }],
      warnings,
      slots: [],
      metrics: {
        totalCells: 0,
        questionCells: 0,
        letterCells: 0,
        coveredLetters: 0,
        horizontalSlots: 0,
        verticalSlots: 0,
        specialElevenLetterSlots: 0
      }
    };
  }

  if (grid[0][0].type !== 'corner') {
    errors.push({
      type: 'CORNER_NOT_EMPTY',
      message: 'Клетка (0,0) должна быть пустым углом.',
      row: 0,
      col: 0
    });
  }

  if (grid[0][1].type !== 'question') {
    errors.push({
      type: 'TOP_LEFT_BORDER_ANCHOR_MISSING',
      message: 'Клетка (0,1) должна быть вопросной: верхний ряд не имеет вопросной границы слева от неё.',
      row: 0,
      col: 1
    });
  }

  if (options.allowTopRowHorizontalRun === true) {
    const expectedTopRow = ['corner', 'question', 'letter', 'letter', 'letter', 'question', 'question', 'question'];
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      if (grid[0][col].type !== expectedTopRow[col]) {
        errors.push({
          type: 'TOP_ROW_SHORT_ANSWER_LAYOUT_INVALID',
          message: 'Короткий верхний ответ должен идти от (0,1) вправо через три буквы до вопросной клетки (0,5).',
          row: 0,
          col,
          expected: expectedTopRow[col],
          actual: grid[0][col].type
        });
      }
    }
  } else if (options.requireBorderClues !== false) {
    for (let col = 1; col < CONFIG.WIDTH; col++) {
      if (grid[0][col].type !== 'question') {
        errors.push({
          type: 'TOP_BORDER_NOT_QUESTION',
          message: 'Все клетки верхнего ряда, кроме пустого угла (0,0), должны быть вопросными.',
          row: 0,
          col
        });
      }
    }
  }

  // The left border remains fully question-marked for both production layouts.
  for (let row = 1; row < CONFIG.HEIGHT; row++) {
    if (grid[row][0].type !== 'question') {
      errors.push({
        type: 'LEFT_COLUMN_NOT_QUESTION',
        message: 'Весь левый столбец, кроме (0,0), должен содержать вопросные клетки.',
        row,
        col: 0
      });
    }
  }

  let questionCells = 0;
  let letterCells = 0;

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      if (!cell || !CELL_ROLES.includes(cell.type)) {
        errors.push({
          type: 'UNASSIGNED_OR_INVALID_CELL',
          message: 'Клетка не имеет допустимой роли.',
          row,
          col,
          actual: cell?.type ?? null
        });
        continue;
      }

      if (cell.type === 'corner' && (row !== 0 || col !== 0)) {
        errors.push({
          type: 'EXTRA_CORNER',
          message: 'Пустой угол разрешён только в (0,0).',
          row,
          col
        });
      }

      if (isQuestionRole(cell)) {
        questionCells++;
        if (cell.type === 'junction' && (!Array.isArray(cell.clueDirections) || !cell.clueDirections.length
          || cell.clueDirections.some(direction => !['right', 'down', 'left', 'up'].includes(direction)))) {
          errors.push({ type: 'INVALID_JUNCTION_DIRECTIONS', message: 'У комбинированной клетки должно быть хотя бы одно корректное направление вопроса.', row, col });
        }
        if (options.requireQuestionIds && (!Array.isArray(cell.questionIds) || cell.questionIds.length === 0)) {
          errors.push({
            type: 'QUESTION_WITHOUT_ID',
            message: 'Вопросная клетка не связана ни с одним вопросом.',
            row,
            col
          });
        }
      }

      if (isLetterRole(cell)) {
        letterCells++;
        if (typeof cell.letter !== 'string' || !/^[А-ЯЁ]$/u.test(cell.letter)) {
          errors.push({
            type: 'INVALID_LETTER_CELL',
            message: 'Буквенная клетка должна содержать ровно одну русскую заглавную букву.',
            row,
            col,
            actual: cell.letter ?? null
          });
        }
      }
    }
  }

  const derived = deriveWordSlots(grid, options);
  errors.push(...derived.errors);
  warnings.push(...derived.warnings);
  if (options.allowTopRowHorizontalRun === true) {
    const topShortSlot = derived.slots.some(slot =>
      slot.axis === 'horizontal'
      && slot.length === 3
      && slot.endpoints[0]?.row === 0
      && slot.endpoints[0]?.col === 1
      && slot.endpoints[1]?.row === 0
      && slot.endpoints[1]?.col === 5
    );
    if (!topShortSlot) {
      errors.push({
        type: 'TOP_ROW_SHORT_ANSWER_SLOT_MISSING',
        message: 'Верхняя короткая подсказка должна образовывать ответ из трёх букв.'
      });
    }
  }

  const coverage = collectSlotCoverage(derived.slots);

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      if (!cell) continue;

      const key = row + ',' + col;
      if (isLetterRole(cell) && !coverage.letterCoverage.has(key)) {
        errors.push({
          type: 'ORPHAN_LETTER',
          message: 'Буква не входит ни в один геометрически допустимый ответ.',
          row,
          col,
          letter: cell.letter ?? null
        });
      }

      if (isQuestionRole(cell) && !coverage.clueCoverage.has(key)) {
        errors.push({
          type: 'QUESTION_WITHOUT_SLOT',
          message: 'Вопросная клетка не ограничивает ни один допустимый ответ.',
          row,
          col
        });
      }
    }
  }

  if (options.requireConnected) {
    const questionKeys = [];
    const adjacency = new Map();

    for (let row = 0; row < CONFIG.HEIGHT; row++) {
      for (let col = 0; col < CONFIG.WIDTH; col++) {
        if (isQuestionRole(grid[row][col])) {
          const key = row + ',' + col;
          questionKeys.push(key);
          adjacency.set(key, new Set());
        }
      }
    }

    for (const slot of derived.slots) {
      const clueKeys = slot.endpoints.filter(item => !item.boundary).map(keyOf);
      if (clueKeys.length === 2) {
        adjacency.get(clueKeys[0])?.add(clueKeys[1]);
        adjacency.get(clueKeys[1])?.add(clueKeys[0]);
      }
    }

    for (let firstIndex = 0; firstIndex < derived.slots.length; firstIndex++) {
      const first = derived.slots[firstIndex];
      const firstLetters = new Set(first.coordinates.map(keyOf));

      for (let secondIndex = firstIndex + 1; secondIndex < derived.slots.length; secondIndex++) {
        const second = derived.slots[secondIndex];
        if (!second.coordinates.some(item => firstLetters.has(keyOf(item)))) continue;

        const firstClues = first.endpoints.filter(item => !item.boundary).map(keyOf);
        const secondClues = second.endpoints.filter(item => !item.boundary).map(keyOf);
        for (const a of firstClues) {
          for (const b of secondClues) {
            adjacency.get(a)?.add(b);
            adjacency.get(b)?.add(a);
          }
        }
      }
    }

    const reached = new Set();
    const queue = questionKeys.length ? [questionKeys[0]] : [];
    if (queue.length) reached.add(queue[0]);

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const next of adjacency.get(current) ?? []) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }

    if (reached.size !== questionKeys.length) {
      errors.push({
        type: 'DISCONNECTED_TOPOLOGY',
        message: 'Вопросные клетки не образуют единую связанную структуру.',
        connectedQuestionCells: reached.size,
        totalQuestionCells: questionKeys.length
      });
    }
  }

  const slots = derived.slots;
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    slots,
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells,
      letterCells,
      coveredLetters: coverage.letterCoverage.size,
      horizontalSlots: slots.filter(slot => slot.axis === 'horizontal').length,
      verticalSlots: slots.filter(slot => slot.axis === 'vertical').length,
      specialElevenLetterSlots: slots.filter(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY').length
    }
  };
}
