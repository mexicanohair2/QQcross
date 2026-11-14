import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRequiredBorderFeasibility, deriveWordSlots, getAnswerCoordinates, validateTopology } from '../src/topology.js';
import { diagnoseTopologyScaffold, generateTopology } from '../src/topology-builder.js';

function makeGrid(defaultType = 'letter') {
  return Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({
    row,
    col,
    type: defaultType,
    letter: defaultType === 'letter' ? 'А' : null,
    questionIds: [],
    wordIds: []
  })));
}

function setQuestion(grid, row, col) {
  grid[row][col] = {
    row,
    col,
    type: 'question',
    letter: null,
    questionIds: ['q-' + row + '-' + col],
    wordIds: []
  };
}

test('derives horizontal slots and both horizontal orientations', () => {
  const grid = makeGrid();
  setQuestion(grid, 2, 0);
  setQuestion(grid, 2, 4);

  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'horizontal' && item.endpoints[0].row === 2);

  assert.ok(slot);
  assert.equal(slot.length, 3);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['right', 'left']);
  assert.deepEqual(slot.directionOptions[0].coordinates, [
    { row: 2, col: 1 },
    { row: 2, col: 2 },
    { row: 2, col: 3 }
  ]);
  assert.deepEqual(slot.directionOptions[1].coordinates, [
    { row: 2, col: 3 },
    { row: 2, col: 2 },
    { row: 2, col: 1 }
  ]);
});

test('derives vertical slots and both vertical orientations', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 4);
  setQuestion(grid, 5, 4);

  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'vertical' && item.endpoints[0].col === 4);

  assert.ok(slot);
  assert.equal(slot.length, 4);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['down', 'up']);
});

test('does not turn a one-letter gap into an answer', () => {
  const grid = makeGrid();
  setQuestion(grid, 2, 0);
  setQuestion(grid, 2, 2);

  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  assert.equal(result.slots.some(item => item.axis === 'horizontal' && item.endpoints[0].row === 2), false);
  assert.ok(result.warnings.some(item => item.type === 'SINGLE_LETTER_GAP'));
});

test('recognizes only the exact eleven-letter bottom boundary exception', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 1);

  const result = deriveWordSlots(grid);
  const special = result.slots.find(item => item.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY');

  assert.ok(special);
  assert.equal(special.length, 11);
  assert.deepEqual(special.coordinates[0], { row: 1, col: 1 });
  assert.deepEqual(special.coordinates[10], { row: 11, col: 1 });
  assert.deepEqual(special.directionOptions.map(item => item.direction), ['down']);
});

test('does not grant the boundary exception when an intermediate cell is a clue', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 1);
  setQuestion(grid, 7, 1);

  const result = deriveWordSlots(grid);
  assert.equal(result.slots.some(item => item.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'), false);
});

test('validates borders and reports unassigned and orphan cells independently', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };
  for (let col = 1; col < 8; col++) setQuestion(grid, 0, col);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);
  grid[5][5] = { row: 5, col: 5, type: 'unassigned', letter: null, questionIds: [], wordIds: [] };

  const result = validateTopology(grid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(item => item.type === 'UNASSIGNED_OR_INVALID_CELL'));
  assert.ok(result.errors.some(item => item.type === 'ORPHAN_LETTER'));
  assert.equal(result.metrics.totalCells, 96);
});

test('coordinate helper obeys the canonical four-direction table', () => {
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'right', 2), [
    { row: 2, col: 3 }, { row: 2, col: 4 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'left', 2), [
    { row: 2, col: 1 }, { row: 2, col: 0 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'down', 2), [
    { row: 3, col: 2 }, { row: 4, col: 2 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'up', 2), [
    { row: 1, col: 2 }, { row: 0, col: 2 }
  ]);
  assert.equal(getAnswerCoordinates({ row: 0, col: 0 }, 'up', 1), null);
});

test('supports dynamic top-row clue omissions while covering all 96 cells', () => {
  const rows = [
    '.#..#..#',
    '#..#.##.',
    '#..#....',
    '#......#',
    '#...#..#',
    '#...#.##',
    '#..#..#.',
    '#....##.',
    '#..#...#',
    '#....#..',
    '#..#..#.',
    '#......#'
  ];
  const grid = makeGrid('letter');
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) {
        grid[row][col] = { row, col, type: 'corner', letter: null, questionIds: [], wordIds: [] };
      } else if (rows[row][col] === '#') {
        setQuestion(grid, row, col);
      }
    }
  }

  const result = validateTopology(grid, { requireConnected: true });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.metrics.totalCells, 96);
  assert.equal(result.metrics.questionCells, 34);
  assert.ok(result.metrics.horizontalSlots + result.metrics.verticalSlots >= 25);
  assert.ok(result.slots.some(slot => slot.axis === 'horizontal' && slot.endpoints[0].row === 0));
  assert.ok(result.errors.length === 0);
});

