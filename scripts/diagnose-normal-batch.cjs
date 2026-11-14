const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 16,
    maxNodes: 120000,
    maxCspTimeMs: 450,
    topologyMutationAttempts: 96,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
    specialElevenLetterChance: 0.25
  };
  const runs = [];
  let specialElevenCount = 0;
  let specialElevenRequestedCount = 0;
  const specialElevenMisses = [];
  for (let index = 1; index <= 100; index++) {
    const seed = 180000 + index * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, { ...options, seed });
    const elapsedMs = Math.round(performance.now() - started);
    if (!result.ok) {
      runs.push({
        seed, ok: false, reason: result.reason, elapsedMs,
        attempts: result.attempts?.length ?? 0,
        rejectedReasons: result.rejectedReasons ?? {},
        lastAttempt: result.attempts?.at(-1) ?? null
      });
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
    const imageWords = words.filter(word => word.imageKey);
    const distinctImageClueCells = new Set(imageWords.map(word => word.clue.row + ',' + word.clue.col)).size;
    if (distinctImageClueCells !== 5) {
      runs.push({ seed, ok: false, reason: 'IMAGE_CLUE_CELL_COLLISION', elapsedMs, distinctImageClueCells });
      continue;
    }
    if (result.stats.specialElevenRequested) specialElevenRequestedCount++;
    if (result.scanword.metadata.specialElevenLetterQuestion) specialElevenCount++;
    else if (result.stats.specialElevenRequested) specialElevenMisses.push({
      seed,
      elapsedMs,
      attempts: result.stats.attempts,
      attemptedSpecialTopologies: result.stats.specialElevenAttempted,
      diagnostics: result.stats.specialElevenFailureDiagnostics,
      rejectedReasons: result.stats.rejectedReasons
    });
    runs.push({
      seed, ok: validation.valid, elapsedMs,
      specialElevenRequested: result.stats.specialElevenRequested,
      specialElevenGenerated: result.scanword.metadata.specialElevenLetterQuestion,
      score: result.scanword.metadata.score,
      answers: words.length,
      questionCells: validation.metrics.questionCells,
      letters: validation.metrics.letters,
      twoLetterAnswers: words.filter(word => word.length === 2).map(word => word.answer),
      weakPronouns: words.filter(word => ["МЫ","ВЫ","ТЫ","ОН","ЕЕ","ЕЙ"].includes(word.answer)).map(word => word.answer),
      images: validation.metrics.imageCount,
      distinctImageClueCells,
      logicCells: validation.metrics.logicClueCells,
      crossings: validation.metrics.crossings,
      nodes: result.stats.nodes,
      topologyAttempts: result.stats.topologyAttempts,
      validationErrors: validation.errors.slice(0, 5)
    });
  }
  const successful = runs.filter(run => run.ok);
  const times = runs.map(run => run.elapsedMs).sort((a,b)=>a-b);
  const report = {
    requested: runs.length,
    successful: successful.length,
    failed: runs.length - successful.length,
    specialElevenRequestedCount,
    specialElevenCount,
    specialElevenMissedCount: specialElevenMisses.length,
    specialElevenMisses,
    expectedSpecialElevenRange: [15, 35],
    medianMs: times[Math.floor(times.length/2)],
    p95Ms: times[Math.min(times.length-1,Math.floor(times.length*.95))],
    options,
    runs
  };
  console.log(JSON.stringify(report,null,2));
  if (successful.length !== runs.length) throw new Error("Scanword generation did not reach 100/100: " + (runs.length - successful.length) + " failures.");
  if (specialElevenCount < 15 || specialElevenCount > 35) {
    throw new Error("Eleven-letter frequency should be near one in four; observed " + specialElevenCount + "/100.");
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

// This production batch is intentionally run by the existing pull-request verification workflow.
