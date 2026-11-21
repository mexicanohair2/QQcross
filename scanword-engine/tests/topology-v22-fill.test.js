import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateEtalonV22Topology, getEtalonV22Patterns } from '../src/topology-v22.js';
import { solveEtalonV22Slots } from '../src/solver-v22.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'data/scanword-dictionary.json'), 'utf8'));

test('v2.2 topology reports seeded dictionary-fill solvability across every certified mask', () => {
  const results = [];

  for (let patternIndex = 0; patternIndex < getEtalonV22Patterns().length; patternIndex++) {
    const topology = generateEtalonV22Topology({ seed: 1, patternIndex });
    assert.equal(topology.ok, true);

    const attempts = [];
    for (let offset = 0; offset < 12; offset++) {
      const seed = 211 + patternIndex * 100 + offset;
      const solved = solveEtalonV22Slots(topology.topology.slots, dictionary, {
        seed,
        maxNodes: 120000,
        maxTimeMs: 800,
        requiredImageCount: 5,
        minimumLogicClueCells: 3
      });

      attempts.push({
        seed,
        ok: solved.ok,
        reason: solved.reason ?? null,
        nodes: solved.nodes,
        depth: solved.bestDepth ?? solved.metrics?.words ?? 0,
        elapsedMs: solved.elapsedMs,
        failure: solved.bestFailure ?? null,
        metrics: solved.metrics ?? null
      });

      if (solved.ok) break;
    }

    const successful = attempts.find(attempt => attempt.ok) ?? null;
    results.push({
      patternIndex,
      slotCount: topology.topology.slots.length,
      sharedClueCells: topology.topology.sharedClueCells ?? null,
      successfulSeed: successful?.seed ?? null,
      attempts: attempts.length,
      bestDepth: Math.max(...attempts.map(attempt => attempt.depth)),
      maxElapsedMs: Math.max(...attempts.map(attempt => attempt.elapsedMs)),
      reasons: attempts.reduce((counts, attempt) => {
        const reason = attempt.reason ?? 'SUCCESS';
        counts[reason] = (counts[reason] ?? 0) + 1;
        return counts;
      }, {}),
      failureSamples: attempts.filter(attempt => !attempt.ok).slice(0, 3).map(attempt => ({
        seed: attempt.seed,
        depth: attempt.depth,
        failure: attempt.failure
      })),
      successfulMetrics: successful?.metrics ?? null,
      dictionaryStats: attempts[0]?.failure?.dictionaryStats ?? null
    });
  }

  console.log('ETALON_V22_SEED_SWEEP=' + JSON.stringify(results));
  assert.equal(results.length, 3);
  assert.ok(results.every(result => result.slotCount === 34));
  assert.ok(results.every(result => result.attempts >= 1));
});
