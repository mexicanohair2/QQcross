const assert = require("node:assert/strict");

async function main() {
  const { generateTopology } = await import("../scanword-engine/src/topology-builder.js");
  const { validateTopology, deriveWordSlots } = await import("../scanword-engine/src/topology.js");
  const { CONFIG } = await import("../scanword-engine/src/config.js");

  const observed = new Set();
  let shortSamples = 0;
  let longSamples = 0;

  for (let index = 1; index <= 128; index++) {
    const seed = 510000 + index * 7919;
    const includeSpecialEleven = index % 4 === 0;
    const generated = generateTopology({
      seed,
      lowShortLayout: true,
      includeSpecialEleven,
      maxAttempts: 96,
      mutationBudget: 96,
      maxTwoLetterSlots: 5
    });
    assert.equal(generated.ok, true, "Topology generation failed for seed " + seed);

    const grid = generated.topology.grid;
    const topologyOptions = {
      requireConnected: true,
      allowTopRowHorizontalRun: true,
      allowSpecialElevenBoundary: includeSpecialEleven,
      allowOuterBoundarySlots: true,
      allowColumnOneBoundarySlot: false,
      minimumOuterBoundaryLength: 2
    };
    const validation = validateTopology(grid, topologyOptions);
    assert.equal(validation.valid, true, "Independent topology check failed for seed " + seed + ": " + JSON.stringify(validation.errors));
    assert.equal(validation.metrics.totalCells, CONFIG.TOTAL_CELLS);
    assert.equal(grid.length, 12);
    assert.ok(grid.every(row => row.length === 8));
    assert.equal(grid.flat().length, 96);
    assert.equal(grid[0][0].type, "corner");
    assert.deepEqual(grid[0].map(cell => cell.type), [
      "corner", "question", "letter", "letter", "letter", "question", "question", "question"
    ]);
    for (let row = 1; row < 12; row++) assert.equal(grid[row][0].type, "question");

    const slots = deriveWordSlots(grid, topologyOptions);
    assert.equal(slots.errors.length, 0);
    const topShort = slots.slots.find(slot =>
      slot.axis === "horizontal"
      && slot.length === 3
      && slot.endpoints[0].row === 0
      && slot.endpoints[0].col === 1
      && slot.endpoints[1].col === 5
    );
    assert.ok(topShort, "Every board must contain the three-letter top-row answer.");

    const longSlots = slots.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY");
    assert.equal(longSlots.length, includeSpecialEleven ? 1 : 0);
    if (includeSpecialEleven) {
      assert.equal(longSlots[0].length, 11);
      longSamples++;
    } else {
      shortSamples++;
    }

    observed.add(generated.topology.pattern.join("/"));
  }

  assert.ok(observed.size >= 12, "128 seeded generations should produce at least 12 distinct validated topologies; got " + observed.size);
  assert.equal(shortSamples, 96);
  assert.equal(longSamples, 32);
  console.log(JSON.stringify({
    ok: true,
    dimensions: "8x12",
    totalCells: 96,
    distinctGeneratedTopologies: observed.size,
    seededSamples: 128,
    shortAnswerBoards: shortSamples,
    oneElevenLetterAnswerBoards: longSamples,
    note: "Three out of every four boards use the short top-row answer; every fourth adds exactly one 11-letter vertical answer."
  }, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
