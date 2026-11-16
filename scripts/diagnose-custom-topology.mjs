import assert from "node:assert/strict";
import { generateTopology } from "../scanword-engine/src/topology-builder.js";
import { validateTopology, deriveWordSlots } from "../scanword-engine/src/topology.js";

for (const includeSpecialEleven of [false, true]) {
  const generated = generateTopology({
    seed: includeSpecialEleven ? 77124 : 77123,
    lowShortLayout: false,
    includeSpecialEleven,
    maxAttempts: 96,
    mutationBudget: 96,
    maxTwoLetterSlots: 5
  });
  assert.equal(generated.ok, true, JSON.stringify(generated));
  const options = {
    requireConnected: true,
    requireFullTopBorder: true,
    allowSpecialElevenBoundary: includeSpecialEleven,
    allowOuterBoundarySlots: true,
    allowColumnOneBoundarySlot: !includeSpecialEleven,
    minimumOuterBoundaryLength: 2
  };
  const topology = validateTopology(generated.topology.grid, options);
  const derived = deriveWordSlots(generated.topology.grid, options);
  const eleven = derived.slots.filter(slot => slot.length === 11);
  assert.equal(topology.valid, true, JSON.stringify(topology.errors));
  assert.equal(derived.errors.length, 0, JSON.stringify(derived.errors));
  assert.equal(generated.topology.pattern[0], ".#######");
  assert.ok(generated.topology.grid[0].slice(1).every(cell => cell.type === "question"));
  assert.equal(eleven.length, includeSpecialEleven ? 1 : 0);
  assert.equal(eleven.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length, includeSpecialEleven ? 1 : 0);
  assert.ok(derived.slots.length >= 20);
}
console.log(JSON.stringify({ ok: true, fullTopBorder: true, ordinaryElevenAnswers: 0, specialElevenAnswers: 1 }, null, 2));
