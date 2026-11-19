import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEtalonV22Grid,
  generateEtalonV22Topology,
  getEtalonV22Patterns,
  validateEtalonV22Topology
} from '../src/topology-v22.js';

test('all v2.2 masks satisfy strict 8x12 borders and produce at least 34 slots', () => {
  const patterns = getEtalonV22Patterns();
  assert.equal(patterns.length, 3);

  for (let index = 0; index < patterns.length; index++) {
    const grid = createEtalonV22Grid(index);
    const result = validateEtalonV22Topology(grid);

    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.metrics.totalCells, 96);
    assert.equal(result.metrics.questionCells, 7 + 11 + result.metrics.interiorQuestionCells);
    assert.equal(result.metrics.slotCount, 34);
    assert.equal(result.metrics.twoLetterSlots, 5);
    assert.equal(result.metrics.mandatoryElevenLetterSlots, 2);
    assert.equal(result.metrics.activeQuestionCells, result.metrics.questionCells);
    assert.equal(result.metrics.coveredLetters, result.metrics.letterCells);
    assert.equal(result.metrics.connected, true);
    assert.ok(result.metrics.interiorQuestionCells >= 6);

    assert.equal(grid[0][0].type, 'corner');
    for (let col = 1; col < 8; col++) assert.equal(grid[0][col].type, 'question');
    for (let row = 1; row < 12; row++) assert.equal(grid[row][0].type, 'question');

    assert.ok(result.slots.every(slot =>
      slot.directionOptions.length === 1
      && ['right', 'down'].includes(slot.directionOptions[0].direction)
      && slot.length >= 2
      && slot.length <= 11
    ));
    assert.deepEqual(
      result.slots.filter(slot => slot.length === 11 && slot.axis === 'vertical')
        .map(slot => slot.clueCell.col).sort(),
      [1, 2]
    );
  }
});

test('the seeded topology selector is deterministic and explores every certified mask', () => {
  const first = generateEtalonV22Topology({ seed: 1001 });
  const second = generateEtalonV22Topology({ seed: 1001 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.patternIndex, second.patternIndex);
  assert.deepEqual(first.topology.pattern, second.topology.pattern);

  const patterns = new Set();
  for (let seed = 1; seed <= 96; seed++) {
    const result = generateEtalonV22Topology({ seed });
    assert.equal(result.ok, true, 'seed=' + seed + ' ' + JSON.stringify(result.errors));
    patterns.add(result.topology.pattern.join('/'));
  }
  assert.equal(patterns.size, 3);
});

test('validator rejects a missing top-border question and a passive clue cell', () => {
  const brokenTop = createEtalonV22Grid(0);
  brokenTop[0][3] = { ...brokenTop[0][3], type: 'letter', letter: 'А' };
  const topResult = validateEtalonV22Topology(brokenTop);
  assert.ok(topResult.errors.some(error => error.type === 'TOP_ROW_NOT_QUESTION'));

  const passive = createEtalonV22Grid(0);
  passive[3][4] = { ...passive[3][4], type: 'question' };
  const passiveResult = validateEtalonV22Topology(passive);
  assert.ok(passiveResult.errors.some(error => error.type === 'QUESTION_WITHOUT_OUTGOING_ANSWER'));
});

test('validator rejects orphan letters, disconnected layouts and too few answers', () => {
  const orphan = createEtalonV22Grid(0);
  orphan[1][1] = { ...orphan[1][1], type: 'letter', letter: 'А' };
  const orphanResult = validateEtalonV22Topology(orphan);
  assert.ok(orphanResult.errors.some(error => error.type === 'ORPHAN_LETTER'));

  const lowTarget = validateEtalonV22Topology(createEtalonV22Grid(0), {
    minimumAnswerCount: 35
  });
  assert.ok(lowTarget.errors.some(error => error.type === 'ANSWER_COUNT_BELOW_TARGET'));
});
