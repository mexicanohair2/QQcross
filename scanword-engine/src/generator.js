import { CONFIG, DIRECTIONS, isAllowedClueDirection } from './config.js';
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
  'ЁЖ', 'ЯД', 'УМ', 'ЮГ', 'АС', 'УС'
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

export function enforceCrossingArcConsistency(domains, foldYo = false, diagnostics = null) {
  // Slot coordinates describe physical cells; each candidate's coordinates
  // describe the order in which its answer letters are written. These orders
  // differ for left/up orientations and must never be mixed.
  const slotKeys = domains.map(domain => new Set(
    domain.slot.coordinates.map(point => point.row + ',' + point.col)
  ));
  const neighbors = domains.map(() => []);

  for (let left = 0; left < domains.length; left++) {
    for (let right = left + 1; right < domains.length; right++) {
      const sharedKeys = [...slotKeys[left]].filter(key => slotKeys[right].has(key));
      if (!sharedKeys.length) continue;
      neighbors[left].push({ other: right, sharedKeys });
      neighbors[right].push({ other: left, sharedKeys });
    }
  }

  const queue = [];
  for (let self = 0; self < neighbors.length; self++) {
    for (const relation of neighbors[self]) {
      queue.push({ self, other: relation.other, sharedKeys: relation.sharedKeys });
    }
  }

  const letterKey = value => foldYo && value === 'Ё' ? 'Е' : value;
  const signatureFor = (domain, option, sharedKeys) => {
    const coordinates = Array.isArray(option.coordinates) && option.coordinates.length
      ? option.coordinates
      : domain.slot.coordinates;
    const positions = new Map(coordinates.map((point, index) => [
      point.row + ',' + point.col,
      index
    ]));
    const letters = [];
    for (const key of sharedKeys) {
      const position = positions.get(key);
      if (position === undefined || typeof option.entry?.answer?.[position] !== 'string') return null;
      letters.push(letterKey(option.entry.answer[position]));
    }
    return letters.join('');
  };

  while (queue.length) {
    const arc = queue.shift();
    const ownDomain = domains[arc.self];
    const otherDomain = domains[arc.other];
    const supportedSignatures = new Set(otherDomain.options
      .map(option => signatureFor(otherDomain, option, arc.sharedKeys))
      .filter(signature => signature !== null));

    const revised = ownDomain.options.filter(option => {
      const signature = signatureFor(ownDomain, option, arc.sharedKeys);
      return signature !== null && supportedSignatures.has(signature);
    });
    if (revised.length === ownDomain.options.length) continue;

    const removedCount = ownDomain.options.length - revised.length;
    if (diagnostics) diagnostics.removedOptions = (diagnostics.removedOptions ?? 0) + removedCount;
    ownDomain.options = revised;
    if (!revised.length) {
      if (diagnostics) {
        diagnostics.failure = {
          slotId: ownDomain.slot.id,
          againstSlotId: otherDomain.slot.id,
          sharedCells: arc.sharedKeys,
          survivingSupportSignatures: [...supportedSignatures].slice(0, 12)
        };
      }
      return false;
    }

    for (const relation of neighbors[arc.self]) {
      if (relation.other === arc.other) continue;
      queue.push({
        self: relation.other,
        other: arc.self,
        sharedKeys: relation.sharedKeys
      });
    }
  }

  return domains.every(domain => domain.options.length > 0);
}

