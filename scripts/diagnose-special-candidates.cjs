const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const trials = 8;
  let successful = null;
  const attempts = [];

  for (let trial = 0; trial < trials; trial++) {
    const seed = 17919 + trial * 104729;
    const options = {
      seed,
      specialElevenLetterChance: 1,
      maxTopologyAttempts: 16,
      specialTopologyAttempts: 8,
      maxNodes: 120000,
      maxCspTimeMs: 1200,
      topologyMutationAttempts: 96,
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      captureTrace: true,
      capturePlanDiagnostics: true
    };

    const result = generateScanword(dictionary, options);
    const special = result.ok
      ? result.scanword.words.filter(word =>
          word.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"
          && word.answer.length === 11
        )
      : [];
    const report = {
      seed,
      ok: result.ok,
      generatedSpecial: special.length === 1,
      elapsedMs: result.stats?.elapsedMs ?? result.elapsedMs,
      nodes: result.stats?.nodes ?? result.nodes,
      planDiagnostics: result.stats?.specialElevenPlanDiagnostics ?? null,
      attempts: result.stats?.specialElevenFailureDiagnostics ?? result.attempts,
      failure: result.ok ? null : {
        reason: result.reason,
        rejectedReasons: result.rejectedReasons,
        lastDiagnostic: result.lastDiagnostic ? {
          attempts: result.lastDiagnostic.attempts,
          lastDeadEnd: result.lastDiagnostic.lastDeadEnd,
          deepestDeadEnd: result.lastDiagnostic.deepestDeadEnd,
          searchTrace: result.lastDiagnostic.searchTrace?.slice(0, 30)
        } : null
      }
    };
    attempts.push(report);

    if (special.length === 1) {
      const independent = validateScanword(result.scanword, dictionary, {
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        requireLeftBorderClues: true,
        requireTopAnchor: true,
        requireConnected: true
      });
      if (independent.valid) {
        successful = { seed, result, independent, special: special[0] };
        break;
      }
      report.validationErrors = independent.errors;
    }
  }

  console.log(JSON.stringify({
    ok: Boolean(successful),
    dictionaryEntries: dictionary.length,
    elevenLetterEntries: dictionary.filter(entry => String(entry.answer ?? "").length === 11).length,
    trials,
    tested: attempts.length,
    attempts,
    success: successful ? {
      answer: successful.special.answer,
      clue: successful.special.question,
      seed: successful.seed,
      dimensions: "8x12",
      answers: successful.result.scanword.words.length,
      imageCount: successful.independent.metrics.imageCount,
      logicClueCells: successful.independent.metrics.logicClueCells,
      crossings: successful.independent.metrics.crossings,
      nodes: successful.result.stats.nodes,
      generationTimeMs: successful.result.stats.elapsedMs
    } : null
  }, null, 2));

  assert.ok(successful, "No production 11-letter scanword passed independent validation across the full dictionary.");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
