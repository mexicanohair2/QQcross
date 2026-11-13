import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildIndexes, findCandidates, normalizeAnswer, prepareDictionary } from '../src/dictionary.js';

const here = dirname(fileURLToPath(import.meta.url));
const productionDictionary = JSON.parse(
  readFileSync(resolve(here, '../../data/scanword-dictionary.json'), 'utf8')
);

test('accepts the live QQCross clue field and preserves Ё', () => {
  const prepared = prepareDictionary([
    { answer: 'БЕРЁЗА', clue: 'Дерево с белой корой.' }
  ]);
  assert.equal(prepared.entries.length, 1);
  assert.equal(prepared.entries[0].question, 'Дерево с белой корой.');
  assert.equal(prepared.entries[0].answer, 'БЕРЁЗА');
  assert.equal(normalizeAnswer('берёза'), 'БЕРЁЗА');
});

test('uses whole-token answer leakage checks instead of substring false positives', () => {
  const prepared = prepareDictionary([
    { answer: 'ЧАЙ', clue: 'Напиток, который заваривают из чайных листьев.' },
    { answer: 'ПЕРСИК', clue: 'Сладкий ПЕРСИК с бархатистой кожицей.' }
  ]);
  assert.equal(prepared.entries.length, 1);
  assert.equal(prepared.entries[0].answer, 'ЧАЙ');
  assert.ok(prepared.errors.some(item => item.codes.includes('ANSWER_LEAKS_INTO_QUESTION')));
});

test('rejects one-letter and overlength entries without editing source data', () => {
  const prepared = prepareDictionary([
    { answer: 'А', clue: 'Первая буква.' },
    { answer: 'ТУРКМЕНИСТАН', clue: '🇹🇲' },
    { answer: 'КОТ', clue: 'Домашнее животное.' }
  ]);
  assert.deepEqual(prepared.entries.map(item => item.answer), ['КОТ']);
  assert.equal(prepared.stats.input, 3);
  assert.equal(prepared.stats.rejected, 2);
});

test('deduplicates answers by selecting the stronger clue and retains all valid variants', () => {
  const prepared = prepareDictionary([
    { answer: 'КАНАТ', clue: 'Вещь.' },
    { answer: 'КАНАТ', clue: 'Толстая прочная верёвка для подъёма грузов.' }
  ]);
  assert.equal(prepared.entries.length, 1);
  assert.equal(prepared.variants.length, 2);
  assert.equal(prepared.entries[0].question, 'Толстая прочная верёвка для подъёма грузов.');
  assert.equal(prepared.stats.duplicateAnswerRecords, 1);
});

test('preserves image and logic metadata from QQCross entries', () => {
  const prepared = prepareDictionary([
    { answer: 'КОТ', clue: 'Домашнее животное.', imageKey: 'cat', logic: true }
  ]);
  assert.equal(prepared.entries[0].imageKey, 'cat');
  assert.equal(prepared.entries[0].type, 'image');
  assert.equal(prepared.entries[0].logic, true);
});

test('audits the real production dictionary without losing valid content', () => {
  const prepared = prepareDictionary(productionDictionary);
  const indexes = buildIndexes(prepared.entries);
  const answers = prepared.entries.map(item => item.answer);

  assert.ok(productionDictionary.length > 2000);
  assert.ok(prepared.entries.length > 1500);
  assert.ok(prepared.variants.length >= prepared.entries.length);
  assert.equal(new Set(answers).size, answers.length);
  assert.ok(prepared.entries.some(item => item.answer.length === 11));
  assert.ok(prepared.entries.some(item => item.imageKey));
  assert.ok(prepared.entries.some(item => item.logic));
  assert.ok(indexes.byLength.size > 0);
  assert.ok(indexes.byLetter.size > 0);
  assert.ok(prepared.stats.rejected > 0);
  assert.ok(prepared.stats.duplicateAnswerRecords > 0);
});

test('prioritizes a real picture variant when duplicate answers exist', () => {
  const prepared = prepareDictionary([
    { answer: 'ЖИРАФ', clue: 'Самое высокое животное.' },
    { answer: 'ЖИРАФ', clue: 'Что изображено на картинке?', imageKey: 'giraffe' }
  ]);
  assert.equal(prepared.entries.length, 1);
  assert.equal(prepared.entries[0].imageKey, 'giraffe');
});

test('uses positional indexes to narrow candidates by every crossing letter', () => {
  const prepared = prepareDictionary([
    { id: 'a', answer: 'КОТ', clue: 'Домашнее животное из семейства кошачьих.' },
    { id: 'b', answer: 'КИТ', clue: 'Крупное морское млекопитающее.' },
    { id: 'c', answer: 'ТОК', clue: 'Направленное движение электрических зарядов.' },
    { id: 'd', answer: 'ЛЕС', clue: 'Множество деревьев на большой территории.' }
  ]);
  const indexes = buildIndexes(prepared.entries);
  assert.deepEqual(findCandidates(indexes, 3, [{ position: 0, letter: 'К' }, { position: 2, letter: 'Т' }]).map(item => item.answer), ['КОТ']);
  assert.deepEqual(findCandidates(indexes, 3, { 1: 'И' }).map(item => item.answer), ['КИТ']);
  assert.deepEqual(findCandidates(indexes, 3, [{ position: 0, letter: 'Я' }]), []);
});

test('candidate lookup preserves Ё and does not mutate index buckets', () => {
  const prepared = prepareDictionary([
    { id: 'a', answer: 'ЁЖ', clue: 'Небольшое животное с иголками.' },
    { id: 'b', answer: 'ЕЖ', clue: 'Сочетание двух букв.' }
  ]);
  const indexes = buildIndexes(prepared.entries);
  const before = indexes.byLength.get(2).map(item => item.id);
  assert.equal(findCandidates(indexes, 2, [{ position: 0, letter: 'Ё' }])[0].answer, 'ЁЖ');
  assert.deepEqual(indexes.byLength.get(2).map(item => item.id), before);
});
