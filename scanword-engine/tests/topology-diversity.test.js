import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTopology, getTopologyScaffolds } from '../src/topology-builder.js';

test('seeded topology generation produces broad geometric variety while preserving the playable border contract', () => {
  const patterns = new Set();
  const questionCounts = new Set();

  for (let seed = 1; seed <= 64; seed++) {
    const result = generateTopology({
      seed,
      includeSpecialEleven: false,
      maxAttempts: 192
    });

    assert.equal(result.ok, true, 'seed=' + seed + ' ' + JSON.stringify(result));
    assert.equal(result.topology.validation.valid, true, 'seed=' + seed);
    assert.equal(result.topology.metrics.totalCells, 96);
    assert.equal(result.topology.pattern.length, 12);
    assert.ok(result.topology.pattern.every(row => row.length === 8));

    const rows = result.topology.pattern;
    assert.equal(rows[0][0], '.', 'the upper-left corner must remain the only blank corner');
    assert.equal(rows[0][1], '#', 'the required top anchor must remain a question cell');
    for (let row = 1; row < 12; row++) {
      assert.equal(rows[row][0], '#', 'left border question missing at row ' + row + ', seed=' + seed);
    }

    assert.ok(result.topology.slots.length >= 18, 'too few real answer slots on seed=' + seed);
    assert.ok(result.topology.slots.every(slot => slot.length >= 2));
    assert.ok(result.topology.validation.metrics.letterCells >= 30);
    assert.ok(result.topology.validation.metrics.questionCells >= 20);
    patterns.add(rows.join('/'));
    questionCounts.add(result.topology.validation.metrics.questionCells);
  }

  assert.ok(
    patterns.size >= 12,
    '64 seeds should generate at least 12 distinct topologies; got ' + patterns.size
  );
  assert.ok(
    questionCounts.size >= 3,
    'topology clue density should vary across seeds; got ' + [...questionCounts].join(', ')
  );
});

test('topology generation is deterministic for a fixed seed', () => {
  const options = { seed: 90317, includeSpecialEleven: true, maxAttempts: 192 };
  const first = generateTopology(options);
  const second = generateTopology(options);

  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.deepEqual(first.topology.pattern, second.topology.pattern);
  assert.deepEqual(
    first.topology.slots.map(slot => ({
      id: slot.id,
      directionOptions: slot.directionOptions.map(option => option.direction)
    })),
    second.topology.slots.map(slot => ({
      id: slot.id,
      directionOptions: slot.directionOptions.map(option => option.direction)
    }))
  );
});


test('production low-short scaffold keeps the 8x12 border and caps short answers at four', () => {
  const scaffolds = getTopologyScaffolds();
  assert.equal(scaffolds.length, 4);
  assert.deepEqual(scaffolds[3], [
    '.#...###',
    '#...#...',
    '#...#...',
    '#...#...',
    '#......#',
    '#....##.',
    '#...#...',
    '#...#...',
    '#......#',
    '#....##.',
    '#.....#.',
    '#......#'
  ]);

  const result = generateTopology({
    seed: 481516,
    includeSpecialEleven: false,
    scaffoldIndex: 3,
    maxTwoLetterSlots: 4,
    maxAttempts: 192
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.scaffoldIndex, 3);
  assert.equal(result.topology.validation.valid, true);
  assert.equal(result.topology.metrics.totalCells, 96);
  assert.equal(result.topology.pattern.length, 12);
  assert.ok(result.topology.pattern.every(row => row.length === 8));
  assert.equal(result.topology.pattern[0][0], '.');
  assert.equal(result.topology.pattern[0][1], '#');
  for (let row = 1; row < 12; row++) assert.equal(result.topology.pattern[row][0], '#');
  const shortSlots = result.topology.slots.filter(slot => slot.length === 2).length;
  assert.ok(shortSlots >= 2 && shortSlots <= 4, 'short slots=' + shortSlots);
  assert.ok(result.topology.slots.length >= 19);
});
