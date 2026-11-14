function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueCount(values) {
  return new Set(values.filter(value => value != null && value !== '')).size;
}

/**
 * Quality score is informational only. Critical constraints are enforced by
 * validateScanword before a score can be assigned or a puzzle can be returned.
 */
export function scoreScanword(scanword, validation) {
  if (!scanword?.grid || !Array.isArray(scanword.words) || !validation?.valid) return 0;

  const cells = scanword.grid.flat();
  const words = scanword.words;
  const letters = cells.filter(cell => cell.type === 'letter');
  const questions = cells.filter(cell => cell.type === 'question');
  const crossings = letters.filter(cell => (cell.wordIds?.length ?? 0) > 1).length;
  const lengths = words.map(word => word.answer.length);
  const directions = uniqueCount(words.map(word => word.direction));
  const categories = uniqueCount(words.flatMap(word => Array.isArray(word.tags) ? word.tags : []));
  const clueWordCounts = words.map(word => String(word.question ?? '').trim().split(/\s+/u).filter(Boolean).length);
  const readableClues = clueWordCounts.filter(count => count >= 3 && count <= 12).length;
  const avgClueWords = clueWordCounts.length
    ? clueWordCounts.reduce((sum, count) => sum + count, 0) / clueWordCounts.length
    : 0;
  const lengthVariety = uniqueCount(lengths);
  const imageCount = new Set(words.filter(word => word.imageKey).map(word => word.clue.row + ',' + word.clue.col)).size;
  const logicCount = uniqueCount(words.filter(word => word.logic).map(word => word.clue.row + ',' + word.clue.col));
  const crossingRatio = crossings / Math.max(1, letters.length);
  const cellCompleteness = cells.length === 96 && cells.every(cell => ['corner', 'question', 'letter'].includes(cell.type));

  const breakdown = {
    completeness: cellCompleteness ? 20 : 0,
    independentValidity: validation.valid ? 20 : 0,
    crossingQuality: clamp(crossingRatio / 0.38, 0, 1) * 18,
    directionDiversity: directions >= 3 ? 8 : directions / 3 * 8,
    clueQuality: readableClues / Math.max(1, words.length) * 12,
    clueBalance: clamp(1 - Math.abs(avgClueWords - 6) / 8, 0, 1) * 6,
    answerVariety: clamp(lengthVariety / 6, 0, 1) * 6,
    topicDiversity: clamp(categories / 6, 0, 1) * 3,
    pictures: imageCount === 5 ? 4 : 0,
    logic: logicCount >= 3 ? 3 : logicCount
  };
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return Math.round(clamp(score, 0, 100));
}

export function getScanwordScoreBreakdown(scanword, validation) {
  const score = scoreScanword(scanword, validation);
  return { score, valid: Boolean(validation?.valid) };
}