function prepareTopologyDomains(slots, indexes, options = {}) {
  const foldYo = options.foldYo === true;
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const domains = [];
  let availableVariants = 0;

  // Every slot has two endpoints, and either endpoint may host the clue.
  // Every answer starts at its clue and proceeds only right or down.
  for (const slot of slots) {
    const candidates = indexes.byLength.get(slot.length) ?? [];
    const domainOptions = [];
    for (const orientation of slot.directionOptions ?? []) {
      if (!isAllowedClueDirection(orientation.clueCell, orientation.direction)) continue;
      for (const entry of candidates) {
        if (slot.length === 2
          && !ALLOWED_SPECIAL_SHORT_ANSWERS.has(canonicalAnswerKey(entry.answer, { foldYo }))) {
          continue;
        }
        domainOptions.push({
          entry,
          coordinates: orientation.coordinates,
          clueCell: orientation.clueCell,
          direction: orientation.direction
        });
      }
    }
    if (!domainOptions.length) {
      return {
        ok: false,
        reason: 'EMPTY_DICTIONARY_DOMAIN',
        slotId: slot.id,
        slotLength: slot.length,
        domains: domains.length
      };
    }
    availableVariants += domainOptions.length;
    domains.push({ slot, options: domainOptions });
  }

  const arcDiagnostics = {};
  if (!enforceCrossingArcConsistency(domains, foldYo, arcDiagnostics)) {
    return {
      ok: false,
      reason: 'CROSSING_ARC_CONSISTENCY_FAILED',
      ...arcDiagnostics,
      domains: domains.length,
      availableVariants
    };
  }

  const shortDomains = domains
    .filter(domain => domain.slot.length === 2)
    .map(domain => new Set(domain.options.map(option =>
      canonicalAnswerKey(option.entry.answer, { foldYo })
    )));
  if (!canAssignDistinctShortAnswers(shortDomains)) {
    return {
      ok: false,
      reason: 'SHORT_ANSWER_MATCHING_FAILED',
      domains: domains.length,
      shortDomainSizes: shortDomains.map(domain => domain.size)
    };
  }

  const imageKeys = new Set();
  const imageClueKeys = new Set();
  const logicClueKeys = new Set();
  for (const domain of domains) {
    for (const option of domain.options) {
      const clueKey = option.clueCell.row + ',' + option.clueCell.col;
      if (option.entry.imageKey) {
        imageKeys.add(option.entry.imageKey);
        imageClueKeys.add(clueKey);
      }
      if (option.entry.logic) logicClueKeys.add(clueKey);
    }
  }
  if (imageKeys.size < requiredImageCount || imageClueKeys.size < requiredImageCount
    || logicClueKeys.size < minimumLogicClueCells) {
    return {
      ok: false,
      reason: 'CONTENT_DOMAINS_INSUFFICIENT',
      domains: domains.length,
      imageKeys: imageKeys.size,
      imageClueCells: imageClueKeys.size,
      logicClueCells: logicClueKeys.size,
      requiredImageCount,
      minimumLogicClueCells
    };
  }

  return {
    ok: true,
    allowedEntryIdsBySlot: new Map(domains.map(domain => [
      domain.slot.id,
      new Set(domain.options.map(option => option.entry.id))
    ])),
    diagnostics: {
      domains: domains.length,
      availableVariants,
      remainingVariants: domains.reduce((count, domain) => count + domain.options.length, 0),
      shortDomainSizes: shortDomains.map(domain => domain.size),
      imageKeys: imageKeys.size,
      imageClueCells: imageClueKeys.size,
      logicClueCells: logicClueKeys.size,
      arcRemovedOptions: arcDiagnostics.removedOptions ?? 0
    }
  };
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

  const sequenceIndex = Number.isSafeInteger(options.sequenceIndex) && options.sequenceIndex > 0
    ? options.sequenceIndex
    : null;
  // One single five-letter featured answer appears every fourth puzzle.
  // This replaces the former 11-letter boundary answer entirely.
  const wantsFeaturedShortQuestion = sequenceIndex !== null
    ? sequenceIndex % 4 === 0
    : random() < (options.featuredShortQuestionChance ?? CONFIG.FEATURED_SHORT_QUESTION_CHANCE);
  const normalTemplateSequence = Array.from({ length: 20 }, (_, index) => index);
  const normalTemplateOffset = seed % normalTemplateSequence.length;
  let bestDiagnostic = null;

  for (let attempt = 0; attempt < maxTopologies; attempt++) {
    const topologySeed = (seed + Math.imul(attempt + 1, 7919)) >>> 0;
    const selectedTemplateIndex = normalTemplateSequence[(normalTemplateOffset + attempt) % normalTemplateSequence.length];
    const topologyResult = generateTopology({
      seed: topologySeed,
      templateIndex: selectedTemplateIndex,
      includeSpecialEleven: false,
      featuredShortQuestion: wantsFeaturedShortQuestion,
      maxTwoLetterSlots: options.maxTwoLetterSlots ?? 5
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

    const domainPlan = prepareTopologyDomains(topology.slots, indexes, {
      foldYo: options.foldYo === true,
      requiredImageCount,
      minimumLogicClueCells
    });
    if (!domainPlan.ok) {
      countFailure(rejectedReasons, domainPlan.reason);
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: domainPlan.reason,
        ...(options.capturePlanDiagnostics ? { domainDiagnostics: domainPlan } : {})
      });
      bestDiagnostic = domainPlan;
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
      allowedDirections: Object.keys(DIRECTIONS),
      enforceBorderDirectionRules: true,
      history: options.history,
      signal: options.signal,
      repeatWordPenalty: options.repeatWordPenalty,
      repeatQuestionPenalty: options.repeatQuestionPenalty,
      allowedEntryIdsBySlot: domainPlan.allowedEntryIdsBySlot,
      captureTrace: options.captureTrace === true
    });

    if (!solved.ok) {
      countFailure(rejectedReasons, solved.reason);
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: solved.reason,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: solved.elapsedMs,
        lastDeadEnd: solved.lastDeadEnd,
        deepestDeadEnd: solved.deepestDeadEnd,
        ...(options.captureTrace && solved.searchTrace ? { searchTrace: solved.searchTrace } : {})
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
    const featuredShortWord = wantsFeaturedShortQuestion
      ? scanword.words.find(word => {
          if (word.length !== 5 || word.clue.row !== 0) return false;
          const vector = DIRECTIONS[word.direction];
          if (!vector) return false;
          const terminal = {
            row: word.clue.row + vector.dr * (word.length + 1),
            col: word.clue.col + vector.dc * (word.length + 1)
          };
          return terminal.row === 0
            && ((word.clue.col === 1 && terminal.col === 7)
              || (word.clue.col === 7 && terminal.col === 1));
        })
      : null;
    if (wantsFeaturedShortQuestion && !featuredShortWord) {
      countFailure(rejectedReasons, 'FEATURED_SHORT_QUESTION_NOT_ASSIGNED');
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: 'FEATURED_SHORT_QUESTION_NOT_ASSIGNED'
      });
      bestDiagnostic = { reason: 'FEATURED_SHORT_QUESTION_NOT_ASSIGNED' };
      continue;
    }
    if (featuredShortWord) featuredShortWord.featuredShortQuestion = true;
    scanword.metadata = {
      ...scanword.metadata,
      seed,
      sequenceIndex,
      topologySeed,
      topologyScaffold: topologyResult.scaffoldIndex,
      topologyTemplate: topologyResult.templateNumber ?? null,
      topologyAttempts: topologyResult.attempts,
      cspNodes: solved.nodes,
      cspElapsedMs: solved.elapsedMs,
      specialElevenLetterQuestion: false,
      featuredShortQuestion: featuredShortWord
        ? { wordId: featuredShortWord.id, answerLength: featuredShortWord.length }
        : null,
      valid: false,
      score: 0
    };

    const validation = validateScanword(scanword, inputDictionary, {
      foldYo: options.foldYo === true,
      requiredImageCount,
      minimumLogicClueCells,
      requireLeftBorderClues: true,
      requireTopAnchor: true,
      requireFullTopBorder: false,
      expectedFeaturedShortQuestion: wantsFeaturedShortQuestion ? 1 : 0,
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

    scanword.metadata.featuredShortQuestionRequested = wantsFeaturedShortQuestion;
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
        sequenceIndex,
        attempts: attempt + 1,
        topologyAttempts: topologyResult.attempts,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: Math.round(now() - started),
        cspElapsedMs: solved.elapsedMs,
        score,
        specialElevenLetterQuestion: false,
        specialElevenRequested: false,
        featuredShortQuestionRequested: wantsFeaturedShortQuestion,
        featuredShortQuestionGenerated: Boolean(featuredShortWord),
        featuredShortQuestionMissed: wantsFeaturedShortQuestion && !featuredShortWord,
        dictionary: prepared.stats,
        rejectedReasons: { ...rejectedReasons }
      }
    };
  }

  return fail('NO_VALID_SCANWORD', seed, started, attempts, rejectedReasons, {
    dictionaryStats: prepared.stats,
    lastDiagnostic: bestDiagnostic,
    requestedFeaturedShortQuestion: wantsFeaturedShortQuestion
  });
}
