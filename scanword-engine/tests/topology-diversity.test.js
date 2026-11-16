import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseTopologyPattern, generateTopology, getTopologyScaffolds } from '../src/topology-builder.js';

test('independent template library contains varied, fully valid 8x12 boards supporting all four directions', () => {
  const templates = getTopologyScaffolds();
  assert.equal(templates.length, 20);
  const patterns = new Set();
  for (const [index, rows] of templates.entries()) {
    const diagnostics = diagnoseTopologyPattern(rows);
    assert.equal(diagnostics.valid, true, 'template=' + index + ' ' + JSON.stringify(diagnostics));
    assert.equal(rows.length, 12);
    assert.ok(rows.every(row => row.length === 8));
    assert.equal(rows[0], '.#######');
    for (let row = 1; row < 12; row++) assert.equal(rows[row][0], '#');
    assert.ok(diagnostics.slotCount >= 20);
    assert.ok(diagnostics.shortSlots >= 1 && diagnostics.shortSlots <= 5);
    assert.ok(diagnostics.longSlots >= 12);
    patterns.add(rows.join('/'));
  }
  assert.equal(patterns.size, 20);
});

test('seeded production topology generation stays fully covered and varied', () => {
  const patterns = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const result = generateTopology({ seed, includeSpecialEleven: false, maxAttempts: 24 });
    assert.equal(result.ok, true, 'seed=' + seed + ' ' + JSON.stringify(result));
    const topology = result.topology;
    assert.equal(topology.validation.valid, true, 'seed=' + seed);
    assert.equal(topology.metrics.totalCells, 96);
    assert.equal(topology.pattern.length, 12);
    assert.ok(topology.pattern.every(row => row.length === 8));
    assert.equal(topology.pattern[0], '.#######');
    for (let row = 1; row < 12; row++) assert.equal(topology.pattern[row][0], '#');
    assert.ok(topology.slots.length >= 20);
    assert.ok(topology.slots.every(slot => {
      if (slot.length < 2) return false;
      if (slot.special === 'OUTER_BOUNDARY' || slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') {
        return slot.directionOptions.length === 1
          && ['right', 'down', 'left', 'up'].includes(slot.directionOptions[0].direction);
      }
      const directions = slot.directionOptions.map(option => option.direction);
      return slot.axis === 'horizontal'
        ? directions.length === 2 && directions.includes('right') && directions.includes('left')
        : directions.length === 2 && directions.includes('down') && directions.includes('up');
    }));
    assert.ok(topology.validation.metrics.letterCells >= 30);
    assert.ok(topology.metrics.interiorQuestionCells >= 5);
    patterns.add(topology.pattern.join('/'));
  }
  assert.ok(patterns.size >= 8, 'expected broad topology variety; got ' + patterns.size);
});

test('the special topology still contains both mandatory long slots and one tagged special slot', () => {
  const result = generateTopology({
    seed: 481516,
    includeSpecialEleven: true,
    maxAttempts: 8,
    preserveScaffold: true
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const topology = result.topology;
  assert.equal(topology.validation.valid, true);
  const eleven = topology.slots.filter(slot => slot.length === 11);
  assert.equal(eleven.length, 2);
  const tagged = eleven.filter(slot => slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY');
  assert.equal(tagged.length, 1);
  assert.equal(tagged[0].directionOptions[0].direction, 'down');
  assert.ok(topology.slots.every(slot => slot.directionOptions.every(option => ['right', 'down', 'left', 'up'].includes(option.direction))));
});
