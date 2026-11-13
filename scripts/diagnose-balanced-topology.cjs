const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { createEmptyGrid } = await import("../scanword-engine/src/grid.js");
  const { deriveWordSlots, validateTopology } = await import("../scanword-engine/src/topology.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");

  const pattern = [
    ".#..####",
    "#......#",
    "#......#",
    "#......#",
    "#...####",
    "#......#",
    "#......#",
    "#......#",
    "#...####",
    "#......#",
    "#......#",
    "#......#"
  ];
  const grid = createEmptyGrid();
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) {
        grid[row][col].type = "corner";
        grid[row][col].letter = null;
      } else {
        const isQuestion = pattern[row][col] === "#";
        grid[row][col].type = isQuestion ? "question" : "letter";
        grid[row][col].letter = isQuestion ? null : "А";
      }
    }
  }

  const rawDictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const filteredDictionary = rawDictionary.filter(entry => {
    const answer = String(entry.answer ?? "").trim().toUpperCase();
    if (answer.length !== 2) return true;
    return answer === "ЁЖ" && entry.imageKey === "hedgehog";
  });
  const topology = validateTopology(grid, { requireConnected: true, allowSpecialElevenBoundary: false });
  const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const lengths = Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(length => [
    String(length), derived.slots.filter(slot => slot.length === length).length
  ]));
  const modes = [];

  for (const seed of [51001, 51002, 51003, 51004, 51005]) {
    const started = performance.now();
    const solved = solveSlotsCsp(derived.slots, filteredDictionary, {
      seed,
      maxNodes: 100000,
      maxTimeMs: 1800,
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireEveryClueStarts: false
    });
    const item = {
      seed,
      ok: solved.ok,
      reason: solved.reason ?? null,
      nodes: solved.nodes,
      deepest: solved.deepest,
      elapsedMs: Math.round(performance.now() - started),
      lastDeadEnd: solved.lastDeadEnd ?? null
    };
    if (solved.ok) {
      const assembled = assembleScanword({ seed, words: solved.words, questions: solved.questions });
      item.assembled = assembled.ok;
      if (assembled.ok) {
        const validation = validateScanword(assembled.scanword, rawDictionary, {
          requiredImageCount: 5,
          minimumLogicClueCells: 3,
          requireLeftBorderClues: true,
          requireTopAnchor: true,
          requireConnected: true
        });
        item.valid = validation.valid;
        item.errors = validation.errors.slice(0, 16);
        item.metrics = validation.metrics;
        item.words = assembled.scanword.words.map(word => ({
          answer: word.answer,
          question: word.question,
          direction: word.direction,
          length: word.length,
          imageKey: word.imageKey ?? null,
          logic: word.logic === true,
          clue: word.clue
        }));
      } else item.assemblyErrors = assembled.errors.slice(0, 16);
    }
    modes.push(item);
  }

  const report = {
    topologyValid: topology.valid,
    topologyErrors: topology.errors,
    topologyMetrics: topology.metrics,
    slotCount: derived.slots.length,
    slotLengths: lengths,
    twoLetterPool: filteredDictionary.filter(entry => String(entry.answer ?? "").trim().length === 2),
    modes
  };
  console.log(JSON.stringify(report, null, 2));
  if (!topology.valid || derived.slots.length !== 18) throw new Error("Balanced topology failed geometry checks.");
  if (!modes.some(item => item.ok && item.valid)) throw new Error("No independently valid puzzle solved from the balanced 8x12 topology.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
