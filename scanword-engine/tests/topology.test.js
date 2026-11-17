import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRequiredBorderFeasibility, deriveWordSlots, getAnswerCoordinates, validateTopology } from '../src/topology.js';
import { generateTopology } from '../src/topology-builder.js';

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
  assert.equal(result.slots.some(item =>
    item.axis === 'horizontal'
    && item.special !== 'RIGHT_EDGE_BOUNDARY'
    && item.endpoints[0].row === 2
  ), false, 'the one-letter gap between adjacent clue cells must not become an answer');
  assert.ok(result.slots.some(item =>
    item.special === 'RIGHT_EDGE_BOUNDARY' && item.endpoints[0].row === 2
  ), 'the separate right-edge answer must remain registered');
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

test('enforces the two active top anchors and the 8×12 right-edge board contract', () => {
  const rows = [
    '.#...#..',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#....#..',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#...#...',
    '#....#..'
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

  const result = validateTopology(grid, { requireConnected: true, allowSpecialElevenBoundary: false });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.metrics.totalCells, 96);
  assert.equal(result.metrics.questionCells, 24);
  assert.equal(result.metrics.letterCells, 71);
  assert.ok(result.metrics.horizontalSlots + result.metrics.verticalSlots >= 25);
  assert.equal(result.slots.filter(slot => slot.special === 'RIGHT_EDGE_BOUNDARY').length, 12);
  assert.ok(result.slots.every(slot => slot.length >= 2));
  assert.equal(result.errors.length, 0);

  const wrongTop = rows.map(row => row.split(''));
  wrongTop[0][2] = '#';
  const wrongTopGrid = makeGrid('letter');
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) {
        wrongTopGrid[row][col] = { row, col, type: 'corner', letter: null, questionIds: [], wordIds: [] };
      } else if (wrongTop[row][col] === '#') {
        setQuestion(wrongTopGrid, row, col);
      }
    }
  }
  const rejected = validateTopology(wrongTopGrid);
  assert.ok(rejected.errors.some(item => item.type === 'INVALID_TOP_ROW_ANCHORS'));
});
test('requires the top-left anchor and complete left border, but not every top-row cell', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };
  setQuestion(grid, 0, 1);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);

  const result = validateTopology(grid);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(!result.errors.some(item => item.type === 'TOP_ROW_NOT_QUESTION'));
  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  assert.equal(derived.slots.filter(slot => slot.special === 'RIGHT_EDGE_BOUNDARY').length, 12);

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
    assert.ok(result.topology.metrics.centerQuestionCells >= 3);
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


test('rejects every question cell in the rightmost canonical column', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };
  setQuestion(grid, 0, 1);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);
  setQuestion(grid, 6, 7);

  const result = validateTopology(grid);
  assert.ok(result.errors.some(item => item.type === 'RIGHTMOST_COLUMN_QUESTION'));
});

test('derives a named right-edge answer from the final real clue to column 7', () => {
  const grid = makeGrid('letter');
  setQuestion(grid, 5, 0);
  setQuestion(grid, 5, 5);

  const result = deriveWordSlots(grid);
  const edge = result.slots.find(slot => slot.special === 'RIGHT_EDGE_BOUNDARY');

  assert.ok(edge, 'the final two letters must form an anchored right-edge answer');
  assert.equal(edge.length, 2);
  assert.deepEqual(edge.endpoints[0], { row: 5, col: 5 });
  assert.deepEqual(edge.endpoints[1], { row: 5, col: 8, boundary: true });
  assert.deepEqual(edge.directionOptions.map(option => option.direction), ['right']);
  assert.deepEqual(edge.coordinates, [
    { row: 5, col: 6 },
    { row: 5, col: 7 }
  ]);
});

test('generated topologies keep the rightmost column letter-only and anchor every row to a boundary answer', () => {
  for (let seed = 1; seed <= 32; seed++) {
    const result = generateTopology({ seed, includeSpecialEleven: false, maxAttempts: 192 });
    assert.equal(result.ok, true, 'seed=' + seed + ' ' + JSON.stringify(result));

    for (let row = 0; row < 12; row++) {
      assert.notEqual(result.topology.pattern[row][7], '#', 'rightmost question at row=' + row + ', seed=' + seed);
      assert.ok(
        result.topology.slots.some(slot =>
          slot.special === 'RIGHT_EDGE_BOUNDARY'
          && slot.endpoints[0].row === row
          && slot.endpoints[1].col === 8
        ),
        'missing right-edge answer at row=' + row + ', seed=' + seed
      );
    }
  }
});


test('rejects a clue in the penultimate column because it creates a one-letter edge answer', () => {
  const grid = makeGrid('letter');
  setQuestion(grid, 4, 0);
  setQuestion(grid, 4, 6);

  const result = validateTopology(grid);
  assert.ok(result.errors.some(item => item.type === 'RIGHT_EDGE_MINIMUM_LENGTH_BROKEN'));
});
