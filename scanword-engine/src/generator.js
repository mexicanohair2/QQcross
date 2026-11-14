import { CONFIG } from './config.js';
import { buildIndexes, prepareDictionary } from './dictionary.js';
import { solveSlotsCsp } from './csp.js';
import { assembleScanword } from './assembler.js';
import { validateScanword } from './validator.js';
import { generateTopology } from './topology-builder.js';
import { scoreScanword } from './scoring.js';
import { createRng } from './rng.js';

function now() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

function chooseSpecialElevenPlan(entries, random, foldYo = false) {
  const normalizeInitial = letter => foldYo && letter === 'Ё' ? 'Е' : letter;
  const starts = length => new Set(entries
    .filter(entry => entry.answer.length === length)
    .map(entry => normalizeInitial(entry.answer[0])));
  const threeLetterStarts = starts(3);
  const sixLetterStarts = starts(6);
  const plans = [];

  // The top clue at row 0 and the three internal clue rows must be at least
  // three rows apart; otherwise the vertical clue chain creates a forbidden
  // one-letter gap. Build only geometrically valid triples.
  for (const entry of entries) {
    if (entry.answer.length !== 11) continue;
    const letters = [...entry.answer].map(normalizeInitial);
    for (let first = 3; first <= 11; first++) {
      for (let second = first + 3; second <= 11; second++) {
        for (let third = second + 3; third <= 11; third++) {
          const rows = [first, second, third];
          const compatible = letters.every((letter, index) => {
            const answerRow = index + 1;
            return rows.includes(answerRow)
              ? threeLetterStarts.has(letter)
              : sixLetterStarts.has(letter);
          });
          if (compatible) plans.push({ answer: entry.answer, rows });
        }
      }
    }
  }

  if (!plans.length) return null;
  return plans[Math.floor(random() * plans.length)];
}

function countFailure(target, reason) {
  target[reason] = (target[reason] ?? 0) + 1;
}

function fail(reason, seed, started, attempts, rejectedReasons, extra = {}) {
  return {
    ok: false,
    reason,
    seed,
    attempts,
    rejectedReasons,
    elapsedMs: Math.round(now() - started),
    message: reason === 'INSUFFICIENT_DICTIONARY'
      ? 'В словаре недостаточно качественных ответов, картинок или логических вопросов.'
      : 'Не удалось собрать полностью проверенный сканворд в заданных пределах поиска.',
    ...extra
  };
}

/**
 * Production entry point. Geometry is generated first, answer slots are
 * derived from the actual role grid, then the bounded CSP assigns dictionary
 * entries. An independent validator reconstructs the complete 8x12 board
 * before the result can be returned to QQCross.
 */
