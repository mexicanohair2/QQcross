import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createEmptyGrid, assertGridDimensions } from '../src/grid.js';
import { normalizeAnswer, normalizeQuestion, prepareDictionary, buildIndexes, findCandidates } from '../src/dictionary.js';
import { getCoordinates, canPlaceWord, placeWord } from '../src/placement.js';
import { generateScanword } from '../src/generator.js';
import { validateScanword } from '../src/validator.js';
import { createRng } from '../src/rng.js';
import { GenerationHistory } from '../src/history.js';
import { assembleScanword } from '../src/assembler.js';
import { analyzeRequiredBorderFeasibility } from '../src/topology.js';

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
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.type === 'INCOMPLETE_GRID'));
  assert.ok(result.errors.some(e => e.type === 'IMAGE_COUNT_MISMATCH'));
  assert.ok(result.errors.some(e => e.type === 'INSUFFICIENT_LOGIC_CLUES'));
});
test('seeded random generator is reproducible', () => {
  const a = createRng(123), b = createRng(123);
  assert.deepEqual([a(),a(),a()], [b(),b(),b()]);
});
test('generator fails fast on the proven mandatory-border contradiction', () => {
  const dictionary = [
    { id: 'cat', answer: 'КОТ', question: 'Домашнее животное из семейства кошачьих.' },
    { id: 'home', answer: 'ДОМ', question: 'Место, где живут люди.' },
    { id: 'forest', answer: 'ЛЕС', question: 'Большая территория, покрытая деревьями.' }
  ];
  const result = generateScanword(dictionary, { seed: 1, specialElevenLetterChance: 0 });

  assert.equal(analyzeRequiredBorderFeasibility().feasible, false);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'TOPOLOGY_CONSTRAINT_CONFLICT');
  assert.equal(result.nodes, 0);
  assert.equal(result.topology.conflicts.length, 3);
  assert.deepEqual(result.topology.conflicts.map(item => item.clueCell), [
    { row: 1, col: 0 },
    { row: 2, col: 0 },
    { row: 0, col: 2 }
  ]);
  assert.equal(result.dictionaryStats.accepted, 3);
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

test('independent validator rejects duplicate normalized clue text for different answers', () => {
  const grid = createEmptyGrid().map(row => row.map(cell => ({ ...cell, questionIds: [], wordIds: [] })));
  grid[0][0].type = 'corner';
  const words = [
    { id: 'w1', entryId: 'e1', answer: 'КОТ', question: 'Домашнее животное.', clue: { row: 1, col: 0 }, direction: 'right', length: 3, coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }] },
    { id: 'w2', entryId: 'e2', answer: 'ДОМ', question: 'Домашнее животное', clue: { row: 3, col: 0 }, direction: 'right', length: 3, coordinates: [{ row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }] }
  ];
  const questions = words.map((word, index) => ({
    id: 'q' + (index + 1), wordId: word.id, text: word.question,
    clue: word.clue, direction: word.direction, length: word.length
  }));
  words.forEach((word, index) => {
    const clue = grid[word.clue.row][word.clue.col];
    clue.type = 'question'; clue.questionIds = ['q' + (index + 1)];
    word.coordinates.forEach((point, letterIndex) => {
      grid[point.row][point.col] = {
        ...grid[point.row][point.col], type: 'letter',
        letter: word.answer[letterIndex], wordIds: [word.id]
      };
    });
  });
  const result = validateScanword({
    width: 8, height: 12, grid, words, questions
  }, [], { requireBorderClues: false, requireConnected: false });
  assert.ok(result.errors.some(item => item.type === 'DUPLICATE_QUESTION_TEXT'));
});

