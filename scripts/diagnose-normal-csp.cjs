const fs = require("node:fs");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    seed: 517919,
    sequenceIndex: 1,
    specialElevenLetterChance: 0,
    maxTopologyAttempts: 1,
    maxNodes: 500000,
    maxCspTimeMs: 6000,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
    captureTrace: true
  };
  const started = performance.now();
  const result = generateScanword(dictionary, options);
  const elapsedMs = Math.round(performance.now() - started);
  const validation = result.ok
    ? validateScanword(result.scanword, dictionary, {
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        requireLeftBorderClues: true,
        requireTopAnchor: true,
        requireConnected: true,
        requireDifficultyBalance: true
      })
    : null;

  const report = {
    seed: options.seed,
    topologySeed: (options.seed + 7919) >>> 0,
    options,
    ok: result.ok,
    elapsedMs,
    reason: result.reason ?? null,
    rejectedReasons: result.rejectedReasons ?? {},
    attempts: (result.attempts ?? []).map(item => ({
      attempt: item.attempt,
      seed: item.seed,
      reason: item.reason,
      nodes: item.nodes,
      deepest: item.deepest,
      elapsedMs: item.elapsedMs,
      lastDeadEnd: item.lastDeadEnd,
      deepestDeadEnd: item.deepestDeadEnd,
      searchTrace: item.searchTrace
    })),
    success: result.ok ? {
      answerCount: result.scanword.words.length,
      topology: result.topology,
      stats: result.stats,
      validation
    } : null
  };
  console.log("NORMAL_CSP_DIAGNOSTIC=" + JSON.stringify(report));
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/normal-csp-diagnostic.json", JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
