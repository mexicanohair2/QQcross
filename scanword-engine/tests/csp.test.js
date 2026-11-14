import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSlotsCsp } from '../src/csp.js';
import { GenerationHistory } from '../src/history.js';

function entry(id, answer, question) {
  return { id, answer, clue: question };
}

function slot(id, first, last, coordinates, forwardDirection, reverseDirection) {
  const forward = coordinates.map(point => ({ ...point }));
  const reverse = [...coordinates].reverse().map(point => ({ ...point }));
  return {
    id,
    length: coordinates.length,
    endpoints: [{ ...first }, { ...last }],
    coordinates: forward,
    directionOptions: [
      {
        clueCell: { ...first },
        terminalCell: { ...last },
        direction: forwardDirection,
        coordinates: forward
      },
      {
        clueCell: { ...last },
        terminalCell: { ...first },
        direction: reverseDirection,
        coordinates: reverse
      }
    ]
  };
}

const fourWords = [
  entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.'),
  entry('dog', 'ПЁС', 'Домашнее животное, которое охраняет дом.'),
  entry('home', 'ДОМ', 'Место, где живут люди.'),
  entry('forest', 'ЛЕС', 'Большая территория, покрытая деревьями.')
];

test('solves a cyclic four-clue topology and assigns all clue cells an outgoing answer', () => {
  const a = { row: 1, col: 1 };
  const b = { row: 1, col: 5 };
  const c = { row: 5, col: 1 };
  const d = { row: 5, col: 5 };

  const slots = [
    slot('ab', a, b, [{ row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }], 'right', 'left'),
    slot('bd', b, d, [{ row: 2, col: 5 }, { row: 3, col: 5 }, { row: 4, col: 5 }], 'down', 'up'),
    slot('dc', d, c, [{ row: 5, col: 4 }, { row: 5, col: 3 }, { row: 5, col: 2 }], 'left', 'right'),
    slot('ca', c, a, [{ row: 4, col: 1 }, { row: 3, col: 1 }, { row: 2, col: 1 }], 'up', 'down')
  ];

  const result = solveSlotsCsp(slots, fourWords, {
    seed: 42,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    maxNodes: 1000,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words.length, 4);
  assert.equal(new Set(result.words.map(word => word.answer)).size, 4);
  for (const key of ['1,1', '1,5', '5,1', '5,5']) {
    assert.ok(result.clueDirections.get(key)?.size > 0, 'missing outgoing clue at ' + key);
  }
});

test('propagates crossing letters into positional candidate indexes', () => {
  const horizontalA = { row: 2, col: 1 };
  const horizontalB = { row: 2, col: 5 };
  const verticalA = { row: 0, col: 3 };
  const verticalB = { row: 4, col: 3 };

  const slots = [
    slot('horizontal', horizontalA, horizontalB, [
      { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }
    ], 'right', 'left'),
    slot('vertical', verticalA, verticalB, [
      { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }
    ], 'down', 'up')
  ];

  const dictionary = [
    entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.'),
    entry('home', 'ДОМ', 'Место, где живут люди.'),
    entry('nose', 'НОС', 'Часть лица для дыхания и обоняния.'),
    entry('forest', 'ЛЕС', 'Большая территория, покрытая деревьями.')
  ];

  const result = solveSlotsCsp(slots, dictionary, {
    seed: 7,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 1000,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  const horizontal = result.words.find(word => word.id === 'w1');
  const vertical = result.words.find(word => word.id === 'w2');
  const shared = { row: 2, col: 3 };
  const hIndex = horizontal.coordinates.findIndex(point => point.row === shared.row && point.col === shared.col);
  const vIndex = vertical.coordinates.findIndex(point => point.row === shared.row && point.col === shared.col);
  assert.ok(hIndex >= 0 && vIndex >= 0);
  assert.equal(horizontal.answer[hIndex], vertical.answer[vIndex]);
  assert.equal(result.letters.get('2,3'), horizontal.answer[hIndex]);
});

test('rejects impossible intersections instead of inventing letters', () => {
  const a = { row: 2, col: 1 };
  const b = { row: 2, col: 5 };
  const c = { row: 0, col: 3 };
  const d = { row: 4, col: 3 };
  const slots = [
    slot('horizontal', a, b, [
      { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }
    ], 'right', 'left'),
    slot('vertical', c, d, [
      { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }
    ], 'down', 'up')
  ];

  const result = solveSlotsCsp(slots, [
    entry('one', 'КОТ', 'Домашнее животное.'),
    entry('two', 'ЛЕС', 'Большая территория с деревьями.')
  ], {
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 500,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
});

test('stops safely when the search budget is exhausted', () => {
  const a = { row: 1, col: 1 };
  const b = { row: 1, col: 5 };
  const slots = [
    slot('ab', a, b, [
      { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }
    ], 'right', 'left')
  ];

  const result = solveSlotsCsp(slots, fourWords, {
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 1,
    maxTimeMs: 1000
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'SEARCH_BUDGET_EXCEEDED');
});

test('validates the unique eleven-letter bottom-edge boundary slot', () => {
  const coordinates = Array.from({ length: 11 }, (_, index) => ({ row: index + 1, col: 1 }));
  const specialSlot = {
    id: 'special-eleven',
    special: 'ELEVEN_LETTER_BOTTOM_BOUNDARY',
    length: 11,
    endpoints: [
      { row: 0, col: 1 },
      { row: 12, col: 1, boundary: true }
    ],
    coordinates,
    directionOptions: [{
      clueCell: { row: 0, col: 1 },
      terminalCell: { row: 12, col: 1, boundary: true },
      direction: 'down',
      coordinates
    }]
  };

  const result = solveSlotsCsp([specialSlot], [
    entry('electronics', 'ЭЛЕКТРОНИКА', 'Раздел техники, связанный с электрическими сигналами.')
  ], {
    seed: 11,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].answer, 'ЭЛЕКТРОНИКА');
  assert.equal(result.words[0].direction, 'down');
  assert.equal(result.words[0].coordinates.length, 11);
});

test('rejects a slot whose direction does not match its coordinates', () => {
  const a = { row: 1, col: 1 };
  const b = { row: 1, col: 5 };
  const bad = slot('wrong-direction', a, b, [
    { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }
  ], 'down', 'up');

  const result = solveSlotsCsp([bad], fourWords, {
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'INVALID_SLOT');
});

test('does not reuse the same normalized clue text for different answers', () => {
  const slots = [
    slot('first', { row: 1, col: 0 }, { row: 1, col: 4 }, [
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
    ], 'right', 'left'),
    slot('second', { row: 5, col: 0 }, { row: 5, col: 4 }, [
      { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 }
    ], 'right', 'left')
  ];
  const dictionary = [
    entry('cat', 'КОТ', '  Домашнее   животное! '),
    entry('home', 'ДОМ', 'домашнее животное')
  ];

  const result = solveSlotsCsp(slots, dictionary, {
    seed: 21,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
});

test('CSP result is deterministic for an identical seed and input', () => {
  const slots = [slot('single', { row: 1, col: 0 }, { row: 1, col: 4 }, [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left')];
  const dictionary = [
    entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.'),
    entry('home', 'ДОМ', 'Место, где живут люди.'),
    entry('nose', 'НОС', 'Часть лица для дыхания и обоняния.'),
    entry('forest', 'ЛЕС', 'Большая территория, покрытая деревьями.')
  ];
  const options = {
    seed: 456,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  };
  const first = solveSlotsCsp(slots, dictionary, options);
  const second = solveSlotsCsp(slots, dictionary, options);
  assert.equal(first.ok, true, first.message);
  assert.equal(second.ok, true, second.message);
  assert.deepEqual(
    first.words.map(word => ({ answer: word.answer, direction: word.direction, clue: word.clue })),
    second.words.map(word => ({ answer: word.answer, direction: word.direction, clue: word.clue }))
  );
});

test('CSP respects an already-aborted cancellation signal', () => {
  const controller = new AbortController();
  controller.abort();
  const result = solveSlotsCsp([
    slot('single', { row: 1, col: 0 }, { row: 1, col: 4 }, [
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
    ], 'right', 'left')
  ], fourWords, {
    signal: controller.signal,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'CANCELLED');
});

test('history penalizes recently used answers and avoids an exact recent structure', () => {
  const history = new GenerationHistory(10);
  const slotPlan = [slot('single', { row: 1, col: 0 }, { row: 1, col: 4 }, [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left')];
  const dictionary = [
    entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.'),
    entry('home', 'ДОМ', 'Место, где живут люди.')
  ];

  history.add({ words: [{ entryId: 'cat', answer: 'КОТ', question: 'Домашнее животное из семейства кошачьих.' }] });
  history.add({ words: [{ entryId: 'cat', answer: 'КОТ', question: 'Домашнее животное из семейства кошачьих.' }] });
  const varied = solveSlotsCsp(slotPlan, dictionary, {
    seed: 4,
    history,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });
  assert.equal(varied.ok, true, varied.message);
  assert.equal(varied.words[0].answer, 'ДОМ');

  const onlyOne = [entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.')];
  const first = solveSlotsCsp(slotPlan, onlyOne, {
    seed: 19,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });
  assert.equal(first.ok, true, first.message);
  const exactHistory = new GenerationHistory(10);
  exactHistory.add({ words: first.words });
  const repeated = solveSlotsCsp(slotPlan, onlyOne, {
    seed: 19,
    history: exactHistory,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });
  assert.equal(repeated.ok, true, repeated.message);
  assert.equal(exactHistory.hasStructure(repeated.words), false);
});

test('allows the shared picture prompt only for distinct image keys', () => {
  const slots = Array.from({ length: 5 }, (_, index) => {
    const row = index * 2 + 1;
    return slot('picture-' + index, { row, col: 0 }, { row, col: 4 }, [
      { row, col: 1 }, { row, col: 2 }, { row, col: 3 }
    ], 'right', 'left');
  });
  const dictionary = [
    { id: 'cat', answer: 'КОТ', clue: 'Что изображено на картинке?', imageKey: 'cat' },
    { id: 'dog', answer: 'ПЁС', clue: 'Что изображено на картинке?', imageKey: 'dog' },
    { id: 'home', answer: 'ДОМ', clue: 'Что изображено на картинке?', imageKey: 'home' },
    { id: 'nose', answer: 'НОС', clue: 'Что изображено на картинке?', imageKey: 'nose' },
    { id: 'forest', answer: 'ЛЕС', clue: 'Что изображено на картинке?', imageKey: 'forest' }
  ];
  const result = solveSlotsCsp(slots, dictionary, {
    seed: 17,
    requiredImageCount: 5,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 500,
    maxTimeMs: 1000
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.metrics.distinctImages, 5);
  assert.equal(new Set(result.words.map(word => word.question)).size, 1);
  assert.equal(new Set(result.words.map(word => word.imageKey)).size, 5);
});


test('CSP accepts only the explicit 7-letter left-border edge slot', () => {
  const coordinates = Array.from({ length: 7 }, (_, index) => ({ row: 1, col: index + 1 }));
  const allowed = {
    id: 'left-edge-row-1',
    special: 'LEFT_BORDER_RIGHT_BOUNDARY',
    length: 7,
    endpoints: [
      { row: 1, col: 0 },
      { row: 1, col: 8, boundary: true }
    ],
    coordinates,
    directionOptions: [{
      clueCell: { row: 1, col: 0 },
      terminalCell: { row: 1, col: 8, boundary: true },
      direction: 'right',
      coordinates
    }]
  };
  const result = solveSlotsCsp([allowed], [
    entry('emerald', 'ИЗУМРУД', 'Зелёный драгоценный камень.')
  ], {
    seed: 17,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].answer, 'ИЗУМРУД');
  assert.equal(result.words[0].special, 'LEFT_BORDER_RIGHT_BOUNDARY');

  const invalid = {
    ...allowed,
    id: 'left-edge-row-3',
    endpoints: [
      { row: 3, col: 0 },
      { row: 3, col: 8, boundary: true }
    ],
    coordinates: coordinates.map(point => ({ ...point, row: 3 })),
    directionOptions: [{
      clueCell: { row: 3, col: 0 },
      terminalCell: { row: 3, col: 8, boundary: true },
      direction: 'right',
      coordinates: coordinates.map(point => ({ ...point, row: 3 }))
    }]
  };
  const rejected = solveSlotsCsp([invalid], [
    entry('emerald', 'ИЗУМРУД', 'Зелёный драгоценный камень.')
  ], {
    seed: 17,
    requiredImageCount: 0,
    minimumLogicClueCells: 0
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'INVALID_SLOT');
});


test('keeps image and logic variants for the same answer available to CSP', () => {
  const onlySlot = [slot(
    'single',
    { row: 1, col: 0 },
    { row: 1, col: 4 },
    [
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 }
    ],
    'right',
    'left'
  )];
  const dictionary = [
    { id: 'kot-image', answer: 'КОТ', clue: 'Что изображено на картинке?', imageKey: 'cat' },
    { id: 'kot-logic', answer: 'КОТ', clue: 'Кто ловит мышей и живёт рядом с человеком?', logic: true }
  ];

  const result = solveSlotsCsp(onlySlot, dictionary, {
    seed: 51,
    requiredImageCount: 0,
    minimumLogicClueCells: 1,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words.length, 1);
  assert.equal(result.words[0].answer, 'КОТ');
  assert.equal(result.words[0].entryId, 'kot-logic');
  assert.equal(result.words[0].logic, true);
  assert.equal(result.words[0].imageKey, null);
  assert.equal(result.metrics.uniqueAnswers, 1);
});


test('CSP cannot place ЕЖ and ЁЖ as two answers in one puzzle', () => {
  const slots = [
    slot(
      'first',
      { row: 1, col: 0 },
      { row: 1, col: 3 },
      [{ row: 1, col: 1 }, { row: 1, col: 2 }],
      'right',
      'left'
    ),
    slot(
      'second',
      { row: 5, col: 0 },
      { row: 5, col: 3 },
      [{ row: 5, col: 1 }, { row: 5, col: 2 }],
      'right',
      'left'
    )
  ];
  const dictionary = [
    entry('yo', 'ЁЖ', 'Небольшое животное с колючими иглами.'),
    entry('e', 'ЕЖ', 'Сочетание двух букв.')
  ];
  const result = solveSlotsCsp(slots, dictionary, {
    seed: 52,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
});


test('allows only an approved picture-backed two-letter scanword answer', () => {
  const slots = [slot(
    'short-picture',
    { row: 0, col: 1 },
    { row: 0, col: 4 },
    [{ row: 0, col: 2 }, { row: 0, col: 3 }],
    'right',
    'left'
  )];
  const dictionary = [
    { id: 'hedgehog', answer: 'ЁЖ', question: 'Что изображено на картинке?', imageKey: 'hedgehog' },
    { id: 'poison', answer: 'ЯД', question: 'Вещество, способное вызвать отравление.' },
    { id: 'mind', answer: 'УМ', question: 'Способность человека думать и рассуждать.' },
    { id: 'south', answer: 'ЮГ', question: 'Сторона света, противоположная северу.' },
    { id: 'ace', answer: 'АС', question: 'Мастер своего дела, особенно опытный пилот.' },
    { id: 'moustache', answer: 'УС', question: 'Один волосок над верхней губой.' },
    { id: 'note', answer: 'МИ', question: 'Третья ступень гаммы до мажор.' }
  ];
  const result = solveSlotsCsp(slots, dictionary, {
    seed: 91,
    requiredImageCount: 1,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    maxNodes: 100,
    maxTimeMs: 1000
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].answer, 'ЁЖ');
  assert.equal(result.words[0].imageKey, 'hedgehog');
});


test('allows curated two-letter Russian words and rejects pronoun filler', () => {
  const clueA = { row: 1, col: 1 };
  const clueB = { row: 1, col: 4 };
  const shortSlot = slot('short-word', clueA, clueB, [
    { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left');
  const options = {
    seed: 71,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false
  };

  const meaningful = solveSlotsCsp(
    [shortSlot],
    [entry('short-um', 'УМ', 'Способность думать и рассуждать.')],
    options
  );
  assert.equal(meaningful.ok, true, meaningful.message);
  assert.equal(meaningful.words[0].answer, 'УМ');

  const filler = solveSlotsCsp(
    [shortSlot],
    [entry('short-my', 'МЫ', 'Местоимение для обозначения группы людей.')],
    options
  );
  assert.equal(filler.ok, false, 'A two-letter pronoun must not fill a scanword slot.');
});


test('rejects eleven-letter candidates with an impossible mandatory crossing before backtracking', () => {
  const special = {
    id: 'special-eleven',
    special: 'ELEVEN_LETTER_BOTTOM_BOUNDARY',
    length: 11,
    endpoints: [
      { row: 0, col: 1 },
      { row: 12, col: 1, boundary: true }
    ],
    coordinates: Array.from({ length: 11 }, (_, index) => ({ row: index + 1, col: 1 })),
    directionOptions: [{
      clueCell: { row: 0, col: 1 },
      terminalCell: { row: 12, col: 1, boundary: true },
      direction: 'down',
      coordinates: Array.from({ length: 11 }, (_, index) => ({ row: index + 1, col: 1 }))
    }]
  };
  const horizontal = slot('crossing', { row: 1, col: 0 }, { row: 1, col: 4 }, [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left');
  const result = solveSlotsCsp([special, horizontal], [
    entry('long', 'АБВГДЕЖЗИЙК', 'Длинный тестовый ответ из одиннадцати букв.'),
    entry('wrong-prefix', 'КОТ', 'Домашнее животное из семейства кошачьих.')
  ], {
    seed: 99,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right', 'down'],
    maxNodes: 100,
    maxTimeMs: 500
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
  assert.equal(result.lastDeadEnd.reason, 'SPECIAL_CANDIDATES_UNSUPPORTED_AT_CROSSINGS');
});

test('CSP never places answers to the left or upward even when reverse orientations are available', () => {
  const horizontal = slot('horizontal-forward', { row: 1, col: 0 }, { row: 1, col: 4 }, [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left');
  const vertical = slot('vertical-forward', { row: 0, col: 6 }, { row: 4, col: 6 }, [
    { row: 1, col: 6 }, { row: 2, col: 6 }, { row: 3, col: 6 }
  ], 'down', 'up');
  const dictionary = [entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.')];

  for (let seed = 1; seed <= 64; seed++) {
    const h = solveSlotsCsp([horizontal], dictionary, {
      seed, requiredImageCount: 0, minimumLogicClueCells: 0,
      requireEveryClueStarts: false, allowedDirections: ['right', 'down'],
      maxNodes: 100, maxTimeMs: 500
    });
    const v = solveSlotsCsp([vertical], dictionary, {
      seed, requiredImageCount: 0, minimumLogicClueCells: 0,
      requireEveryClueStarts: false, allowedDirections: ['right', 'down'],
      maxNodes: 100, maxTimeMs: 500
    });
    assert.equal(h.ok, true, h.message);
    assert.equal(v.ok, true, v.message);
    assert.equal(h.words[0].direction, 'right', 'seed=' + seed);
    assert.equal(v.words[0].direction, 'down', 'seed=' + seed);
  }
});
