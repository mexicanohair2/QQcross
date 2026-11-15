export const CONFIG = Object.freeze({
  WIDTH: 8,
  HEIGHT: 12,
  TOTAL_CELLS: 96,
  SPECIAL_ELEVEN_LETTER_CHANCE: 0.25,
  MAX_SEARCH_NODES: 120000,
  MAX_GENERATION_MS: 2500,
  MIN_WORD_LENGTH: 2,
  MAX_WORD_LENGTH: 11,
  HISTORY_LIMIT: 100
});
export const DIRECTIONS = Object.freeze({
  right: Object.freeze({ dr: 0, dc: 1 }),
  left: Object.freeze({ dr: 0, dc: -1 }),
  down: Object.freeze({ dr: 1, dc: 0 }),
  up: Object.freeze({ dr: -1, dc: 0 })
});

/**
 * Border clues have stable visual semantics: the top border never points up,
 * and the left border always starts its answer to the right. Interior clues
 * may use all four directions.
 */
export function isAllowedClueDirection(clueCell, direction) {
  if (!DIRECTIONS[direction] || !Number.isInteger(clueCell?.row) || !Number.isInteger(clueCell?.col)) return false;
  if (clueCell.row === 0) return direction !== 'up';
  if (clueCell.col === 0) return direction === 'right';
  return true;
}