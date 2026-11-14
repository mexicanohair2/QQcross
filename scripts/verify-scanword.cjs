const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const summaries = [];
  const failures = [];
  const timings = [];
  let specialElevenCount = 0;
  const directionCounts = { right: 0, down: 0, left: 0, up: 0 };
  const generationOptions = {
    maxTopologyAttempts: 16,
    maxNodes: 100000,
    maxCspTimeMs: 1200,
    specialTopologyAttempts: 2,
    maxTwoLetterSlots: 4,
    topologyMutationAttempts: 96,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };

  function stablePuzzle(scanword) {
    return JSON.stringify({
      dimensions: [scanword.width, scanword.height],
      grid: scanword.grid.map(row => row.map(cell => [cell.type, cell.letter ?? null])),
      words: scanword.words.map(word => ({
        id: word.id,
        entryId: word.entryId,
        answer: word.answer,
        question: word.question,
        clue: word.clue,
        direction: word.direction,
        coordinates: word.coordinates,
        imageKey: word.imageKey ?? null,
        logic: word.logic === true,
        special: word.special ?? null
      }))
    });
  }

  for (let run = 1; run <= 100; run++) {
    const seed = 10000 + run * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, {
      ...generationOptions,
      seed
    });
    const elapsedMs = Math.round(performance.now() - started);
    timings.push(elapsedMs);

    if (!result.ok) {
      failures.push({
        run,
        seed,
        reason: result.reason,
        elapsedMs,
        attempts: result.attempts,
        rejectedReasons: result.rejectedReasons,
        lastDiagnostic: result.lastDiagnostic?.errors?.slice?.(0, 5) ?? null
      });
      summaries.push({ run, seed, ok: false, reason: result.reason, elapsedMs });
      continue;
    }

    const scanword = result.scanword;
    const validation = validateScanword(scanword, dictionary, {
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireConnected: true
    });
    assert.equal(validation.valid, true, "Independent validator rejected seed " + seed + ": " + JSON.stringify(validation.errors.slice(0, 8)));
    assert.equal(scanword.width, 8);
    assert.equal(scanword.height, 12);
    assert.equal(scanword.grid.length, 12);
    assert.ok(scanword.grid.every(row => row.length === 8));
    assert.equal(scanword.grid.flat().length, 96);
    assert.ok(scanword.grid.flat().every(cell => ["corner", "question", "letter"].includes(cell.type)));
    assert.equal(scanword.grid[0][0].type, "corner");
    assert.ok(scanword.words.length >= 18, "too few answers on seed " + seed);
    assert.ok(scanword.words.filter(word => word.length === 2).length <= 4, "too many short answers on seed " + seed);
    assert.equal(new Set(scanword.words.map(word => word.answer)).size, scanword.words.length);
    for (const word of scanword.words) {
      if (Object.prototype.hasOwnProperty.call(directionCounts, word.direction)) directionCounts[word.direction]++;
    }
    const imageWords = scanword.words.filter(word => word.imageKey);
    assert.equal(imageWords.length, 5);
    assert.equal(new Set(imageWords.map(word => word.imageKey)).size, 5);
    assert.equal(new Set(imageWords.map(word => word.clue.row + ',' + word.clue.col)).size, 5,
      'five picture answers must occupy five visible clue cells on seed ' + seed);
    assert.ok(new Set(scanword.words.filter(word => word.logic).map(word => word.clue.row + "," + word.clue.col)).size >= 3);
    assert.ok(scanword.metadata.valid);
    assert.ok(scanword.metadata.score >= 0 && scanword.metadata.score <= 100);

    if (scanword.metadata.specialElevenLetterQuestion) specialElevenCount++;

    if (run <= 3) {
      const repeated = generateScanword(dictionary, {
        ...generationOptions,
        seed
      });
      assert.equal(repeated.ok, true, "same-seed replay failed for " + seed);
      assert.equal(stablePuzzle(repeated.scanword), stablePuzzle(scanword), "same seed must produce identical puzzle content: " + seed);
    }

    summaries.push({
      run,
      seed,
      ok: true,
      answers: scanword.words.length,
      clueCells: validation.metrics.questionCells,
      letterCells: validation.metrics.letters,
      crossings: validation.metrics.crossings,
      pictures: validation.metrics.imageCount,
      logicCells: validation.metrics.logicClueCells,
      specialEleven: scanword.metadata.specialElevenLetterQuestion,
      score: scanword.metadata.score,
      nodes: result.stats.nodes,
      topologyAttempts: result.stats.topologyAttempts,
      elapsedMs,
      cspElapsedMs: result.stats.cspElapsedMs
    });
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const report = {
    dictionaryEntries: dictionary.length,
    requestedRuns: 100,
    successfulRuns: summaries.filter(item => item.ok).length,
    failedRuns: failures.length,
    specialElevenRuns: specialElevenCount,
    directionCounts,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
    failures,
    runs: summaries
  };
  console.log(JSON.stringify(report, null, 2));

  if (failures.length) {
    throw new Error("Scanword generation did not reach 100/100: " + failures.length + " failures.");
  }
  assert.ok(specialElevenCount >= 15 && specialElevenCount <= 35,
    "Eleven-letter frequency should stay near one in four; observed " + specialElevenCount + "/100");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
