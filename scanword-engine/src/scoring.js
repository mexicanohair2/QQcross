export function scoreScanword(scanword, validation) {
  const cells = scanword.grid.flat();
  const filled = cells.filter(c => c.type !== 'unassigned').length;
  const words = scanword.words ?? [];
  const uniqueAnswers = new Set(words.map(w => w.answer)).size;
  const intersections = cells.filter(c => c.type === 'letter' && (c.wordIds?.length ?? 0) > 1).length;
  const completeness = filled / 96 * 35;
  const validity = validation.valid ? 35 : 0;
  const diversity = words.length ? uniqueAnswers / words.length * 15 : 0;
  const crossing = Math.min(15, intersections / Math.max(1, words.length) * 15);
  return Math.round(Math.max(0, Math.min(100, completeness + validity + diversity + crossing)));
}