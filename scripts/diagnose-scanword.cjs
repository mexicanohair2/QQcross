const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 16,
    maxNodes: 240000,
    maxCspTimeMs: 5000,
    specialMaxCspTimeMs: 5000,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };

  const results = [];
  for (const sequenceIndex of [1, 4]) {
    const seed = 17919 + sequenceIndex * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, { ...options, seed, sequenceIndex, capturePlanDiagnostics: true });
    results.push({
      sequenceIndex,
      seed,
      requestedLongAnswer: sequenceIndex % 4 === 0,
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
        featuredShort: result.scanword.metadata.featuredShortQuestion,
        stats: result.stats,
        score: result.scanword.metadata.score,
        metrics: result.validation.metrics,
        words: result.scanword.words.map(word => ({
          answer: word.answer, question: word.question, direction: word.direction,
          clue: word.clue, length: word.answer.length, special: word.special ?? null
        }))
      } : null
    });
  }
  console.log(JSON.stringify({ options, results }, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
