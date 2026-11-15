import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';
import { SCANWORD_TEMPLATES, getScanwordTemplates as listScanwordTemplates } from './template-library.js';

/*
 * Three original scaffolds remain available for broad topology exploration.
 * A fourth ordinary scaffold is designed for low-short-answer production boards.
 * The fifth, low-short scaffold is reserved for the optional 11-letter layout.
 * It is not connected when that boundary answer is omitted.
 */
const SCAFFOLD_ROWS = Object.freeze([
  { col4Rows: [3, 7, 11], col5Rows: [4, 8], rightEdgeRows: [3, 7] },
  { col4Rows: [4, 8], col5Rows: [3, 7, 11], rightEdgeRows: [3, 7] },
  { col4Rows: [3, 7], col5Rows: [4, 8], rightEdgeRows: [4, 8] },
  { col4Rows: [4, 8], col5Rows: [4, 8], col6Rows: [4], rightEdgeRows: [4, 8] },
  { col4Rows: [4, 8], col5Rows: [5, 9], col6Rows: [5, 9, 10], rightEdgeRows: [3, 10] }
]);

function createScaffold(layout = SCAFFOLD_ROWS[0]) {
  const col4Rows = new Set(layout.col4Rows);
  const col5Rows = new Set(layout.col5Rows);
  const col6Rows = new Set(layout.col6Rows ?? []);
  const rightEdgeRows = new Set(layout.rightEdgeRows);
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) {
      for (const col of [1, 4, 5, 6, 7]) cells[col] = '#';
    } else {
      cells[0] = '#';
      if (col4Rows.has(row)) cells[4] = '#';
      if (col5Rows.has(row)) cells[5] = '#';
      if (col6Rows.has(row)) cells[6] = '#';
      if (rightEdgeRows.has(row)) cells[7] = '#';
    }
    return cells.join('');
  });
}

const LOW_SHORT_SCAFFOLD = Object.freeze([
  '.#...###',
  '#...#...',
  '#...#...',
  '#...#...',
  '#......#',
  '#....##.',
  '#...#...',
  '#...#...',
  '#......#',
  '#....##.',
  '#.....#.',
  '#......#'
]);
const SCAFFOLDS = Object.freeze([
  ...SCAFFOLD_ROWS.map(createScaffold),
  LOW_SHORT_SCAFFOLD
]);
function cloneRows(rows) {
  return rows.map(row => row.split(''));
}

function toRoleGrid(matrix) {
  const grid = createEmptyGrid();
  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      if (row === 0 && col === 0) continue;
      const cell = grid[row][col];
      cell.type = matrix[row][col] === '#' ? 'question' : 'letter';
      cell.letter = cell.type === 'letter' ? 'А' : null;
    }
  }
  return grid;
}

/**
 * Independently validates one of the twenty user-approved 8x12 templates.
 * Template masks are immutable in production: there are no random role flips
 * that could quietly change the agreed geometry.
 */
function inspectTemplateCandidate(templateIndex, includeSpecialEleven, maxTwoLetterSlots = 5) {
  const rows = SCANWORD_TEMPLATES[templateIndex];
  if (!rows || rows.length !== CONFIG.HEIGHT || rows.some(row => row.length !== CONFIG.WIDTH)) return null;
  if (rows[0] !== '.#######') return null;
  if (rows.some((row, index) => index > 0 && row[0] !== '#')) return null;

  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix);
  const topologyOptions = {
    requireConnected: true,
    requireFullTopBorder: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: true,
    minimumOuterBoundaryLength: 2
  };
  const validation = validateTopology(grid, topologyOptions);
  const derived = deriveWordSlots(grid, topologyOptions);
  if (!validation.valid || derived.errors.length) return null;

  const shortSlots = derived.slots.filter(slot => slot.length === 2);
  const longSlots = derived.slots.filter(slot => slot.length >= 3);
  const elevenSlots = derived.slots.filter(slot =>
    slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
    && slot.axis === 'vertical'
    && slot.length === 11
    && slot.endpoints[0]?.row === 0
  );

  if (shortSlots.length < 1 || shortSlots.length > maxTwoLetterSlots || longSlots.length < 12) return null;
  if (includeSpecialEleven) {
    if (elevenSlots.length !== 1) return null;
    elevenSlots[0].special = 'ELEVEN_LETTER_BOTTOM_BOUNDARY';
  } else if (elevenSlots.length > 0) {
    return null;
  }
  if (derived.slots.length < 20) return null;

  const interiorQuestionCells = countInteriorQuestions(matrix);
  return {
    grid,
    slots: derived.slots,
    validation,
    pattern: rows.map(row => row),
    templateIndex,
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells: validation.metrics.questionCells,
      interiorQuestionCells,
      letterCells: validation.metrics.letterCells,
      slotCount: derived.slots.length,
      horizontalSlots: validation.metrics.horizontalSlots,
      verticalSlots: validation.metrics.verticalSlots,
      crossingsPotential: validation.metrics.coveredLetters,
      twoLetterSlots: shortSlots.length,
      elevenLetterSlots: elevenSlots.length
    }
  };
}

