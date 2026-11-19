import { CONFIG } from './config.js';
import { createRng } from './rng.js';

export const ETALON_V22 = Object.freeze({
  width: 8,
  height: 12,
  totalCells: 96,
  minimumAnswerLength: 2,
  maximumAnswerLength: 11,
  minimumAnswerCount: 34,
  maximumTwoLetterAnswers: 5,
  minimumInteriorQuestionCells: 6,
  directions: Object.freeze(['right', 'down'])
});

// Each mask is a complete 8×12 role layout. The only non-question boundary
// cell is the reserved upper-left corner. The masks were independently checked
// for active clue cells, complete letter coverage, connectivity and answer count.
const PATTERNS = Object.freeze([
  Object.freeze([
    '.#######',
    '#.......',
    '#.......',
    '#...#...',
    '#....###',
    '#..#....',
    '#...#...',
    '#.......',
    '#....###',
    '#..#....',
    '#...#...',
    '#...#...'
  ]),
  Object.freeze([
    '.#######',
    '#.......',
    '#.......',
    '#...#...',
    '#....###',
    '#..#....',
    '#...#...',
    '#...#...',
    '#....###',
    '#..#....',
    '#.......',
    '#...#...'
  ]),
  Object.freeze([
    '.#######',
    '#.......',
    '#.......',
    '#...#...',
    '#....###',
    '#..#....',
    '#.......',
    '#...#...',
    '#....###',
    '#..#....',
    '#...#...',
    '#...#...'
  ])
]);

function pointKey(point) {
  return point.row + ',' + point.col;
}

function inBounds(row, col) {
  return Number.isInteger(row) && Number.isInteger(col)
    && row >= 0 && row < CONFIG.HEIGHT
    && col >= 0 && col < CONFIG.WIDTH;
}

function isGridShape(grid) {
  return Array.isArray(grid)
    && grid.length === CONFIG.HEIGHT
    && grid.every(row => Array.isArray(row) && row.length === CONFIG.WIDTH);
}

function makePoint(row, col) {
  return { row, col };
}

function buildGrid(pattern) {
  return pattern.map((line, row) => [...line].map((role, col) => ({
    row,
    col,
    type: row === 0 && col === 0
      ? 'corner'
      : role === '#' ? 'question' : 'letter',
    letter: role === '#' || (row === 0 && col === 0) ? null : 'А',
    questionIds: [],
    wordIds: []
  })));
}

export function getEtalonV22Patterns() {
  return PATTERNS.map(pattern => [...pattern]);
}

export function createEtalonV22Grid(patternIndex = 0) {
  if (!Number.isInteger(patternIndex) || patternIndex < 0 || patternIndex >= PATTERNS.length) {
    throw new RangeError('Неизвестная маска эталона v2.2.');
  }
  return buildGrid(PATTERNS[patternIndex]);
}

/**
 * A slot always starts at its own clue cell and travels only right or down.
 * Its terminal is the next question cell or the board edge. There is no
 * reverse orientation and no implicit left/up answer.
 */
export function deriveEtalonV22Slots(grid) {
  const slots = [];
  const errors = [];
  const warnings = [];

  if (!isGridShape(grid)) {
    return {
      slots,
      errors: [{
        type: 'INVALID_GRID_SHAPE',
        message: 'Эталон v2.2 требует поле строго 8×12.'
      }],
      warnings
    };
  }

  const directions = [
    { name: 'right', dr: 0, dc: 1, axis: 'horizontal' },
    { name: 'down', dr: 1, dc: 0, axis: 'vertical' }
  ];

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      if (grid[row][col]?.type !== 'question') continue;

      for (const direction of directions) {
        const coordinates = [];
        let nextRow = row + direction.dr;
        let nextCol = col + direction.dc;
        let malformed = false;

        while (inBounds(nextRow, nextCol)) {
          const nextCell = grid[nextRow][nextCol];
          if (nextCell?.type === 'question') break;
          if (nextCell?.type !== 'letter') {
            errors.push({
              type: 'INVALID_CELL_INSIDE_ANSWER',
              message: 'Между вопросной клеткой и концом ответа найдена клетка без роли.',
              row: nextRow,
              col: nextCol,
              direction: direction.name
            });
            malformed = true;
            break;
          }
          coordinates.push(makePoint(nextRow, nextCol));
          nextRow += direction.dr;
          nextCol += direction.dc;
        }

        if (malformed || coordinates.length === 0) continue;

        if (coordinates.length === 1) {
          warnings.push({
            type: 'ONE_LETTER_GAP',
            message: 'Однобуквенный промежуток не считается ответом и должен быть покрыт пересекающим словом.',
            clueCell: makePoint(row, col),
            direction: direction.name,
            coordinate: coordinates[0]
          });
          continue;
        }

        if (coordinates.length > ETALON_V22.maximumAnswerLength) {
          errors.push({
            type: 'ANSWER_TOO_LONG',
            message: 'Длина ответа превышает 11 букв.',
            clueCell: makePoint(row, col),
            direction: direction.name,
            length: coordinates.length
          });
          continue;
        }

        const terminalInBoard = inBounds(nextRow, nextCol);
        const terminalCell = terminalInBoard
          ? makePoint(nextRow, nextCol)
          : {
              row: nextRow,
              col: nextCol,
              boundary: true,
              edge: direction.name === 'right' ? 'right' : 'bottom'
            };
        const clueCell = makePoint(row, col);
        const slot = {
          id: direction.name + ':' + pointKey(clueCell) + '>' + pointKey(terminalCell),
          axis: direction.axis,
          length: coordinates.length,
          clueCell,
          terminalCell,
          endpoints: [clueCell, terminalCell],
          coordinates,
          directionOptions: [{
            clueCell: makePoint(row, col),
            terminalCell: { ...terminalCell },
            direction: direction.name,
            coordinates: coordinates.map(point => ({ ...point }))
          }],
          special: terminalInBoard ? null : 'BOARD_BOUNDARY'
        };
        slots.push(slot);
      }
    }
  }

  return { slots, errors, warnings };
}