export function generateScanword(inputDictionary, options = {}) {
  const started = now();
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) >>> 0 : Date.now() >>> 0;
  const random = createRng(seed);
  const maxTopologies = Math.max(1, Math.min(64, options.maxTopologyAttempts ?? 16));
  const maxNodes = Math.max(500, options.maxNodes ?? 120000);
  const maxCspTimeMs = Math.max(25, options.maxCspTimeMs ?? 450);
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const rejectedReasons = Object.create(null);
  const attempts = [];

  if (!Array.isArray(inputDictionary) || inputDictionary.length === 0) {
    return fail('EMPTY_DICTIONARY', seed, started, attempts, rejectedReasons);
  }

  const prepared = prepareDictionary(inputDictionary, { foldYo: options.foldYo === true });
  if (prepared.stats.withImages < requiredImageCount || prepared.stats.logicEntries < minimumLogicClueCells) {
    return fail('INSUFFICIENT_DICTIONARY', seed, started, attempts, rejectedReasons, {
      dictionaryStats: prepared.stats,
      dictionaryErrors: prepared.errors.slice(0, 20)
    });
  }

  // Dictionary validation and positional indexes are invariant across topology attempts.
  // Build them once, not again inside every CSP retry.
  const indexes = buildIndexes(prepared.variants, { foldYo: options.foldYo === true });

  const hasElevenLetterAnswers = prepared.entries.some(entry => entry.answer.length === 11);
  const wantsEleven = hasElevenLetterAnswers
    && random() < (options.specialElevenLetterChance ?? CONFIG.SPECIAL_ELEVEN_LETTER_CHANCE);
  const specialAttempts = wantsEleven ? Math.min(maxTopologies, options.specialTopologyAttempts ?? 8) : 0;
  let bestDiagnostic = null;

  for (let attempt = 0; attempt < maxTopologies; attempt++) {
    const useSpecial = wantsEleven && attempt < specialAttempts;
    const specialPlan = useSpecial
      ? chooseSpecialElevenPlan(prepared.entries, random, options.foldYo === true)
      : null;
    const useSpecialTopology = Boolean(specialPlan);
    const topologySeed = (seed + Math.imul(attempt + 1, 7919)) >>> 0;
    const topologyResult = generateTopology({
      seed: topologySeed,
      includeSpecialEleven: useSpecialTopology,
      specialSplitRows: specialPlan?.rows,
      maxAttempts: options.topologyMutationAttempts ?? 96
    });

    if (!topologyResult.ok) {
      countFailure(rejectedReasons, topologyResult.reason);
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: topologyResult.reason,
        topologyAttempts: topologyResult.attempts
      });
      bestDiagnostic = topologyResult;
      continue;
    }

    const topology = topologyResult.topology;
    const topologyValidation = topology.validation;
    if (!topologyValidation.valid || topology.slots.length < 18) {
      countFailure(rejectedReasons, 'TOPOLOGY_VALIDATION_FAILED');
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: 'TOPOLOGY_VALIDATION_FAILED',
        errors: topologyValidation.errors.slice(0, 8)
      });
      continue;
    }

    const cspSeed = (seed ^ Math.imul(attempt + 1, 104729)) >>> 0;
    const solved = solveSlotsCsp(topology.slots, inputDictionary, {
      seed: cspSeed,
      foldYo: options.foldYo === true,
      preparedDictionary: prepared,
      indexes,
      maxNodes,
      maxTimeMs: maxCspTimeMs,
      requiredImageCount,
      minimumLogicClueCells,
      requireEveryClueStarts: false,
      allowedDirections: ['right', 'down'],
      history: options.history,
      signal: options.signal,
      repeatWordPenalty: options.repeatWordPenalty,
      repeatQuestionPenalty: options.repeatQuestionPenalty,
      preferredSpecialAnswer: specialPlan?.answer
    });

    if (!solved.ok) {
      countFailure(rejectedReasons, solved.reason);
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: solved.reason,
        specialAnswer: specialPlan?.answer ?? null,
        specialSplitRows: specialPlan?.rows ?? null,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: solved.elapsedMs,
        lastDeadEnd: solved.lastDeadEnd
      });
      bestDiagnostic = solved;
      continue;
    }

    const assembled = assembleScanword({
      seed,
      words: solved.words,
      questions: solved.questions
    }, {
      foldYo: options.foldYo === true
    });

    if (!assembled.ok) {
      countFailure(rejectedReasons, 'ASSEMBLY_FAILED');
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: 'ASSEMBLY_FAILED',
        errors: assembled.errors.slice(0, 12)
      });
      bestDiagnostic = assembled;
      continue;
    }

    const scanword = assembled.scanword;
    scanword.metadata = {
      ...scanword.metadata,
      seed,
      topologySeed,
      topologyScaffold: topologyResult.scaffoldIndex,
      topologyAttempts: topologyResult.attempts,
      cspNodes: solved.nodes,
      cspElapsedMs: solved.elapsedMs,
      specialElevenLetterQuestion: scanword.words.some(
        word => word.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY'
      ),
      valid: false,
      score: 0
    };

    const validation = validateScanword(scanword, inputDictionary, {
      foldYo: options.foldYo === true,
      requiredImageCount,
      minimumLogicClueCells,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireConnected: true
    });

    if (!validation.valid) {
      countFailure(rejectedReasons, 'INDEPENDENT_VALIDATION_FAILED');
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: 'INDEPENDENT_VALIDATION_FAILED',
        nodes: solved.nodes,
        errors: validation.errors.slice(0, 16)
      });
      bestDiagnostic = validation;
      continue;
    }

    const score = scoreScanword(scanword, validation);
    scanword.metadata.valid = true;
    scanword.metadata.score = score;
    scanword.metadata.generationTimeMs = Math.round(now() - started);

    const specialElevenAttemptDiagnostics = attempts
      .filter(item => item.attempt <= specialAttempts)
      .map(item => ({
        attempt: item.attempt,
        reason: item.reason,
        nodes: item.nodes ?? null,
        elapsedMs: item.elapsedMs ?? null,
        lastDeadEnd: item.lastDeadEnd ?? null
      }));
    scanword.metadata.specialElevenRequested = wantsEleven;
    return {
      ok: true,
      scanword,
      validation,
      topology: {
        ...topology.metrics,
        scaffoldIndex: topologyResult.scaffoldIndex,
        attempts: topologyResult.attempts,
        seed: topologySeed
      },
      stats: {
        seed,
        attempts: attempt + 1,
        topologyAttempts: topologyResult.attempts,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: Math.round(now() - started),
        cspElapsedMs: solved.elapsedMs,
        score,
        specialElevenLetterQuestion: scanword.metadata.specialElevenLetterQuestion,
        specialElevenRequested: wantsEleven,
        specialElevenMissed: wantsEleven && !scanword.metadata.specialElevenLetterQuestion,
        specialElevenAttempted: specialAttempts,
        specialElevenFailureDiagnostics: specialElevenAttemptDiagnostics,
        dictionary: prepared.stats,
        rejectedReasons: { ...rejectedReasons }
      }
    };
  }

  return fail('NO_VALID_SCANWORD', seed, started, attempts, rejectedReasons, {
    dictionaryStats: prepared.stats,
    lastDiagnostic: bestDiagnostic,
    requestedSpecialEleven: wantsEleven
  });
}
