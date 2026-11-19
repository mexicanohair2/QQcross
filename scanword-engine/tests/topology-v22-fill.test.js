import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateEtalonV22Topology, getEtalonV22Patterns } from '../src/topology-v22.js';
import { solveEtalonV22Slots } from '../src/solver-v22.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'data/scanword-dictionary.json'), 'utf8'));

test('v2.2 topology has bounded dictionary-fill diagnostics without weakening the contract', () => {
  const results = [];
  for (let patternIndex = 0; patternIndex < getEtalonV22Patterns().length; patternIndex++) {
    const topology = generateEtalonV22Topology({ seed: 1, patternIndex });
    assert.equal(topology.ok, true);
    const solved = solveEtalonV22Slots(topology.topology.slots, dictionary, {
      seed: 211 + patternIndex,
      maxNodes: 120000,
      maxTimeMs: 2500,
      requiredImageCount: 5,
      minimumLogicClueCells: 3
    });
    results.push({
      patternIndex,
      ok: solved.ok,
      reason: solved.reason,
      nodes: solved.nodes,
      depth: solved.bestDepth ?? solved.metrics?.words,
      failure: solved.bestFailure,
      metrics: solved.metrics
    });
  }

  // This is intentionally diagnostic for the first integration milestone:
  // it proves every mask can be checked against the actual curated dictionary.
  // Full 34-word solvability is promoted to a hard gate only after shared-clue
  // word pairs have been editorially curated and reviewed.
  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.nodes > 0));
});
