import assert from "node:assert/strict";
import { generateTopology } from "../scanword-engine/src/topology-builder.js";
import { validateTopology, deriveWordSlots } from "../scanword-engine/src/topology.js";
import { CONFIG } from "../scanword-engine/src/config.js";

const observed = new Set();
const directionCoverage = new Set();
let ordinaryBoards = 0;
let specialBoards = 0;

for (let index = 1; index <= 48; index++) {
  const seed = 510000 + index * 7919;
  const includeSpecialEleven = index % 4 === 0;
  const generated = generateTopology({
    seed,
    lowShortLayout: false,
    includeSpecialEleven,
    maxAttempts: 96,
    mutationBudget: 96,
    maxTwoLetterSlots: 5
  });
  assert.equal(generated.ok, true, "Topology generation failed for seed " + seed + ": " + JSON.stringify(generated));
  const grid = generated.topology.grid;
  const options = {
    requireConnected: true,
    requireFullTopBorder: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven,
    minimumOuterBoundaryLength: 2
  };
  const validation = validateTopology(grid, options);
  const derived = deriveWordSlots(grid, options);
  assert.equal(validation.valid, true, "Independent topology check failed for seed " + seed + ": " + JSON.stringify(validation.errors));
  assert.equal(derived.errors.length, 0, "Slot derivation failed for seed " + seed);
  assert.equal(validation.metrics.totalCells, CONFIG.TOTAL_CELLS);
  assert.equal(grid[0][0].type, "corner");
  assert.ok(grid[0].slice(1).every(cell => cell.type === "question"), "The full top border must be question cells.");
  for (let row = 1; row < CONFIG.HEIGHT; row++) assert.equal(grid[row][0].type, "question");
  assert.ok(derived.slots.length >= 20);
  assert.ok(derived.slots.every(slot => slot.length >= 2 && slot.length <= 11));
  const eleven = derived.slots.filter(slot => slot.length === 11);
  assert.equal(eleven.length, includeSpecialEleven ? 1 : 0, "The puzzle must contain zero or exactly one 11-letter answer.");
  assert.equal(eleven.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length, includeSpecialEleven ? 1 : 0);
  assert.ok(derived.slots.filter(slot => slot.length === 2).length <= 5);
  for (const slot of derived.slots) for (const option of slot.directionOptions) directionCoverage.add(option.direction);
  observed.add(generated.topology.pattern.join("/"));
  if (includeSpecialEleven) specialBoards++;
  else ordinaryBoards++;
}

assert.ok(observed.size >= 8, "Expected varied full-border topologies; got " + observed.size);
assert.deepEqual([...directionCoverage].sort(), ["down", "left", "right", "up"]);
assert.equal(ordinaryBoards, 36);
assert.equal(specialBoards, 12);
console.log(JSON.stringify({
  ok: true,
  dimensions: "8x12",
  totalCells: 96,
  distinctGeneratedTopologies: observed.size,
  seededSamples: 48,
  ordinaryBoards,
  oneElevenLetterAnswerBoards: specialBoards,
  directionCoverage: [...directionCoverage].sort(),
  note: "The top row and left column remain clue borders; one 11-letter answer appears every fourth puzzle."
}, null, 2));
