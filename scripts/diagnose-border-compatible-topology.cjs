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
  let specialSamples = 0;
  for (let index = 0; index < 128; index++) {
    const seed = 510000 + index * 7919;
    const special = index % 4 === 3;
    const generated = generateTopology({
      seed,
      includeSpecialEleven: special,
      maxAttempts: 96
    });
    assert.equal(generated.ok, true, "Topology generation failed for seed " + seed);
    const grid = generated.topology.grid;
    const validation = validateTopology(grid, {
      requireConnected: true,
      allowSpecialElevenBoundary: special
    });
    assert.equal(validation.valid, true, "Independent topology check failed for seed " + seed + ": " + JSON.stringify(validation.errors));
    assert.equal(validation.metrics.totalCells, CONFIG.TOTAL_CELLS);
    assert.equal(grid.length, 12);
    assert.ok(grid.every(row => row.length === 8));
    assert.equal(grid.flat().length, 96);
    assert.equal(grid[0][0].type, "corner");
    assert.equal(grid[0][1].type, "question");
    for (let row = 1; row < 12; row++) assert.equal(grid[row][0].type, "question");
    const slots = deriveWordSlots(grid, { allowSpecialElevenBoundary: special });
    assert.equal(slots.errors.length, 0);
    if (special) {
      assert.equal(slots.slots.filter(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY").length, 1);
      specialSamples++;
    } else {
      assert.equal(slots.slots.some(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY"), false);
      normalSamples++;
    }
    observed.add(generated.topology.pattern.join("/"));
  }
  assert.ok(
    observed.size >= 12,
    "128 seeded generations should produce at least 12 distinct validated topologies; got " + observed.size
  );
  assert.equal(normalSamples, 96);
  assert.equal(specialSamples, 32);
  console.log(JSON.stringify({
    ok: true,
    dimensions: "8x12",
    totalCells: 96,
    availableScaffolds: distinctScaffolds.size,
    distinctGeneratedTopologies: observed.size,
    seededSamples: 128,
    normalSamples,
    specialElevenSamples: specialSamples,
    note: "This verifies topology only; dictionary assignment and gameplay are tested separately."
  }, null, 2));
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
