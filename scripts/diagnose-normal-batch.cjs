const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 16,
    maxNodes: 120000,
    // Match the real worker's bounded search budgets.
    maxCspTimeMs: 1200,
    specialMaxCspTimeMs: 1500,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
  };
  const runs = [];
  let shortFeatureRequested = 0;
  let shortFeatureGenerated = 0;
  let longFeatureRequested = 0;
  let longFeatureGenerated = 0;

  for (let index = 1; index <= 100; index++) {
    const seed = 180000 + index * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, { ...options, seed, sequenceIndex: index });
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
      requireBorderClues: false,
      requireTopRowHorizontalRun: true,
      requireConnected: true
    });
    const words = result.scanword.words;
    const wantsLong = index % 4 === 0;
    const featuredShort = words.filter(word => word.featuredShortQuestion === true);
    const specialLong = words.filter(word => word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY');
    if (wantsLong) longFeatureRequested++; else shortFeatureRequested++;
    if (wantsLong && specialLong.length === 1 && specialLong[0].answer.length === 11) longFeatureGenerated++;
    if (!wantsLong && featuredShort.length === 1 && featuredShort[0].answer.length <= 5) shortFeatureGenerated++;
    const imageWords = words.filter(word => word.imageKey);
    const distinctImageClueCells = new Set(imageWords.map(word => word.clue.row + ',' + word.clue.col)).size;
    if (distinctImageClueCells !== 5) {
      runs.push({ seed, ok: false, reason: 'IMAGE_CLUE_CELL_COLLISION', elapsedMs, distinctImageClueCells });
      continue;
    }

    runs.push({
      seed, ok: validation.valid, elapsedMs,
      generationAttempts: result.stats.attempts,
      score: result.scanword.metadata.score,
      answers: words.length,
      questionCells: validation.metrics.questionCells,
      letters: validation.metrics.letters,
      twoLetterAnswers: words.filter(word => word.length === 2).map(word => word.answer),
      musicNoteAnswers: words.filter(word => ['ДО','РЕ','МИ','ФА','ЛЯ','СИ'].includes(word.answer)).map(word => word.answer),
      weakPronouns: words.filter(word => ["МЫ","ВЫ","ТЫ","ОН","ЕЕ","ЕЙ"].includes(word.answer)).map(word => word.answer),
      images: validation.metrics.imageCount,
      distinctImageClueCells,
      logicCells: validation.metrics.logicClueCells,
      wantsLong,
      specialLongCount: specialLong.length,
      featuredShortCount: featuredShort.length,
      featuredShortAnswer: featuredShort[0]?.answer ?? null,
      crossings: validation.metrics.crossings,
      nodes: result.stats.nodes,
      topologyAttempts: result.stats.topologyAttempts,
      validationErrors: validation.errors.slice(0, 5)
    });
  }
  const successful = runs.filter(run => run.ok);
  const times = runs.map(run => run.elapsedMs).sort((a,b)=>a-b);
  const twoLetterCounts = successful.map(run => run.twoLetterAnswers.length).sort((a,b)=>a-b);
  const report = {
    requested: runs.length,
    successful: successful.length,
    shortFeatureRequested,
    shortFeatureGenerated,
    longFeatureRequested,
    longFeatureGenerated,
    failed: runs.length - successful.length,

    medianMs: times[Math.floor(times.length/2)],
    p95Ms: times[Math.min(times.length-1,Math.floor(times.length*.95))],
    medianTwoLetterAnswers: twoLetterCounts[Math.floor(twoLetterCounts.length/2)],
    maximumTwoLetterAnswers: twoLetterCounts.at(-1),
    options,
    runs
  };
  console.log(JSON.stringify(report,null,2));
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/scanword-100-report.json", JSON.stringify(report, null, 2));
  if (successful.length !== runs.length) throw new Error("Scanword generation did not reach 100/100: " + (runs.length - successful.length) + " failures.");
  if (shortFeatureRequested !== 75 || shortFeatureGenerated !== 75) throw new Error("The three-in-four short-question cadence failed.");
  if (longFeatureRequested !== 25 || longFeatureGenerated !== 25) throw new Error("The one-in-four 11-letter cadence failed.");
  if (successful.some(run => run.musicNoteAnswers.length > 0)) {
    throw new Error('A scanword still uses a musical note as a two-letter filler answer.');
  }
  if (report.maximumTwoLetterAnswers > 6) {
    throw new Error("A production scanword contains more than six two-letter answers.");
  }
  if (report.p95Ms > 4000) {
    throw new Error("Generation p95 exceeded the 4-second mobile safety budget: " + report.p95Ms + "ms.");
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

// This production batch is intentionally run by the existing pull-request verification workflow.