test('generation history tracks combinations, structures, and normalized clue reuse', () => {
  const history = new GenerationHistory(2);
  const first = {
    seed: 12,
    words: [{
      entryId: 'cat', answer: 'КОТ', question: 'Домашнее животное.',
      clue: { row: 1, col: 0 }, direction: 'right',
      coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]
    }]
  };
  history.add(first);
  assert.equal(history.usageCount('cat'), 1);
  assert.equal(history.questionUsageCount('домашнее животное'), 1);
  assert.equal(history.hasCombination(first.words), true);
  assert.equal(history.hasStructure(first.words), true);

  const moved = [{
    ...first.words[0],
    clue: { row: 2, col: 0 },
    coordinates: [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }]
  }];
  assert.equal(history.hasCombination(moved), true);
  assert.equal(history.hasStructure(moved), false);

  history.add({ words: [{ ...first.words[0], entryId: 'dog', answer: 'ПЁС', question: 'Сторожит дом.' }] });
  history.add({ words: [{ ...first.words[0], entryId: 'home', answer: 'ДОМ', question: 'Место для жизни.' }] });
  assert.equal(history.items.length, 2);
  assert.equal(history.usageCount('cat'), 0);
});

test('assembler builds clue cells, terminal cells and crossing letter ownership', () => {
  const assembled = assembleScanword({
    seed: 5,
    words: [
      {
        id: 'w1', entryId: 'cat', answer: 'КОТ', question: 'Домашнее животное.',
        clue: { row: 1, col: 0 }, direction: 'right',
        coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]
      },
      {
        id: 'w2', entryId: 'wasp', answer: 'ОСА', question: 'Полосатое жалящее насекомое.',
        clue: { row: 0, col: 2 }, direction: 'down',
        coordinates: [{ row: 1, col: 2 }, { row: 2, col: 2 }, { row: 3, col: 2 }]
      }
    ]
  });
  assert.equal(assembled.ok, true, JSON.stringify(assembled.errors));
  assert.equal(assembled.scanword.width, 8);
  assert.equal(assembled.scanword.height, 12);
  assert.equal(assembled.scanword.grid[0][0].type, 'corner');
  assert.equal(assembled.scanword.grid[1][0].type, 'question');
  assert.equal(assembled.scanword.grid[1][4].type, 'question');
  assert.deepEqual(assembled.scanword.grid[1][4].questionIds, []);
  assert.equal(assembled.scanword.grid[4][2].type, 'question');
  assert.equal(assembled.scanword.grid[1][2].letter, 'О');
  assert.deepEqual(assembled.scanword.grid[1][2].wordIds.sort(), ['w1', 'w2']);
  assert.equal(assembled.metrics.crossings, 1);
  assert.equal(assembled.scanword.metadata.complete, false);
});

test('assembler rejects crossing letter conflicts and invalid answer paths', () => {
  const assembled = assembleScanword({
    words: [
      {
        id: 'w1', answer: 'КОТ', question: 'Домашнее животное.',
        clue: { row: 1, col: 0 }, direction: 'right',
        coordinates: [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]
      },
      {
        id: 'w2', answer: 'ЛЕС', question: 'Большая территория с деревьями.',
        clue: { row: 0, col: 2 }, direction: 'down',
        coordinates: [{ row: 1, col: 2 }, { row: 2, col: 2 }, { row: 3, col: 2 }]
      }
    ]
  });
  assert.equal(assembled.ok, false);
  assert.ok(assembled.errors.some(item => item.type === 'CROSSING_LETTER_CONFLICT'));
});

