const assert = require("node:assert/strict");

async function main() {
  const { createEmptyGrid } = await import("../scanword-engine/src/grid.js");
  const { createRng } = await import("../scanword-engine/src/rng.js");
  const { getTopologyScaffolds } = await import("../scanword-engine/src/topology-builder.js");
  const { deriveWordSlots, validateTopology } = await import("../scanword-engine/src/topology.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const fs = require("node:fs");
  const raw = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const dictionary = raw.map((entry, index) => ({
    ...entry,
    id: entry.id ?? ("dictionary_" + String(index + 1).padStart(4, "0"))
  }));
  const scaffolds = getTopologyScaffolds();
  const resultSummary = [];

  function gridFrom(rows) {
    const grid = createEmptyGrid();
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === 0 && c === 0) {
          grid[r][c].type = "corner";
          grid[r][c].letter = null;
        } else {
          const question = rows[r][c] === "#";
          grid[r][c].type = question ? "question" : "letter";
          grid[r][c].letter = question ? null : "А";
        }
      }
    }
    return grid;
  }

  function inspect(rows, special) {
    if (rows.length !== 12 || rows.some(row => row.length !== 8)) return null;
    if (rows[0][0] !== "." || rows[0][1] !== "#") return null;
    const top = [...rows[0]].map((value, col) => value === "#" ? col : -1).filter(col => col >= 0);
    if (top.length !== 2 || top[0] !== 1 || ![4,5].includes(top[1])) return null;
    for (let r = 1; r < 12; r++) {
      if (rows[r][0] !== "#" || rows[r][1] !== "." || rows[r][2] !== ".") return null;
      if (rows[r][6] !== "." || rows[r][7] !== ".") return null;
    }
    if (special && rows.some(row => row[3] === "#")) return null;
    const interior = rows.slice(1).reduce((sum, row) => sum + row.slice(1,7).filter(ch => ch === "#").length, 0);
    const center = rows.slice(3,9).reduce((sum, row) => sum + row.slice(3,6).filter(ch => ch === "#").length, 0);
    if (interior < 6 || center < 3) return null;

    const grid = gridFrom(rows);
    const topology = validateTopology(grid, { requireConnected: true, allowSpecialElevenBoundary: special });
    if (!topology.valid || topology.metrics.totalCells !== 96 || topology.metrics.questionCells < 20 || topology.metrics.letterCells < 30) return null;
    const derived = deriveWordSlots(grid, { allowSpecialElevenBoundary: special });
    if (derived.errors.length) return null;
    const shortCount = derived.slots.filter(slot => slot.length === 2).length;
    const longCount = derived.slots.filter(slot => slot.length >= 3).length;
    if (shortCount < 2 || shortCount > 5 || longCount < 12) return null;
    const rightEdges = derived.slots.filter(slot => slot.special === "RIGHT_EDGE_BOUNDARY");
    if (rightEdges.length !== 12 || new Set(rightEdges.map(slot => slot.endpoints[0].row)).size !== 12) return null;
    const specialSlots = derived.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY");
    if (special ? specialSlots.length !== 1 : specialSlots.length !== 0) return null;
    return {
      rows: rows.map(row => row.join("")),
      grid,
      slots: derived.slots,
      metrics: {
        words: derived.slots.length,
        horizontal: topology.metrics.horizontalSlots,
        vertical: topology.metrics.verticalSlots,
        questionCells: topology.metrics.questionCells,
        letterCells: topology.metrics.letterCells,
        short: shortCount,
        long: longCount,
        center
      }
    };
  }

  function clone(rows) { return rows.map(row => [...row]); }

  function search(special, attempts, stepsPerAttempt) {
    const allowedColumns = special ? [4,5] : [3,4,5];
    let best = null;
    const topScores = new Map();
    for (let restart = 0; restart < attempts; restart++) {
      const rng = createRng((special ? 0x51ec1a1 : 0x34a11) + restart * 7919);
      const source = special ? scaffolds[3] : scaffolds[Math.floor(rng() * 3)];
      let currentRows = source.map(row => [...row]);
      let current = inspect(currentRows, special);
      if (!current) continue;
      for (let step = 0; step < stepsPerAttempt; step++) {
        const nextRows = clone(currentRows);
        const row = 1 + Math.floor(rng() * 11);
        const col = allowedColumns[Math.floor(rng() * allowedColumns.length)];
        nextRows[row][col] = nextRows[row][col] === "#" ? "." : "#";
        const next = inspect(nextRows, special);
        if (!next) continue;
        const delta = next.metrics.words - current.metrics.words;
        const temperature = 0.8 * (1 - step / stepsPerAttempt) + 0.08;
        if (delta >= 0 || rng() < Math.exp(delta / temperature) * 0.04) {
          currentRows = nextRows;
          current = next;
        }
        if (!best || next.metrics.words > best.metrics.words) best = next;
        topScores.set(next.metrics.words, (topScores.get(next.metrics.words) || 0) + 1);
      }
    }
    return {
      best,
      scores: [...topScores.entries()].sort((a,b)=>b[0]-a[0]).slice(0,12)
    };
  }

  for (const special of [false, true]) {
    const searched = search(special, 120, 260);
    const best = searched.best;
    const mode = {
      specialEleven: special,
      highestTopology: best?.metrics ?? null,
      pattern: best?.rows ?? null,
      sampledScoreCounts: searched.scores,
      solver: null
    };
    if (best && best.metrics.words >= 34) {
      const solved = solveSlotsCsp(best.slots, dictionary, {
        seed: special ? 891011 : 881122,
        maxNodes: 250000,
        maxTimeMs: 3500,
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        requireEveryClueStarts: false
      });
      mode.solver = { ok: solved.ok, reason: solved.reason ?? null, nodes: solved.nodes, deepest: solved.deepest, elapsedMs: solved.elapsedMs ?? null };
      if (solved.ok) {
        const assembled = assembleScanword({ seed: special ? 891011 : 881122, words: solved.words, questions: solved.questions });
        mode.solver.assembled = assembled.ok;
        if (assembled.ok) {
          const validation = validateScanword(assembled.scanword, dictionary, {
            minWordCount: 34,
            requiredImageCount: 5,
            minimumLogicClueCells: 3,
            requireLeftBorderClues: true,
            requireTopAnchor: true,
            requireConnected: true
          });
          mode.solver.valid = validation.valid;
          mode.solver.validationErrors = validation.errors.slice(0,12);
          mode.solver.metrics = validation.metrics;
          mode.solver.answers = assembled.scanword.words.map(word => ({
            answer: word.answer, clue: word.question, direction: word.direction, special: word.special ?? null
          }));
        } else mode.solver.assemblyErrors = assembled.errors.slice(0,12);
      }
    }
    resultSummary.push(mode);
  }

  const report = {
    targetAnswersPerBoard: 34,
    dictionaryRecords: dictionary.length,
    search: { normalRestarts: 120, specialRestarts: 120, stepsPerRestart: 260 },
    modes: resultSummary
  };
  const serialized = JSON.stringify(report, null, 2);
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/qqcross-34-topology-search.json", serialized + "\\n");
  console.log(serialized);

  for (const mode of resultSummary) {
    assert.ok(mode.highestTopology?.words >= 34,
      (mode.specialEleven ? "Special" : "Normal") + " topology search found only "
      + (mode.highestTopology?.words ?? 0) + " answer slots; required at least 34.");
    assert.equal(mode.solver?.ok, true, "34-answer topology did not solve: " + JSON.stringify(mode.solver));
    assert.equal(mode.solver?.assembled, true, "34-answer topology could not be assembled.");
    assert.equal(mode.solver?.valid, true,
      "Independent validator rejected the 34-answer topology: " + JSON.stringify(mode.solver?.validationErrors));
    assert.ok(mode.solver?.metrics?.words >= 34, "Validated board has fewer than 34 answers.");
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
