import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createEmptyGrid, assertGridDimensions } from '../src/grid.js';
import { normalizeAnswer, normalizeQuestion, prepareDictionary, buildIndexes, findCandidates } from '../src/dictionary.js';
import { getCoordinates, canPlaceWord, placeWord } from '../src/placement.js';
import { generateScanword } from '../src/generator.js';
import { validateScanword } from '../src/validator.js';
import { createRng } from '../src/rng.js';

test('fixed grid is exactly 8 columns × 12 rows', () => {
  const grid = createEmptyGrid();
  assert.equal(CONFIG.TOTAL_CELLS, 96); assert.equal(grid.length, 12); assert.ok(grid.every(r => r.length === 8)); assert.ok(assertGridDimensions(grid));
});
test('normalization preserves Ё unless folding is explicitly enabled', () => {
  assert.equal(normalizeAnswer(' берёза '), 'БЕРЁЗА');
  assert.equal(normalizeAnswer(' берёза ', { foldYo: true }), 'БЕРЕЗА');
});
test('dictionary rejects malformed and duplicate records', () => {
  const r = prepareDictionary([{id:'1',answer:'КОТ',question:'Домашнее животное'}, {id:'2',answer:'КОТ',question:'Зверь'}, {id:'3',answer:'123',question:'Число'}, {id:'4',answer:'ЛЕС',question:''}]);
  assert.equal(r.entries.length, 1); assert.equal(r.errors.length, 2); assert.ok(r.warnings.some(w => w.code === 'DUPLICATE_ANSWER'));
});
test('coordinates respect direction and bounds', () => {
  assert.deepEqual(getCoordinates(0,0,'right',3), [{row:0,col:1},{row:0,col:2},{row:0,col:3}]);
  assert.equal(getCoordinates(0,7,'right',2), null);
});
test('placement checks bounds and matching intersections', () => {
  const grid = createEmptyGrid(); const clue = grid[1][0];
  assert.equal(canPlaceWord(grid, clue, {answer:'КОТ'}, 'right').ok, true);
  placeWord(grid, clue, {id:'a',answer:'КОТ',question:'Животное'}, 'right', 'w1');
  assert.equal(canPlaceWord(grid, grid[0][1], {answer:'ЛЕС'}, 'down').ok, false);
});
test('validator rejects incomplete grids and reports errors', () => {
  const fake = {width:8,height:12,grid:createEmptyGrid(),words:[],questions:[]};
  const result = validateScanword(fake);
  assert.equal(result.valid, false); assert.ok(result.errors.some(e => e.type === 'INCOMPLETE_GRID'));
});
test('seeded random generator is reproducible', () => {
  const a = createRng(123), b = createRng(123);
  assert.deepEqual([a(),a(),a()], [b(),b(),b()]);
});
test('small dictionary fails safely instead of returning a fake puzzle', () => {
  const result = generateScanword([{id:'a',answer:'КОТ',question:'Домашнее животное'}], {seed:1, specialElevenLetterChance:0, maxNodes:100});
  assert.equal(result.ok, false); assert.ok(result.reason);
});
test('validator rejects an ordinary answer ending at the board boundary', () => {
  const grid = createEmptyGrid().map(row => row.map(cell => ({ ...cell, questionIds: [], wordIds: [] })));
  grid[0][0].type = 'corner';
  const fake = {
    width: 8,
    height: 12,
    grid,
    words: [{
      id: 'w1',
      entryId: 'e1',
      answer: 'КОТЛЕСЫ',
      question: 'Составное тестовое слово.',
      clue: { row: 1, col: 0 },
      direction: 'right',
      length: 7,
      coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }, { row: 1, col: 5 }, { row: 1, col: 6 }, { row: 1, col: 7 }]
    }],
    questions: []
  };
  for (let col = 1; col <= 7; col++) grid[1][col] = { row: 1, col, type: 'letter', letter: 'КОТЛЕСЫ'[col - 1], questionIds: [], wordIds: ['w1'] };
  grid[1][0] = { row: 1, col: 0, type: 'question', letter: null, questionIds: [], wordIds: [] };

  const result = validateScanword(fake, [], { requireBorderClues: false, requireConnected: false });
  assert.ok(result.errors.some(item => item.type === 'ORDINARY_WORD_ENDS_AT_BOUNDARY'));
});

test('validator rejects duplicate clue directions and non-contiguous coordinates', () => {
  const grid = createEmptyGrid().map(row => row.map(cell => ({ ...cell, questionIds: [], wordIds: [] })));
  grid[0][0].type = 'corner';
  grid[1][0] = { row: 1, col: 0, type: 'question', letter: null, questionIds: [], wordIds: [] };
  for (let col = 1; col <= 3; col++) grid[1][col] = { row: 1, col, type: 'letter', letter: 'КОТ'[col - 1], questionIds: [], wordIds: ['w1', 'w2'] };
  const word = {
    id: 'w1', entryId: 'e1', answer: 'КОТ', question: 'Домашнее животное.',
    clue: { row: 1, col: 0 }, direction: 'right', length: 3,
    coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]
  };
  const second = {
    ...word, id: 'w2', entryId: 'e2',
    coordinates: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }]
  };
  const result = validateScanword({
    width: 8, height: 12, grid, words: [word, second], questions: []
  }, [], { requireBorderClues: false, requireConnected: false });
  assert.ok(result.errors.some(item => item.type === 'DUPLICATE_CLUE_DIRECTION'));
  assert.ok(result.errors.some(item => item.type === 'NON_CONTIGUOUS_WORD'));
});

test('dictionary normalization makes punctuation and spacing variants comparable', () => {
  assert.equal(
    normalizeQuestion('  «Домашнее   животное!» '),
    normalizeQuestion('домашнее животное')
  );
});

test('dictionary indexes narrow candidates by every crossing position', () => {
  const prepared = prepareDictionary([
    { id: 'cat', answer: 'КОТ', clue: 'Домашнее животное из семейства кошачьих.' },
    { id: 'home', answer: 'ДОМ', clue: 'Место, где живут люди.' },
    { id: 'nose', answer: 'НОС', clue: 'Часть лица для дыхания и обоняния.' },
    { id: 'forest', answer: 'ЛЕС', clue: 'Большая территория, покрытая деревьями.' }
  ]);
  const indexes = buildIndexes(prepared.entries);
  assert.deepEqual(
    findCandidates(indexes, 3, [{ position: 0, letter: 'К' }, { position: 2, letter: 'Т' }]).map(item => item.answer),
    ['КОТ']
  );
  assert.deepEqual(findCandidates(indexes, 3, [{ position: 1, letter: 'Я' }]), []);
});

test('dictionary rejects one-letter and over-eleven-letter entries', () => {
  const prepared = prepareDictionary([
    { id: 'one', answer: 'Я', clue: 'Личная форма местоимения.' },
    { id: 'long', answer: 'ЭЛЕКТРОНИКАА', clue: 'Тестовая строка длиннее лимита.' },
    { id: 'valid', answer: 'ЭЛЕКТРОНИКА', clue: 'Область техники, связанная с электрическими сигналами.' }
  ]);
  assert.deepEqual(prepared.entries.map(item => item.answer), ['ЭЛЕКТРОНИКА']);
  assert.equal(prepared.errors.length, 2);
  assert.ok(prepared.errors.some(item => item.codes.includes('ANSWER_LENGTH_OUT_OF_RANGE')));
});
