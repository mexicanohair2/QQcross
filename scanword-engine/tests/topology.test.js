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

test('derives both horizontal answer directions for a single geometric slot', () => {
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
});

test('derives both vertical answer directions for a single geometric slot', () => {
  const grid = makeGrid();
  setQuestion(grid, 0, 4);
  setQuestion(grid, 5, 4);
  const result = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const slot = result.slots.find(item => item.axis === 'vertical' && item.endpoints[0].col === 4);
  assert.ok(slot);
  assert.equal(slot.length, 4);
  assert.deepEqual(slot.directionOptions.map(item => item.direction), ['down', 'up']);
});

test('coordinate helper supports all four answer directions and rejects out-of-bounds paths', () => {
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
  assert.equal(getAnswerCoordinates({ row: 2, col: 0 }, 'left', 2), null);
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

test('all twenty templates preserve the dynamic top anchor and complete left clue border', () => {
  const templates = getTopologyScaffolds();
  assert.equal(templates.length, 20);
  for (const [index, rows] of templates.entries()) {
    const diagnostics = diagnoseTopologyPattern(rows);
    assert.equal(diagnostics.valid, true, 'template=' + index + ' ' + JSON.stringify(diagnostics));
    assert.equal(rows[0], '.#..#..#');
    for (let row = 1; row < 12; row++) assert.equal(rows[row][0], '#');
    assert.ok(diagnostics.slotCount >= 20);
    assert.ok(diagnostics.shortSlots >= 1 && diagnostics.shortSlots <= 5);
    assert.ok(diagnostics.longSlots >= 12);
    assert.ok(diagnostics.slotLengths.every(length => length <= 10));
  }
});

test('the featured layout creates exactly one five-letter top-row answer and no eleven-letter slot', () => {
  const result = generateTopology({
    seed: 123,
    templateIndex: 0,
    includeSpecialEleven: false,
    featuredShortQuestion: true
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.topology.pattern[0], '.#.....#');
  const featured = result.topology.slots.filter(slot =>
    slot.axis === 'horizontal'
    && slot.length === 5
    && slot.endpoints.some(point => point.row === 0 && point.col === 1)
    && slot.endpoints.some(point => point.row === 0 && point.col === 7)
  );
  assert.equal(featured.length, 1);
  assert.equal(result.topology.slots.some(slot => slot.length === 11), false);
  assert.equal(result.topology.slots.some(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'), false);
});

test('topology validation preserves the top anchor and left border while allowing the short top layout', () => {
  const featured = generateTopology({ seed: 27, templateIndex: 2, featuredShortQuestion: true });
  assert.equal(featured.ok, true, JSON.stringify(featured));
  const validation = validateTopology(featured.topology.grid, {
    requireConnected: true,
    requireFullTopBorder: false,
    allowSpecialElevenBoundary: false,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: false
  });
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(featured.topology.grid[0][1].type, 'question');
  for (let row = 1; row < 12; row++) assert.equal(featured.topology.grid[row][0].type, 'question');
});

test('topology validator rejects a question cell with no valid slot', () => {
  const rows = getTopologyScaffolds()[0];
  const inactive = [...rows];
  inactive[2] = inactive[2].slice(0, 2) + '#' + inactive[2].slice(3);
  const result = validateTopology(gridFromPattern(inactive), {
    requireConnected: true,
    requireBorderClues: false,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: false
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.type === 'QUESTION_WITHOUT_SLOT'));
});

test('no topology template generates an 11-letter boundary answer', () => {
  for (const rows of getTopologyScaffolds()) {
    const derived = deriveWordSlots(gridFromPattern(rows), {
      allowSpecialElevenBoundary: false,
      allowOuterBoundarySlots: true,
      allowColumnOneBoundarySlot: false
    });
    assert.equal(derived.errors.length, 0);
    assert.equal(derived.slots.some(slot => slot.length === 11), false);
    assert.equal(derived.slots.some(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'), false);
  }
});

test('border feasibility reports the dynamic top and fixed left clue borders', () => {
  const result = analyzeRequiredBorderFeasibility();
  assert.equal(result.feasible, true);
  assert.equal(result.reason, 'DYNAMIC_TOP_AND_FIXED_LEFT_BORDERS');
  assert.deepEqual(result.requiredTopAnchor, { row: 0, col: 1 });
  assert.deepEqual(result.requiredLeftBorderRows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const unsupported = analyzeRequiredBorderFeasibility({ width: 9, height: 12 });
  assert.equal(unsupported.feasible, null);
  assert.equal(unsupported.reason, 'UNSUPPORTED_DIMENSIONS');
});

test('seeded topology generation is deterministic and uses valid reversible slots', () => {
  const options = { seed: 90317, includeSpecialEleven: false, maxAttempts: 12 };
  const first = generateTopology(options);
  const second = generateTopology(options);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.deepEqual(first.topology.pattern, second.topology.pattern);
  assert.ok(first.topology.slots.every(slot => slot.special === 'OUTER_BOUNDARY'
    ? slot.directionOptions.length === 1 && ['right', 'down'].includes(slot.directionOptions[0].direction)
    : slot.directionOptions.length === 2));
});
