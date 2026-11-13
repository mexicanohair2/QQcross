const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const seed = 17919;
  const options = {
    seed,
    specialElevenLetterChance: 1,
    maxTopologyAttempts: 4,
    maxNodes: 120000,
    maxCspTimeMs: 1200,
    topologyMutationAttempts: 96,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };
  const started = performance.now();
  const result = generateScanword(dictionary, options);
  const output = {
    seed,
    ok: result.ok,
    reason: result.reason ?? null,
    elapsedMs: Math.round(performance.now() - started),
    attempts: result.attempts?.map(item => ({
      attempt: item.attempt,
      reason: item.reason,
      nodes: item.nodes,
      deepest: item.deepest,
      elapsedMs: item.elapsedMs,
      lastDeadEnd: item.lastDeadEnd
    })) ?? [],
    rejectedReasons: result.rejectedReasons ?? {},
    diagnostics: result.lastDiagnostic?.errors?.slice?.(0, 8) ?? null,
    success: result.ok ? {
      answers: result.scanword.words.length,
      specialEleven: result.scanword.metadata.specialElevenLetterQuestion,
      score: result.scanword.metadata.score,
      metrics: result.validation.metrics
    } : null
  };
  console.log(JSON.stringify(output, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
