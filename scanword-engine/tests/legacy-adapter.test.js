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
  ];
  for (const word of words) grid[word.clue.row][word.clue.col].type = 'question';
  return { width: 8, height: 12, grid, words, metadata: { seed: 7 } };
}

test('preserves the native 8-column by 12-row grid and only right/down answer directions', () => {
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
  assert.deepEqual(puzzle.words.map(word => word.dir).sort(), ['down', 'right']);
});


test('rejects answer coordinates that extend beyond the 8x12 grid', () => {
  const scanword = makeScanword();
  const down = scanword.words.find(word => word.id === 'down');
  down.coordinates[1] = { row: 12, col: 4 };
  assert.throws(() => toLegacyPuzzle(scanword), /выходит за границы|неверно направлен/u);
});

test('rejects a question whose answer direction points outside the grid', () => {
  const scanword = makeScanword();
  const down = scanword.words.find(word => word.id === 'down');
  down.direction = 'right';
  assert.throws(() => toLegacyPuzzle(scanword), /выходит за границы|неверно направлен/u);
});


test('keeps only the designated top-right and bottom-left edge anchors as playable clues', () => {
  const scanword = makeScanword();
  scanword.words.push(
    { id: 'top-right', answer: 'ИК', direction: 'down', coordinates: [{ row: 1, col: 7 }, { row: 2, col: 7 }], clue: { row: 0, col: 7 }, question: 'Вниз от верхнего правого угла' },
    { id: 'bottom-left', answer: 'ЛМ', direction: 'right', coordinates: [{ row: 11, col: 1 }, { row: 11, col: 2 }], clue: { row: 11, col: 0 }, question: 'Вправо от нижнего левого угла' }
  );
  scanword.grid[0][7].type = 'question';
  scanword.grid[11][0].type = 'question';
  const puzzle = toLegacyPuzzle(scanword);
  assert.ok(puzzle.clueKeys.has('0,7'));
  assert.ok(puzzle.clueKeys.has('11,0'));
});

test('rejects false playable clue starts on the right and bottom borders', () => {
  const rightEdge = makeScanword();
  rightEdge.grid[4][7].type = 'question';
  rightEdge.words.push({ id: 'right-edge', answer: 'АБ', direction: 'right', coordinates: [{ row: 4, col: 6 }, { row: 4, col: 5 }], clue: { row: 4, col: 7 }, question: 'Ошибочный правый вопрос' });
  assert.throws(() => toLegacyPuzzle(rightEdge), /правом или нижнем краю/u);

  const bottomEdge = makeScanword();
  bottomEdge.grid[11][3].type = 'question';
  bottomEdge.words.push({
    id: 'bottom-edge', answer: 'НО', direction: 'right',
    coordinates: [{ row: 11, col: 4 }, { row: 11, col: 5 }],
    clue: { row: 11, col: 3 }, question: 'Ошибочный нижний вопрос'
  });
  assert.throws(() => toLegacyPuzzle(bottomEdge), /правом или нижнем краю/u);
});

test('rejects leftward and upward answers at the production adapter boundary', () => {
  for (const direction of ['left', 'up']) {
    const scanword = makeScanword();
    scanword.grid[4][3].type = 'question';
    scanword.words.push({
      id: 'forbidden-' + direction,
      answer: 'КОТ',
      direction,
      coordinates: direction === 'left'
        ? [{ row: 4, col: 2 }, { row: 4, col: 1 }, { row: 4, col: 0 }]
        : [{ row: 3, col: 3 }, { row: 2, col: 3 }, { row: 1, col: 3 }],
      clue: { row: 4, col: 3 },
      question: 'Запрещённое направление'
    });
    assert.throws(() => toLegacyPuzzle(scanword), /запрещённое направление/u);
  }
});
