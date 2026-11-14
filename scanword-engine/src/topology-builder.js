import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';

/*
 * Connected 8x12 geometry with one vertical clue chain in column 4.
 * The chain starts at the top border and reaches the bottom border; every
 * horizontal answer crosses it, so all 12 rows belong to one word graph.
 * Its four clue cells split only four rows and create six controlled
 * two-letter answers in total.
 */
const SCAFFOLD_ROWS = Object.freeze([
  [4, 8, 11],
  [3, 7, 11],
  [4, 7, 11]
]);

function createScaffold(extraRows) {
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) {
      cells[1] = '#';
      cells[4] = '#';
    } else {
      cells[0] = '#';
      if (extraRows.includes(row)) cells[4] = '#';
    }
    cells[7] = '#';
    return cells.join('');
  });
}

const SCAFFOLDS = Object.freeze(SCAFFOLD_ROWS.map(createScaffold));

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

function inspectCandidate(matrix, includeSpecialEleven) {
  if (matrix.length !== CONFIG.HEIGHT || matrix.some(row => row.length !== CONFIG.WIDTH)) return null;
  if (matrix[0][0] !== '.' || matrix[0][1] !== '#') return null;
  if (countTopQuestions(matrix) < 2) return null;
  // Keep column 3 letter-only for special puzzles: otherwise a left-border
  // crossing can become a two-letter slot dictated by the eleven-letter word.
  if (includeSpecialEleven && matrix.some(row => row[3] === '#')) return null;

  for (let row = 1; row < CONFIG.HEIGHT; row++) {
    if (matrix[row][0] !== '#') return null;
    if (matrix[row][1] !== '.' || matrix[row][2] !== '.') return null;
  }

  const grid = toRoleGrid(matrix);
  const topologyOptions = {
    requireConnected: true,
    allowSpecialElevenBoundary: includeSpecialEleven
  };
  const validation = validateTopology(grid, topologyOptions);
  if (!validation.valid || validation.metrics.totalCells !== CONFIG.TOTAL_CELLS) return null;
  if (validation.metrics.questionCells < 20 || validation.metrics.letterCells < 30) return null;

  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: includeSpecialEleven });
  const minimumSlots = 19 + (includeSpecialEleven ? 1 : 0);
  const twoLetterSlots = derived.slots.filter(slot => slot.length === 2).length;
  const longSlots = derived.slots.filter(slot => slot.length >= 3).length;
  if (derived.errors.length || derived.slots.length < minimumSlots) return null;
  if (twoLetterSlots < 4 || twoLetterSlots > 8 || longSlots < 12) return null;

  return {
    grid,
    slots: derived.slots,
    validation,
    pattern: matrix.map(row => row.join('')),
    metrics: {
      totalCells: CONFIG.TOTAL_CELLS,
      questionCells: validation.metrics.questionCells,
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

/**
 * Apply bounded seeded mutations only to internal cells. A mutation is kept
 * only when the independent geometry validator still proves complete letter
 * coverage, connected clue structure, valid answer lengths and active clues.
 */
function mutateValidatedScaffold(baseRows, includeSpecialEleven, random, budget = 96) {
  const matrix = cloneRows(baseRows);
  let candidate = inspectCandidate(matrix, includeSpecialEleven);
  if (!candidate) return { candidate: null, accepted: 0, tried: 0 };

  const targetMutations = 2 + Math.floor(random() * 5);
  const touched = new Set();
  let accepted = 0;
  let tried = 0;

  for (let attempt = 0; attempt < budget && accepted < targetMutations; attempt++) {
    const row = 1 + Math.floor(random() * (CONFIG.HEIGHT - 1));
    // Columns 1 and 2 stay letters. Special boards also keep column 3
    // clear so the eleven-letter answer never forces an unapproved short crossing.
    const minMutationColumn = includeSpecialEleven ? 4 : 3;
    const mutationColumnCount = CONFIG.WIDTH - 1 - minMutationColumn;
    const col = minMutationColumn + Math.floor(random() * mutationColumnCount);
    const key = row + ',' + col;
    if (touched.has(key)) continue;
    touched.add(key);
    tried++;

    const previous = matrix[row][col];
    matrix[row][col] = previous === '#' ? '.' : '#';
    const next = inspectCandidate(matrix, includeSpecialEleven);

    if (next) {
      candidate = next;
      accepted++;
    } else {
      matrix[row][col] = previous;
    }
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
  const history = [];
  let fallback = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const scaffoldIndex = Math.floor(random() * SCAFFOLDS.length);
    const mutated = mutateValidatedScaffold(
      SCAFFOLDS[scaffoldIndex],
      includeSpecialEleven,
      random,
      mutationBudget
    );
    if (!mutated.candidate) {
      history.push('TOPOLOGY_REJECTED');
      continue;
    }

    if (!fallback) fallback = { candidate: mutated.candidate, scaffoldIndex, mutations: mutated.accepted };
    if (mutated.accepted === 0) {
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

export function getTopologyScaffolds() {
  return SCAFFOLDS.map(rows => [...rows]);
}
