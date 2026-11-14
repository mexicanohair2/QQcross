import { CONFIG } from './config.js';
export function createEmptyGrid() {
  return Array.from({ length: CONFIG.HEIGHT }, (_, row) => Array.from({ length: CONFIG.WIDTH }, (_, col) => ({
    row, col, type: row === 0 && col === 0 ? 'corner' : 'unassigned', letter: null, questionIds: [], wordIds: []
  })));
}
export function inBounds(row, col) { return row >= 0 && row < CONFIG.HEIGHT && col >= 0 && col < CONFIG.WIDTH; }
export function assertGridDimensions(grid) {
  return Array.isArray(grid) && grid.length === CONFIG.HEIGHT && grid.every(r => Array.isArray(r) && r.length === CONFIG.WIDTH);
}