import { CONFIG } from './config.js';
import { createEmptyGrid } from './grid.js';
import { createRng } from './rng.js';
import { deriveWordSlots, validateTopology } from './topology.js';
import { SCANWORD_TEMPLATES, getScanwordTemplates as listScanwordTemplates } from './template-library.js';

const SCAFFOLDS = Object.freeze(
  SCANWORD_TEMPLATES.map(rows => Object.freeze([...rows]))
);
const LOW_SHORT_SCAFFOLD = Object.freeze([
  '.#...###',
  '#....#..',
  '#...#...',
  '#...#...',
  '#......#',
  '#....##.',
  '#...#...',
  '#...#...',
  '#......#',
  '#....#..',
  '#...#...',
  '#....##.'
]);

function cloneRows(rows) {
  return rows.map(row => row.split(''));
}

const JUNCTION_ROWS = Object.freeze([4, 8]);
const JUNCTION_COLUMNS = Object.freeze([1, 2]);

function toRoleGrid(matrix, includeSpecialEleven = false) {
  const grid = createEmptyGrid();
  for (let row = 0; row < CONFIG.HEIGHT; row++) {
    for (let col = 0; col < CONFIG.WIDTH; col++) {
      if (row === 0 && col === 0) continue;
      const cell = grid[row][col];
      const junctionColumns = includeSpecialEleven ? [2] : JUNCTION_COLUMNS;
      if (JUNCTION_ROWS.includes(row) && junctionColumns.includes(col)) {
        // The vertical clue begins here while the same square remains a
        // letter in the horizontal answer started at the left border.
        cell.type = 'junction';
        cell.letter = 'А';
        cell.clueDirections = ['down'];
      } else {
        cell.type = matrix[row][col] === '#' ? 'question' : 'letter';
        cell.letter = cell.type === 'letter' ? 'А' : null;
      }
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
  const lowShortLayout = false;
  if (!rows || rows.length !== CONFIG.HEIGHT || rows.some(row => row.length !== CONFIG.WIDTH)) return null;
  if (rows[0] !== '.#######') return null;
  if (rows.some((row, index) => index > 0 && row[0] !== '#')) return null;

  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix, includeSpecialEleven);
  const topologyOptions = {
    requireConnected: true,
    requireFullTopBorder: !lowShortLayout,
    allowTopRowHorizontalRun: lowShortLayout,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven && !lowShortLayout,
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

function inspectCandidate(matrix, includeSpecialEleven, maxTwoLetterSlots = 5, minimumInteriorQuestionCells = 5) {
  if (!Array.isArray(matrix) || matrix.length !== CONFIG.HEIGHT
    || matrix.some(row => !Array.isArray(row) || row.length !== CONFIG.WIDTH)) return null;
  const lowShortLayout = matrix[0].join('') === '.#...###';
  if (!lowShortLayout && matrix[0].join('') !== '.#######') return null;

  for (let row = 1; row < CONFIG.HEIGHT; row++) {
    if (matrix[row][0] !== '#') return null;
    if (matrix[row][1] !== '.' || matrix[row][2] !== '.') return null;
  }

  const interiorQuestionCells = countInteriorQuestions(matrix);
  if (interiorQuestionCells < minimumInteriorQuestionCells) return null;

  const grid = toRoleGrid(matrix, includeSpecialEleven);
  const topologyOptions = {
    requireConnected: true,
    requireFullTopBorder: !lowShortLayout,
    allowTopRowHorizontalRun: lowShortLayout,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven && !lowShortLayout,
    minimumOuterBoundaryLength: 2
  };
  const validation = validateTopology(grid, topologyOptions);
  const derived = deriveWordSlots(grid, topologyOptions);
  if (!validation.valid || derived.errors.length
    || validation.metrics.totalCells !== CONFIG.TOTAL_CELLS) return null;
  if (validation.metrics.questionCells < 20 || validation.metrics.letterCells < 30) return null;

  const shortSlots = derived.slots.filter(slot => slot.length === 2);
  const longSlots = derived.slots.filter(slot => slot.length >= 3);
  const elevenSlots = derived.slots.filter(slot =>
    slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
    && slot.axis === 'vertical'
    && slot.length === 11
    && slot.endpoints[0]?.row === 0
  );
  if (shortSlots.length < 1 || shortSlots.length > maxTwoLetterSlots || longSlots.length < 12) return null;
  if (derived.slots.length < 20) return null;
  if (includeSpecialEleven ? elevenSlots.length !== 1 : elevenSlots.length !== 0) return null;

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
      crossingsPotential: validation.metrics.coveredLetters,
      twoLetterSlots: shortSlots.length,
      elevenLetterSlots: elevenSlots.length
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
    (total, row) => total + row.slice(1).filter(value => value === '#').length,
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
  const targetMutations = includeSpecialEleven || preserveScaffold ? 0 : 2 + Math.floor(random() * 4);
  const touched = new Set();
  let accepted = 0;
  let tried = 0;

  for (let attempt = 0; attempt < budget && accepted < targetMutations; attempt++) {
    const row = 3 + Math.floor(random() * (CONFIG.HEIGHT - 3));
    // Preserve the first horizontal answer from the left border: it is the
    // crossing prefix that makes the two top-border vertical lanes solvable.
    const firstQuestion = matrix[row].indexOf('#', 1);
    if (firstQuestion < 0 || firstQuestion >= CONFIG.WIDTH - 1) continue;
    const firstMutableColumn = Math.max(3, firstQuestion + 1);
    if (firstMutableColumn >= CONFIG.WIDTH) continue;
    const col = firstMutableColumn
      + Math.floor(random() * (CONFIG.WIDTH - firstMutableColumn));
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
    && options.scaffoldIndex < SCAFFOLDS.length
    ? options.scaffoldIndex
    : null;
  const history = [];
  let fallback = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const lowShortLayout = options.lowShortLayout !== false || includeSpecialEleven;
    const scaffoldIndex = lowShortLayout
      ? -1
      : requestedScaffoldIndex ?? Math.floor(random() * SCAFFOLDS.length);
    const scaffold = lowShortLayout
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
export function diagnoseTopologyScaffold(templateIndex = 0, options = {}) {
  const includeSpecialEleven = options.includeSpecialEleven === true;
  const lowShortLayout = options.lowShortLayout === true || includeSpecialEleven;
  const selectedIndex = Number.isInteger(templateIndex) && templateIndex >= 0 && templateIndex < SCAFFOLDS.length
    ? templateIndex
    : 0;
  const rows = lowShortLayout ? LOW_SHORT_SCAFFOLD : SCAFFOLDS[selectedIndex];
  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix, includeSpecialEleven);
  const topologyOptions = {
    requireConnected: true,
    requireFullTopBorder: !lowShortLayout,
    allowTopRowHorizontalRun: lowShortLayout,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven && !lowShortLayout,
    minimumOuterBoundaryLength: 2
  };
  const validation = validateTopology(grid, topologyOptions);
  const derived = deriveWordSlots(grid, topologyOptions);
  return {
    pattern: rows,
    valid: validation.valid && derived.errors.length === 0,
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
    elevenLetterSlots: derived.slots.filter(slot => slot.length === 11).length,
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
  const lowShortLayout = options.allowTopRowHorizontalRun === true || includeSpecialEleven;
  const matrix = cloneRows(rows);
  const grid = toRoleGrid(matrix);
  const topologyOptions = {
    requireConnected: true,
    requireFullTopBorder: !lowShortLayout,
    allowTopRowHorizontalRun: lowShortLayout,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven && !lowShortLayout,
    minimumOuterBoundaryLength: 2
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
