import { CONFIG } from './config.js';
import { normalizeQuestion } from './dictionary.js';

function combinationKey(words) {
  return words.map(word => word.entryId ?? word.id ?? word.answer).sort().join('|');
}

function structureKey(words) {
  return words.map(word => {
    const clue = word.clue ?? {};
    const coordinates = Array.isArray(word.coordinates)
      ? word.coordinates.map(point => point.row + ',' + point.col).join(';')
      : '';
    return [
      word.entryId ?? word.id ?? word.answer,
      clue.row ?? (Array.isArray(word.clueCell) ? word.clueCell[0] : word.clueCell?.row) ?? '',
      clue.col ?? (Array.isArray(word.clueCell) ? word.clueCell[1] : word.clueCell?.col) ?? '',
      word.direction ?? word.dir ?? '',
      coordinates
    ].join(':');
  }).sort().join('|');
}

function questionSimilarity(left, right) {
  const a = new Set(normalizeQuestion(left).split(/\s+/u).filter(Boolean));
  const b = new Set(normalizeQuestion(right).split(/\s+/u).filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function splitQuestionIdentity(value) {
  const marker = '::image:';
  const index = String(value).indexOf(marker);
  return index < 0
    ? { question: String(value), imageKey: null }
    : { question: String(value).slice(0, index), imageKey: String(value).slice(index + marker.length) };
}

function questionKey(word) {
  const question = normalizeQuestion(word.question ?? word.text ?? '');
  if (!question) return '';
  // Reusing the same short image prompt for a different illustration is not
  // considered a duplicate clue; the image asset is part of its identity.
  return word.imageKey ? question + '::image:' + word.imageKey : question;
}

export class GenerationHistory {
  constructor(limit = CONFIG.HISTORY_LIMIT, items = [], cooldownBoards = 12) {
    this.limit = Number.isInteger(limit) && limit > 0 ? limit : CONFIG.HISTORY_LIMIT;
    this.cooldownBoards = Number.isInteger(cooldownBoards) && cooldownBoards > 0 ? cooldownBoards : 12;
    this.items = Array.isArray(items) ? items.slice(-this.limit).filter(item =>
      item && Array.isArray(item.entryIds) && Array.isArray(item.questions)
    ) : [];
  }

  add(result) {
    const words = Array.isArray(result?.words) ? result.words : [];
    const item = {
      key: combinationKey(words),
      structureKey: structureKey(words),
      answers: words.map(word => word.answer),
      questions: words.map(questionKey).filter(Boolean),
      entryIds: words.map(word => word.entryId ?? word.id ?? word.answer),
      seed: result?.metadata?.seed ?? result?.seed ?? null
    };

    this.items.push(item);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
    return item;
  }

  toJSON() {
    return this.items.slice(-this.limit).map(item => ({
      key: item.key,
      structureKey: item.structureKey,
      answers: [...item.answers],
      questions: [...item.questions],
      entryIds: [...item.entryIds],
      seed: item.seed ?? null
    }));
  }

  usageCount(entryId) {
    return this.items.reduce((count, item) => count + Number(item.entryIds.includes(entryId)), 0);
  }

  recentUsageCount(entryId) {
    return this.items.slice(-this.cooldownBoards)
      .reduce((count, item) => count + Number(item.entryIds.includes(entryId)), 0);
  }

  questionUsageCount(question, imageKey = null) {
    const normalized = normalizeQuestion(question);
    if (!normalized) return 0;
    return this.items.reduce((count, item) => count + item.questions.filter(value => {
      const previous = splitQuestionIdentity(value);
      if (imageKey && previous.imageKey !== imageKey) return false;
      if (!imageKey && previous.imageKey) return false;
      return questionSimilarity(normalized, previous.question) >= 0.82;
    }).length, 0);
  }

  recentQuestionUsageCount(question, imageKey = null) {
    const normalized = normalizeQuestion(question);
    if (!normalized) return 0;
    return this.items.slice(-this.cooldownBoards).reduce((count, item) => count + item.questions.filter(value => {
      const previous = splitQuestionIdentity(value);
      if (imageKey && previous.imageKey !== imageKey) return false;
      if (!imageKey && previous.imageKey) return false;
      return questionSimilarity(normalized, previous.question) >= 0.82;
    }).length, 0);
  }

  hasCombination(words) {
    const key = combinationKey(words);
    return this.items.some(item => item.key === key);
  }

  hasStructure(words) {
    const key = structureKey(words);
    return this.items.some(item => item.structureKey === key);
  }
}