export function getScanwordTemplates() {
  return listScanwordTemplates();
}

function inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots = includeSpecialEleven ? 4 : 5, minimumInteriorQuestionCells = includeSpecialEleven ? 8 : 5) {
  if (matrix.length !== CONFIG.HEIGHT || matrix.some(row => row.length !== CONFIG.WIDTH)) return null;
  if (matrix[0][0] !== '.' || matrix[0][1] !== '#') return null;
  if (countTopQuestions(matrix) !== (includeSpecialEleven ? 4 : 5)) return null;
  if (countRightEdgeQuestions(matrix) !== (includeSpecialEleven ? 4 : 3)) return null;
  const interiorQuestionCells = countInteriorQuestions(matrix);
  if (interiorQuestionCells < Math.max(includeSpecialEleven ? 8 : 5, minimumInteriorQuestionCells)) return null;
  // Keep column 3 letter-only for special puzzles: otherwise a left-border
  // crossing can become a short slot dictated by the eleven-letter answer.
  if (includeSpecialEleven && matrix.some(row => row[3] === '#')) return null;

  for (let row = 1; row < CONFIG.HEIGHT; row++) {
    if (matrix[row][0] !== '#') return null;
    if (matrix[row][1] !== '.' || matrix[row][2] !== '.') return null;
  }

  const grid = toRoleGrid(matrix);
  const topologyOptions = {
    requireConnected: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: !includeSpecialEleven,
    minimumOuterBoundaryLength: includeSpecialEleven ? undefined : 2
  };
  const validation = validateTopology(grid, topologyOptions);
  if (!validation.valid || validation.metrics.totalCells !== CONFIG.TOTAL_CELLS) return null;
  if (validation.metrics.questionCells < 20 || validation.metrics.letterCells < 30) return null;

  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: includeSpecialEleven, allowOuterBoundarySlots: !includeSpecialEleven, minimumOuterBoundaryLength: includeSpecialEleven ? undefined : 2 });
  const minimumSlots = 19 + (includeSpecialEleven ? 1 : 0);
  const twoLetterSlots = derived.slots.filter(slot => slot.length === 2).length;
  const longSlots = derived.slots.filter(slot => slot.length >= 3).length;
  if (derived.errors.length || derived.slots.length < minimumSlots) return null;
  // Production caps ordinary boards at three short answers. Geometry-only
  // topology diagnostics may request a broader range to measure diversity.
  if (twoLetterSlots < (includeSpecialEleven ? 2 : 1) || twoLetterSlots > maxTwoLetterSlots || longSlots < 12) return null;

  return {
    grid,
    slots: derived.slots,
    validation,
    pattern: matrix.map(row => row.join('')),
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells: validation.metrics.questionCells,
      interiorQuestionCells,
      letterCells: validation.metrics.letterCells,
      slotCount: derived.slots.length,
      horizontalSlots: validation.metrics.horizontalSlots,
      verticalSlots: validation.metrics.verticalSlots,
      crossingsPotential: validation.metrics.coveredLetters
    }
  };
}

function countTopQuestions(matrix) {
  return matrix[0].slice(1).filter(value => value === '#').length;
}

function countRightEdgeQuestions(matrix) {
  return matrix.filter(row => row[CONFIG.WIDTH - 1] === '#').length;
}

function countInteriorQuestions(matrix) {
  return matrix.slice(1).reduce(
    (total, row) => total + row.slice(1, CONFIG.WIDTH - 1).filter(value => value === '#').length,
    0
  );
}

/**
 * Apply bounded seeded mutations only to internal cells. A mutation is kept
 * only when the independent geometry validator still proves complete letter
 * coverage, connected clue structure, valid answer lengths and active clues.
 */
