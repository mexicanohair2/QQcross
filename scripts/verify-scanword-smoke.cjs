const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 24,
    maxNodes: 120000,
    maxCspTimeMs: 1600,
    specialMaxCspTimeMs: 1800,
    specialTopologyAttempts: 2,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
  };
  const runs = [];
  const fingerprints = new Set();
  const topologyMasks = new Set();
  let featuredShortRequested = 0;
  let featuredShortGenerated = 0;
  let specialElevenRequested = 0;
  let specialElevenGenerated = 0;
  const directionCoverage = new Set();

  for (let index = 1; index <= 20; index++) {
    const seed = 510000 + index * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, { ...options, seed, sequenceIndex: index, capturePlanDiagnostics: index === 4, captureTrace: index === 1 });
    const elapsedMs = Math.round(performance.now() - started);

    if (!result.ok) {
      runs.push({ index, seed, ok: false, elapsedMs, reason: result.reason, rejectedReasons: result.rejectedReasons, lastDiagnostic: result.lastDiagnostic ?? null, attempts: (result.attempts ?? []).map(item => ({ attempt: item.attempt, reason: item.reason, nodes: item.nodes, deepest: item.deepest, elapsedMs: item.elapsedMs, lastDeadEnd: item.lastDeadEnd, deepestDeadEnd: item.deepestDeadEnd, searchTrace: item.searchTrace ?? null })) });
      continue;
    }

    const validation = validateScanword(result.scanword, dictionary, {
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireBorderClues: false,
      requireTopRowHorizontalRun: true,
      requireConnected: true
    });
    const words = result.scanword.words;
    const images = words.filter(word => word.imageKey);
    const shortAnswers = words.filter(word => word.length === 2);
    for (const word of words) directionCoverage.add(word.direction);
    const featured = words.filter(word => word.featuredShortQuestion === true);
    const shouldFeatureShort = index % 4 !== 0;
    const shouldFeatureEleven = index % 4 === 0;
    if (shouldFeatureShort) featuredShortRequested++;
    if (featured.length === 1 && featured[0].answer.length <= 5) featuredShortGenerated++;
    if (shouldFeatureEleven) specialElevenRequested++;
    if (result.scanword.metadata.specialElevenLetterQuestion === true) specialElevenGenerated++;

    const topologyMask = JSON.stringify(result.scanword.grid.map(row => row.map(cell => cell.type)));
    topologyMasks.add(topologyMask);
    const fingerprint = JSON.stringify({
      roles: result.scanword.grid.map(row => row.map(cell => cell.type)),
      answers: words.map(word => word.answer).sort()
    });
    fingerprints.add(fingerprint);

    runs.push({
      index,
      seed,
      scaffoldIndex: result.topology.scaffoldIndex,
      ok: validation.valid,
      elapsedMs,
      answerCount: words.length,
      questionCells: validation.metrics.questionCells,
      letterCells: validation.metrics.letters,
      fillPercent: Math.round((validation.metrics.questionCells + validation.metrics.letters) / 95 * 10000) / 100,
      crossings: validation.metrics.crossings,
      shortAnswers: shortAnswers.map(word => word.answer),
      directions: [...new Set(words.map(word => word.direction))].sort(),
      imageCount: validation.metrics.imageCount,
      distinctImageCells: new Set(images.map(word => word.clue.row + "," + word.clue.col)).size,
      logicCells: validation.metrics.logicClueCells,
      featuredShortRequested: shouldFeatureShort,
      featuredShortGenerated: featured.length === 1 && featured[0].answer.length <= 5,
      featuredShortAnswer: featured[0]?.answer ?? null,
      specialElevenRequested: shouldFeatureEleven,
      specialElevenGenerated: result.scanword.metadata.specialElevenLetterQuestion === true,
      musicNoteAnswers: words.filter(word => ['ДО','РЕ','МИ','ФА','ЛЯ','СИ'].includes(word.answer)).map(word => word.answer),
      validationErrors: validation.errors.slice(0, 5),

    });
  }

  const successful = runs.filter(run => run.ok);
  const times = runs.map(run => run.elapsedMs).sort((a, b) => a - b);
  const validRuns = successful.length === 20;
  const report = {
    requested: 20,
    successful: successful.length,
    failed: 20 - successful.length,
    featuredShortRequested,
    featuredShortGenerated,
    specialElevenRequested,
    specialElevenGenerated,
    medianMs: times[Math.floor(times.length / 2)],
    p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
    maxTwoLetterAnswers: Math.max(0, ...successful.map(run => run.shortAnswers.length)),
    distinctPuzzles: fingerprints.size,
    distinctTopologies: topologyMasks.size,
    directionCoverage: [...directionCoverage].sort(),
    ordinaryScaffoldsUsed: [...new Set(successful.filter(run => Number.isInteger(run.scaffoldIndex) && run.scaffoldIndex >= 0).map(run => run.scaffoldIndex))].sort((a, b) => a - b),
    averageAnswers: successful.length ? Math.round(successful.reduce((sum, run) => sum + run.answerCount, 0) / successful.length * 100) / 100 : 0,
    averageQuestionCells: successful.length ? Math.round(successful.reduce((sum, run) => sum + run.questionCells, 0) / successful.length * 100) / 100 : 0,
    averageFillPercent: successful.length ? Math.round(successful.reduce((sum, run) => sum + run.fillPercent, 0) / successful.length * 100) / 100 : 0,
    options,
    runs
  };
  console.log(JSON.stringify(report, null, 2));
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/scanword-20-report.json", JSON.stringify(report, null, 2));

  assert.equal(validRuns, true, "The first gate must produce 20/20 independently validated puzzles.");
  assert.equal(featuredShortRequested, 15, "Exactly three out of every four puzzles must feature one short top-row clue.");
  assert.equal(featuredShortGenerated, 15, "Every short-layout puzzle must feature exactly one answer of at most five letters.");
  assert.equal(specialElevenRequested, 5, "Exactly every fourth puzzle must request one 11-letter answer.");
  assert.equal(specialElevenGenerated, 5, "Every fourth puzzle must contain exactly one 11-letter answer.");
  assert.deepEqual([...directionCoverage].sort(), ['down', 'left', 'right', 'up'], 'The 20 production seeds must exercise all four answer directions.');
  assert.ok(report.distinctTopologies >= 3, 'Production must produce at least three distinct validated topology masks across the batch.');
  assert.ok(successful.every(run => run.musicNoteAnswers.length === 0), "Musical note names must not be used as short-answer fillers.");

  assert.ok(report.maxTwoLetterAnswers <= options.maxTwoLetterSlots, "Production puzzles must stay within the configured two-letter answer limit.");
  assert.ok(report.p95Ms <= 4000, "20-puzzle p95 exceeds the 4-second performance budget.");
  assert.ok(report.distinctPuzzles >= 18, "The 20 seeds did not produce enough distinct puzzles.");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
