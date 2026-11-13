const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { createEmptyGrid } = await import("../scanword-engine/src/grid.js");
  const { deriveWordSlots, validateTopology } = await import("../scanword-engine/src/topology.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");

  // A diagnostic geometry candidate with the top-left anchor, the complete
  // left question border, and no two-letter answer slots. This deliberately
  // keeps the top row dynamic while testing dictionary/CSP viability.
  const pattern = [
    ".#....##",
    "#......#",
    "#......#",
    "#......#",
    "#......#",
    "#.....##",
    "#.....##",
    "#.....##",
    "#.....##",
    "#.....##",
    "#.....##",
    "#......#"
  ];

  const makeGrid = () => {
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
    return grid;
  };

  const rawDictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const sourceDictionary = rawDictionary.map((entry, index) => ({
    ...entry,
    id: entry.id ?? ("dictionary_" + String(index + 1).padStart(4, "0"))
  }));
  const solverDictionary = sourceDictionary.filter(entry => {
    const answer = String(entry.answer ?? "").trim().toUpperCase();
    return answer.length !== 2 || (answer === "ЁЖ" && Boolean(entry.imageKey));
  });

  const grid = makeGrid();
  const normalTopology = validateTopology(grid, {
    requireConnected: true,
    allowSpecialElevenBoundary: false
  });
  const specialTopology = validateTopology(grid, {
    requireConnected: true,
    allowSpecialElevenBoundary: true
  });
  const normal = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
  const special = deriveWordSlots(grid, { allowSpecialElevenBoundary: true });
  const histogram = slots => Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(length => [
    String(length), slots.filter(slot => slot.length === length).length
  ]));

  const geometry = {
    normalValid: normalTopology.valid,
    normalErrors: normalTopology.errors,
    specialValid: specialTopology.valid,
    specialErrors: specialTopology.errors,
    questionCells: normalTopology.metrics.questionCells,
    letterCells: normalTopology.metrics.letterCells,
    normalSlots: normal.slots.length,
    specialSlots: special.slots.length,
    normalLengths: histogram(normal.slots),
    specialLengths: histogram(special.slots),
    twoLetterSlots: special.slots.filter(slot => slot.length === 2).length,
    pattern
  };
  console.log("BORDER-COMPATIBLE GEOMETRY " + JSON.stringify(geometry));

  if (!normalTopology.valid || !specialTopology.valid || normal.errors.length || special.errors.length) {
    throw new Error("Diagnostic geometry failed independent topology validation.");
  }
  if (special.slots.some(slot => slot.length === 2)) {
    throw new Error("Diagnostic geometry unexpectedly contains a two-letter answer.");
  }

  const accepted = [];
  const rejected = [];
  const maxSeeds = 36;
  for (let index = 0; index < maxSeeds && accepted.length < 10; index++) {
    const wantsSpecial = accepted.length % 4 === 3;
    const slots = wantsSpecial ? special.slots : normal.slots;
    const seed = 740001 + index * 7919;
    const started = performance.now();
    const solved = solveSlotsCsp(slots, solverDictionary, {
      seed,
      maxNodes: 180000,
      maxTimeMs: 1400,
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireEveryClueStarts: false
    });

    if (!solved.ok) {
      rejected.push({
        seed,
        special: wantsSpecial,
        reason: solved.reason,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: solved.elapsedMs,
        lastDeadEnd: solved.lastDeadEnd ?? null
      });
      continue;
    }

    const assembled = assembleScanword({ seed, words: solved.words, questions: solved.questions });
    if (!assembled.ok) {
      rejected.push({ seed, special: wantsSpecial, reason: "ASSEMBLY_FAILED", errors: assembled.errors.slice(0, 10) });
      continue;
    }

    const validation = validateScanword(assembled.scanword, sourceDictionary, {
      requiredImageCount: 5,
      minimumLogicClueCells: 3,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireConnected: true
    });
    if (!validation.valid) {
      rejected.push({
        seed,
        special: wantsSpecial,
        reason: "INDEPENDENT_VALIDATION_FAILED",
        errors: validation.errors.slice(0, 12)
      });
      continue;
    }

    const answers = assembled.scanword.words.map(word => word.answer);
    const signature = [...answers].sort().join("|");
    if (accepted.some(item => item.signature === signature)) {
      rejected.push({ seed, special: wantsSpecial, reason: "DUPLICATE_BOARD" });
      continue;
    }

    accepted.push({
      id: accepted.length + 1,
      seed,
      special: assembled.scanword.words.some(word => word.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"),
      elapsedMs: Math.round(performance.now() - started),
      nodes: solved.nodes,
      score: assembled.scanword.metadata?.score ?? null,
      metrics: validation.metrics,
      signature,
      words: assembled.scanword.words.map(word => ({
        answer: word.answer,
        question: word.question,
        length: word.length,
        direction: word.direction,
        clue: word.clue,
        imageKey: word.imageKey ?? null,
        logic: word.logic === true
      })),
      grid: assembled.scanword.grid.map(row => row.map(cell =>
        cell.type === "question" ? "?" : cell.type === "corner" ? " " : cell.letter
      ).join(""))
    });
  }

  const report = {
    geometry,
    dictionary: {
      sourceEntries: rawDictionary.length,
      solverEntries: solverDictionary.length,
      imageEntries: sourceDictionary.filter(entry => entry.imageKey).length,
      logicEntries: sourceDictionary.filter(entry => entry.logic === true).length
    },
    generated: accepted.length,
    specialElevenCount: accepted.filter(item => item.special).length,
    rejectedCount: rejected.length,
    rejected: rejected.slice(0, 20),
    puzzles: accepted
  };
  fs.writeFileSync("scanword-engine/diagnostic-border-compatible-10.json", JSON.stringify(report, null, 2) + "\n");
  console.log("DIAGNOSTIC GENERATION " + JSON.stringify({
    generated: report.generated,
    specialElevenCount: report.specialElevenCount,
    rejectedCount: report.rejectedCount,
    examples: rejected.slice(0, 8)
  }, null, 2));

  if (accepted.length < 10) {
    throw new Error("Only " + accepted.length + " independently valid puzzles were generated; 10 are required.");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
