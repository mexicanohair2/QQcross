import { CONFIG } from './config.js';
import { buildIndexes, canonicalAnswerKey, findCandidates, prepareDictionary } from './dictionary.js';
import { solveSlotsCsp } from './csp.js';
import { assembleScanword } from './assembler.js';
import { validateScanword } from './validator.js';
import { generateTopology } from './topology-builder.js';
import { scoreScanword } from './scoring.js';
import { createRng } from './rng.js';

function now() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

const ALLOWED_SPECIAL_SHORT_ANSWERS = new Set([
  'ЁЖ', 'ЯД', 'УМ', 'ЮГ', 'АС', 'УС', 'ДО', 'РЕ', 'МИ', 'ФА', 'ЛЯ', 'СИ'
].map(answer => canonicalAnswerKey(answer)));

function canAssignDistinctShortAnswers(domains) {
  const ordered = domains
    .map(domain => [...domain].sort())
    .sort((a, b) => a.length - b.length);
  const used = new Set();

  function assign(index) {
    if (index === ordered.length) return true;
    for (const answer of ordered[index]) {
      if (used.has(answer)) continue;
      used.add(answer);
      if (assign(index + 1)) return true;
      used.delete(answer);
    }
    return false;
  }

  return assign(0);
}

function chooseSpecialElevenPlan(entries, random, foldYo = false, indexes, requirements = {}) {
  if (!indexes) return null;
  const normalizeInitial = letter => foldYo && letter === 'Ё' ? 'Е' : letter;
  const requiredImageCount = requirements.requiredImageCount ?? 5;
  const minimumLogicClueCells = requirements.minimumLogicClueCells ?? 3;
  const rowPatterns = [];

  for (let first = 3; first <= 5; first++) {
    for (let second = first + 3; second <= 8; second++) {
      for (let third = second + 3; third <= 11; third++) {
        rowPatterns.push([first, second, third]);
      }
    }
  }

  const topologies = rowPatterns.map(rows => ({
    rows,
    result: generateTopology({
      seed: 1,
      includeSpecialEleven: true,
      specialSplitRows: rows,
      maxAttempts: 1
    })
  })).filter(item => item.result.ok);

  const plans = [];
  const uniqueAnswers = new Set();

  for (const entry of entries) {
    if (entry.answer.length !== 11) continue;
    const answerKey = canonicalAnswerKey(entry.answer, { foldYo });
    if (uniqueAnswers.has(answerKey)) continue;
    uniqueAnswers.add(answerKey);

    const letters = [...entry.answer].map(normalizeInitial);
    const imposedLetters = new Map(letters.map((letter, index) => [
      (index + 1) + ',1',
      letter
    ]));

    for (const topology of topologies) {
      const shortDomains = [];
      const imageKeys = new Set();
      let logicSlots = 0;
      let minimumDomain = Infinity;
      let totalDomain = 0;
      let valid = true;

      for (const slot of topology.result.topology.slots) {
        if (slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') continue;

        const candidatesById = new Map();
        for (const orientation of slot.directionOptions) {
          if (orientation.direction !== 'right' && orientation.direction !== 'down') continue;
          const constraints = [];
          orientation.coordinates.forEach((point, position) => {
            const imposed = imposedLetters.get(point.row + ',' + point.col);
            if (imposed !== undefined) constraints.push({ position, letter: imposed });
          });

          const candidates = findCandidates(indexes, slot.length, constraints);
          for (const candidate of candidates) {
            if (slot.length === 2
              && !ALLOWED_SPECIAL_SHORT_ANSWERS.has(canonicalAnswerKey(candidate.answer, { foldYo }))) {
              continue;
            }
            candidatesById.set(candidate.id, candidate);
          }
        }

        const candidates = [...candidatesById.values()];
        if (!candidates.length) {
          valid = false;
          break;
        }

        const answerCount = new Set(candidates.map(candidate =>
          canonicalAnswerKey(candidate.answer, { foldYo })
        )).size;
        minimumDomain = Math.min(minimumDomain, answerCount);
        totalDomain += Math.min(answerCount, 40);

        if (slot.length === 2) {
          shortDomains.push(new Set(candidates.map(candidate =>
            canonicalAnswerKey(candidate.answer, { foldYo })
          )));
        }
        for (const candidate of candidates) {
          if (candidate.imageKey) imageKeys.add(candidate.imageKey);
        }
        if (candidates.some(candidate => candidate.logic === true)) logicSlots++;
      }

      if (!valid || !canAssignDistinctShortAnswers(shortDomains)) continue;
      if (imageKeys.size < requiredImageCount || logicSlots < minimumLogicClueCells) continue;

      plans.push({
        answer: entry.answer,
        rows: topology.rows,
        score: minimumDomain * 100000 + totalDomain * 100 + imageKeys.size * 10 + logicSlots,
        tie: random()
      });
    }
  }

  if (!plans.length) return null;
  plans.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return { answer: plans[0].answer, rows: plans[0].rows };
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
      ? chooseSpecialElevenPlan(prepared.entries, random, options.foldYo === true, indexes, options)
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
