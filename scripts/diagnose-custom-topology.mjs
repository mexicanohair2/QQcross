import assert from "node:assert/strict";
import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { deriveWordSlots, validateTopology } from "../scanword-engine/src/topology.js";
import { SCANWORD_TEMPLATES } from "../scanword-engine/src/template-library.js";

const templateIndex = 3;
const pattern = SCANWORD_TEMPLATES[templateIndex];
assert.ok(pattern, "The selected production template must exist.");
const grid = createEmptyGrid();
for (let row = 0; row < 12; row++) {
  for (let col = 0; col < 8; col++) {
    if (row === 0 && col === 0) continue;
    const question = pattern[row][col] === "#";
    grid[row][col].type = question ? "question" : "letter";
    grid[row][col].letter = question ? null : "А";
  }
}
const options = {
  requireConnected: true,
  requireFullTopBorder: true,
  allowOuterBoundarySlots: true,
  allowColumnOneBoundarySlot: true,
  allowSpecialElevenBoundary: false,
  minimumOuterBoundaryLength: 2
};
const topology = validateTopology(grid, options);
const derived = deriveWordSlots(grid, options);
const lengths = derived.slots.map(slot => slot.length);
const result = {
  templateIndex,
  pattern,
  valid: topology.valid && derived.errors.length === 0,
  validationErrors: topology.errors,
  slotErrors: derived.errors,
  metrics: topology.metrics,
  slotCount: derived.slots.length,
  answerLengthRange: lengths.length ? [Math.min(...lengths), Math.max(...lengths)] : null,
  twoLetterSlots: lengths.filter(length => length === 2).length,
  elevenLetterSlots: lengths.filter(length => length === 11).length,
  taggedSpecialElevenSlots: derived.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length,
  fourDirectionSlots: derived.slots.filter(slot => slot.directionOptions.some(option => ["left", "up"].includes(option.direction))).length
};
console.log(JSON.stringify(result, null, 2));
assert.equal(result.valid, true, "Production topology must pass independent validation.");
assert.ok(result.slotCount >= 20, "Production topology must contain at least 20 answer slots.");
assert.ok(lengths.every(length => length >= 2), "Production topology must not contain one-letter answers.");
assert.equal(result.taggedSpecialElevenSlots, 0, "The retired special 11-letter feature must not appear.");
assert.ok(result.twoLetterSlots <= 5, "Production topology must stay within the configured short-answer limit.");
