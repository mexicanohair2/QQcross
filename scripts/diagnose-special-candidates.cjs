const assert = require("node:assert/strict");
const fs = require("node:fs");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    seed: 17919,
    specialElevenLetterChance: 1,
    maxTopologyAttempts: 16,
    maxNodes: 120000,
    maxCspTimeMs: 450,
    topologyMutationAttempts: 96,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };

  const result = generateScanword(dictionary, options);
  assert.equal(result.ok, true, "The optional 11-letter scanword could not be generated: " + JSON.stringify(result));
  const special = result.scanword.words.filter(word =>
    word.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"
    && word.answer.length === 11
  );
  assert.equal(special.length, 1, "Expected exactly one optional 11-letter vertical boundary answer.");

  const independent = validateScanword(result.scanword, dictionary, {
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
    requireLeftBorderClues: true,
    requireTopAnchor: true,
    requireConnected: true
  });
  assert.equal(independent.valid, true, "Independent validation rejected the 11-letter puzzle: " + JSON.stringify(independent.errors));

  const report = {
    ok: true,
    seed: options.seed,
    dimensions: "8x12",
    answers: result.scanword.words.length,
    specialElevenLetterAnswer: special[0].answer,
    imageCount: independent.metrics.imageCount,
    logicClueCells: independent.metrics.logicClueCells,
    questionCells: independent.metrics.questionCells,
    letterCells: independent.metrics.letters,
    crossings: independent.metrics.crossings,
    score: result.scanword.metadata.score,
    generationTimeMs: result.scanword.metadata.generationTimeMs,
    cspNodes: result.stats.nodes,
    independentValidation: independent.valid
  };
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
