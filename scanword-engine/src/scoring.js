function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueCount(values) {
  return new Set(values.filter(value => value != null && value !== '')).size;
}

function coordinateKey(point) {
  return point && Number.isInteger(point.row) && Number.isInteger(point.col)
    ? point.row + ',' + point.col
    : '';
}

/**
 * Quality score is assigned only after independent validation. It measures
 * content and layout quality; it can never turn an invalid board into success.
 * Maximum: 100 points.
 */
export function getScanwordScoreBreakdown(scanword, validation, options = {}) {
  if (!scanword?.grid || !Array.isArray(scanword.words) || !validation?.valid) {
    return { score: 0, valid: false, breakdown: {}, metrics: {} };
  }

  const cells = scanword.grid.flat();
  const words = scanword.words;
  const letters = cells.filter(cell => cell.type === 'letter');
  const questions = cells.filter(cell => cell.type === 'question');
  const crossings = letters.filter(cell => (cell.wordIds?.length ?? 0) > 1).length;
  const lengths = words.map(word => word.answer.length);
  const directions = uniqueCount(words.map(word => word.direction));
  const categories = uniqueCount(words.map(word => word.category ?? word.tags?.[0]));
  const familiarityCounts = { everyday: 0, familiar: 0, extended: 0 };
  for (const word of words) {
    const tier = word.familiarity ?? 'familiar';
    if (Object.hasOwn(familiarityCounts, tier)) familiarityCounts[tier]++;
  }
  const everydayRatio = familiarityCounts.everyday / Math.max(1, words.length);
  const extendedRatio = familiarityCounts.extended / Math.max(1, words.length);
  const clueWordCounts = words.map(word => String(word.question ?? '').trim().split(/\s+/u).filter(Boolean).length);
  const readableClues = clueWordCounts.filter(count => count >= 3 && count <= 12).length;
  const avgClueWords = clueWordCounts.length
    ? clueWordCounts.reduce((sum, count) => sum + count, 0) / clueWordCounts.length
    : 0;
  const lengthVariety = uniqueCount(lengths);
  const imageKeys = new Set(words.filter(word => word.imageKey).map(word => word.imageKey));
  const logicCount = uniqueCount(words.filter(word => word.logic).map(word => coordinateKey(word.clue)));
  const crossingRatio = crossings / Math.max(1, letters.length);
  const cellCompleteness = cells.length === 96 && cells.every(cell => ['corner', 'question', 'letter'].includes(cell.type));
  const interiorQuestionCount = questions.filter(cell =>
    cell.row >= 2 && cell.row <= 9 && cell.col >= 1 && cell.col <= 6
  ).length;
  const recentWordUses = words.reduce((sum, word) =>
    sum + (options.history?.recentUsageCount?.(word.entryId ?? word.id) ?? 0), 0);
  const recentQuestionUses = words.reduce((sum, word) =>
    sum + (options.history?.recentQuestionUsageCount?.(word.question, word.imageKey) ?? 0), 0);
  const novelty = 1 - (recentWordUses + recentQuestionUses) / Math.max(1, words.length * 2);

  const breakdown = {
    completeness: cellCompleteness ? 12 : 0,
    independentValidity: validation.valid ? 20 : 0,
    crossingQuality: clamp(crossingRatio / 0.38, 0, 1) * 15,
    directionCoverage: directions === 2 ? 4 : directions === 1 ? 2 : 0,
    clueQuality: readableClues / Math.max(1, words.length) * 15,
    clueBalance: clamp(1 - Math.abs(avgClueWords - 6) / 8, 0, 1) * 4,
    answerVariety: clamp(lengthVariety / 6, 0, 1) * 5,
    categoryDiversity: clamp(categories / 6, 0, 1) * 8,
    familiarVocabulary: clamp(everydayRatio + (familiarityCounts.familiar / Math.max(1, words.length)) * 0.65 - extendedRatio * 0.5, 0, 1) * 8,
    pictureDiversity: imageKeys.size >= 2 ? 3 : imageKeys.size === 1 ? 1.5 : 0,
    logicClues: clamp(logicCount / 3, 0, 1) * 3,
    clueDistribution: clamp(interiorQuestionCount / 8, 0, 1) * 6,
    recentNovelty: clamp(novelty, 0, 1) * 5
  };
  const score = Math.round(clamp(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 0, 100));

  return {
    score,
    valid: true,
    breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, Math.round(value * 100) / 100])),
    metrics: {
      words: words.length,
      questionCells: questions.length,
      letterCells: letters.length,
      crossings,
      crossingRatio: Math.round(crossingRatio * 1000) / 1000,
      directions,
      categoryCount: categories,
      familiarityCounts,
      imageCount: imageKeys.size,
      logicClueCells: logicCount,
      interiorQuestionCells: interiorQuestionCount,
      recentWordUses,
      recentQuestionUses
    }
  };
}

export function scoreScanword(scanword, validation, options = {}) {
  return getScanwordScoreBreakdown(scanword, validation, options).score;
}
