const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 16,
    maxNodes: 120000,
    maxCspTimeMs: 1200,
    specialMaxCspTimeMs: 1500,
    specialTopologyAttempts: 2,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 6,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
  };
  const runs = [];
  const fingerprints = new Set();
  let specialRequested = 0;
  let specialGenerated = 0;

  for (let index = 1; index <= 20; index++) {
    const seed = 510000 + index * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, { ...options, seed, sequenceIndex: index, capturePlanDiagnostics: index === 4, captureTrace: index === 4 });
    const elapsedMs = Math.round(performance.now() - started);

    if (!result.ok) {
      runs.push({ index, seed, ok: false, elapsedMs, reason: result.reason, rejectedReasons: result.rejectedReasons });
      continue;
    }

    const validation = validateScanword(result.scanword, dictionary, {
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireConnected: true
    });
    const words = result.scanword.words;
    const images = words.filter(word => word.imageKey);
    const shortAnswers = words.filter(word => word.length === 2);
    const special = result.scanword.metadata.specialElevenLetterQuestion === true;
    if (result.stats.specialElevenRequested) specialRequested++;
    if (special) specialGenerated++;

    const fingerprint = JSON.stringify({
      roles: result.scanword.grid.map(row => row.map(cell => cell.type)),
      answers: words.map(word => word.answer).sort()
    });
    fingerprints.add(fingerprint);

    runs.push({
      index,
      seed,
      ok: validation.valid,
      elapsedMs,
      answerCount: words.length,
      questionCells: validation.metrics.questionCells,
      letterCells: validation.metrics.letters,
      fillPercent: Math.round((validation.metrics.questionCells + validation.metrics.letters) / 95 * 10000) / 100,
      crossings: validation.metrics.crossings,
      shortAnswers: shortAnswers.map(word => word.answer),
      imageCount: validation.metrics.imageCount,
      distinctImageCells: new Set(images.map(word => word.clue.row + "," + word.clue.col)).size,
      logicCells: validation.metrics.logicClueCells,
      specialRequested: result.stats.specialElevenRequested,
      specialGenerated: special,
      musicNoteAnswers: words.filter(word => ['ДО','РЕ','МИ','ФА','ЛЯ','СИ'].includes(word.answer)).map(word => word.answer),
      validationErrors: validation.errors.slice(0, 5),
      ...(index === 4 ? { specialPlanDiagnostics: result.stats.specialElevenPlanDiagnostics ?? null, specialFailureDiagnostics: result.stats.specialElevenFailureDiagnostics ?? null } : {})
    });
  }

  const successful = runs.filter(run => run.ok);
  const times = runs.map(run => run.elapsedMs).sort((a, b) => a - b);
  const validRuns = successful.length === 20;
  const report = {
    requested: 20,
    successful: successful.length,
    failed: 20 - successful.length,
    specialRequested,
    specialGenerated,
    specialMissed: successful.filter(run => run.specialRequested && !run.specialGenerated).length,
    medianMs: times[Math.floor(times.length / 2)],
    p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
    maxTwoLetterAnswers: Math.max(0, ...successful.map(run => run.shortAnswers.length)),
    distinctPuzzles: fingerprints.size,
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
  assert.equal(specialRequested, 5, "Exactly runs 4, 8, 12, 16 and 20 must request the eleven-letter answer.");
  assert.equal(specialGenerated, 5, "Every fourth puzzle must contain the eleven-letter answer.");
  assert.ok(successful.every(run => run.musicNoteAnswers.length === 0), "Musical note names must not be used as short-answer fillers.");
  assert.equal(report.specialMissed, 0, "Requested eleven-letter puzzles must not silently fall back.");
  assert.ok(report.maxTwoLetterAnswers <= 6, "Production puzzles must contain at most six two-letter answers.");
  assert.ok(report.p95Ms <= 4000, "20-puzzle p95 exceeds the 4-second performance budget.");
  assert.ok(report.distinctPuzzles >= 18, "The 20 seeds did not produce enough distinct puzzles.");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
