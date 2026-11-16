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
    { id: 'down', answer: 'ВГ', direction: 'down', coordinates: [{ row: 1, col: 4 }, { row: 2, col: 4 }], clue: { row: 0, col: 4 }, question: 'Вниз' },
    { id: 'left', answer: 'ДЕ', direction: 'left', coordinates: [{ row: 4, col: 6 }, { row: 4, col: 5 }], clue: { row: 4, col: 7 }, question: 'Влево' },
    { id: 'up', answer: 'ЖЗ', direction: 'up', coordinates: [{ row: 6, col: 4 }, { row: 5, col: 4 }], clue: { row: 7, col: 4 }, question: 'Вверх' }
  ];
  for (const word of words) grid[word.clue.row][word.clue.col].type = 'question';
  return { width: 8, height: 12, grid, words, metadata: { seed: 7 } };
}

test('rotates an 8x12 scanword into a 12x8 board without changing answer order', () => {
  const puzzle = toLegacyPuzzle(makeScanword(), { sequence: 1 });
  assert.equal(puzzle.w, 12);
  assert.equal(puzzle.h, 8);
  assert.deepEqual(puzzle.reservedKeys, new Set(['7,0']));
  assert.equal(puzzle.clueKeys.size, 4);
  assert.ok(puzzle.clueKeys.has('7,2'));
  assert.ok(puzzle.used.has('6,2'));
  const byId = Object.fromEntries(puzzle.words.map(word => [word.id, word]));
  assert.equal(byId.right.dir, 'up');
  assert.deepEqual(byId.right.clueCell, [7, 2]);
  assert.deepEqual(byId.right.cells, [[6, 2], [5, 2]]);
  assert.equal(byId.down.dir, 'right');
  assert.deepEqual(byId.down.clueCell, [3, 0]);
  assert.deepEqual(byId.down.cells, [[3, 1], [3, 2]]);
  assert.equal(byId.left.dir, 'down');
  assert.deepEqual(byId.left.clueCell, [0, 4]);
  assert.deepEqual(byId.left.cells, [[1, 4], [2, 4]]);
  assert.equal(byId.up.dir, 'left');
  assert.deepEqual(byId.up.clueCell, [3, 7]);
  assert.deepEqual(byId.up.cells, [[3, 6], [3, 5]]);
});
