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
    { id: 'left', answer: 'ДЕ', direction: 'left', coordinates: [{ row: 4, col: 5 }, { row: 4, col: 4 }], clue: { row: 4, col: 6 }, question: 'Влево' },
    { id: 'up', answer: 'ЖЗ', direction: 'up', coordinates: [{ row: 6, col: 4 }, { row: 5, col: 4 }], clue: { row: 7, col: 4 }, question: 'Вверх' }
  ];
  for (const word of words) grid[word.clue.row][word.clue.col].type = 'question';
  return { width: 8, height: 12, grid, words, metadata: { seed: 7 } };
}

test('preserves canonical 8x12 portrait orientation and answer directions', () => {
  const puzzle = toLegacyPuzzle(makeScanword(), { sequence: 1 });
  assert.equal(puzzle.w, 8);
  assert.equal(puzzle.h, 12);
  assert.deepEqual(puzzle.reservedKeys, new Set(['0,0']));
  assert.equal(puzzle.clueKeys.size, 4);
  assert.ok(puzzle.clueKeys.has('2,0'));
  assert.ok(puzzle.used.has('2,1'));
  const byId = Object.fromEntries(puzzle.words.map(word => [word.id, word]));
  assert.equal(byId.right.dir, 'right');
  assert.deepEqual(byId.right.clueCell, [2, 0]);
  assert.deepEqual(byId.right.cells, [[2, 1], [2, 2]]);
  assert.equal(byId.down.dir, 'down');
  assert.deepEqual(byId.down.clueCell, [0, 4]);
  assert.deepEqual(byId.down.cells, [[1, 4], [2, 4]]);
  assert.equal(byId.left.dir, 'left');
  assert.deepEqual(byId.left.clueCell, [4, 6]);
  assert.deepEqual(byId.left.cells, [[4, 5], [4, 4]]);
  assert.equal(byId.up.dir, 'up');
  assert.deepEqual(byId.up.clueCell, [7, 4]);
  assert.deepEqual(byId.up.cells, [[6, 4], [5, 4]]);
});
