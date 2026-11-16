import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRequiredBorderFeasibility, deriveWordSlots, getAnswerCoordinates, validateTopology } from '../src/topology.js';
import { diagnoseTopologyPattern, generateTopology, getTopologyScaffolds } from '../src/topology-builder.js';

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
  return grid;
}

test('derives only rightward horizontal answer slots', () => {
  const grid = makeGrid();
  setQuestion(grid, 2, 0);
  setQuestion(grid, 2, 4);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'horizontal' && item.endpoints[0].row === 2);
  assert.ok(slot);
  assert.equal(slot.length, 3);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['right']);
  assert.deepEqual(slot.directionOptions[0].coordinates, [
    { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }
  ]);
});

test('derives only downward vertical answer slots', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 4);
  setQuestion(grid, 5, 4);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'vertical' && item.endpoints[0].col === 4);
  assert.ok(slot);
  assert.equal(slot.length, 4);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['down']);
});

test('coordinate helper rejects left and up directions', () => {
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'right', 2), [
    { row: 2, col: 3 }, { row: 2, col: 4 }
  ]);
  assert.deepEqual(getAnswerCoordinates({ row: 2, col: 2 }, 'down', 2), [
    { row: 3, col: 2 }, { row: 4, col: 2 }
  ]);
  assert.equal(getAnswerCoordinates({ row: 2, col: 2 }, 'left', 2), null);
  assert.equal(getAnswerCoordinates({ row: 2, col: 2 }, 'up', 2), null);
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

test('the first two mandatory top clues create two 11-letter downward slots', () => {
  const grid = gridFromPattern(getTopologyScaffolds()[0]);
  const derived = deriveWordSlots(grid, {
    allowSpecialElevenBoundary: false,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: true
  });
  const eleven = derived.slots.filter(slot => slot.length === 11 && slot.special === 'OUTER_BOUNDARY');
  assert.equal(eleven.length, 2);
  assert.deepEqual(eleven.map(slot => slot.directionOptions[0].direction), ['down', 'down']);
  assert.deepEqual(eleven.map(slot => slot.directionOptions[0].clueCell.col), [1, 2]);
});

test('optional special-eleven metadata marks a single one of the mandatory 11-letter slots', () => {
  const result = generateTopology({ seed: 123, includeSpecialEleven: true, maxAttempts: 8 });
  assert.equal(result.ok, true, JSON.stringify(result));
  const special = result.topology.slots.filter(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY');
  assert.equal(special.length, 1);
  assert.equal(special[0].length, 11);
  assert.deepEqual(special[0].directionOptions.map(item => item.direction), ['down']);
  assert.deepEqual(special[0].coordinates[0], { row: 1, col: 1 });
  assert.deepEqual(special[0].coordinates[10], { row: 11, col: 1 });
});

test('border feasibility reports a fixed 8x12 full-border contract', () => {
  const result = analyzeRequiredBorderFeasibility();
  assert.equal(result.feasible, true);
  assert.equal(result.reason, 'FIXED_FULL_TOP_AND_LEFT_BORDERS');
  assert.deepEqual(result.requiredTopAnchor, { row: 0, col: 1 });
  assert.deepEqual(result.requiredLeftBorderRows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const unsupported = analyzeRequiredBorderFeasibility({ width: 9, height: 12 });
  assert.equal(unsupported.feasible, null);
  assert.equal(unsupported.reason, 'UNSUPPORTED_DIMENSIONS');
});

test('seeded topology generation is deterministic and never adds reverse directions', () => {
  const options = { seed: 90317, includeSpecialEleven: false, maxAttempts: 12 };
  const first = generateTopology(options);
  const second = generateTopology(options);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.deepEqual(first.topology.pattern, second.topology.pattern);
  assert.ok(first.topology.slots.every(slot =>
    slot.directionOptions.length === 1
    && ['right', 'down'].includes(slot.directionOptions[0].direction)
  ));
});
