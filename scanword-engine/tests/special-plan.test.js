import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndexes, prepareDictionary } from '../src/dictionary.js';
import { chooseSpecialElevenPlan } from '../src/generator.js';
import { createRng } from '../src/rng.js';

const productionDictionary = JSON.parse(
  readFileSync(new URL('../../data/scanword-dictionary.json', import.meta.url), 'utf8')
);

test('production special-eleven planner returns unique plans with complete quota metadata', () => {
  const prepared = prepareDictionary(productionDictionary);
  const diagnostics = {};
  const plans = chooseSpecialElevenPlan(
    prepared.entries,
    createRng(20261121),
    false,
    buildIndexes(prepared.variants),
    {
      returnAllPlans: true,
      planDiagnostics: diagnostics,
      requiredImageCount: 5,
      minimumLogicClueCells: 3
    }
  );

  assert.ok(Array.isArray(plans), 'returnAllPlans must always return an array');
  assert.equal(diagnostics.viablePlans, plans.length);
  assert.ok(diagnostics.topologiesConsidered > 0);
  assert.ok(plans.length > 0, 'the production dictionary must support at least one valid special topology: ' + JSON.stringify(diagnostics));
  assert.equal(new Set(plans.map(plan => plan.planKey)).size, plans.length);
  for (const plan of plans) {
    assert.equal(typeof plan.answer, 'string');
    assert.equal(plan.answer.length, 11);
    assert.ok(Array.isArray(plan.rows));
    assert.equal(plan.specialPattern.length, 12);
    assert.ok(plan.allowedEntryIdsBySlot instanceof Map);
    assert.ok(plan.allowedPlacementsBySlot instanceof Map);
    assert.ok([...plan.allowedPlacementsBySlot.values()].every(value => value instanceof Set));
    assert.ok(plan.preferredImagePlacementsBySlot instanceof Map);
  }
});

test('requested special puzzle fails clearly instead of silently returning an ordinary board when no plan exists', async () => {
  const { generateScanword } = await import('../src/generator.js');
  const sparseDictionary = [
    { id: 'special', answer: 'КАТАЛИЗАТОР', clue: 'Вещество, ускоряющее химическую реакцию.', difficulty: 4 },
    ...[
      ['КОТ', 'cat'], ['ДОМ', 'house'], ['СЫР', 'cheese'], ['МЯЧ', 'ball'], ['ЛЕС', 'forest']
    ].map(([answer, imageKey]) => ({
      id: 'image-' + imageKey,
      answer,
      clue: 'Что изображено на картинке?',
      imageKey,
      difficulty: 2
    })),
    ...[
      ['УМ', 'Способность человека думать и рассуждать.'],
      ['МИР', 'Состояние без войны и вооружённых конфликтов.'],
      ['СОН', 'Естественное состояние отдыха организма.']
    ].map(([answer, clue]) => ({
      id: 'logic-' + answer,
      answer,
      clue,
      logic: true,
      difficulty: 3
    }))
  ];

  const result = generateScanword(sparseDictionary, {
    seed: 77,
    sequenceIndex: 5,
    requiredImageCount: 5,
    minimumLogicClueCells: 3,
    maxTopologyAttempts: 1,
    maxNodes: 500,
    maxCspTimeMs: 25
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NO_SPECIAL_ELEVEN_PLAN');
  assert.equal(result.specialElevenPlanDiagnostics.viablePlans, 0);
});
