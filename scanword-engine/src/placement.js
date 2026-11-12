import { DIRECTIONS } from './config.js';
import { inBounds } from './grid.js';
export function getCoordinates(row, col, direction, length) {
  const vector = DIRECTIONS[direction];
  if (!vector || !Number.isInteger(length) || length < 1) return null;
  const coords = [];
  for (let i = 0; i < length; i++) {
    const r = row + vector.dr * (i + 1), c = col + vector.dc * (i + 1);
    if (!inBounds(r, c)) return null;
    coords.push({ row: r, col: c });
  }
  return coords;
}
export function canPlaceWord(grid, clue, entry, direction) {
  const coords = getCoordinates(clue.row, clue.col, direction, entry.answer.length);
  if (!coords) return { ok: false, reason: 'OUT_OF_BOUNDS' };
  for (let i = 0; i < coords.length; i++) {
    const cell = grid[coords[i].row][coords[i].col];
    if (cell.type === 'question' || cell.type === 'corner') return { ok: false, reason: 'BLOCKED_BY_CLUE' };
    if (cell.letter && cell.letter !== entry.answer[i]) return { ok: false, reason: 'LETTER_CONFLICT', at: coords[i] };
  }
  return { ok: true, coords };
}
export function placeWord(grid, clue, entry, direction, wordId) {
  const check = canPlaceWord(grid, clue, entry, direction);
  if (!check.ok) return check;
  clue.type = 'question';
  const questionId = `q_${wordId}`;
  clue.questionIds.push(questionId);
  const word = { id: wordId, entryId: entry.id, answer: entry.answer, question: entry.question,
    clue: { row: clue.row, col: clue.col }, direction, length: entry.answer.length,
    coordinates: check.coords.map(p => ({ ...p })) };
  check.coords.forEach((p, i) => {
    const cell = grid[p.row][p.col];
    cell.type = 'letter'; cell.letter = entry.answer[i]; cell.wordIds.push(wordId);
  });
  return { ok: true, word, questionId };
}