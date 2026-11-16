const assert = require("node:assert/strict");

async function main() {
  const { generateTopology, getTopologyScaffolds } = await import("../scanword-engine/src/topology-builder.js");
  const { validateTopology, deriveWordSlots } = await import("../scanword-engine/src/topology.js");
  const { CONFIG } = await import("../scanword-engine/src/config.js");

  const scaffolds = getTopologyScaffolds();
  assert.ok(scaffolds.length >= 3, "Expected several independently prepared topology scaffolds.");
  const distinctScaffolds = new Set(scaffolds.map(rows => rows.join("/")));
  assert.equal(distinctScaffolds.size, scaffolds.length, "Topology scaffolds must be distinct.");

  const observed = new Set();
  let normalSamples = 0;
  for (let index = 0; index < 128; index++) {
    const seed = 510000 + index * 7919;
    const generated = generateTopology({
      seed,
      includeSpecialEleven: false,
      maxAttempts: 96,
      maxTwoLetterSlots: 5
    });
    assert.equal(generated.ok, true, "Topology generation failed for seed " + seed);
    const grid = generated.topology.grid;
    const topologyOptions = {
      requireConnected: true,
      allowSpecialElevenBoundary: false,
      allowOuterBoundarySlots: true,
      allowColumnOneBoundarySlot: true,
      minimumOuterBoundaryLength: 2
    };
    const validation = validateTopology(grid, topologyOptions);
    assert.equal(validation.valid, true, "Independent topology check failed for seed " + seed + ": " + JSON.stringify(validation.errors));
    assert.equal(validation.metrics.totalCells, CONFIG.TOTAL_CELLS);
    assert.equal(grid.length, 12);
    assert.ok(grid.every(row => row.length === 8));
    assert.equal(grid.flat().length, 96);
    assert.equal(grid[0][0].type, "corner");
    assert.equal(grid[0][1].type, "question");
    for (let row = 1; row < 12; row++) assert.equal(grid[row][0].type, "question");
    const slots = deriveWordSlots(grid, topologyOptions);
    assert.equal(slots.errors.length, 0);
    assert.equal(slots.slots.some(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"), false);
    normalSamples++;
    observed.add(generated.topology.pattern.join("/"));
  }
  assert.ok(
    observed.size >= 12,
    "128 seeded generations should produce at least 12 distinct validated topologies; got " + observed.size
  );
  assert.equal(normalSamples, 128);
  console.log(JSON.stringify({
    ok: true,
    dimensions: "8x12",
    totalCells: 96,
    availableScaffolds: distinctScaffolds.size,
    distinctGeneratedTopologies: observed.size,
    seededSamples: 128,
    normalSamples,
    specialElevenSamples: 0,
    note: "All sampled topologies use the ordinary layout; the retired 11-letter special mode is disabled."
  }, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
