import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRequiredBorderFeasibility, deriveWordSlots, getAnswerCoordinates, validateTopology } from '../src/topology.js';
import { diagnoseTopologyPattern, diagnoseTopologyScaffold, generateTopology, getTopologyScaffolds } from '../src/topology-builder.js';

function makeGrid(defaultType = 'letter') {
  return Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({
    row, col, type: defaultType,
    letter: defaultType === 'letter' ? 'А' : null,
    questionIds: [], wordIds: []
  })));
}

function setQuestion(grid, row, col) {
  grid[row][col] = {
    row, col, type: 'question', letter: null,
    questionIds: ['q-' + row + '-' + col], wordIds: []
  };
}

function gridFromPattern(rows) {
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
  for (const row of [4, 8]) {
    for (const col of [1, 2]) {
      grid[row][col] = {
        row, col, type: 'junction', letter: 'А',
        clueDirections: ['down'], questionIds: [], wordIds: []
      };
    }
  }
  return grid;
}

test('derives horizontal answer slots in both directions', () => {
  const grid = makeGrid();
  setQuestion(grid, 2, 0);
  setQuestion(grid, 2, 4);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'horizontal' && item.endpoints[0].row === 2);
  assert.ok(slot);
  assert.equal(slot.length, 3);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['right', 'left']);
  assert.deepEqual(slot.directionOptions[0].coordinates, [
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }
  ]);
  assert.deepEqual(slot.directionOptions[1].coordinates, [
    { row: 2, col: 3 }, { row: 2, col: 2 }, { row: 2, col: 1 }
  ]);
  assert.deepEqual(slot.directionOptions[1].clueCell, { row: 2, col: 4 });
});

test('derives vertical answer slots in both directions', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 4);
  setQuestion(grid, 5, 4);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'vertical' && item.endpoints[0].col === 4);
  assert.ok(slot);
  assert.equal(slot.length, 4);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['down', 'up']);
  assert.deepEqual(slot.directionOptions[1].coordinates, [
    { row: 4, col: 4 }, { row: 3, col: 4 }, { row: 2, col: 4 }, { row: 1, col: 4 }
  ]);
});

