const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const seed = 17919;
  const options = {
    seed,
    specialElevenLetterChance: 0,
    maxTopologyAttempts: 1,
    maxNodes: 240000,
    maxCspTimeMs: 5000,
    topologyMutationAttempts: 96,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };
  const started = performance.now();
  const result = generateScanword(dictionary, options);
  const output = {
    seed,
    options,
    ok: result.ok,
    reason: result.reason ?? null,
    elapsedMs: Math.round(performance.now() - started),
    attempts: result.attempts?.map(item => ({
      attempt: item.attempt,
      reason: item.reason,
      nodes: item.nodes,
      deepest: item.deepest,
      elapsedMs: item.elapsedMs,
      lastDeadEnd: item.lastDeadEnd,
      errors: item.errors ?? null
    })) ?? [],
    rejectedReasons: result.rejectedReasons ?? {},
    diagnostics: result.lastDiagnostic ?? null,
    dictionaryStats: result.dictionaryStats ?? null,
    success: result.ok ? {
      answers: result.scanword.words.length,
      specialEleven: result.scanword.metadata.specialElevenLetterQuestion,
      score: result.scanword.metadata.score,
      metrics: result.validation.metrics,
      words: result.scanword.words.map(word => ({
        answer: word.answer, question: word.question, direction: word.direction,
        clue: word.clue, length: word.answer.length
      }))
    } : null
  };
  console.log(JSON.stringify(output, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
