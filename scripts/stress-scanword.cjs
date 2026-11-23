const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

const requestedRuns = Number(process.argv[2] ?? 1000);
if (![1000, 10000].includes(requestedRuns)) {
  throw new Error("Usage: node scripts/stress-scanword.cjs <1000|10000>");
}

async function main() {
  const { generateScanword } = await import("../scanword-engine/src/generator.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const options = {
    maxTopologyAttempts: 16,
    maxNodes: 120000,
    maxCspTimeMs: 1200,
    specialMaxCspTimeMs: 1500,
    specialTopologyAttempts: 2,
    topologyMutationAttempts: 96,
    maxTwoLetterSlots: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3
  };
  const timings = [];
  const failures = [];
  const signatures = new Set();
  const directionCounts = { right: 0, down: 0, left: 0, up: 0, other: 0 };
  const checkpoints = {};
  let specialElevenCount = 0;
  let totalAnswers = 0;
  let totalCrossings = 0;
  let maxAnswers = 0;
  let minAnswers = Number.POSITIVE_INFINITY;

  function signature(scanword) {
    const stable = {
      grid: scanword.grid.map(row => row.map(cell => [cell.type, cell.letter ?? null])),
      words: scanword.words.map(word => [
        word.answer, word.question, word.clue.row, word.clue.col,
        word.direction, word.coordinates, word.imageKey ?? null
      ])
    };
    return crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");
  }

  for (let run = 1; run <= requestedRuns; run++) {
    const seed = 2000000 + run * 7919;
    const started = performance.now();
    const result = generateScanword(dictionary, {
      ...options,
      seed,
      sequenceIndex: run
    });
    const elapsedMs = Math.round(performance.now() - started);
    timings.push(elapsedMs);

    if (!result.ok) {
      failures.push({ run, seed, reason: result.reason, elapsedMs, attempts: result.attempts, rejectedReasons: result.rejectedReasons });
    } else {
      const scanword = result.scanword;
      const validation = validateScanword(scanword, dictionary, {
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        requireLeftBorderClues: true,
        requireTopAnchor: true,
        requireConnected: true
      });

      try {
        assert.equal(validation.valid, true, "independent validator: " + JSON.stringify(validation.errors.slice(0, 8)));
        assert.equal(scanword.width, 8);
        assert.equal(scanword.height, 12);
        assert.equal(scanword.grid.length, 12);
        assert.ok(scanword.grid.every(row => row.length === 8));
        const cells = scanword.grid.flat();
        assert.equal(cells.length, 96);
        assert.ok(cells.every(cell => ["corner", "question", "letter"].includes(cell.type)));
        assert.equal(cells.filter(cell => cell.type === "corner").length, 1);
        assert.equal(scanword.grid[0][0].type, "corner");
        assert.ok(cells.slice(1).every(cell => cell.type === "question" || cell.type === "letter"));
        assert.ok(scanword.words.length >= 18);
        assert.ok(scanword.words.every(word => word.length >= 2 && word.length <= 11));
        assert.ok(scanword.words.filter(word => word.length === 2).length <= 5);
        assert.equal(new Set(scanword.words.map(word => word.answer.replace(/Ё/g, "Е"))).size, scanword.words.length);
        assert.ok(!scanword.words.some(word => ["ДО", "РЕ", "МИ", "ФА", "ЛЯ", "СИ"].includes(word.answer)));
        assert.ok(!scanword.words.some(word => ["МЫ", "ВЫ", "ТЫ", "ОН", "ЕЕ", "ЕЙ"].includes(word.answer)));
        assert.equal(scanword.metadata.specialElevenLetterQuestion, run % 4 === 0);
        assert.equal(scanword.words.filter(word => word.length === 11).length, run % 4 === 0 ? 1 : 0);

        for (const word of scanword.words) {
          if (word.direction === "right" || word.direction === "down") directionCounts[word.direction]++;
          else if (Object.prototype.hasOwnProperty.call(directionCounts, word.direction)) directionCounts[word.direction]++;
          else directionCounts.other++;
        }
        const imageWords = scanword.words.filter(word => word.imageKey);
        assert.equal(imageWords.length, 5);
        assert.equal(new Set(imageWords.map(word => word.imageKey)).size, 5);
        assert.equal(new Set(imageWords.map(word => word.clue.row + "," + word.clue.col)).size, 5);
        assert.ok(new Set(scanword.words.filter(word => word.logic).map(word => word.clue.row + "," + word.clue.col)).size >= 3);
        assert.ok(scanword.metadata.valid);
        assert.ok(scanword.metadata.score >= 0 && scanword.metadata.score <= 100);

        if (scanword.metadata.specialElevenLetterQuestion) specialElevenCount++;
        totalAnswers += scanword.words.length;
        totalCrossings += validation.metrics.crossings;
        maxAnswers = Math.max(maxAnswers, scanword.words.length);
        minAnswers = Math.min(minAnswers, scanword.words.length);
        signatures.add(signature(scanword));

        if (run <= 3) {
          const repeated = generateScanword(dictionary, { ...options, seed, sequenceIndex: run });
          assert.equal(repeated.ok, true, "same-seed replay failed");
          assert.equal(signature(repeated.scanword), signature(scanword), "same seed produced a different puzzle");
        }
      } catch (error) {
        failures.push({ run, seed, reason: "VALIDATION_ASSERTION", elapsedMs, message: error.message });
      }
    }

    if ([100, 1000, 10000].includes(run)) {
      const sorted = [...timings].sort((a, b) => a - b);
      checkpoints[run] = {
        successfulRuns: run - failures.length,
        failedRuns: failures.length,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
        maxMs: sorted[sorted.length - 1],
        specialElevenRuns: specialElevenCount
      };
      if (failures.length) break;
    }
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const report = {
    dictionaryEntries: dictionary.length,
    requestedRuns,
    completedRuns: timings.length,
    successfulRuns: timings.length - failures.length,
    failedRuns: failures.length,
    specialElevenRuns: specialElevenCount,
    expectedSpecialElevenRuns: requestedRuns / 4,
    directionCounts,
    uniquePuzzleSignatures: signatures.size,
    duplicatePuzzleSignatures: timings.length - failures.length - signatures.size,
    averageAnswers: totalAnswers / Math.max(1, timings.length - failures.length),
    minAnswers: Number.isFinite(minAnswers) ? minAnswers : null,
    maxAnswers,
    averageCrossings: totalCrossings / Math.max(1, timings.length - failures.length),
    medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
    heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
    checkpoints,
    failures: failures.slice(0, 50)
  };

  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/scanword-stress-" + requestedRuns + ".json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  assert.equal(report.successfulRuns, requestedRuns, "not every scanword passed the independent validation gate");
  assert.equal(specialElevenCount, requestedRuns / 4, "one in four puzzles must contain exactly one eleven-letter answer");
  assert.ok(directionCounts.right > 0 && directionCounts.down > 0, "both permitted directions must be used");
  assert.equal(directionCounts.left, 0, "leftward answers are forbidden");
  assert.equal(directionCounts.up, 0, "upward answers are forbidden");
  assert.equal(directionCounts.other, 0, "unknown answer direction detected");
  assert.ok(report.p95Ms <= 4000, "p95 generation time exceeded the 4-second mobile budget");
  assert.ok(report.maxMs <= 16000, "a generation exceeded the 16-second worker timeout");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