function mutateValidatedScaffold(baseRows, includeSpecialEleven, random, budget = 96, maxTwoLetterSlots = includeSpecialEleven ? 4 : 5, preserveScaffold = false) {
  const matrix = cloneRows(baseRows);
  let candidate = inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots);
  if (!candidate) return { candidate: null, accepted: 0, tried: 0 };

  // The special 11-letter layout keeps its crossing rows intact. Ordinary
  // layouts receive a bounded number of seeded mutations.
  const targetMutations = includeSpecialEleven || preserveScaffold ? 0 : 1 + Math.floor(random() * 3);
  const touched = new Set();
  let accepted = 0;
  let tried = 0;

  for (let attempt = 0; attempt < budget && accepted < targetMutations; attempt++) {
    const row = 1 + Math.floor(random() * (CONFIG.HEIGHT - 1));
    // Columns 1 and 2 stay letters. Special boards also keep column 3 clear.
    const minMutationColumn = includeSpecialEleven ? 4 : 3;
    const mutationColumnCount = CONFIG.WIDTH - 1 - minMutationColumn;
    const col = minMutationColumn + Math.floor(random() * mutationColumnCount);
    const key = row + ',' + col;
    if (touched.has(key)) continue;
    touched.add(key);
    tried++;

    const previous = matrix[row][col];
    matrix[row][col] = previous === '#' ? '.' : '#';
    const next = inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots, 3);

    if (next) {
      candidate = next;
      accepted++;
    } else {
      matrix[row][col] = previous;
    }
  }

  const requiredInterior = includeSpecialEleven ? 8 : 5;
  if ((candidate?.metrics.interiorQuestionCells ?? 0) < requiredInterior) {
    return { candidate: null, accepted, tried };
  }
  return { candidate, accepted, tried };
}

/**
 * Selects a seeded, fully validated role mask. Every topology begins with a
 * known-safe scaffold, then receives bounded, validator-approved mutations;
 * no answer letters are stored in this stage.
 */
export function generateTopology(options = {}) {
  const seed = options.seed ?? 1;
  if (Number.isInteger(options.templateIndex)) {
    const templateIndex = options.templateIndex;
    const includeSpecialEleven = options.includeSpecialEleven === true;
    const maxTwoLetterSlots = Math.max(1, Math.min(10, options.maxTwoLetterSlots ?? 3));
    const candidate = inspectTemplateCandidate(templateIndex, includeSpecialEleven, maxTwoLetterSlots);
    if (!candidate) {
      return {
        ok: false,
        reason: 'TEMPLATE_REJECTED',
        seed,
        templateIndex,
        templateNumber: templateIndex + 1,
        attempts: 1,
        rejectedAttempts: 1,
        message: 'Шаблон не прошёл независимую проверку геометрии и ограничений ответов.'
      };
    }
    return {
      ok: true,
      seed,
      attempts: 1,
      scaffoldIndex: templateIndex,
      templateIndex,
      templateNumber: templateIndex + 1,
      mutationCount: 0,
      mutationTries: 0,
      topology: candidate,
      rejectedAttempts: 0,
      diagnostics: ['APPROVED_TEMPLATE_USED']
    };
  }
  const random = createRng(seed);
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const maxAttempts = Math.max(1, Math.min(512, options.maxAttempts ?? 96));
  const mutationBudget = Math.max(1, Math.min(512, options.mutationBudget ?? 96));
  const maxTwoLetterSlots = Math.max(1, Math.min(8, options.maxTwoLetterSlots ?? (includeSpecialEleven ? 4 : 5)));
  const requestedScaffoldIndex = Number.isInteger(options.scaffoldIndex)
    && options.scaffoldIndex >= 0
    && options.scaffoldIndex < SCAFFOLD_ROWS.length
    ? options.scaffoldIndex
    : null;
  const history = [];
  let fallback = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const specialRows = Array.isArray(options.specialSplitRows)
      && options.specialSplitRows.length === 3
      && new Set(options.specialSplitRows).size === 3
      && options.specialSplitRows.every(row => Number.isInteger(row) && row >= 1 && row < CONFIG.HEIGHT)
      ? [...options.specialSplitRows].sort((a, b) => a - b)
      : [3, 7, 10];
    const scaffoldIndex = includeSpecialEleven
      ? -1
      : requestedScaffoldIndex ?? Math.floor(random() * SCAFFOLD_ROWS.length);
    const scaffold = includeSpecialEleven
      ? (Array.isArray(options.specialPattern) ? options.specialPattern : LOW_SHORT_SCAFFOLD)
      : SCAFFOLDS[scaffoldIndex];
    const mutated = mutateValidatedScaffold(
      scaffold,
      includeSpecialEleven,
      random,
      mutationBudget,
      maxTwoLetterSlots,
      options.preserveScaffold === true
    );
    if (!mutated.candidate) {
      history.push('TOPOLOGY_REJECTED');
      continue;
    }

    if (!fallback) fallback = { candidate: mutated.candidate, scaffoldIndex, mutations: mutated.accepted };
    if (mutated.accepted === 0 && !includeSpecialEleven && options.preserveScaffold !== true) {
      history.push('VALID_SCAFFOLD_WITHOUT_MUTATION');
      continue;
    }

    return {
      ok: true,
      seed,
      attempts: attempt,
      scaffoldIndex,
      mutationCount: mutated.accepted,
      mutationTries: mutated.tried,
      topology: mutated.candidate,
      rejectedAttempts: attempt - 1,
      diagnostics: history.slice(-8)
    };
  }

  if (fallback) {
    return {
      ok: true,
      seed,
      attempts: maxAttempts + 1,
      scaffoldIndex: fallback.scaffoldIndex,
      mutationCount: fallback.mutations,
      mutationTries: mutationBudget,
      topology: fallback.candidate,
      rejectedAttempts: maxAttempts,
      diagnostics: ['SEEDED_MUTATION_BUDGET_EXHAUSTED', 'VALIDATED_SCAFFOLD_FALLBACK', ...history.slice(-6)]
    };
  }

  return {
    ok: false,
    reason: 'NO_VALID_TOPOLOGY',
    seed,
    attempts: maxAttempts,
    rejectedAttempts: maxAttempts,
    diagnostics: history.slice(-12),
    message: 'Не удалось построить геометрически корректную топологию 8×12.'
  };
}


