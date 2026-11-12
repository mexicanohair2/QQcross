import { CONFIG } from './config.js';
export class GenerationHistory {
  constructor(limit = CONFIG.HISTORY_LIMIT) { this.limit = limit; this.items = []; }
  add(result) { this.items.push({ key: result.words.map(w => w.entryId).sort().join('|'), answers: result.words.map(w => w.answer), entryIds: result.words.map(w => w.entryId) }); if (this.items.length > this.limit) this.items.shift(); }
  usageCount(entryId) { return this.items.reduce((n, item) => n + (item.entryIds.includes(entryId) ? 1 : 0), 0); }
  hasCombination(words) { const key = words.map(w => w.entryId).sort().join('|'); return this.items.some(x => x.key === key); }
}