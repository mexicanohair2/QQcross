import assert from "node:assert/strict";
import { generateTopology } from "../scanword-engine/src/topology-builder.js";
import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { validateTopology, deriveWordSlots } from "../scanword-engine/src/topology.js";

const targetPattern = [
  ".#...###",
  "#....#..",
  "#...#...",
  "#...#...",
  "#......#",
  "#...#...",
  "#...#...",
  "#...#...",
  "#......#",
  "#.....#.",
  "#...#...",
  "#....#.."
];

function roleGrid(rows, includeSpecialEleven = false) {
  const grid = createEmptyGrid();
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) continue;
      const cell = grid[row][col];
      cell.type = rows[row][col] === "#" ? "question" : "letter";
      cell.letter = cell.type === "letter" ? "А" : null;
    }
  }
  const junctionColumns = includeSpecialEleven ? [2] : [1, 2];
  for (const row of [4, 8]) {
    for (const col of junctionColumns) {
      grid[row][col] = { ...grid[row][col], type: "junction", letter: "А", clueDirections: ["down"] };
    }
  }
  return grid;
}

function metrics(rows, includeSpecialEleven = false) {
  const grid = roleGrid(rows, includeSpecialEleven);
  const topologyOptions = {
    requireConnected: true,
    allowTopRowHorizontalRun: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven,
    minimumOuterBoundaryLength: 2
  };
  const validation = validateTopology(grid, topologyOptions);
  const derived = deriveWordSlots(grid, topologyOptions);
  return {
    valid: validation.valid && derived.errors.length === 0,
    errors: [...validation.errors, ...derived.errors].slice(0, 8),
    pattern: rows.join("/"),
    questionCells: validation.metrics.questionCells,
    letterCells: validation.metrics.letterCells,
    slots: derived.slots.length,
    shortSlots: derived.slots.filter(slot => slot.length === 2).length,
    longSlots: derived.slots.filter(slot => slot.length >= 3).length,
    elevenSlots: derived.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length,
    topShortSlot: derived.slots.some(slot =>
      slot.axis === "horizontal" && slot.length === 3
      && slot.endpoints[0].row === 0 && slot.endpoints[0].col === 1
      && slot.endpoints[1].row === 0 && slot.endpoints[1].col === 5
    )
  };
}

const target = metrics(targetPattern, false);
assert.equal(target.valid, true, JSON.stringify(target));
assert.equal(target.topShortSlot, true);
assert.equal(target.elevenSlots, 0);

const special = generateTopology({
  seed: 4004,
  lowShortLayout: true,
  includeSpecialEleven: true,
  maxAttempts: 1
});
assert.equal(special.ok, true, JSON.stringify(special));
const specialMetrics = metrics(special.topology.pattern, true);
assert.equal(specialMetrics.valid, true, JSON.stringify(specialMetrics));
assert.equal(specialMetrics.elevenSlots, 1);

const randomResults = [];
for (let seed = 1; seed <= 48; seed++) {
  const result = generateTopology({
    seed,
    lowShortLayout: true,
    includeSpecialEleven: false,
    maxAttempts: 96,
    mutationBudget: 96,
    maxTwoLetterSlots: 5
  });
  assert.equal(result.ok, true, "seed=" + seed + " " + JSON.stringify(result));
  const item = metrics(result.topology.pattern, false);
  assert.equal(item.valid, true, "seed=" + seed + " " + JSON.stringify(item));
  assert.equal(item.elevenSlots, 0);
  randomResults.push(item);
}
const distinctTopologies = new Set(randomResults.map(item => item.pattern));
assert.ok(distinctTopologies.size >= 8, "Expected at least 8 distinct mutated low-short topologies.");

console.log(JSON.stringify({
  ok: true,
  target,
  specialEleven: specialMetrics,
  randomSampleCount: randomResults.length,
  distinctMutatedTopologies: distinctTopologies.size,
  shortBoards: 48,
  longBoards: 1
}, null, 2));