test('optional eleven-letter mode is not attempted while the required topology is impossible', () => {
  const result = generateScanword([
    { id: 'cat', answer: 'КОТ', question: 'Домашнее животное из семейства кошачьих.' },
    { id: 'home', answer: 'ДОМ', question: 'Место, где живут люди.' },
    { id: 'forest', answer: 'ЛЕС', question: 'Большая территория, покрытая деревьями.' }
  ], {
    seed: 9,
    specialElevenLetterChance: 1,
    maxNodes: 100,
    maxTimeMs: 100
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'TOPOLOGY_CONSTRAINT_CONFLICT');
  assert.equal(result.nodes, 0);
});

test('independent validator reports malformed word records without throwing', () => {
  const grid = createEmptyGrid();
  grid[0][0].type = 'corner';
  const result = validateScanword({
    width: 8,
    height: 12,
    grid,
    words: [{ id: 'broken' }],
    questions: []
  }, [], { requireBorderClues: false, requireConnected: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(item => item.type === 'INVALID_DIRECTION'));
});

test('independent validator rejects question references on a letter cell', () => {
  const grid = createEmptyGrid();
  grid[0][0].type = 'corner';
  grid[1][1] = {
    row: 1, col: 1, type: 'letter', letter: 'А',
    questionIds: ['fake-question'], wordIds: []
  };
  const result = validateScanword({
    width: 8, height: 12, grid, words: [], questions: []
  }, [], { requireBorderClues: false, requireConnected: false });
  assert.ok(result.errors.some(item => item.type === 'LETTER_HAS_QUESTION_REFERENCES'));
});


test('assembler and independent validator recognize only the two exact left-border boundary exceptions', () => {
  const dictionary = [{
    id: 'emerald',
    answer: 'ИЗУМРУД',
    question: 'Зелёный драгоценный камень.'
  }];
  const coordinates = Array.from({ length: 7 }, (_, index) => ({
    row: 1,
    col: index + 1
  }));
  const assembled = assembleScanword({
    seed: 17,
    words: [{
      id: 'w1',
      entryId: 'emerald',
      answer: 'ИЗУМРУД',
      question: dictionary[0].question,
      clue: { row: 1, col: 0 },
      direction: 'right',
      coordinates,
      special: 'LEFT_BORDER_RIGHT_BOUNDARY'
    }]
  }, { allowLeftBorderRightBoundary: true });

  assert.equal(assembled.ok, true, JSON.stringify(assembled.errors));
  assert.equal(assembled.scanword.grid[1][0].type, 'question');
  assert.equal(assembled.scanword.grid[1][7].letter, 'Д');

  const validation = validateScanword(assembled.scanword, dictionary, {
    requireBorderClues: false,
    requireConnected: false,
    allowLeftBorderRightBoundary: true,
    requiredImageCount: 0,
    minimumLogicClueCells: 0
  });
  const boundaryErrors = validation.errors.filter(error => [
    'ORDINARY_WORD_ENDS_AT_BOUNDARY',
    'UNKNOWN_SPECIAL_RULE',
    'INVALID_SPECIAL_BOUNDARY_WORD'
  ].includes(error.type));
  assert.deepEqual(boundaryErrors, []);
});


test('normalizes Ё and Е consistently when comparing duplicate clue text', () => {
  assert.equal(
    normalizeQuestion('Берёза растёт у реки.'),
    normalizeQuestion('Береза растёт у реки.')
  );
});


test('independent validator accepts a selected logic variant when the answer also has an image variant', () => {
  const dictionary = [
    { id: 'kot-image', answer: 'КОТ', clue: 'Что изображено на картинке?', imageKey: 'cat' },
    { id: 'kot-logic', answer: 'КОТ', clue: 'Кто ловит мышей и живёт рядом с человеком?', logic: true }
  ];
  const assembled = assembleScanword({
    seed: 51,
    words: [{
      id: 'w1',
      entryId: 'kot-logic',
      answer: 'КОТ',
      question: dictionary[1].clue,
      clue: { row: 1, col: 0 },
      direction: 'right',
      coordinates: [
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 1, col: 3 }
      ],
      logic: true
    }]
  });
  assert.equal(assembled.ok, true, JSON.stringify(assembled.errors));

  const validation = validateScanword(assembled.scanword, dictionary, {
    requireBorderClues: false,
    requireConnected: false,
    requiredImageCount: 0,
    minimumLogicClueCells: 1
  });
  assert.equal(validation.errors.some(error => error.type === 'WORD_NOT_IN_DICTIONARY'), false);
  assert.equal(validation.errors.some(error => error.type === 'DICTIONARY_QUESTION_MISMATCH'), false);
});
