const assert = require("node:assert/strict");

async function main() {
  const { generateTopology } = await import("../scanword-engine/src/topology-builder.js");
  const { validateTopology, deriveWordSlots } = await import("../scanword-engine/src/topology.js");
  const { CONFIG } = await import("../scanword-engine/src/config.js");

  const observed = new Set();
  let ordinarySamples = 0;
  let longSamples = 0;
  const directionCoverage = new Set();

  for (let index = 1; index <= 128; index++) {
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
    assert.equal(validation.valid, true, "Independent topology check failed for seed " + seed + ": " + JSON.stringify(validation.errors));
    assert.equal(validation.metrics.totalCells, CONFIG.TOTAL_CELLS);
    assert.equal(grid[0][0].type, "corner");
    assert.ok(grid[0].slice(1).every(cell => cell.type === "question"));
    for (let row = 1; row < 12; row++) assert.equal(grid[row][0].type, "question");

    const slots = deriveWordSlots(grid, options);
    assert.equal(slots.errors.length, 0);
    const eleven = slots.slots.filter(slot => slot.length === 11);
    assert.equal(eleven.length, includeSpecialEleven ? 1 : 0);
    assert.equal(eleven.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length, includeSpecialEleven ? 1 : 0);
    for (const slot of slots.slots) for (const option of slot.directionOptions) directionCoverage.add(option.direction);
    observed.add(generated.topology.pattern.join("/"));
    if (includeSpecialEleven) longSamples++;
    else ordinarySamples++;
  }

  assert.ok(observed.size >= 12, "128 seeded generations should produce at least 12 distinct validated full-border topologies; got " + observed.size);
  assert.deepEqual([...directionCoverage].sort(), ["down", "left", "right", "up"]);
  assert.equal(ordinarySamples, 96);
  assert.equal(longSamples, 32);
  console.log(JSON.stringify({
    ok: true,
    dimensions: "8x12",
    totalCells: 96,
    distinctGeneratedTopologies: observed.size,
    seededSamples: 128,
    ordinaryBoards: ordinarySamples,
    oneElevenLetterAnswerBoards: longSamples,
    directionCoverage: [...directionCoverage].sort()
  }, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
