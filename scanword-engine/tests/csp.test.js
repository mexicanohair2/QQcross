import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSlotsCsp } from '../src/csp.js';

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
