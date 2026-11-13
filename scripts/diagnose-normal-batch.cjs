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
    specialElevenLetterChance: 0
  };
  const runs = [];
  for (let index = 1; index <= 12; index++) {
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
    runs.push({
      seed, ok: validation.valid, elapsedMs,
      score: result.scanword.metadata.score,
      answers: words.length,
      questionCells: validation.metrics.questionCells,
      letters: validation.metrics.letters,
      twoLetterAnswers: words.filter(word => word.length === 2).map(word => word.answer),
      weakPronouns: words.filter(word => ["МЫ","ВЫ","ТЫ","ОН","ЕЕ","ЕЙ"].includes(word.answer)).map(word => word.answer),
      images: validation.metrics.imageCount,
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
    medianMs: times[Math.floor(times.length/2)],
    p95Ms: times[Math.min(times.length-1,Math.floor(times.length*.95))],
    options,
    runs
  };
  console.log(JSON.stringify(report,null,2));
  if (!successful.length) throw new Error("No normal 8x12 scanword could be generated.");
}
main().catch(error=>{console.error(error);process.exitCode=1});