test('coordinate helper supports all four directions and enforces bounds', () => {
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'right', 2), [
    { row: 2, col: 3 }, { row: 2, col: 4 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'down', 2), [
    { row: 3, col: 2 }, { row: 4, col: 2 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'left', 2), [
    { row: 2, col: 1 }, { row: 2, col: 0 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'up', 2), [
    { row: 1, col: 2 }, { row: 0, col: 2 }
  ]);
  assert.equal(getAnswerCoordinates({ row: 2, col: 0 }, 'left', 1), null);
  assert.equal(getAnswerCoordinates({ row: 0, col: 2 }, 'up', 1), null);
});

test('does not turn a one-letter gap into an answer', () => {
  const grid = makeGrid();
  setQuestion(grid, 2, 0);
  setQuestion(grid, 2, 2);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  assert.equal(result.slots.some(item => item.axis === 'horizontal' && item.endpoints[0].row === 2), false);
  assert.ok(result.warnings.some(item => item.type === 'SINGLE_LETTER_GAP'));
});

test('every independent template has the complete top/left clue borders and connected coverage', () => {
  const templates = getTopologyScaffolds();
  assert.equal(templates.length, 20);
  for (const [index, rows] of templates.entries()) {
    const diagnostics = diagnoseTopologyPattern(rows);
    assert.equal(diagnostics.valid, true, 'template=' + index + ' ' + JSON.stringify(diagnostics));
    assert.equal(rows[0], '.#######');
    for (let row = 1; row < 12; row++) assert.equal(rows[row][0], '#');
    assert.ok(diagnostics.slotCount >= 20);
    assert.ok(diagnostics.shortSlots >= 1 && diagnostics.shortSlots <= 5);
    assert.ok(diagnostics.longSlots >= 12);
  }
});

test('topology validator cannot be bypassed into allowing a partial top border', () => {
  const rows = getTopologyScaffolds()[0];
  const partial = [...rows];
  partial[0] = '.###.###';
  const result = validateTopology(gridFromPattern(partial), {
    requireConnected: true,
    requireFullTopBorder: false,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: true
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.type === 'TOP_BORDER_NOT_QUESTION'));
});

test('topology validator rejects a question cell with no valid outgoing slot', () => {
  const rows = getTopologyScaffolds()[0];
  const inactive = [...rows];
  // At (2,2), both the incoming top/left runs would contain only one
  // letter before this new clue, so the clue cannot own a valid answer.
  inactive[2] = inactive[2].slice(0, 2) + '#' + inactive[2].slice(3);
  const result = validateTopology(gridFromPattern(inactive), {
    requireConnected: true,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: true
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.type === 'QUESTION_WITHOUT_SLOT'));
});

test('top border answer columns are split into short vertical segments at clue-letter junctions', () => {
  const grid = gridFromPattern(getTopologyScaffolds()[0]);
  const derived = deriveWordSlots(grid, {
    allowSpecialElevenBoundary: false,
    allowOuterBoundarySlots: true,
    minimumOuterBoundaryLength: 2
  });
  const vertical = derived.slots.filter(slot =>
    slot.axis === 'vertical' && [1, 2].includes(slot.endpoints[0].col)
    && [1, 2].includes(slot.endpoints[1].col)
  );
  assert.equal(vertical.length, 6);
  assert.ok(vertical.every(slot => slot.length === 3));
  assert.equal(derived.slots.some(slot => slot.length === 11), false);
  assert.ok(grid.flat().filter(cell => cell.type === 'junction').length >= 8);
  assert.ok(vertical.every(slot => slot.directionOptions.some(option => option.direction === 'down')));
});

test('ordinary topology never creates a featured eleven-letter answer', () => {
  const result = generateTopology({ seed: 123, includeSpecialEleven: false, maxAttempts: 8 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.topology.slots.some(slot => slot.length === 11), false);
  assert.equal(result.topology.slots.some(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'), false);
});


test('ordinary production layout preserves the full top clue border and has no 11-letter slot', () => {
  const diagnostics = diagnoseTopologyScaffold(0, { includeSpecialEleven: false });
  assert.equal(diagnostics.valid, true, JSON.stringify(diagnostics));
  assert.equal(diagnostics.elevenLetterSlots, 0);
  assert.equal(diagnostics.pattern[0], '.#######');

  const generated = generateTopology({
    seed: 77123,
    lowShortLayout: false,
    includeSpecialEleven: false,
    maxAttempts: 24,
    mutationBudget: 96,
    maxTwoLetterSlots: 5
  });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  assert.equal(generated.topology.pattern[0], '.#######');
  assert.ok(generated.topology.pattern[0].slice(1).split('').every(cell => cell === '#'));
  assert.equal(generated.topology.slots.some(slot => slot.length === 11), false);
  assert.equal(generated.topology.slots.some(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'), false);
});

test('every fourth production layout adds exactly one 11-letter answer to the full-border grid', () => {
  const diagnostics = diagnoseTopologyScaffold(0, { includeSpecialEleven: true });
  assert.equal(diagnostics.valid, true, JSON.stringify(diagnostics));
  assert.equal(diagnostics.elevenLetterSlots, 1);
  assert.equal(diagnostics.pattern[0], '.#######');

  const generated = generateTopology({
    seed: 77124,
    lowShortLayout: false,
    includeSpecialEleven: true,
    maxAttempts: 24,
    maxTwoLetterSlots: 5,
    preserveScaffold: true
  });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  assert.equal(generated.topology.pattern[0], '.#######');
  const long = generated.topology.slots.filter(slot => slot.length === 11);
  assert.equal(long.length, 1);
  assert.equal(long[0].special, 'ELEVEN_LETTER_BOTTOM_BOUNDARY');
});

test('border feasibility reports a fixed 8x12 full-border contract', () => {
  const result = analyzeRequiredBorderFeasibility();
  assert.equal(result.feasible, true);
  assert.equal(result.reason, 'FIXED_FULL_TOP_AND_LEFT_BORDER');
  assert.deepEqual(result.requiredTopBorderColumns, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(result.emptyCorner, { row: 0, col: 0 });
  assert.deepEqual(result.requiredLeftBorderRows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const unsupported = analyzeRequiredBorderFeasibility({ width: 9, height: 12 });
  assert.equal(unsupported.feasible, null);
  assert.equal(unsupported.reason, 'UNSUPPORTED_DIMENSIONS');
});

test('seeded topology generation is deterministic and provides reverse answer directions', () => {
  const options = { seed: 90317, includeSpecialEleven: false, maxAttempts: 12 };
  const first = generateTopology(options);
  const second = generateTopology(options);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.deepEqual(first.topology.pattern, second.topology.pattern);
  assert.ok(first.topology.slots.every(slot =>
    slot.directionOptions.length >= 1
    && slot.directionOptions.every(option => ['right', 'down', 'left', 'up'].includes(option.direction))
  ));
  assert.ok(first.topology.slots.some(slot => slot.directionOptions.some(item => item.direction === 'left')));
  assert.ok(first.topology.slots.some(slot => slot.directionOptions.some(item => item.direction === 'up')));
  assert.ok(first.topology.slots.some(slot => slot.directionOptions.length === 1));
});
