import { CONFIG, DIRECTIONS } from './config.js';

export const CELL_ROLES = Object.freeze(['corner', 'question', 'letter']);
export const MIN_ANSWER_LENGTH = 2;

/**
 * Proves whether the required top/left clue borders can satisfy the rule
 * that every ordinary answer ends at an in-board question cell.
 */
export function analyzeRequiredBorderFeasibility(options = {}) {
  const width = options.width ?? CONFIG.WIDTH;
  const height = options.height ?? CONFIG.HEIGHT;
  const minimumLength = options.minimumAnswerLength ?? MIN_ANSWER_LENGTH;
  const allowedRows = options.allowLeftBorderRightBoundaryRows ?? [];

  if (!Number.isInteger(width) || !Number.isInteger(height)
    || !Number.isInteger(minimumLength) || width < 3
    || height <= minimumLength || minimumLength < 2) {
    return {
      feasible: null,
      reason: 'UNSUPPORTED_DIMENSIONS',
      width,
      height,
      minimumAnswerLength: minimumLength,
      conflicts: [],
      message: 'Невозможно выполнить предварительную проверку для переданных размеров или минимальной длины.'
    };
  }

  if (!Array.isArray(allowedRows)
    || new Set(allowedRows).size !== allowedRows.length
    || allowedRows.some(row => !Number.isInteger(row) || ![1, 2].includes(row))
    || (allowedRows.length > 0 && (width !== 8 || height !== 12 || minimumLength !== 2))) {
    return {
      feasible: false,
      reason: 'INVALID_LEFT_BOUNDARY_EXCEPTION',
      width,
      height,
      minimumAnswerLength: minimumLength,
      allowedLeftBoundaryRows: [],
      conflicts: [],
      message: 'Исключение правой границы разрешено только для строк 1 и 2 на поле 8×12.'
    };
  }

  const forcedLetterCells = [];
  const forcedKeys = new Set();
  const forceLetter = (row, col, cause) => {
    const key = row + ',' + col;
    if (forcedKeys.has(key)) return;
    forcedKeys.add(key);
    forcedLetterCells.push({ row, col, forcedBy: cause });
  };

  // Every left-border clue can only point right: up/down are occupied by
  // neighbouring mandatory clue cells and left is outside the board.
  for (let row = 1; row < height; row++) {
    for (let col = 1; col <= minimumLength; col++) {
      forceLetter(row, col, { type: 'LEFT_BORDER_CLUE', row, col: 0 });
    }
  }

  // The top-row answers also force their first minimumLength cells to letters.
  for (let col = 1; col < width; col++) {
    for (let row = 1; row <= minimumLength; row++) {
      forceLetter(row, col, { type: 'TOP_BORDER_CLUE', row: 0, col });
    }
  }

  const allowed = new Set(allowedRows);
  const conflicts = [];
  // Rows 1 and 2 on the left border are not inherently impossible:
  // their answers may terminate at an interior clue cell after at least
  // two letters. The proven unavoidable contradiction is the second
  // top clue, whose entire column is forced to be letters by the left clues.

  // The second top clue is impossible even when the two left-edge exceptions
  // are enabled: every left-border clue forces columns 1 and 2 to be letters
  // all the way down. Thus (0,2) can only end after 11 letters at the bottom
  // boundary, but the specification permits that exception only at (0,1).
  conflicts.push({
    clueCell: { row: 0, col: 2 },
    blockedDirections: {
      left: 'обязательная вопросная клетка (0,1)',
      right: 'обязательная вопросная клетка (0,3)',
      up: 'граница поля'
    },
    forcedVerticalPath: Array.from({ length: height - 1 }, (_, index) => ({
      row: index + 1,
      col: 2
    })),
    reason: 'Все левые вопросы требуют минимум две буквы вправо, поэтому весь второй столбец букв занят до нижней границы. Для ответа из 11 букв в столбце 2 отдельного разрешения нет.'
  });

  return {
    feasible: false,
    reason: 'TOP_BORDER_SECOND_COLUMN_CONFLICT',
    width,
    height,
    minimumAnswerLength: minimumLength,
    forcedLetterCells,
    allowedLeftBoundaryRows: [...allowed].sort((a, b) => a - b),
    conflicts,
    message: 'Поле невозможно полностью заполнить при текущих правилах: верхний вопрос (0,2) вынужден идти на 11 букв до нижней границы, но такое исключение разрешено только для (0,1).'
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

function makeSlot(axis, first, last, coordinates) {
  const horizontal = axis === 'horizontal';
  const forwardDirection = horizontal ? 'right' : 'down';
  const reverseDirection = horizontal ? 'left' : 'up';
  const forward = coordinates.map(item => ({ ...item }));
  const reverse = [...coordinates].reverse().map(item => ({ ...item }));

  return {
    id: axis[0] + ':' + keyOf(first) + '>' + keyOf(last),
    axis,
    length: coordinates.length,
    endpoints: [{ ...first }, { ...last }],
    coordinates: forward,
    directionOptions: [
      {
        clueCell: { ...first },
        terminalCell: { ...last },
        direction: forwardDirection,
        coordinates: forward.map(item => ({ ...item }))
      },
      {
        clueCell: { ...last },
        terminalCell: { ...first },
        direction: reverseDirection,
        coordinates: reverse.map(item => ({ ...item }))
      }
    ],
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
 * consecutive question cells on one row or column. Both endpoint orientations
 * are retained, allowing the CSP stage to choose right/left/down/up.
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
      if (grid[row][col].type === 'question') questionPositions.push(offset);
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

        if (!cell || cell.type !== 'letter') {
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

      slots.push(makeSlot(axis, first, last, coordinates));
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

    for (const endpoint of slot.endpoints) {
      if (endpoint.boundary) continue;
      const key = keyOf(endpoint);
      clueCoverage.set(key, (clueCoverage.get(key) ?? 0) + 1);
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

  for (let col = 1; col < CONFIG.WIDTH; col++) {
    if (grid[0][col].type !== 'question') {
      errors.push({
        type: 'TOP_ROW_NOT_QUESTION',
        message: 'Вся верхняя строка, кроме (0,0), должна содержать вопросные клетки.',
        row: 0,
        col
      });
    }
  }

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

      if (cell.type === 'question') {
        questionCells++;
        if (options.requireQuestionIds && (!Array.isArray(cell.questionIds) || cell.questionIds.length === 0)) {
          errors.push({
            type: 'QUESTION_WITHOUT_ID',
            message: 'Вопросная клетка не связана ни с одним вопросом.',
            row,
            col
          });
        }
      }

      if (cell.type === 'letter') {
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

  const coverage = collectSlotCoverage(derived.slots);

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      if (!cell) continue;

      const key = row + ',' + col;
      if (cell.type === 'letter' && !coverage.letterCoverage.has(key)) {
        errors.push({
          type: 'ORPHAN_LETTER',
          message: 'Буква не входит ни в один геометрически допустимый ответ.',
          row,
          col,
          letter: cell.letter ?? null
        });
      }

      if (cell.type === 'question' && !coverage.clueCoverage.has(key)) {
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
        if (grid[row][col].type === 'question') {
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
