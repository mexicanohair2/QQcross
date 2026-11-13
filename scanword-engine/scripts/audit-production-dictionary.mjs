import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeAnswer, normalizeQuestion, prepareDictionary } from '../src/dictionary.js';

const here = dirname(fileURLToPath(import.meta.url));
const dictionaryPath = resolve(here, '../../data/scanword-dictionary.json');
const raw = JSON.parse(readFileSync(dictionaryPath, 'utf8'));
if (!Array.isArray(raw)) throw new Error('Production dictionary must be a JSON array.');

const lengthCounts = {};
const answerGroups = new Map();
const questionGroups = new Map();
const rejectionCodes = {};
let emptyClues = 0;
let invalidCharacters = 0;
let oneLetterAnswers = 0;
let overlengthAnswers = 0;
let emptyAnswers = 0;
let imageRecords = 0;
let logicRecords = 0;
let shortClues = 0;
let longClues = 0;

for (const item of raw) {
  const answer = normalizeAnswer(item?.answer);
  const clue = String(item?.clue ?? item?.question ?? '').trim();
  const questionKey = normalizeQuestion(clue);

  lengthCounts[answer.length] = (lengthCounts[answer.length] ?? 0) + 1;
  if (!answer) emptyAnswers++;
  if (answer && !/^[А-ЯЁ]+$/u.test(answer)) invalidCharacters++;
  if (answer.length === 1) oneLetterAnswers++;
  if (answer.length > 11) overlengthAnswers++;
  if (!clue) emptyClues++;
  if (clue.length > 0 && clue.length < 15) shortClues++;
  if (clue.length > 110) longClues++;
  if (item?.imageKey) imageRecords++;
  if (item?.logic === true) logicRecords++;

  if (!answerGroups.has(answer)) answerGroups.set(answer, []);
  answerGroups.get(answer).push({ answer, clue, imageKey: item?.imageKey ?? null });

  if (questionKey) {
    if (!questionGroups.has(questionKey)) questionGroups.set(questionKey, []);
    questionGroups.get(questionKey).push(answer);
  }
}

const prepared = prepareDictionary(raw);
for (const error of prepared.errors) {
  for (const code of error.codes) rejectionCodes[code] = (rejectionCodes[code] ?? 0) + 1;
}

const duplicateAnswers = [...answerGroups.entries()]
  .filter(([answer, items]) => answer && items.length > 1)
  .map(([answer, items]) => ({ answer, count: items.length, clues: items.slice(0, 3).map(item => item.clue) }))
  .sort((a, b) => b.count - a.count);
const duplicateQuestions = [...questionGroups.entries()]
  .filter(([, items]) => new Set(items.map(item => normalizeAnswer(item.answer))).size > 1)
  .map(([question, items]) => ({
    question,
    answers: [...new Set(items.map(item => normalizeAnswer(item.answer)))],
    imageKeys: [...new Set(items.map(item => item.imageKey).filter(Boolean))]
  }));
const safeImagePromptGroups = duplicateQuestions.filter(group =>
  /изображено на картинке|показано на картинке/u.test(group.question)
  && group.imageKeys.length === group.answers.length
);
const suspiciousDuplicateQuestionGroups = duplicateQuestions.filter(group =>
  !safeImagePromptGroups.includes(group)
);

const report = {
  source: 'data/scanword-dictionary.json',
  rawRecords: raw.length,
  playableUniqueEntries: prepared.entries.length,
  validVariants: prepared.variants.length,
  rejectedRecords: prepared.errors.length,
  rejectionCodes,
  duplicateAnswerGroups: duplicateAnswers.length,
  duplicateAnswerRecords: raw.length - new Set(raw.map(item => normalizeAnswer(item?.answer))).size,
  duplicateQuestionGroupsAcrossAnswers: duplicateQuestions.length,
  safeSharedImagePromptGroups: safeImagePromptGroups.length,
  suspiciousDuplicateQuestionGroups: suspiciousDuplicateQuestionGroups.length,
  rawAnswerLengths: lengthCounts,
  entriesWithImages: imageRecords,
  entriesMarkedLogic: logicRecords,
  shortCluesUnder15Characters: shortClues,
  longCluesOver110Characters: longClues,
  oneLetterAnswers: oneLetterAnswers,
  answersOver11Letters: overlengthAnswers,
  emptyAnswers,
  emptyClues,
  invalidAnswerCharacters: invalidCharacters,
  topDuplicateAnswers: duplicateAnswers.slice(0, 12),
  warningCounts: {
    duplicateAnswers: prepared.stats.duplicateAnswerWarnings,
    duplicateQuestions: prepared.stats.duplicateQuestionWarnings,
    shortQuestionReview: prepared.stats.shortQuestionWarnings
  }
};

console.log(JSON.stringify(report, null, 2));

if (prepared.entries.length < 1500) {
  throw new Error('Too few playable unique dictionary entries: ' + prepared.entries.length);
}
if (!prepared.entries.some(item => item.answer.length === 11)) {
  throw new Error('Production dictionary has no usable 11-letter answer.');
}