test('requires the top-left anchor and complete left border, but not every top-row cell', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };
  setQuestion(grid, 0, 1);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);

  const result = validateTopology(grid);
  assert.ok(result.errors.some(item => item.type === 'QUESTION_WITHOUT_SLOT'));
  assert.ok(!result.errors.some(item => item.type === 'TOP_ROW_NOT_QUESTION'));

  grid[0][1] = { row: 0, col: 1, type: 'letter', letter: 'А', questionIds: [], wordIds: [] };
  const missingAnchor = validateTopology(grid);
  assert.ok(missingAnchor.errors.some(item => item.type === 'TOP_LEFT_BORDER_ANCHOR_MISSING'));
});

test('the 8x12 preflight permits the dynamically generated top border', () => {
  const result = analyzeRequiredBorderFeasibility();
  assert.equal(result.feasible, true);
  assert.equal(result.reason, 'DYNAMIC_TOP_BORDER_SUPPORTED');
  assert.equal(result.width, 8);
  assert.equal(result.height, 12);
  assert.deepEqual(result.requiredTopAnchor, { row: 0, col: 1 });
  assert.deepEqual(result.requiredLeftBorderRows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  const unsupported = analyzeRequiredBorderFeasibility({ width: 9, height: 12 });
  assert.equal(unsupported.feasible, null);
  assert.equal(unsupported.reason, 'UNSUPPORTED_DIMENSIONS');
});


test('production interior-clue scaffold is a connected, fully covered 8x12 topology', () => {
  const diagnostics = diagnoseTopologyScaffold([4, 8]);
  assert.equal(diagnostics.valid, true, JSON.stringify(diagnostics));
  assert.equal(diagnostics.questionCells, 27);
  assert.equal(diagnostics.interiorQuestionCells, 9);
  assert.equal(diagnostics.pattern.filter(row => row[7] === '#').length, 3);
  assert.ok(diagnostics.slotCount >= 19);
  assert.ok(diagnostics.twoLetterSlots <= 8);
  assert.ok(diagnostics.longSlots >= 12);
});

test('generates varied, connected topologies rather than one fixed board layout', () => {
  const patterns = new Set();
  for (let seed = 1; seed <= 24; seed++) {
    const result = generateTopology({ seed, includeSpecialEleven: false, maxAttempts: 128 });
    assert.equal(result.ok, true, 'seed=' + seed + ' ' + JSON.stringify(result));
    assert.equal(result.topology.validation.valid, true);
    assert.equal(result.topology.metrics.totalCells, 96);
    assert.equal(result.topology.pattern.length, 12);
    assert.ok(result.topology.slots.length >= 19);
    assert.ok(result.topology.slots.filter(slot => slot.length === 2).length <= 8);
    assert.ok(result.topology.metrics.questionCells >= 20);
    patterns.add(result.topology.pattern.join('/'));
  }
  assert.ok(patterns.size >= 3, 'expected multiple distinct topologies, got ' + patterns.size);
});

test('offers the exact optional eleven-letter vertical boundary slot', () => {
  const result = generateTopology({ seed: 123, includeSpecialEleven: true, maxAttempts: 128 });
  assert.equal(result.ok, true);
  const special = result.topology.slots.find(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY');
  assert.ok(special);
  assert.equal(special.length, 11);
  assert.deepEqual(special.directionOptions.map(item => item.direction), ['down']);
  assert.deepEqual(special.coordinates[0], { row: 1, col: 1 });
  assert.deepEqual(special.coordinates[10], { row: 11, col: 1 });
});
