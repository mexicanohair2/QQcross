import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';

/*
 * The original three scaffolds remain available for broad topology exploration.
 * The fourth, low-short-answer scaffold is reserved for the optional 11-letter
 * layout. It is not connected when that boundary answer is omitted.
 */
const SCAFFOLD_ROWS = Object.freeze([
  [4, 8],
  [3, 7],
  [5, 9]
]);

function createScaffold(extraRows) {
  // Keep the left clue border and several top anchors. The two cells between
  // the top-left anchor and the first upper interior anchor remain letters:
  // making them clues would force a second unavoidable 11-letter down answer.
  // Interior columns 3–6 carry staggered crossings; the right edge is open.
  const col3Rows = new Set([1, 5]);
  const rowAnchorColumns = [4, 4, 6, 4, 4, 5, 5, 4, 6, 5, 4];
  const col5Rows = new Set([3, 7]);
  const col6Rows = new Set([4, 8]);
  const rightEdgeRows = new Set([4, 8]);
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) {
      for (const col of [1, 4, 5, 6, 7]) cells[col] = '#';
    } else {
      cells[0] = '#';
      cells[rowAnchorColumns[row - 1]] = '#';
      if (col3Rows.has(row)) cells[3] = '#';
      if (extraRows.includes(row)) cells[4] = '#';
      if (col5Rows.has(row)) cells[5] = '#';
      if (col6Rows.has(row)) cells[6] = '#';
      if (rightEdgeRows.has(row)) cells[7] = '#';
    }
    return cells.join('');
  });
}

function createSpecialScaffold(extraRows) {
  // Column 1 is reserved for the optional eleven-letter answer. Column 3
  // remains letter-only so every left-border clue keeps a valid horizontal
  // answer; other interior columns still create multiple crossing chains.
  const col5Rows = new Set([3, 7, 10]);
  const col6Rows = new Set([4, 8]);
  const rowAnchorColumns = [4, 5, 6, 4, 4, 4, 4, 4, 6, 4, 6];
  const rightEdgeRows = new Set([4, 8]);
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) {
      for (const col of [1, 4, 5, 6, 7]) cells[col] = '#';
    } else {
      cells[0] = '#';
      cells[rowAnchorColumns[row - 1]] = '#';
      if (extraRows.includes(row)) cells[4] = '#';
      if (col5Rows.has(row)) cells[5] = '#';
      if (col6Rows.has(row)) cells[6] = '#';
      if (rightEdgeRows.has(row)) cells[7] = '#';
    }
    return cells.join('');
  });
}

const LOW_SHORT_SCAFFOLD = Object.freeze(createSpecialScaffold([3, 7, 10]));

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

function inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots = 8, minimumInteriorQuestionCells = 3) {
  if (matrix.length !== CONFIG.HEIGHT || matrix.some(row => row.length !== CONFIG.WIDTH)) return null;
  if (matrix[0][0] !== '.' || matrix[0][1] !== '#') return null;
  if (countTopQuestions(matrix) < 5) return null;
  const interiorQuestionCells = countInteriorQuestions(matrix);
  if (interiorQuestionCells < Math.max(8, minimumInteriorQuestionCells)) return null;
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
    allowOuterBoundarySlots: true
  };
  const validation = validateTopology(grid, topologyOptions);
  if (!validation.valid || validation.metrics.totalCells !== CONFIG.TOTAL_CELLS) return null;
  if (validation.metrics.questionCells < 20 || validation.metrics.letterCells < 30) return null;

  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: includeSpecialEleven, allowOuterBoundarySlots: true });
  const minimumSlots = 19 + (includeSpecialEleven ? 1 : 0);
  const twoLetterSlots = derived.slots.filter(slot => slot.length === 2).length;
  const longSlots = derived.slots.filter(slot => slot.length >= 3).length;
  if (derived.errors.length || derived.slots.length < minimumSlots) return null;
  // Production uses a cap of four short answers; the low-short scaffold starts
  // at two and allows seeded, validator-approved mutations for variety.
  if (twoLetterSlots < 2 || twoLetterSlots > maxTwoLetterSlots || longSlots < 12) return null;

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
function mutateValidatedScaffold(baseRows, includeSpecialEleven, random, budget = 96, maxTwoLetterSlots = 8) {
  const matrix = cloneRows(baseRows);
  let candidate = inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots);
  if (!candidate) return { candidate: null, accepted: 0, tried: 0 };

  // The special 11-letter layout keeps its crossing rows intact. Ordinary
  // layouts receive a bounded number of seeded mutations.
  const targetMutations = includeSpecialEleven ? 0 : 5 + Math.floor(random() * 5);
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

  const requiredInterior = 8;
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
  const random = createRng(seed);
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const maxAttempts = Math.max(1, Math.min(512, options.maxAttempts ?? 96));
  const mutationBudget = Math.max(1, Math.min(512, options.mutationBudget ?? 96));
  const maxTwoLetterSlots = Math.max(2, Math.min(8, options.maxTwoLetterSlots ?? 8));
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
      ? (Array.isArray(options.specialPattern) ? options.specialPattern : createSpecialScaffold(specialRows))
      : SCAFFOLDS[scaffoldIndex];
    const mutated = mutateValidatedScaffold(
      scaffold,
      includeSpecialEleven,
      random,
      mutationBudget,
      maxTwoLetterSlots
    );
    if (!mutated.candidate) {
      history.push('TOPOLOGY_REJECTED');
      continue;
    }

    if (!fallback) fallback = { candidate: mutated.candidate, scaffoldIndex, mutations: mutated.accepted };
    if (mutated.accepted === 0 && !includeSpecialEleven) {
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
  const rows = includeSpecialEleven ? createSpecialScaffold(extraRows) : createScaffold(extraRows);
  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix);
  const validation = validateTopology(grid, {
    requireConnected: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true
  });
  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: includeSpecialEleven, allowOuterBoundarySlots: true });
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

export function getTopologyScaffolds() {
  return SCAFFOLDS.map(rows => [...rows]);
}
