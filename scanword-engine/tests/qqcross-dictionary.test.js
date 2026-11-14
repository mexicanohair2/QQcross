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

test('rejects pronoun, preposition and interjection filler clues', () => {
  const prepared = prepareDictionary([
    { answer: 'ОН', clue: 'Местоимение, которым заменяют имя мужчины.' },
    { answer: 'НА', clue: 'Предлог, указывающий на расположение.' },
    { answer: 'АХ', clue: 'Междометие, выражающее удивление.' },
    { answer: 'КОТ', clue: 'Домашнее животное из семейства кошачьих.' }
  ]);
  assert.deepEqual(prepared.entries.map(item => item.answer), ['КОТ']);
  assert.equal(prepared.stats.rejected, 3);
  assert.ok(prepared.errors.every(item => item.codes.includes('FUNCTION_WORD_CLUE')));
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
  const uniqueImageAnswers = new Set(
    prepared.variants.filter(item => item.imageKey).map(item => item.answer)
  );
  const uniqueLogicAnswers = new Set(
    prepared.variants.filter(item => item.logic).map(item => item.answer)
  );
  assert.equal(prepared.stats.withImages, uniqueImageAnswers.size);
  assert.equal(prepared.stats.logicEntries, uniqueLogicAnswers.size);
  assert.equal(prepared.stats.withImages, 46);
  assert.equal(prepared.stats.logicEntries, 622);
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
  assert.deepEqual(findCandidates(indexes, 3, [{ position: 0, letter: 'К' }, { position: 1, letter: 'О' }, { position: 2, letter: 'Т' }]).map(item => item.answer), ['КОТ']);
  assert.deepEqual(findCandidates(indexes, 3, { 1: 'И' }).map(item => item.answer), ['КИТ']);
  assert.deepEqual(findCandidates(indexes, 3, [{ position: 0, letter: 'Я' }]), []);
});

test('preserves Ё spelling in variants while deduplicating Е/Ё lexical identity', () => {
  const prepared = prepareDictionary([
    { id: 'yo', answer: 'ЁЖ', clue: 'Небольшое животное с иголками.' },
    { id: 'e', answer: 'ЕЖ', clue: 'Сочетание двух букв.' }
  ]);
  assert.equal(prepared.variants.length, 2);
  assert.equal(prepared.entries.length, 1);
  const indexes = buildIndexes(prepared.variants);
  const before = indexes.byLength.get(2).map(item => item.id);
  assert.equal(findCandidates(indexes, 2, [{ position: 0, letter: 'Ё' }])[0].answer, 'ЁЖ');
  assert.equal(findCandidates(indexes, 2, [{ position: 0, letter: 'Е' }]).length, 1);
  assert.deepEqual(indexes.byLength.get(2).map(item => item.id), before);
});

test('allows the same picture prompt when each answer has a distinct image asset', () => {
  const prepared = prepareDictionary([
    { answer: 'ЯБЛОКО', clue: 'Что изображено на картинке?', imageKey: 'apple' },
    { answer: 'БАНАН', clue: 'Что изображено на картинке?', imageKey: 'banana' }
  ]);
  assert.equal(prepared.entries.length, 2);
  assert.equal(prepared.stats.duplicateQuestionWarnings, 0);
});


test('content availability statistics count distinct answers across all valid variants', () => {
  const prepared = prepareDictionary([
    { id: 'shared-image', answer: 'КОТ', clue: 'Что изображено на картинке?', imageKey: 'cat' },
    { id: 'shared-logic', answer: 'КОТ', clue: 'Кто ловит мышей и живёт рядом с человеком?', logic: true },
    { id: 'other-logic', answer: 'ПЁС', clue: 'Кто охраняет дом и подаёт голос лаем?', logic: true },
    { id: 'other-image', answer: 'ЛЕС', clue: 'Что изображено на картинке?', imageKey: 'forest' }
  ]);

  assert.equal(prepared.entries.length, 3);
  assert.equal(prepared.variants.length, 4);
  assert.equal(prepared.stats.withImages, 2);
  assert.equal(prepared.stats.logicEntries, 2);
});


test('picture-only clues are not incorrectly counted as logical questions', () => {
  const catPicture = productionDictionary.find(item => item.imageKey === 'cat');
  assert.ok(catPicture);
  assert.notEqual(catPicture.logic, true);
});

test('production answer identity treats ЕЖ and ЁЖ as one unique lexical answer', () => {
  const prepared = prepareDictionary([
    { id: 'yo', answer: 'ЁЖ', clue: 'Небольшое животное с колючими иглами.' },
    { id: 'e', answer: 'ЕЖ', clue: 'Сочетание двух букв.' }
  ]);
  assert.equal(prepared.stats.accepted, 1);
  assert.equal(prepared.stats.duplicateAnswerRecords, 1);
  assert.equal(prepared.entries[0].answer, 'ЁЖ');
});

