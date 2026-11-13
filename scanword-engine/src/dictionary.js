const ANSWER_RE = /^[А-ЯЁ]+$/u;

export function normalizeAnswer(value, { foldYo = false } = {}) {
  let result = String(value ?? '')
    .normalize('NFC')
    .trim()
    .toLocaleUpperCase('ru-RU')
    .replace(/\s+/gu, '');
  if (foldYo) result = result.replaceAll('Ё', 'Е');
  return result;
}

export function normalizeQuestion(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/[«»"'“”]/gu, '')
    .replace(/[.,!?;:()[\]{}—–-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function questionContainsWholeAnswer(question, answer) {
  if (!answer || answer.length < 2) return false;
  const tokens = String(question ?? '')
    .toLocaleUpperCase('ru-RU')
    .match(/[А-ЯЁ]+/gu) ?? [];
  return tokens.includes(answer);
}

function clueQuality(entry) {
  const question = entry.question;
  const words = question.split(/\s+/u).filter(Boolean).length;
  let score = 0;

  if (question.length >= 18 && question.length <= 100) score += 12;
  else if (question.length > 110) score -= 8;

  if (words >= 3 && words <= 10) score += 8;
  else if (words <= 1) score -= 8;

  if (/[.!?]$/u.test(question)) score += 3;
  if (entry.logic) score += 18;
  // Preserve the production picture-answer variants; image selection is a hard content preference.
  if (entry.imageKey) score += 1000;

  if (/первая буква слова|последняя буква слова|начинается на букву|заканчивается на букву/iu.test(question)) score -= 30;
  if (/сколько будет|чему равно|вычисли|посчитай/iu.test(question)) score -= 12;
  if (questionContainsWholeAnswer(question, entry.answer)) score -= 100;

  return score;
}

export function validateEntry(raw, index = 0, options = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['ENTRY_NOT_OBJECT'],
      entry: null
    };
  }

  const answer = normalizeAnswer(raw.answer, options);
  const question = String(raw.question ?? raw.clue ?? '').normalize('NFC').trim();
  const clueShort = String(raw.clueShort ?? raw.shortClue ?? question).normalize('NFC').trim();
  const imageKey = typeof raw.imageKey === 'string' && raw.imageKey.trim()
    ? raw.imageKey.trim()
    : (typeof raw.image?.key === 'string' ? raw.image.key : null);

  if (!answer || !ANSWER_RE.test(answer)) errors.push('INVALID_ANSWER_CHARACTERS');
  if (answer.length < 2 || answer.length > 11) errors.push('ANSWER_LENGTH_OUT_OF_RANGE');
  if (!question) errors.push('EMPTY_QUESTION');
  if (questionContainsWholeAnswer(question, answer)) errors.push('ANSWER_LEAKS_INTO_QUESTION');

  const entry = {
    id: String(raw.id ?? ('dictionary_' + String(index + 1).padStart(4, '0'))),
    sourceIndex: index,
    answer,
    question,
    clueShort: clueShort || question,
    difficulty: Number.isFinite(raw.difficulty) ? raw.difficulty : 1,
    partOfSpeech: String(raw.partOfSpeech ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    logic: raw.logic === true,
    type: raw.type === 'image' || imageKey ? 'image' : 'text',
    imageKey,
    image: raw.image ?? null
  };

  return { valid: errors.length === 0, errors, entry };
}

/**
 * Normalizes the production QQCross dictionary schema.
 *
 * The live source uses { answer, clue, clueShort, imageKey?, logic? };
 * the isolated engine originally expected { answer, question }. Both shapes
 * are accepted here. Duplicate answers are represented by one best candidate
 * in entries, while every valid source variant remains available in variants.
 */
export function prepareDictionary(input, options = {}) {
  const errors = [];
  const warnings = [];
  const variants = [];
  const byAnswer = new Map();
  const questionOwners = new Map();

  const source = Array.isArray(input) ? input : [];
  for (let index = 0; index < source.length; index++) {
    const result = validateEntry(source[index], index, options);
    if (!result.valid) {
      errors.push({
        index,
        id: source[index]?.id ?? null,
        answer: source[index]?.answer ?? null,
        codes: result.errors
      });
      continue;
    }

    const entry = result.entry;
    variants.push(entry);

    if (entry.question.length < 15 && !entry.imageKey && !entry.logic) {
      warnings.push({
        code: 'SHORT_QUESTION_REVIEW',
        id: entry.id,
        answer: entry.answer,
        question: entry.question
      });
    }

    const previous = byAnswer.get(entry.answer);
    if (!previous) {
      byAnswer.set(entry.answer, entry);
    } else {
      const keepNew = clueQuality(entry) > clueQuality(previous);
      const winner = keepNew ? entry : previous;
      const alternate = keepNew ? previous : entry;
      byAnswer.set(entry.answer, winner);
      warnings.push({
        code: 'DUPLICATE_ANSWER',
        answer: entry.answer,
        keptId: winner.id,
        alternateId: alternate.id
      });
    }

    const normalizedQuestion = normalizeQuestion(entry.question);
    const owner = questionOwners.get(normalizedQuestion);
    if (owner && owner.answer !== entry.answer) {
      warnings.push({
        code: 'DUPLICATE_QUESTION',
        question: entry.question,
        ids: [owner.id, entry.id],
        answers: [owner.answer, entry.answer]
      });
    } else if (!owner) {
      questionOwners.set(normalizedQuestion, { id: entry.id, answer: entry.answer });
    }
  }

  const entries = [...byAnswer.values()];
  const lengthCounts = {};
  for (const entry of entries) {
    lengthCounts[entry.answer.length] = (lengthCounts[entry.answer.length] ?? 0) + 1;
  }

  return {
    entries,
    variants,
    errors,
    warnings,
    stats: {
      input: source.length,
      validVariants: variants.length,
      accepted: entries.length,
      rejected: errors.length,
      duplicateAnswerRecords: variants.length - entries.length,
      duplicateAnswerWarnings: warnings.filter(item => item.code === 'DUPLICATE_ANSWER').length,
      duplicateQuestionWarnings: warnings.filter(item => item.code === 'DUPLICATE_QUESTION').length,
      shortQuestionWarnings: warnings.filter(item => item.code === 'SHORT_QUESTION_REVIEW').length,
      withImages: entries.filter(item => item.imageKey).length,
      logicEntries: entries.filter(item => item.logic).length,
      byLength: lengthCounts
    }
  };
}

export function buildIndexes(entries) {
  const byLength = new Map();
  const byLetter = new Map();

  for (const entry of entries) {
    const length = entry.answer.length;
    if (!byLength.has(length)) byLength.set(length, []);
    byLength.get(length).push(entry);

    for (let position = 0; position < length; position++) {
      const key = position + ':' + entry.answer[position];
      if (!byLetter.has(key)) byLetter.set(key, []);
      byLetter.get(key).push(entry);
    }
  }

  return { byLength, byLetter };
}
