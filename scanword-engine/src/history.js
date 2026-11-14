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

export class GenerationHistory {
  constructor(limit = CONFIG.HISTORY_LIMIT) {
    this.limit = Number.isInteger(limit) && limit > 0 ? limit : CONFIG.HISTORY_LIMIT;
    this.items = [];
  }

  add(result) {
    const words = Array.isArray(result?.words) ? result.words : [];
    const item = {
      key: combinationKey(words),
      structureKey: structureKey(words),
      answers: words.map(word => word.answer),
      questions: words.map(word => normalizeQuestion(word.question ?? word.text ?? '')),
      entryIds: words.map(word => word.entryId ?? word.id ?? word.answer),
      seed: result?.metadata?.seed ?? result?.seed ?? null
    };

    this.items.push(item);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
    return item;
  }

  usageCount(entryId) {
    return this.items.reduce((count, item) => count + Number(item.entryIds.includes(entryId)), 0);
  }

  questionUsageCount(question) {
    const normalized = normalizeQuestion(question);
    if (!normalized) return 0;
    return this.items.reduce((count, item) =>
      count + item.questions.filter(value => value === normalized).length, 0);
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
