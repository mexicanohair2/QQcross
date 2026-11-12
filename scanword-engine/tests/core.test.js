import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createEmptyGrid, assertGridDimensions } from '../src/grid.js';
import { normalizeAnswer, prepareDictionary } from '../src/dictionary.js';
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
  assert.equal(r.entries.length, 1); assert.equal(r.errors.length, 2); assert.equal(r.warnings.length, 1);
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