function analyzeConnectivity(slots) {
  const parent = slots.map((_, index) => index);
  const find = value => {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const unite = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  const ownersByLetter = new Map();
  const ownersByClue = new Map();
  slots.forEach((slot, index) => {
    for (const coordinate of slot.coordinates) {
      const key = pointKey(coordinate);
      if (!ownersByLetter.has(key)) ownersByLetter.set(key, []);
      ownersByLetter.get(key).push(index);
    }
    const clueKey = pointKey(slot.clueCell);
    if (!ownersByClue.has(clueKey)) ownersByClue.set(clueKey, []);
    ownersByClue.get(clueKey).push(index);
  });

  for (const owners of [...ownersByLetter.values(), ...ownersByClue.values()]) {
    for (let index = 1; index < owners.length; index++) {
      unite(owners[0], owners[index]);
    }
  }

  const components = new Set(slots.map((_, index) => find(index)));
  return {
    connected: slots.length > 0 && components.size === 1,
    componentCount: components.size
  };
}

/**
 * Reconstructs every right/down answer from the role grid and validates the
 * strict v2.2 border, clue activity, coverage, connectivity and answer quotas.
 */
export function validateEtalonV22Topology(grid, options = {}) {
  const errors = [];
  const minimumAnswerCount = options.minimumAnswerCount ?? ETALON_V22.minimumAnswerCount;
  const maximumTwoLetterAnswers = options.maximumTwoLetterAnswers ?? ETALON_V22.maximumTwoLetterAnswers;
  const minimumInteriorQuestionCells = options.minimumInteriorQuestionCells
    ?? ETALON_V22.minimumInteriorQuestionCells;
  const add = (type, message, extra = {}) => errors.push({ type, message, ...extra });

  if (!isGridShape(grid)) {
    return {
      valid: false,
      errors: [{
        type: 'INVALID_GRID_SHAPE',
        message: 'Эталон v2.2 требует поле строго 8×12.'
      }],
      warnings: [],
      slots: [],
      metrics: {
        totalCells: 0,
        questionCells: 0,
        letterCells: 0,
        interiorQuestionCells: 0,
        slotCount: 0,
        twoLetterSlots: 0,
        coveredLetters: 0,
        crossings: 0,
        connected: false
      }
    };
  }

  if (grid[0][0]?.type !== 'corner') {
    add('CORNER_NOT_EMPTY', 'Клетка (0,0) должна быть единственным пустым углом.', { row: 0, col: 0 });
  }

  for (let col = 1; col < CONFIG.WIDTH; col++) {
    if (grid[0][col]?.type !== 'question') {
      add('TOP_ROW_NOT_QUESTION', 'Вся верхняя строка, кроме угла (0,0), должна содержать вопросные клетки.', {
        row: 0, col
      });
    }
  }

  for (let row = 1; row < CONFIG.HEIGHT; row++) {
    if (grid[row][0]?.type !== 'question') {
      add('LEFT_COLUMN_NOT_QUESTION', 'Весь левый столбец, кроме угла (0,0), должен содержать вопросные клетки.', {
        row, col: 0
      });
    }
  }

  let questionCells = 0;
  let letterCells = 0;
  let interiorQuestionCells = 0;

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      if (!cell || !['corner', 'question', 'letter'].includes(cell.type)) {
        add('INVALID_CELL_ROLE', 'Каждая клетка должна быть углом, вопросом или буквой.', {
          row, col, actual: cell?.type ?? null
        });
        continue;
      }
      if (cell.type === 'corner' && (row !== 0 || col !== 0)) {
        add('EXTRA_CORNER', 'Пустой угол разрешён только в координате (0,0).', { row, col });
      }
      if (cell.type === 'question') {
        questionCells++;
        if (row > 0 && col > 0) interiorQuestionCells++;
      }
      if (cell.type === 'letter') letterCells++;
    }
  }

  if (interiorQuestionCells < minimumInteriorQuestionCells) {
    add('TOO_FEW_INTERIOR_QUESTION_CELLS', 'В поле недостаточно внутренних вопросных клеток.', {
      expectedAtLeast: minimumInteriorQuestionCells,
      actual: interiorQuestionCells
    });
  }

  const derived = deriveEtalonV22Slots(grid);
  errors.push(...derived.errors);
  const slots = derived.slots;
  const letterCoverage = new Map();
  const clueStarts = new Map();

  for (const slot of slots) {
    const clueKey = pointKey(slot.clueCell);
    clueStarts.set(clueKey, (clueStarts.get(clueKey) ?? 0) + 1);
    for (const coordinate of slot.coordinates) {
      const key = pointKey(coordinate);
      letterCoverage.set(key, (letterCoverage.get(key) ?? 0) + 1);
    }
    if (!ETALON_V22.directions.includes(slot.directionOptions[0]?.direction)) {
      add('DISALLOWED_DIRECTION', 'Ответ может идти только вправо или вниз.', {
        slotId: slot.id,
        direction: slot.directionOptions[0]?.direction ?? null
      });
    }
  }

  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      const cell = grid[row][col];
      const key = row + ',' + col;
      if (cell?.type === 'question' && !clueStarts.has(key)) {
        add('QUESTION_WITHOUT_OUTGOING_ANSWER', 'Каждая вопросная клетка должна начинать ответ вправо и/или вниз.', {
          row, col
        });
      }
      if (cell?.type === 'letter' && !letterCoverage.has(key)) {
        add('ORPHAN_LETTER', 'Каждая буквенная клетка должна входить минимум в один настоящий ответ.', {
          row, col
        });
      }
    }
  }

  const twoLetterSlots = slots.filter(slot => slot.length === 2).length;
  if (slots.length < minimumAnswerCount) {
    add('ANSWER_COUNT_BELOW_TARGET', 'В поле меньше требуемых осмысленных ответных слотов.', {
      expectedAtLeast: minimumAnswerCount,
      actual: slots.length
    });
  }
  if (twoLetterSlots > maximumTwoLetterAnswers) {
    add('TOO_MANY_TWO_LETTER_SLOTS', 'Количество двухбуквенных ответов превышает проверенный лимит качества.', {
      expectedAtMost: maximumTwoLetterAnswers,
      actual: twoLetterSlots
    });
  }

  const mandatoryElevenSlots = slots.filter(slot =>
    slot.axis === 'vertical'
    && slot.length === 11
    && slot.clueCell.row === 0
    && [1, 2].includes(slot.clueCell.col)
    && slot.terminalCell.boundary === true
    && slot.terminalCell.row === CONFIG.HEIGHT
  );
  for (const col of [1, 2]) {
    if (!mandatoryElevenSlots.some(slot => slot.clueCell.col === col)) {
      add('MANDATORY_ELEVEN_LETTER_PATH_MISSING', 'Один из двух обязательных 11-буквенных вертикальных ответов отсутствует.', {
        clueCell: { row: 0, col }
      });
    }
  }

  const connectivity = analyzeConnectivity(slots);
  if (!connectivity.connected) {
    add('DISCONNECTED_ANSWER_GRAPH', 'Все ответы должны образовывать одну связанную конструкцию через пересечения или общую вопросную клетку.', {
      componentCount: connectivity.componentCount
    });
  }

  const crossings = [...letterCoverage.values()].filter(count => count > 1).length;
  return {
    valid: errors.length === 0,
    errors,
    warnings: derived.warnings,
    slots,
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells,
      letterCells,
      interiorQuestionCells,
      slotCount: slots.length,
      horizontalSlots: slots.filter(slot => slot.axis === 'horizontal').length,
      verticalSlots: slots.filter(slot => slot.axis === 'vertical').length,
      twoLetterSlots,
      coveredLetters: letterCoverage.size,
      crossings,
      connected: connectivity.connected,
      connectedComponents: connectivity.componentCount,
      mandatoryElevenLetterSlots: mandatoryElevenSlots.length,
      activeQuestionCells: clueStarts.size
    }
  };
}

/** Returns one seeded mask from the independently validated v2.2 pattern set. */
export function generateEtalonV22Topology(options = {}) {
  const seed = options.seed ?? 1;
  const random = createRng(seed);
  const patternIndex = Number.isInteger(options.patternIndex)
    && options.patternIndex >= 0
    && options.patternIndex < PATTERNS.length
      ? options.patternIndex
      : Math.floor(random() * PATTERNS.length);
  const pattern = [...PATTERNS[patternIndex]];
  const grid = buildGrid(pattern);
  const validation = validateEtalonV22Topology(grid, options);

  if (!validation.valid) {
    return {
      ok: false,
      reason: 'ETALON_V22_TOPOLOGY_REJECTED',
      seed,
      patternIndex,
      errors: validation.errors,
      topology: null
    };
  }

  return {
    ok: true,
    seed,
    patternIndex,
    topology: {
      pattern,
      grid,
      slots: validation.slots,
      validation,
      metrics: validation.metrics
    }
  };
}