/** Exposes the preflight geometry metrics for regression tests and diagnostics. */
export function diagnoseTopologyScaffold(extraRows = [4, 8], options = {}) {
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const rows = includeSpecialEleven ? [...LOW_SHORT_SCAFFOLD] : createScaffold({ col4Rows: extraRows, col5Rows: [4, 8], rightEdgeRows: [3, 7] });
  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix);
  const validation = validateTopology(grid, {
    requireConnected: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: !includeSpecialEleven,
    minimumOuterBoundaryLength: includeSpecialEleven ? undefined : 2
  });
  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: includeSpecialEleven, allowOuterBoundarySlots: !includeSpecialEleven, minimumOuterBoundaryLength: includeSpecialEleven ? undefined : 2 });
  return {
    pattern: rows,
    valid: validation.valid,
    validationErrors: validation.errors,
    validationMetrics: validation.metrics,
    slotErrors: derived.errors,
    warnings: derived.warnings,
    slotLengths: derived.slots.map(slot => slot.length),
    questionCells: validation.metrics.questionCells,
    letterCells: validation.metrics.letterCells,
    interiorQuestionCells: countInteriorQuestions(matrix),
    twoLetterSlots: derived.slots.filter(slot => slot.length === 2).length,
    longSlots: derived.slots.filter(slot => slot.length >= 3).length,
    slotCount: derived.slots.length
  };
}

/** Returns detailed independent diagnostics for a hand-authored 8x12 role mask. */
export function diagnoseTopologyPattern(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length !== CONFIG.HEIGHT
    || rows.some(row => typeof row !== 'string' || row.length !== CONFIG.WIDTH)) {
    return { valid: false, errors: [{ type: 'INVALID_PATTERN_SHAPE' }] };
  }
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix);
  const topologyOptions = {
    requireConnected: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: !includeSpecialEleven,
    minimumOuterBoundaryLength: includeSpecialEleven ? undefined : 2
  };
  const validation = validateTopology(grid, topologyOptions);
  const derived = deriveWordSlots(grid, topologyOptions);
  return {
    valid: validation.valid && derived.errors.length === 0,
    errors: validation.errors,
    slotErrors: derived.errors,
    warnings: derived.warnings,
    metrics: validation.metrics,
    slotCount: derived.slots.length,
    slotLengths: derived.slots.map(slot => slot.length),
    shortSlots: derived.slots.filter(slot => slot.length === 2).length,
    longSlots: derived.slots.filter(slot => slot.length >= 3).length,
    interiorQuestionCells: countInteriorQuestions(matrix),
    topQuestions: countTopQuestions(matrix),
    rightEdgeQuestions: countRightEdgeQuestions(matrix)
  };
}

export function getTopologyScaffolds() {
  return SCAFFOLDS.map(rows => [...rows]);
}
