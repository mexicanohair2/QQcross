import { CONFIG } from './config.js';
import { prepareDictionary } from './dictionary.js';
import { createEmptyGrid } from './grid.js';
import { placeWord } from './placement.js';
import { validateScanword } from './validator.js';
import { scoreScanword } from './scoring.js';
import { createRng, shuffle } from './rng.js';

/*
 * Bounded CSP placement kernel. It deliberately refuses to label a partial
 * board as a successful scanword. This prototype is incomplete: a production
 * 96-cell puzzle still needs a topology-specific slot plan and central clue
 * placement. Do not wire it into live gameplay until that work is complete.
 */
export function generateScanword(inputDictionary, options = {}) {
  const started = Date.now(), seed = options.seed ?? Date.now();
  const prepared = prepareDictionary(inputDictionary, { foldYo: options.foldYo ?? false });
  const random = createRng(seed);
  const wantsEleven = random() < (options.specialElevenLetterChance ?? CONFIG.SPECIAL_ELEVEN_LETTER_CHANCE);
  const specialEntry = wantsEleven ? prepared.entries.find(e => e.answer.length === 11) : null;
  // If no real 11-letter entry exists, silently fall back to ordinary generation.
  // The special mechanic is optional; a missing candidate must not kill the run.
  const grid = createEmptyGrid();
  const anchors = [
    ...Array.from({ length: 7 }, (_, i) => ({ row: 0, col: i + 1, direction: 'down' })),
    ...Array.from({ length: 11 }, (_, i) => ({ row: i + 1, col: 0, direction: 'right' }))
  ];
  const words = [], questions = [], used = new Set();
  const ordered = shuffle(prepared.entries.filter(e => e.id !== specialEntry?.id), random).sort((a, b) => b.answer.length - a.answer.length);
  let nodes = 0;
  function dfs(index) {
    if (index === anchors.length) return true;
    if (++nodes > (options.maxNodes ?? CONFIG.MAX_SEARCH_NODES) || Date.now() - started > (options.maxTimeMs ?? CONFIG.MAX_GENERATION_MS)) return false;
    const anchor = anchors[index];
    const candidates = index === 0 && specialEntry ? [specialEntry] : shuffle(ordered.filter(e => !used.has(e.id)), random);
    for (const entry of candidates) {
      const snapshot = grid.map(row => row.map(c => ({ ...c, questionIds: [...c.questionIds], wordIds: [...c.wordIds] })));
      const placed = placeWord(grid, grid[anchor.row][anchor.col], entry, anchor.direction, `w${index + 1}`);
      if (placed.ok) {
        if (entry.id === specialEntry?.id) placed.word.special = 'ELEVEN_LETTER_BOTTOM_BOUNDARY';
        used.add(entry.id); words.push(placed.word);
        questions.push({ id: placed.questionId, wordId: placed.word.id, text: entry.question, answer: entry.answer, clue: placed.word.clue, direction: anchor.direction });
        if (dfs(index + 1)) return true;
        used.delete(entry.id); words.pop(); questions.pop();
      }
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) grid[r][c] = snapshot[r][c];
    }
    return false;
  }
  const solved = dfs(0);
  if (!solved) return { ok: false, reason: 'NO_COMPLETE_SOLUTION', nodes, elapsedMs: Date.now() - started, seed,
    message: 'Не найдено совместимое размещение обязательных ответов. Частичная сетка не возвращена как готовый сканворд.', dictionaryStats: prepared.stats, dictionaryErrors: prepared.errors, warnings: prepared.warnings };
  const result = { version: 1, width: CONFIG.WIDTH, height: CONFIG.HEIGHT, grid, questions, words,
    metadata: { seed, score: 0, valid: false, generationTimeMs: Date.now() - started, specialElevenLetterQuestion: words.some(w => w.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') } };
  const validation = validateScanword(result, prepared.entries);
  result.metadata.valid = validation.valid;
  result.metadata.score = scoreScanword(result, validation);
  if (!validation.valid) return { ok: false, reason: 'VALIDATION_FAILED', validation, result: null, seed };
  return { ok: true, scanword: result, validation, nodes, elapsedMs: Date.now() - started };
}