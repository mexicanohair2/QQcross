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

/**
 * Lexical identity key: Е and Ё are treated as the same answer for duplicate
 * prevention, while the displayed answer keeps its original spelling.
 */
export function canonicalAnswerKey(value, options = {}) {
  return normalizeAnswer(value, options).replaceAll('Ё', 'Е');
}

export function normalizeQuestion(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[«»"'“”]/gu, '')
    .replace(/[.,!?;:(){}—–-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function questionContainsWholeAnswer(question, answer) {
  if (!answer || answer.length < 2) return false;
  const normalizedAnswer = normalizeAnswer(answer, { foldYo: true });
  const tokens = String(question ?? '')
    .toLocaleUpperCase('ru-RU')
    .replace(/Ё/gu, 'Е')
    .match(/[А-ЯЕ]+/gu) ?? [];
  return tokens.includes(normalizedAnswer);
}

export function normalizeDifficultyBand(value) {
  if (value === undefined || value === null || value === '') return 3;
  const numeric = Number(value);
  const level = Number.isFinite(numeric) ? Math.round(numeric) : 3;
  // Keep live play within the agreed grade-7 range: easy, medium, challenging.
  return level <= 2 ? 2 : level >= 4 ? 4 : 3;
}

export function getDifficultyQuotaCounts(total, distribution = {}) {
  distribution = distribution ?? {};
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const weights = {
    2: Number.isFinite(Number(distribution.easy)) ? Math.max(0, Number(distribution.easy)) : 0.2,
    3: Number.isFinite(Number(distribution.medium)) ? Math.max(0, Number(distribution.medium)) : 0.6,
    4: Number.isFinite(Number(distribution.challenging)) ? Math.max(0, Number(distribution.challenging)) : 0.2
  };
  let weightTotal = weights[2] + weights[3] + weights[4];
  if (weightTotal <= 0) {
    weights[2] = 0.2;
    weights[3] = 0.6;
    weights[4] = 0.2;
    weightTotal = 1;
  }

  const quotas = {};
  const remainders = [];
  let assigned = 0;
  for (const level of [2, 3, 4]) {
    const exact = count * weights[level] / weightTotal;
    quotas[level] = Math.floor(exact);
    assigned += quotas[level];
    remainders.push({ level, fraction: exact - quotas[level] });
  }
  // Largest-remainder apportionment; ties prefer medium, then easy, then challenging.
  const tieOrder = { 3: 0, 2: 1, 4: 2 };
  remainders.sort((a, b) => b.fraction - a.fraction || tieOrder[a.level] - tieOrder[b.level]);
  for (let index = 0; index < count - assigned; index++) quotas[remainders[index].level]++;
  return quotas;
}

export function inferDifficulty(raw, question, imageKey = null, answer = '') {
  const supplied = raw?.difficulty;
  if (supplied !== undefined && supplied !== null && supplied !== '' && Number.isFinite(Number(supplied))) {
    return normalizeDifficultyBand(supplied);
  }

  const text = String(question ?? '').trim();
  const lower = text.toLocaleLowerCase('ru-RU');
  const answerLength = normalizeAnswer(answer).length;
  const wordCount = text.split(/\s+/u).filter(Boolean).length;
  const isFlagPrompt = !/[А-Яа-яЁё]/u.test(text) && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(text);

  if (imageKey || isFlagPrompt) return 2;

  const challengingConcept = /архипелаг|изотоп|фотосинтез|цитоплазм|молекул|орбит|периодическ.{0,20}систем|гипотез|диаспор|барельеф|метафор|кислотност|электролиз|митохондр|хлорофилл/iu.test(lower);
  if (challengingConcept || text.length > 85 || wordCount >= 12) return 4;
  if (raw?.logic === true) return wordCount >= 9 || answerLength >= 9 ? 4 : 3;
  if (answerLength <= 4 && wordCount <= 5 && text.length <= 42) return 2;
  if (answerLength <= 6 && wordCount <= 3 && text.length <= 35) return 2;
  if (answerLength >= 9 && wordCount >= 8) return 4;
  return 3;
}

export function getDifficultyFitScore(value) {
  const level = Math.max(1, Math.min(5, Number(value) || 3));
  // Level 3 is the target: familiar but not trivial for a middle-school player.
  // Both very easy and specialist-level clues lose priority symmetrically.
  return 36 - Math.abs(level - 3) * 18;
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
  // Picture variants are a required gameplay content class; keep their asset metadata.
  if (entry.imageKey) score += 1000;

  if (/первая буква слова|последняя буква слова|начинается на букву|заканчивается на букву/iu.test(question)) score -= 30;
  if (/сколько будет|чему равно|вычисли|посчитай/iu.test(question)) score -= 12;
  if (questionContainsWholeAnswer(question, entry.answer)) score -= 100;

  return score;
}

export function validateEntry(raw, index = 0, options = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['ENTRY_NOT_OBJECT'], entry: null };
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
  // Grammar-only entries (pronouns, prepositions and interjections) make weak filler clues in this scanword format.
  if (/местоимени|предлог|междомет/iu.test(question)) errors.push('FUNCTION_WORD_CLUE');
  if (questionContainsWholeAnswer(question, answer)) errors.push('ANSWER_LEAKS_INTO_QUESTION');

  const entry = {
    id: String(raw.id ?? ('dictionary_' + String(index + 1).padStart(4, '0'))),
    sourceIndex: index,
    answer,
    question,
    clueShort: clueShort || question,
    difficulty: inferDifficulty(raw, question, imageKey, answer),
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
 * The source uses { answer, clue, clueShort, imageKey?, logic? }.
 * All valid variants remain available in variants; entries contains one
 * highest-quality representative per answer to prevent duplicate answers.
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

    const answerKey = canonicalAnswerKey(entry.answer);
    const previous = byAnswer.get(answerKey);
    if (!previous) {
      byAnswer.set(answerKey, entry);
    } else {
      const keepNew = clueQuality(entry) > clueQuality(previous);
      const winner = keepNew ? entry : previous;
      const alternate = keepNew ? previous : entry;
      byAnswer.set(answerKey, winner);
      warnings.push({
        code: 'DUPLICATE_ANSWER',
        answer: entry.answer,
        keptId: winner.id,
        alternateId: alternate.id
      });
    }

    const normalizedQuestion = normalizeQuestion(entry.question);
    const owner = questionOwners.get(normalizedQuestion);
    if (owner && canonicalAnswerKey(owner.answer) !== answerKey) {
      const sharedPicturePrompt = Boolean(
        owner.imageKey
        && entry.imageKey
        && owner.imageKey !== entry.imageKey
        && /изображено на картинке|показано на картинке/u.test(normalizedQuestion)
      );
      if (!sharedPicturePrompt) {
        warnings.push({
          code: 'DUPLICATE_QUESTION',
          question: entry.question,
          ids: [owner.id, entry.id],
          answers: [owner.answer, entry.answer]
        });
      }
    } else if (!owner) {
      questionOwners.set(normalizedQuestion, {
        id: entry.id,
        answer: entry.answer,
        imageKey: entry.imageKey
      });
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
    foldYo: options.foldYo === true,
    stats: {
      input: source.length,
      validVariants: variants.length,
      accepted: entries.length,
      rejected: errors.length,
      duplicateAnswerRecords: variants.length - entries.length,
      duplicateAnswerWarnings: warnings.filter(item => item.code === 'DUPLICATE_ANSWER').length,
      duplicateQuestionWarnings: warnings.filter(item => item.code === 'DUPLICATE_QUESTION').length,
      shortQuestionWarnings: warnings.filter(item => item.code === 'SHORT_QUESTION_REVIEW').length,
      // Count unique answers that have at least one variant of each content type.
      // A picture and a logic clue may legitimately be alternate formulations
      // of the same answer; the CSP can select either one for a given puzzle.
      withImages: new Set(variants.filter(item => item.imageKey).map(item => canonicalAnswerKey(item.answer))).size,
      logicEntries: new Set(variants.filter(item => item.logic).map(item => canonicalAnswerKey(item.answer))).size,
      byLength: lengthCounts
    }
  };
}

/**
 * Builds indexes for accepted dictionary variants.
 * Multiple formulations may share an answer; the CSP's usedAnswers constraint
 * prevents using that answer more than once in a puzzle while allowing the
 * solver to select the best available clue/image/logic variant.
 * byLetter uses "position:letter" keys so intersections narrow candidates.
 */
export function buildIndexes(entries, options = {}) {
  const byLength = new Map();
  const byLetter = new Map();
  const byId = new Map();
  const byAnswer = new Map();

  for (const entry of entries) {
    const length = entry.answer.length;
    if (!byLength.has(length)) byLength.set(length, []);
    byLength.get(length).push(entry);
    byId.set(entry.id, entry);
    byAnswer.set(entry.answer, entry);

    for (let position = 0; position < length; position++) {
      const key = position + ':' + entry.answer[position];
      if (!byLetter.has(key)) byLetter.set(key, []);
      byLetter.get(key).push(entry);
    }
  }

  return {
    byLength,
    byLetter,
    byId,
    byAnswer,
    foldYo: options.foldYo === true
  };
}

/**
 * Finds dictionary answers of a fixed length that satisfy all crossing letters.
 * constraints may be [{ position, letter }] or an object like { 0: 'К', 2: 'Т' }.
 * The smallest positional bucket is scanned first (MRV-style candidate narrowing).
 */
export function findCandidates(indexes, length, constraints = []) {
  if (!indexes || !Number.isInteger(length) || length < 1) return [];
  const lengthBucket = indexes.byLength.get(length);
  if (!lengthBucket?.length) return [];

  const rawConstraints = Array.isArray(constraints)
    ? constraints
    : Object.entries(constraints ?? {}).map(([position, letter]) => ({
      position: Number(position),
      letter
    }));

  const normalized = [];
  for (const constraint of rawConstraints) {
    const position = Number(constraint?.position);
    const letter = normalizeAnswer(constraint?.letter, { foldYo: indexes.foldYo });
    if (!Number.isInteger(position) || position < 0 || position >= length || letter.length !== 1) return [];
    normalized.push({ position, letter });
  }

  if (!normalized.length) return [...lengthBucket];

  const buckets = [];
  for (const constraint of normalized) {
    const bucket = indexes.byLetter.get(constraint.position + ':' + constraint.letter);
    if (!bucket?.length) return [];
    buckets.push(bucket);
  }

  buckets.sort((a, b) => a.length - b.length);
  const remainingSets = buckets.slice(1).map(bucket => new Set(bucket.map(entry => entry.id)));

  return buckets[0].filter(entry =>
    entry.answer.length === length
    && remainingSets.every(set => set.has(entry.id))
  );
}
