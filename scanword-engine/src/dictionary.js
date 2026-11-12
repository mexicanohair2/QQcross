const ANSWER_RE = /^[А-ЯЁ]+$/u;
export function normalizeAnswer(value, { foldYo = false } = {}) {
  let result = String(value ?? '').normalize('NFC').trim().toLocaleUpperCase('ru-RU').replace(/\s+/gu, '');
  if (foldYo) result = result.replaceAll('Ё', 'Е');
  return result;
}
export function normalizeQuestion(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru-RU');
}
export function validateEntry(raw, index = 0, options = {}) {
  const errors = [];
  const answer = normalizeAnswer(raw?.answer, options);
  const question = String(raw?.question ?? '').trim();
  if (!raw || typeof raw !== 'object') errors.push('ENTRY_NOT_OBJECT');
  if (!answer || !ANSWER_RE.test(answer)) errors.push('INVALID_ANSWER_CHARACTERS');
  if (answer.length < 2 || answer.length > 11) errors.push('ANSWER_LENGTH_OUT_OF_RANGE');
  if (!question) errors.push('EMPTY_QUESTION');
  if (question && answer && normalizeQuestion(question).includes(answer.toLocaleLowerCase('ru-RU'))) errors.push('ANSWER_LEAKS_INTO_QUESTION');
  return { valid: errors.length === 0, errors, entry: {
    id: String(raw?.id ?? `entry_${index + 1}`), answer, question,
    difficulty: Number.isFinite(raw?.difficulty) ? raw.difficulty : 1,
    partOfSpeech: String(raw?.partOfSpeech ?? ''), tags: Array.isArray(raw?.tags) ? raw.tags : [],
    type: raw?.type === 'image' ? 'image' : 'text', image: raw?.type === 'image' ? (raw.image ?? null) : null
  }};
}
export function prepareDictionary(input, options = {}) {
  const errors = [], warnings = [], accepted = [], seenAnswers = new Map(), seenQuestions = new Map();
  for (let i = 0; i < (Array.isArray(input) ? input.length : 0); i++) {
    const result = validateEntry(input[i], i, options);
    if (!result.valid) { errors.push({ index: i, id: input[i]?.id ?? null, codes: result.errors }); continue; }
    const e = result.entry;
    const q = normalizeQuestion(e.question);
    if (seenAnswers.has(e.answer)) { warnings.push({ code: 'DUPLICATE_ANSWER', answer: e.answer, ids: [seenAnswers.get(e.answer), e.id] }); continue; }
    if (seenQuestions.has(q)) { warnings.push({ code: 'DUPLICATE_QUESTION', question: e.question, ids: [seenQuestions.get(q), e.id] }); continue; }
    seenAnswers.set(e.answer, e.id); seenQuestions.set(q, e.id); accepted.push(e);
  }
  return { entries: accepted, errors, warnings, stats: { input: input?.length ?? 0, accepted: accepted.length, rejected: errors.length } };
}
export function buildIndexes(entries) {
  const byLength = new Map(), byLetter = new Map();
  for (const e of entries) {
    const n = e.answer.length;
    if (!byLength.has(n)) byLength.set(n, []);
    byLength.get(n).push(e);
    for (let i = 0; i < n; i++) {
      const key = `${i}:${e.answer[i]}`;
      if (!byLetter.has(key)) byLetter.set(key, []);
      byLetter.get(key).push(e);
    }
  }
  return { byLength, byLetter };
}