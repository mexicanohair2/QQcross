import test from 'node:test';
import assert from 'node:assert/strict';
import { maximumDistinctAssignmentCount, solveSlotsCsp } from '../src/csp.js';
import { GenerationHistory } from '../src/history.js';

test('maximum distinct assignment count handles overlapping resource domains', () => {
  assert.equal(maximumDistinctAssignmentCount([
    ['apple', 'pear'],
    ['apple'],
    ['plum', 'pear']
  ]), 3);

  assert.equal(maximumDistinctAssignmentCount([
    ['image-a'],
    ['image-a'],
    ['image-a', 'image-b']
  ]), 2);

  assert.equal(maximumDistinctAssignmentCount([
    ['clue-1', 'clue-2'],
    ['clue-1', 'clue-2'],
    ['clue-1', 'clue-2']
  ]), 2);

  assert.equal(maximumDistinctAssignmentCount([
    [], ['image-x'], [], ['image-y', 'image-z']
  ]), 2);
});

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

test('keeps an image-backed special eleven-letter answer eligible under strict image planning', () => {
  const coordinates = Array.from({ length: 11 }, (_, index) => ({ row: index + 1, col: 1 }));
  const specialSlot = {
    id: 'special-image-eleven',
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
    { id: 'camera', answer: 'ФОТОАППАРАТ', question: 'Что изображено на картинке?', imageKey: 'camera' }
  ], {
    seed: 12,
    requiredImageCount: 1,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    enforcePreferredImagePlacements: true,
    preferredImagePlacementsBySlot: new Map(),
    allowedDirections: ['down'],
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].answer, 'ФОТОАППАРАТ');
  assert.equal(result.words[0].imageKey, 'camera');
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


test('enforces the exact prevalidated image placement when requested', () => {
  const imageSlot = slot(
    'planned-image',
    { row: 0, col: 1 },
    { row: 0, col: 4 },
    [{ row: 0, col: 2 }, { row: 0, col: 3 }],
    'right',
    'left'
  );
  const dictionary = [
    { id: 'hedgehog', answer: 'ЁЖ', question: 'Что изображено на картинке?', imageKey: 'hedgehog' },
    { id: 'poison-image', answer: 'ЯД', question: 'Что изображено на картинке?', imageKey: 'poison' }
  ];
  const result = solveSlotsCsp([imageSlot], dictionary, {
    seed: 92,
    requiredImageCount: 1,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    preferredImagePlacementsBySlot: new Map([[
      'planned-image',
      { entryId: 'hedgehog', clueKey: '0,1', direction: 'right' }
    ]]),
    enforcePreferredImagePlacements: true,
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].entryId, 'hedgehog');
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

  const ace = solveSlotsCsp(
    [shortSlot],
    [entry('short-as', 'АС', 'Мастер своего дела, особенно опытный пилот.')],
    options
  );
  assert.equal(ace.ok, true, ace.message);
  assert.equal(ace.words[0].answer, 'АС');

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

test('CSP places answers in all four directions when each orientation is allowed', () => {
  const horizontal = slot('horizontal-forward', { row: 1, col: 0 }, { row: 1, col: 4 }, [
    { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }
  ], 'right', 'left');
  const vertical = slot('vertical-forward', { row: 0, col: 6 }, { row: 4, col: 6 }, [
    { row: 1, col: 6 }, { row: 2, col: 6 }, { row: 3, col: 6 }
  ], 'down', 'up');
  const dictionary = [entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.')];

  for (let seed = 1; seed <= 64; seed++) {
    const left = solveSlotsCsp([horizontal], dictionary, {
      seed, requiredImageCount: 0, minimumLogicClueCells: 0,
      requireEveryClueStarts: false, allowedDirections: ['left'],
      maxNodes: 100, maxTimeMs: 500
    });
    const up = solveSlotsCsp([vertical], dictionary, {
      seed, requiredImageCount: 0, minimumLogicClueCells: 0,
      requireEveryClueStarts: false, allowedDirections: ['up'],
      maxNodes: 100, maxTimeMs: 500
    });
    assert.equal(left.ok, true, left.message);
    assert.equal(up.ok, true, up.message);
    assert.equal(left.words[0].direction, 'left', 'seed=' + seed);
    assert.equal(up.words[0].direction, 'up', 'seed=' + seed);
  }
});

test('CSP keeps only orientations retained by the special-plan AC-3 domain', () => {
  const horizontal = slot(
    'planned-horizontal',
    { row: 1, col: 0 },
    { row: 1, col: 4 },
    [{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }],
    'right',
    'left'
  );
  const result = solveSlotsCsp([horizontal], [
    entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.')
  ], {
    seed: 19,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right', 'left', 'down', 'up'],
    allowedEntryIdsBySlot: new Map([['planned-horizontal', new Set(['cat'])]]),
    allowedPlacementKeysBySlot: new Map([[
      'planned-horizontal',
      new Set(['cat|left|1,4'])
    ]]),
    maxNodes: 100,
    maxTimeMs: 500
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].direction, 'left');
  assert.deepEqual(result.words[0].clue, { row: 1, col: 4 });
  assert.deepEqual(result.words[0].coordinates, [
    { row: 1, col: 3 },
    { row: 1, col: 2 },
    { row: 1, col: 1 }
  ]);
});

test('CSP preserves the fixed downward lower-right terminal slot', () => {
  const terminalSlot = slot('v:0,7>11,7', { row: 0, col: 7 }, { row: 4, col: 7 },
    Array.from({ length: 3 }, (_, index) => ({ row: index + 1, col: 7 })),
    'down', 'up'
  );
  terminalSlot.requiredDirection = 'down';
  const result = solveSlotsCsp([terminalSlot], [
    entry('cat', 'КОТ', 'Домашнее животное из семейства кошачьих.')
  ], {
    seed: 7,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right', 'left', 'down', 'up'],
    maxNodes: 100,
    maxTimeMs: 500
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].direction, 'down');
});


test('rejects musical-note names as artificial two-letter fillers', () => {
  const noteSlot = slot(
    'note',
    { row: 1, col: 0 },
    { row: 1, col: 3 },
    [{ row: 1, col: 1 }, { row: 1, col: 2 }],
    'right',
    'left'
  );
  const result = solveSlotsCsp([noteSlot], [
    entry('do-note', 'ДО', 'Первая ступень музыкальной гаммы.')
  ], {
    seed: 18,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right'],
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
});

test('keeps familiar real two-letter answers available', () => {
  const shortSlot = slot(
    'hedgehog',
    { row: 1, col: 0 },
    { row: 1, col: 3 },
    [{ row: 1, col: 1 }, { row: 1, col: 2 }],
    'right',
    'left'
  );
  const result = solveSlotsCsp([shortSlot], [
    entry('hedgehog', 'ЁЖ', 'Небольшое животное с колючими иглами на спине.')
  ], {
    seed: 19,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right'],
    maxNodes: 100,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.words[0].answer, 'ЁЖ');
});

test('enforces the exact easy-medium-challenging quota for a completed puzzle', () => {
  const slots = Array.from({ length: 5 }, (_, index) => {
    const row = index + 1;
    return slot(
      'difficulty-' + index,
      { row, col: 0 },
      { row, col: 4 },
      [{ row, col: 1 }, { row, col: 2 }, { row, col: 3 }],
      'right',
      'left'
    );
  });
  const dictionary = [
    ['КОТ', 2], ['ДОМ', 2], ['ЛЕС', 2], ['НОС', 2],
    ['ЧАЙ', 3], ['ШАР', 3], ['МЁД', 3], ['СЫР', 3],
    ['БОК', 4], ['КУБ', 4], ['ДАР', 4], ['ГУЛ', 4]
  ].map(([answer, difficulty], index) => ({
    id: 'tier-' + index,
    answer,
    difficulty,
    clue: 'Тестовая подсказка номер ' + (index + 1) + '.'
  }));

  const result = solveSlotsCsp(slots, dictionary, {
    seed: 219,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    requireDifficultyBalance: true,
    allowedDirections: ['right'],
    maxNodes: 2000,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.difficultyQuotas, { 2: 1, 3: 3, 4: 1 });
  assert.deepEqual(result.difficultyCounts, { 2: 1, 3: 3, 4: 1 });
  assert.deepEqual(
    [2, 3, 4].map(level => result.words.filter(word => word.difficulty === level).length),
    [1, 3, 1]
  );
});

test('prunes a branch immediately when the dictionary cannot satisfy every difficulty band', () => {
  const slots = Array.from({ length: 5 }, (_, index) => {
    const row = index + 1;
    return slot(
      'easy-only-' + index,
      { row, col: 0 },
      { row, col: 4 },
      [{ row, col: 1 }, { row, col: 2 }, { row, col: 3 }],
      'right',
      'left'
    );
  });
  const dictionary = [
    ['КОТ', 2], ['ДОМ', 2], ['ЛЕС', 2]
  ].map(([answer, difficulty], index) => ({
    id: 'only-easy-' + index,
    answer,
    difficulty,
    clue: 'Простая тестовая подсказка ' + (index + 1) + '.'
  }));

  const result = solveSlotsCsp(slots, dictionary, {
    seed: 220,
    requiredImageCount: 0,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    requireDifficultyBalance: true,
    allowedDirections: ['right'],
    maxNodes: 2000,
    maxTimeMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_CSP_SOLUTION');
  assert.equal(result.lastDeadEnd.reason, 'DIFFICULTY_CAPACITY_UNREACHABLE');
  assert.equal(result.lastDeadEnd.level, 3);
  assert.equal(result.lastDeadEnd.required, 3);
  assert.equal(result.lastDeadEnd.available, 0);
});

test('reserves five distinct picture answers before filling the remaining special eleven-letter crossings', () => {
  const specialAnswer = 'ФОТОАППАРАТ';
  const specialCoordinates = Array.from({ length: 11 }, (_, index) => ({
    row: index + 1,
    col: 1
  }));
  const special = {
    id: 'special-eleven:0,1>12,1',
    length: 11,
    special: 'ELEVEN_LETTER_BOTTOM_BOUNDARY',
    endpoints: [
      { row: 0, col: 1 },
      { row: 12, col: 1, boundary: true }
    ],
    coordinates: specialCoordinates,
    directionOptions: [{
      clueCell: { row: 0, col: 1 },
      terminalCell: { row: 12, col: 1, boundary: true },
      direction: 'down',
      coordinates: specialCoordinates
    }]
  };
  const pictureSpecs = [
    { row: 1, answer: 'ФЕН', imageKey: 'hairdryer' },
    { row: 2, answer: 'ОСА', imageKey: 'wasp' },
    { row: 3, answer: 'ТИГР', imageKey: 'tiger' },
    { row: 4, answer: 'ОБЛАКО', imageKey: 'cloud' },
    { row: 5, answer: 'АРБУЗ', imageKey: 'watermelon' }
  ];
  const pictureSlots = pictureSpecs.map((item, index) => {
    const length = item.answer.length;
    return {
      ...slot(
        'picture-crossing-' + index,
        { row: item.row, col: 0 },
        { row: item.row, col: length + 1 },
        Array.from({ length }, (_, position) => ({
          row: item.row,
          col: position + 1
        })),
        'right',
        'left'
      ),
      expectedImageKey: item.imageKey
    };
  });
  const dictionary = [
    {
      id: 'special-photo',
      answer: specialAnswer,
      clue: 'Устройство для съёмки фотографий.',
      difficulty: 3
    },
    ...pictureSpecs.map(item => ({
      id: 'picture-' + item.imageKey,
      answer: item.answer,
      clue: 'Что изображено на картинке?',
      imageKey: item.imageKey,
      difficulty: 2
    }))
  ];

  const result = solveSlotsCsp([special, ...pictureSlots], dictionary, {
    seed: 90210,
    requiredImageCount: 5,
    minimumLogicClueCells: 0,
    requireEveryClueStarts: false,
    allowedDirections: ['right', 'down'],
    preferredSpecialAnswer: specialAnswer,
    maxNodes: 5000,
    maxTimeMs: 1500
  });

  assert.equal(result.ok, true, result.message + ': ' + JSON.stringify(result.lastDeadEnd));
  assert.equal(result.words.filter(word => word.imageKey).length, 5);
  assert.equal(new Set(result.words.filter(word => word.imageKey).map(word => word.imageKey)).size, 5);
  assert.equal(new Set(result.words.filter(word => word.imageKey).map(word => word.entryId)).size, 5);
  assert.deepEqual(
    result.words.filter(word => word.imageKey).map(word => word.clue.row),
    pictureSpecs.map(item => item.row)
  );
});

