import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';

/*
 * Each scaffold is a complete, independently validated 8x12 role mask.
 * Three aligned interior clue columns create six connected vertical slots;
 * the twelve horizontal slots cover the remaining runs. The geometry has
 * exactly 18 normal answers and at most one two-letter answer (the optional
 * top-row picture clue "ЁЖ"). No letter cell is left as filler.
 */
const SCAFFOLD_ROWS = Object.freeze([
  [0, 4, 8],
  [0, 4, 9],
  [1, 5, 9],
  [1, 5, 10],
  [1, 6, 10],
  [1, 6, 11],
  [2, 6, 10],
  [2, 6, 11],
  [2, 7, 11],
  [3, 7, 11],
  [0, 5, 10],
  [1, 5, 11]
]);

function createScaffold(rows) {
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) {
      cells[1] = '#';
    } else {
      cells[0] = '#';
    }
    cells[7] = '#';
    if (rows.includes(row)) {
      cells[4] = '#';
      cells[5] = '#';
      cells[6] = '#';
    }
    return cells.join('');
  });
}

const SCAFFOLDS = Object.freeze(SCAFFOLD_ROWS.map(createScaffold));

function cloneRows(rows) {
  return rows.map(row => row.split(''));
}

function createRandomMatrix(random) {
  const scaffoldIndex = Math.floor(random() * SCAFFOLDS.length);
  return {
    scaffoldIndex,
    matrix: cloneRows(SCAFFOLDS[scaffoldIndex])
  };
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
  if (derived.errors.length || derived.slots.length !== 18) return null;
  if (derived.slots.filter(slot => slot.length === 2).length > 1) return null;
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
 * Builds a varied role topology before the dictionary is consulted.
 * Top-row omissions are intentional: all those cells must still be covered
 * by a valid horizontal answer run. The left edge and top-left anchor remain
 * the stable scanword frame; the interior mask changes for each seed.
 */
export function generateTopology(options = {}) {
  const seed = options.seed ?? 1;
  const random = createRng(seed);
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const maxAttempts = Math.max(1, Math.min(512, options.maxAttempts ?? 96));
  const history = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const generated = createRandomMatrix(random);
    const scaffoldIndex = generated.scaffoldIndex;
    const matrix = generated.matrix;
    const candidate = inspectCandidate(matrix, includeSpecialEleven);
    if (!candidate) {
      history.push('TOPOLOGY_REJECTED');
      continue;
    }

    return {
      ok: true,
      seed,
      attempts: attempt,
      scaffoldIndex,
      topology: candidate,
      rejectedAttempts: attempt - 1,
      diagnostics: history.slice(-8)
    };
  }

  // All scaffolds are independently validated. This deterministic fallback
  // avoids returning an unverified partial board when random edits all fail.
  const fallbackOrder = Array.from({ length: SCAFFOLDS.length }, (_, index) => index);
  for (let index = fallbackOrder.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [fallbackOrder[index], fallbackOrder[swap]] = [fallbackOrder[swap], fallbackOrder[index]];
  }
  for (const scaffoldIndex of fallbackOrder) {
    const candidate = inspectCandidate(cloneRows(SCAFFOLDS[scaffoldIndex]), includeSpecialEleven);
    if (candidate) {
      return {
        ok: true,
        seed,
        attempts: maxAttempts + 1,
        scaffoldIndex,
        topology: candidate,
        rejectedAttempts: maxAttempts,
        diagnostics: ['RANDOMIZED_TOPOLOGIES_EXHAUSTED', 'VALIDATED_SCAFFOLD_FALLBACK']
      };
    }
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
