const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { createEmptyGrid } = await import("../scanword-engine/src/grid.js");
  const { deriveWordSlots, validateTopology } = await import("../scanword-engine/src/topology.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");

  const pattern = [
    ".#..#..#",
    "#......#",
    "#.....#.",
    "#....#..",
    "#...#...",
    "#......#",
    "#.....#.",
    "#....#..",
    "#...#...",
    "#.....#.",
    "#......#",
    "#...#..#"
  ];
  const grid = createEmptyGrid();
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) {
        grid[row][col].type = "corner";
        grid[row][col].letter = null;
      } else {
        grid[row][col].type = pattern[row][col] === "#" ? "question" : "letter";
        grid[row][col].letter = grid[row][col].type === "letter" ? "А" : null;
      }
    }
  }

  const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const topologyValidation = validateTopology(grid, { requireConnected: true });
  const normal = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const special = deriveWordSlots(grid, { allowSpecialElevenBoundary: true });
  const slotHistogram = slots => Object.fromEntries(
    [2,3,4,5,6,7,8,9,10,11].map(length => [
      String(length), slots.filter(slot => slot.length === length).length
    ])
  );

  assert.equal(topologyValidation.valid, true, JSON.stringify(topologyValidation.errors));
  assert.equal(normal.errors.length, 0, JSON.stringify(normal.errors));
  assert.ok(normal.slots.length >= 18, "Expected at least 18 normal answer slots");
  assert.ok(normal.slots.every(slot => slot.length >= 2), "One-letter gaps must never become answers");

  const modes = [];
  for (const [name, slots, seed] of [
    ["normal", normal.slots, 187919],
    ["with-eleven", special.slots, 17919]
  ]) {
    const started = performance.now();
    const solved = solveSlotsCsp(slots, dictionary, {
      seed,
      maxNodes: 180000,
      maxTimeMs: 1800,
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireEveryClueStarts: false
    });
    const result = { name, ok: solved.ok, reason: solved.reason ?? null, nodes: solved.nodes, deepest: solved.deepest, elapsedMs: Math.round(performance.now() - started), lastDeadEnd: solved.lastDeadEnd ?? null };
    if (solved.ok) {
      const assembled = assembleScanword({ seed, words: solved.words, questions: solved.questions });
      result.assembled = assembled.ok;
      if (assembled.ok) {
        const validation = validateScanword(assembled.scanword, dictionary, {
          requiredImageCount: 5,
          minimumLogicClueCells: 3,
          requireLeftBorderClues: true,
          requireTopAnchor: true,
          requireConnected: true
        });
        result.valid = validation.valid;
        result.errors = validation.errors.slice(0, 12);
        result.metrics = validation.metrics;
        result.score = assembled.scanword.metadata?.score ?? null;
        result.words = assembled.scanword.words.map(word => ({
          answer: word.answer, clue: word.clue, direction: word.direction,
          imageKey: word.imageKey, logic: word.logic
        }));
      } else result.assemblyErrors = assembled.errors.slice(0, 12);
    }
    modes.push(result);
  }

  console.log(JSON.stringify({
    topologyValid: topologyValidation.valid,
    topologyMetrics: topologyValidation.metrics,
    normalSlots: normal.slots.length,
    specialSlots: special.slots.length,
    normalLengths: slotHistogram(normal.slots),
    specialLengths: slotHistogram(special.slots),
    modes
  }, null, 2));
  assert.ok(modes[0].ok && modes[0].valid, "The clean production dictionary must solve the new normal topology.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
