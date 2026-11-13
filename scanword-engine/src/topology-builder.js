import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';

/*
 * Twelve safe variants of one balanced 8x12 geometry.
 * Every board has 18 ordinary answer slots and four short, but meaningful,
 * two-letter slots. The short-answer whitelist in the CSP excludes pronouns,
 * particles and arbitrary two-letter fragments.
 *
 * Two staggered vertical runs (columns 4 and 5 in zero-based coordinates)
 * cross the full-width horizontal rows and keep the complete word graph
 * connected. The optional 11-letter word still runs down column 1.
 */
const SCAFFOLD_PAIRS = Object.freeze([
  [[1, 5], [2, 6]],
  [[2, 6], [3, 7]],
  [[3, 7], [4, 8]],
  [[4, 8], [5, 9]],
  [[5, 9], [6, 10]],
  [[6, 10], [7, 11]],
  [[1, 5], [3, 7]],
  [[2, 6], [4, 8]],
  [[3, 7], [5, 9]],
  [[4, 8], [6, 10]],
  [[5, 9], [7, 11]],
  [[1, 5], [4, 8]]
]);

function createScaffold([columnThreeRows, columnFourRows]) {
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => {
    const cells = Array(CONFIG.WIDTH).fill('.');
    if (row === 0) cells[1] = '#';
    else cells[0] = '#';
    cells[7] = '#';

    if (columnThreeRows.includes(row)) cells[3] = '#';
    if (columnFourRows.includes(row)) cells[4] = '#';
    return cells.join('');
  });
}

const SCAFFOLDS = Object.freeze(SCAFFOLD_PAIRS.map(createScaffold));

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
  const expectedSlots = 18 + (includeSpecialEleven ? 1 : 0);
  if (derived.errors.length || derived.slots.length !== expectedSlots) return null;
  if (derived.slots.filter(slot => slot.length === 2).length !== 4) return null;

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
 * Selects a seeded, fully validated role mask. Geometry is always checked
 * before the dictionary solver is called; the masks contain no stored words.
 */
export function generateTopology(options = {}) {
  const seed = options.seed ?? 1;
  const random = createRng(seed);
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const maxAttempts = Math.max(1, Math.min(512, options.maxAttempts ?? 96));
  const history = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const scaffoldIndex = Math.floor(random() * SCAFFOLDS.length);
    const matrix = cloneRows(SCAFFOLDS[scaffoldIndex]);
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

  for (let scaffoldIndex = 0; scaffoldIndex < SCAFFOLDS.length; scaffoldIndex++) {
    const candidate = inspectCandidate(cloneRows(SCAFFOLDS[scaffoldIndex]), includeSpecialEleven);
    if (candidate) {
      return {
        ok: true,
        seed,
        attempts: maxAttempts + 1,
        scaffoldIndex,
        topology: candidate,
        rejectedAttempts: maxAttempts,
        diagnostics: ['SEEDED_TOPOLOGY_RETRIES_EXHAUSTED', 'VALIDATED_SCAFFOLD_FALLBACK']
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
