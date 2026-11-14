const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const candidates = [
    "ПРИКЛЮЧЕНИЕ",
    "ПРЕДЛОЖЕНИЕ",
    "ПЕРЕПЛЕТЧИК",
    "ПЕРЕМЕЩЕНИЕ",
    "ЭКЗИСТЕНЦИЯ",
    "КОНТРПРИМЕР",
    "ТАДЖИКИСТАН"
  ];
  const trialsPerAnswer = 3;
  let successful = null;
  const attempts = [];

  for (let candidateIndex = 0; candidateIndex < candidates.length && !successful; candidateIndex++) {
    const answer = candidates[candidateIndex];
    const constrainedDictionary = dictionary.filter(entry =>
      String(entry.answer ?? "").length !== 11
      || String(entry.answer ?? "").toLocaleUpperCase("ru-RU").replace(/Ё/gu, "Е") === answer.replace(/Ё/gu, "Е")
    );

    for (let trial = 0; trial < trialsPerAnswer; trial++) {
      const seed = 17919 + candidateIndex * 104729 + trial * 7919;
      const options = {
        seed,
        specialElevenLetterChance: 1,
        maxTopologyAttempts: 1,
        specialTopologyAttempts: 1,
        maxNodes: 120000,
        maxCspTimeMs: 1200,
        topologyMutationAttempts: 96,
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        captureTrace: true,
        capturePlanDiagnostics: true
      };

      const result = generateScanword(constrainedDictionary, options);
      const special = result.ok
        ? result.scanword.words.filter(word =>
            word.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"
            && word.answer.length === 11
          )
        : [];
      attempts.push({
        answer,
        seed,
        ok: result.ok,
        generatedSpecial: special.length === 1,
        elapsedMs: result.stats?.elapsedMs ?? result.elapsedMs,
        nodes: result.stats?.nodes ?? result.nodes,
        planDiagnostics: result.stats?.specialElevenPlanDiagnostics ?? null,
        failure: result.ok ? null : {
          reason: result.reason,
          attempts: result.attempts,
          rejectedReasons: result.rejectedReasons,
          lastDiagnostic: result.lastDiagnostic ? {
            attempts: result.lastDiagnostic.attempts,
            lastDeadEnd: result.lastDiagnostic.lastDeadEnd,
            deepestDeadEnd: result.lastDiagnostic.deepestDeadEnd,
            searchTrace: result.lastDiagnostic.searchTrace?.slice(0, 30)
          } : null
        }
      });

      if (special.length === 1) {
        const independent = validateScanword(result.scanword, dictionary, {
          requiredImageCount: 5,
          minimumLogicClueCells: 3,
          requireLeftBorderClues: true,
          requireTopAnchor: true,
          requireConnected: true
        });
        if (independent.valid) {
          successful = { answer, seed, result, independent, special: special[0] };
          break;
        }
        attempts[attempts.length - 1].validationErrors = independent.errors;
      }
    }
  }

  console.log(JSON.stringify({
    ok: Boolean(successful),
    candidates,
    trialsPerAnswer,
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

  assert.ok(successful, "No tested 11-letter answer produced a fully validated special scanword.");
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
