import test from 'node:test';
import assert from 'node:assert/strict';
import { toLegacyPuzzle } from '../src/legacy-adapter.js';

function makeScanword() {
  const grid = Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({
    row, col, type: 'letter', letter: 'А'
  })));
  grid[0][0] = { row: 0, col: 0, type: 'corner', letter: null };
  const words = [
    { id: 'right', answer: 'АБ', direction: 'right', coordinates: [{ row: 2, col: 1 }, { row: 2, col: 2 }], clue: { row: 2, col: 0 }, question: 'Вправо' },
    { id: 'down', answer: 'ВГ', direction: 'down', coordinates: [{ row: 1, col: 4 }, { row: 2, col: 4 }], clue: { row: 0, col: 4 }, question: 'Вниз' }
  ];
  for (const word of words) grid[word.clue.row][word.clue.col].type = 'question';
  return { width: 8, height: 12, grid, words, metadata: { seed: 7 } };
}

test('preserves the strict 8x12 grid, coordinates and right/down directions', () => {
  const puzzle = toLegacyPuzzle(makeScanword(), { sequence: 1 });
  assert.equal(puzzle.w, 8);
  assert.equal(puzzle.h, 12);
  assert.deepEqual(puzzle.reservedKeys, new Set(['0,0']));
  assert.equal(puzzle.clueKeys.size, 2);
  assert.ok(puzzle.clueKeys.has('2,0'));
  assert.ok(puzzle.used.has('2,1'));
  const byId = Object.fromEntries(puzzle.words.map(word => [word.id, word]));
  assert.equal(byId.right.dir, 'right');
  assert.deepEqual(byId.right.clueCell, [2, 0]);
  assert.deepEqual(byId.right.cells, [[2, 1], [2, 2]]);
  assert.equal(byId.down.dir, 'down');
  assert.deepEqual(byId.down.clueCell, [0, 4]);
  assert.deepEqual(byId.down.cells, [[1, 4], [2, 4]]);
});

test('rejects unsupported left/up answer directions', () => {
  for (const direction of ['left', 'up']) {
    const scanword = makeScanword();
    scanword.words[0].direction = direction;
    assert.throws(() => toLegacyPuzzle(scanword), /неизвестное направление/);
  }
});
