import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { deriveWordSlots, validateTopology } from "../scanword-engine/src/topology.js";
import { getTopologyScaffolds } from "../scanword-engine/src/topology-builder.js";

const pattern = getTopologyScaffolds()[3];
const grid = createEmptyGrid();
for (let row = 0; row < 12; row++) {
  for (let col = 0; col < 8; col++) {
    if (row === 0 && col === 0) continue;
    const question = pattern[row][col] === "#";
    grid[row][col].type = question ? "question" : "letter";
    grid[row][col].letter = question ? null : "А";
  }
}
const options = { requireConnected: true, allowSpecialElevenBoundary: true };
const topology = validateTopology(grid, options);
const normal = deriveWordSlots(grid, { allowSpecialElevenBoundary: false });
const special = deriveWordSlots(grid, { allowSpecialElevenBoundary: true });
const histogram = slots => Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(n => [
  String(n), slots.filter(slot => slot.length === n).length
]));
const rightEdgeSlots = special.slots.filter(slot => slot.special === "RIGHT_EDGE_BOUNDARY");
const result = {
  valid: topology.valid,
  errors: topology.errors,
  metrics: topology.metrics,
  normalSlots: normal.slots.length,
  specialSlots: special.slots.length,
  rightEdgeBoundarySlots: rightEdgeSlots.length,
  specialElevenSlots: special.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length,
  normalLengths: histogram(normal.slots),
  specialLengths: histogram(special.slots),
  pattern
};
console.log(JSON.stringify(result, null, 2));
if (
  !topology.valid
  || normal.errors.length
  || special.errors.length
  || rightEdgeSlots.length !== 12
  || result.specialElevenSlots !== 1
  || grid.some(row => row[6].type !== "letter" || row[7].type !== "letter")
  || special.slots.filter(slot => slot.length === 2).length > 4
) process.exitCode = 1;
