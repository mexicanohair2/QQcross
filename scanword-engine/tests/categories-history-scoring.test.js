import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerationHistory } from '../src/history.js';
import { getScanwordScoreBreakdown } from '../src/scoring.js';

test('history penalizes recent answer and near-duplicate Russian clue reuse', () => {
  const history = new GenerationHistory(12, [], 12);
  history.add({
    metadata: { seed: 1 },
    words: [
      { id: 'w1', entryId: 'animal_1', answer: 'ЖИРАФ', question: 'Высокое животное с длинной шеей.' },
      { id: 'w2', entryId: 'img_1', answer: 'ЯБЛОКО', question: 'Что изображено на картинке?', imageKey: 'apple' }
    ]
  });
  assert.equal(history.usageCount('animal_1'), 1);
  assert.equal(history.recentUsageCount('animal_1'), 1);
  assert.equal(history.questionUsageCount('Высокое животное с очень длинной шеей.'), 1);
  assert.equal(history.questionUsageCount('Что изображено на картинке?', 'apple'), 1);
  assert.equal(history.questionUsageCount('Что изображено на картинке?', 'banana'), 0);
  const restored = new GenerationHistory(12, history.toJSON(), 12);
  assert.equal(restored.recentUsageCount('animal_1'), 1);
});

test('quality score is zero for invalid boards and never exceeds 100 for valid boards', () => {
  assert.equal(getScanwordScoreBreakdown({ grid: [], words: [] }, { valid: false }).score, 0);
  const grid = Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({
    row, col, type: row === 0 && col === 0 ? 'corner' : (row % 3 === 0 && col % 2 === 0 ? 'question' : 'letter'),
    wordIds: []
  })));
  const words = Array.from({ length: 20 }, (_, index) => ({
    id: 'w' + index, entryId: 'e' + index, answer: 'СЛОВО',
    question: 'Русская проверенная формулировка вопроса.',
    direction: index % 2 ? 'right' : 'down',
    category: ['animals', 'food', 'nature', 'culture', 'science', 'sport'][index % 6],
    clue: { row: 1 + (index % 10), col: 1 + (index % 6) },
    coordinates: []
  }));
  const result = getScanwordScoreBreakdown({ grid, words }, { valid: true });
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.valid, true);
  assert.equal(Object.values(result.breakdown).reduce((sum, value) => sum + value, 0) <= 100, true);
});
