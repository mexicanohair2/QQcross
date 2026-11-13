import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRequiredBorderFeasibility, deriveWordSlots, getAnswerCoordinates, validateTopology } from '../src/topology.js';

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

test('documents the border-anchor contradiction under strict terminal-question rules', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };

  for (let col = 1; col < 8; col++) setQuestion(grid, 0, col);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);
  // The top-row clues need at least two letters before a terminal question.
  for (let col = 1; col < 8; col++) setQuestion(grid, 3, col);

  const result = validateTopology(grid, { allowSpecialElevenBoundary: false });
  const missingRowOne = result.errors.some(item =>
    item.type === 'QUESTION_WITHOUT_SLOT' && item.row === 1 && item.col === 0
  );
  const missingRowTwo = result.errors.some(item =>
    item.type === 'QUESTION_WITHOUT_SLOT' && item.row === 2 && item.col === 0
  );

  assert.equal(missingRowOne, true);
  assert.equal(missingRowTwo, true);
});

test('preflight proves the mandatory 8×12 border conflicts with in-board answer terminals', () => {
  const result = analyzeRequiredBorderFeasibility();

  assert.equal(result.feasible, false);
  assert.equal(result.reason, 'TOP_BORDER_SECOND_COLUMN_CONFLICT');
  assert.equal(result.width, 8);
  assert.equal(result.height, 12);
  assert.equal(result.forcedLetterCells.length, 28);
  assert.deepEqual(result.conflicts.map(item => item.clueCell), [
    { row: 1, col: 0 },
    { row: 2, col: 0 },
    { row: 0, col: 2 }
  ]);
  assert.ok(result.conflicts[0].forcedHorizontalPath.length === 7);
  assert.ok(result.conflicts[1].forcedHorizontalPath.length === 7);
  assert.equal(result.conflicts[2].forcedVerticalPath.length, 11);
  assert.ok(result.conflicts[0].blockedDirections.left === 'граница поля');
  assert.ok(result.conflicts[2].blockedDirections.up === 'граница поля');
});

test('preflight does not silently claim feasibility for unsupported dimensions', () => {
  const result = analyzeRequiredBorderFeasibility({ width: 1, height: 12 });
  assert.equal(result.feasible, null);
  assert.equal(result.reason, 'UNSUPPORTED_DIMENSIONS');
});


test('left-edge exceptions for rows 1 and 2 do not solve the second top-column contradiction', () => {
  const approved = analyzeRequiredBorderFeasibility({
    allowLeftBorderRightBoundaryRows: [1, 2]
  });
  assert.equal(approved.feasible, false);
  assert.equal(approved.reason, 'TOP_BORDER_SECOND_COLUMN_CONFLICT');
  assert.deepEqual(approved.allowedLeftBoundaryRows, [1, 2]);
  assert.deepEqual(approved.conflicts.map(item => item.clueCell), [{ row: 0, col: 2 }]);
  assert.equal(approved.conflicts[0].forcedVerticalPath.length, 11);

  const partial = analyzeRequiredBorderFeasibility({
    allowLeftBorderRightBoundaryRows: [1]
  });
  assert.equal(partial.feasible, false);
  assert.deepEqual(partial.conflicts.map(item => item.clueCell), [
    { row: 2, col: 0 },
    { row: 0, col: 2 }
  ]);

  const invalid = analyzeRequiredBorderFeasibility({
    allowLeftBorderRightBoundaryRows: [1, 3]
  });
  assert.equal(invalid.feasible, false);
  assert.equal(invalid.reason, 'INVALID_LEFT_BOUNDARY_EXCEPTION');
});

test('derives exactly two opt-in left-border boundary slots and none by default', () => {
  const grid = makeGrid('letter');
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null, questionIds: [], wordIds: [] };
  for (let col = 1; col < 8; col++) setQuestion(grid, 0, col);
  for (let row = 1; row < 12; row++) setQuestion(grid, row, 0);

  const withoutException = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  assert.equal(withoutException.slots.some(item => item.special === 'LEFT_BORDER_RIGHT_BOUNDARY'), false);

  const withException = deriveWordSlots(grid, {
    allowSpecialElevenBoundary: false,
    allowLeftBorderRightBoundary: true
  });
  const boundarySlots = withException.slots.filter(item => item.special === 'LEFT_BORDER_RIGHT_BOUNDARY');
  assert.equal(boundarySlots.length, 2);
  assert.deepEqual(boundarySlots.map(item => item.endpoints[0]), [
    { row: 1, col: 0 },
    { row: 2, col: 0 }
  ]);
  assert.ok(boundarySlots.every(item => item.length === 7));
  assert.ok(boundarySlots.every(item => item.directionOptions.length === 1 && item.directionOptions[0].direction === 'right'));
  assert.deepEqual(boundarySlots[0].coordinates[6], { row: 1, col: 7 });
});
