import { CONFIG } from './config.js';
import { buildIndexes, canonicalAnswerKey, findCandidates, getDifficultyQuotaCounts, normalizeDifficultyBand, prepareDictionary } from './dictionary.js';
import { ALLOWED_SPECIAL_SHORT_ANSWERS, maximumDistinctAssignmentCount, solveSlotsCsp } from './csp.js';
import { assembleScanword } from './assembler.js';
import { validateScanword } from './validator.js';
import { generateTopology, getTopologyScaffolds } from './topology-builder.js';
import { analyzeRequiredBorderFeasibility } from './topology.js';
import { scoreScanword } from './scoring.js';
import { createRng } from './rng.js';

function now() {
  return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

export function canAssignDistinctShortAnswers(domains, options = {}) {
  const excludedAnswers = options.excludedAnswers ?? new Set();
  const foldYo = options.foldYo === true;
  const initialLetters = options.letterUses instanceof Map ? new Map(options.letterUses) : new Map();
  const workingLetters = new Map(initialLetters);
  const difficultyCounts = {
    2: Number(options.difficultyCounts?.[2] ?? 0),
    3: Number(options.difficultyCounts?.[3] ?? 0),
    4: Number(options.difficultyCounts?.[4] ?? 0)
  };
  const difficultyQuotas = options.difficultyQuotas ?? null;

  const ordered = domains.map(domain => {
    const unique = new Map();
    for (const candidate of domain) {
      const answerKey = typeof candidate === 'string'
        ? canonicalAnswerKey(candidate, { foldYo })
        : candidate.answerKey ?? canonicalAnswerKey(candidate.answer, { foldYo });
      if (!answerKey || excludedAnswers.has(answerKey) || !ALLOWED_SPECIAL_SHORT_ANSWERS.has(answerKey)) continue;
      const difficulty = typeof candidate === 'string'
        ? 3
        : normalizeDifficultyBand(candidate.difficulty);
      if (difficultyQuotas && difficultyCounts[difficulty] >= difficultyQuotas[difficulty]) continue;

      const coordinates = typeof candidate === 'string' ? [] : (candidate.coordinates ?? []);
      const answer = typeof candidate === 'string' ? candidate : candidate.answer;
      let compatible = true;
      for (let index = 0; index < coordinates.length; index++) {
        const point = coordinates[index];
        const key = point.row + ',' + point.col;
        const letter = foldYo && answer[index] === 'Ё' ? 'Е' : answer[index];
        const existing = workingLetters.get(key);
        if (existing !== undefined && existing !== letter) {
          compatible = false;
          break;
        }
      }
      if (!compatible) continue;

      const placementKey = answerKey + '|' + coordinates.map(point => point.row + ',' + point.col).join(';');
      if (!unique.has(placementKey)) unique.set(placementKey, {
        answerKey,
        answer,
        difficulty,
        coordinates
      });
    }
    return [...unique.values()];
  }).sort((a, b) => a.length - b.length);

  if (ordered.some(domain => domain.length === 0)) return false;

  const usedAnswers = new Set();
  function assign(index) {
    if (index === ordered.length) return true;

    for (const candidate of ordered[index]) {
      if (usedAnswers.has(candidate.answerKey)) continue;
      const band = candidate.difficulty;
      if (difficultyQuotas && difficultyCounts[band] >= difficultyQuotas[band]) continue;

      let compatible = true;
      const addedKeys = [];
      for (let position = 0; position < candidate.coordinates.length; position++) {
        const point = candidate.coordinates[position];
        const key = point.row + ',' + point.col;
        const letter = foldYo && candidate.answer[position] === 'Ё' ? 'Е' : candidate.answer[position];
        const existing = workingLetters.get(key);
        if (existing !== undefined && existing !== letter) {
          compatible = false;
          break;
        }
        if (existing === undefined) {
          workingLetters.set(key, letter);
          addedKeys.push(key);
        }
      }

      if (compatible) {
        usedAnswers.add(candidate.answerKey);
        difficultyCounts[band]++;
        if (assign(index + 1)) return true;
        difficultyCounts[band]--;
        usedAnswers.delete(candidate.answerKey);
      }
      for (const key of addedKeys) workingLetters.delete(key);
    }
    return false;
  }

  return assign(0);
}
function chooseCompatibleImageSelection(domains, requiredImageCount, specialEntry, foldYo = false, maxNodes = 2500, difficultyQuotas = null, shortDomains = []) {
  const specialAnswerKey = canonicalAnswerKey(specialEntry.answer, { foldYo });
  const specialHasImage = Boolean(specialEntry.imageKey);
  const specialClueKey = '0,1';
  const specialLetters = new Map([...specialEntry.answer].map((letter, index) => [
    (index + 1) + ',1',
    foldYo && letter === 'Ё' ? 'Е' : letter
  ]));
  const required = Math.max(0, requiredImageCount - (specialHasImage ? 1 : 0));
  if (required === 0) return [];

  const domainsWithImages = domains.map(domain => {
    const seen = new Set();
    const options = [];
    for (const option of domain.options) {
      const entry = option.entry;
      if (!entry.imageKey || entry.imageKey === specialEntry.imageKey) continue;
      const answerKey = canonicalAnswerKey(entry.answer, { foldYo });
      const clueKey = option.clueCell.row + ',' + option.clueCell.col;
      const directionKey = clueKey + '|' + option.direction;
      const identity = answerKey + '|' + directionKey + '|' + entry.imageKey;
      if (seen.has(identity)) continue;
      seen.add(identity);
      options.push({
        ...option,
        slotId: domain.slot.id,
        answerKey,
        clueKey,
        directionKey
      });
    }
    return { slotId: domain.slot.id, options };
  }).filter(domain => domain.options.length);

  const selected = [];
  const usedAssets = new Set(specialHasImage ? [specialEntry.imageKey] : []);
  // Track image answers separately from the remaining two-letter matching.
  // A picture may use a two-letter word only when every short slot still has
  // a distinct, letter-compatible answer after that picture is placed.
  const usedAnswers = new Set([specialAnswerKey]);
  const plannedDifficultyQuotas = difficultyQuotas ?? getDifficultyQuotaCounts(domains.length + 1);
  const usedDifficultyCounts = { 2: 0, 3: 0, 4: 0 };
  usedDifficultyCounts[normalizeDifficultyBand(specialEntry.difficulty)]++;
  const usedClues = new Set(specialHasImage ? [specialClueKey] : []);
  const usedDirections = new Set([specialClueKey + '|down']);
  const letterUses = new Map(specialLetters);
  let nodes = 0;

  const canAdd = candidate => {
    if (usedAssets.has(candidate.entry.imageKey)
      || usedAnswers.has(candidate.answerKey)
      || usedClues.has(candidate.clueKey)
      || usedDirections.has(candidate.directionKey)) return false;
    const difficultyBand = normalizeDifficultyBand(candidate.entry.difficulty);
    if (usedDifficultyCounts[difficultyBand] >= plannedDifficultyQuotas[difficultyBand]) return false;
    for (let index = 0; index < candidate.coordinates.length; index++) {
      const point = candidate.coordinates[index];
      const key = point.row + ',' + point.col;
      const letter = foldYo && candidate.entry.answer[index] === 'Ё'
        ? 'Е'
        : candidate.entry.answer[index];
      const existing = letterUses.get(key);
      if (existing !== undefined && existing !== letter) return false;
    }
    return true;
  };

  const add = candidate => {
    usedAssets.add(candidate.entry.imageKey);
    usedAnswers.add(candidate.answerKey);
    usedDifficultyCounts[normalizeDifficultyBand(candidate.entry.difficulty)]++;
    usedClues.add(candidate.clueKey);
    usedDirections.add(candidate.directionKey);
    const added = [];
    for (let index = 0; index < candidate.coordinates.length; index++) {
      const point = candidate.coordinates[index];
      const key = point.row + ',' + point.col;
      if (!letterUses.has(key)) {
        const letter = foldYo && candidate.entry.answer[index] === 'Ё'
          ? 'Е'
          : candidate.entry.answer[index];
        letterUses.set(key, letter);
        added.push(key);
      }
    }
    selected.push(candidate);
    return added;
  };

  const undo = (candidate, added) => {
    selected.pop();
    usedAssets.delete(candidate.entry.imageKey);
    usedAnswers.delete(candidate.answerKey);
    const difficultyBand = normalizeDifficultyBand(candidate.entry.difficulty);
    usedDifficultyCounts[difficultyBand] = Math.max(0, usedDifficultyCounts[difficultyBand] - 1);
    usedClues.delete(candidate.clueKey);
    usedDirections.delete(candidate.directionKey);
    for (const key of added) letterUses.delete(key);
  };

  function search(remainingDomains) {
    if (selected.length >= required) return true;
    if (nodes++ >= maxNodes || selected.length + remainingDomains.length < required) return false;

    const viableDomains = [];
    for (const domain of remainingDomains) {
      const candidates = domain.options.filter(canAdd);
      if (candidates.length) viableDomains.push({ ...domain, candidates });
    }
    const needed = required - selected.length;
    if (viableDomains.length < needed) return false;

    const assetDomains = viableDomains.map(domain =>
      [...new Set(domain.candidates.map(candidate => candidate.entry.imageKey))]
    );
    const answerDomains = viableDomains.map(domain =>
      [...new Set(domain.candidates.map(candidate => candidate.answerKey))]
    );
    const clueDomains = viableDomains.map(domain =>
      [...new Set(domain.candidates.map(candidate => candidate.clueKey))]
    );
    if (maximumDistinctAssignmentCount(assetDomains) < needed
      || maximumDistinctAssignmentCount(answerDomains) < needed
      || maximumDistinctAssignmentCount(clueDomains) < needed) return false;

    viableDomains.sort((a, b) =>
      a.candidates.length - b.candidates.length
      || a.slotId.localeCompare(b.slotId)
    );
    const chosen = viableDomains[0];
    const rest = remainingDomains.filter(domain => domain.slotId !== chosen.slotId);

    for (const candidate of chosen.candidates) {
      const added = add(candidate);
      const shortAnswersRemainFeasible = canAssignDistinctShortAnswers(shortDomains, {
        excludedAnswers: usedAnswers,
        letterUses,
        difficultyCounts: usedDifficultyCounts,
        difficultyQuotas: plannedDifficultyQuotas,
        foldYo
      });
      if (shortAnswersRemainFeasible && search(rest)) return true;
      undo(candidate, added);
    }

    return search(rest);
  }

  return search(domainsWithImages) ? selected.map(candidate => ({
    slotId: candidate.slotId,
    entryId: candidate.entry.id,
    answer: candidate.entry.answer,
    imageKey: candidate.entry.imageKey,
    clueCell: { ...candidate.clueCell },
    direction: candidate.direction
  })) : null;
}

export function enforceCrossingArcConsistency(domains, foldYo = false, diagnostics = null) {
  // Intersections are physical cells, not positional indices. A left/up
  // orientation reverses answer order while the canonical slot coordinates
  // remain left-to-right/top-to-bottom. AC-3 must compare by coordinate.
  const cellKeys = domains.map(domain =>
    new Set(domain.slot.coordinates.map(point => point.row + ',' + point.col))
  );
  const neighbors = domains.map(() => []);

  for (let left = 0; left < domains.length; left++) {
    for (let right = left + 1; right < domains.length; right++) {
      const sharedKeys = [...cellKeys[left]].filter(key => cellKeys[right].has(key));
      if (!sharedKeys.length) continue;
      neighbors[left].push({ other: right, sharedKeys });
      neighbors[right].push({ other: left, sharedKeys });
    }
  }

  const letterKey = value => foldYo && value === 'Ё' ? 'Е' : value;
  const signatureFor = (option, domain, sharedKeys) => {
    const coordinates = Array.isArray(option.coordinates)
      && option.coordinates.length === option.entry.answer.length
      ? option.coordinates
      : domain.slot.coordinates;
    const lettersByCell = new Map();
    for (let index = 0; index < coordinates.length; index++) {
      const point = coordinates[index];
      lettersByCell.set(point.row + ',' + point.col, letterKey(option.entry.answer[index]));
    }
    return sharedKeys.map(key => lettersByCell.get(key) ?? '\u0000').join('');
  };

  const queue = [];
  for (let self = 0; self < neighbors.length; self++) {
    for (const relation of neighbors[self]) {
      queue.push({ self, other: relation.other, sharedKeys: relation.sharedKeys });
    }
  }

  // Cursor-based queue avoids repeated array shifts as AC-3 re-enqueues arcs.
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const arc = queue[cursor];
    const ownDomain = domains[arc.self];
    const otherDomain = domains[arc.other];
    const supportedSignatures = new Set(otherDomain.options.map(option =>
      signatureFor(option, otherDomain, arc.sharedKeys)
    ));

    const revised = ownDomain.options.filter(option =>
      supportedSignatures.has(signatureFor(option, ownDomain, arc.sharedKeys))
    );
    if (revised.length === ownDomain.options.length) continue;

    const removedCount = ownDomain.options.length - revised.length;
    if (diagnostics) diagnostics.removedOptions = (diagnostics.removedOptions ?? 0) + removedCount;
    ownDomain.options = revised;
    if (!revised.length) {
      if (diagnostics) {
        diagnostics.failure = {
          slotId: ownDomain.slot.id,
          againstSlotId: otherDomain.slot.id,
          sharedCells: [...arc.sharedKeys],
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

function chooseSpecialElevenPlan(entries, random, foldYo = false, indexes, requirements = {}) {
  if (!indexes) return null;
  const normalizeInitial = letter => foldYo && letter === 'Ё' ? 'Е' : letter;
  const requiredImageCount = requirements.requiredImageCount ?? 5;
  const minimumLogicClueCells = requirements.minimumLogicClueCells ?? 3;
  // The old split-row loop generated many nominally different plans that
  // actually reused the same three fixed masks. Sample a compact, reproducible
  // set of layouts and use a row-derived seed so validated internal mutations
  // produce genuinely different crossing lengths while preserving columns 1..3.
  const rowPatterns = [
    [3, 7, 10], [3, 7, 11], [3, 8, 10], [3, 8, 11],
    [3, 9, 11], [4, 7, 10], [4, 7, 11], [4, 8, 10],
    [4, 8, 11], [5, 8, 10], [5, 8, 11], [5, 9, 11]
  ];

  const topologySignatures = new Set();
  const topologies = [];
  for (const rows of rowPatterns) {
    const seed = rows.reduce((value, row) => Math.imul(value ^ row, 16777619), 2166136261) >>> 0;
    const result = generateTopology({
      seed,
      includeSpecialEleven: true,
      specialSplitRows: rows,
      mutationBudget: 48,
      maxAttempts: 1,
      maxTwoLetterSlots: requirements.maxTwoLetterSlots ?? 5
    });
    if (!result.ok) continue;
    const signature = result.topology.pattern.join('/');
    if (topologySignatures.has(signature)) continue;
    topologySignatures.add(signature);
    topologies.push({
      rows,
      patternKey: 'split-' + rows.join('-'),
      // Reuse this exact mask during the production CSP pass. A new seed must
      // never silently change the slots after their domains were precomputed.
      specialPattern: result.topology.pattern,
      result
    });
  }

  // The independently audited two-short-slot layout is valid only when its
  // eleven-letter boundary answer is present. Keep it as a dedicated CSP
  // candidate instead of trying to use it for ordinary disconnected boards.
  const lowShortPattern = getTopologyScaffolds()[3];
  for (let sample = 0; sample < 8; sample++) {
    const seed = 9127 + sample * 65537;
    const lowShortTopology = generateTopology({
      seed,
      includeSpecialEleven: true,
      specialPattern: lowShortPattern,
      mutateSpecialPattern: true,
      mutationBudget: 48,
      maxAttempts: 1,
      maxTwoLetterSlots: 4
    });
    if (!lowShortTopology.ok) continue;
    const signature = lowShortTopology.topology.pattern.join('/');
    if (topologySignatures.has(signature)) continue;
    topologySignatures.add(signature);
    topologies.push({
      rows: [3, 7, 11],
      patternKey: 'low-short-' + sample,
      specialPattern: lowShortTopology.topology.pattern,
      result: lowShortTopology
    });
  }

  const plans = [];
  const uniqueAnswers = new Set();
  const planDiagnostics = {
    elevenLetterAnswers: 0,
    topologiesConsidered: topologies.length,
    missingSlotDomains: 0,
    arcConsistencyRejected: 0,
    shortAnswerMatchingRejected: 0,
    contentRequirementsRejected: 0,
    imageAssignmentRejected: 0,
    viablePlans: 0,
    distinctSpecialAnswers: 0,
    distinctTopologyPatterns: topologies.length
  };

  for (const entry of entries) {
    if (entry.answer.length !== 11) continue;
    planDiagnostics.elevenLetterAnswers++;
    const answerKey = canonicalAnswerKey(entry.answer, { foldYo });
    if (uniqueAnswers.has(answerKey)) continue;
    uniqueAnswers.add(answerKey);

    const letters = [...entry.answer].map(normalizeInitial);
    const imposedLetters = new Map(letters.map((letter, index) => [
      (index + 1) + ',1',
      letter
    ]));

    for (const topology of topologies) {
      const domains = [];
      let valid = true;

      for (const slot of topology.result.topology.slots) {
        if (slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') continue;

        const candidatesById = new Map();
        for (const orientation of slot.directionOptions) {
          if (slot.requiredDirection && orientation.direction !== slot.requiredDirection) continue;
          if (!['right', 'left', 'down', 'up'].includes(orientation.direction)) continue;
          const constraints = [];
          orientation.coordinates.forEach((point, position) => {
            const imposed = imposedLetters.get(point.row + ',' + point.col);
            if (imposed !== undefined) constraints.push({ position, letter: imposed });
          });

          const candidates = findCandidates(indexes, slot.length, constraints);
          for (const candidate of candidates) {
            // The fixed eleven-letter answer is already reserved for the
            // special slot and cannot be counted again in another capacity.
            if (canonicalAnswerKey(candidate.answer, { foldYo }) === answerKey) continue;
            if (slot.length === 2
              && !ALLOWED_SPECIAL_SHORT_ANSWERS.has(canonicalAnswerKey(candidate.answer, { foldYo }))) {
              continue;
            }
            candidatesById.set(candidate.id + '|' + orientation.direction, {
              entry: candidate,
              clueCell: { ...orientation.clueCell },
              direction: orientation.direction,
              coordinates: orientation.coordinates
            });
          }
        }

        const candidates = [...candidatesById.values()];
        if (!candidates.length) {
          valid = false;
          break;
        }
        domains.push({ slot, options: candidates });
      }

      // Independent word domains can all look valid while their crossing
      // letters are mutually impossible. Enforce arc consistency across the
      // complete slot graph before ranking a special 11-letter plan.
      if (!valid) {
        planDiagnostics.missingSlotDomains++;
        continue;
      }
      const arcDiagnostics = {};
      if (!enforceCrossingArcConsistency(domains, foldYo, arcDiagnostics)) {
        planDiagnostics.arcConsistencyRejected++;
        if (!planDiagnostics.firstArcFailure) {
          planDiagnostics.firstArcFailure = {
            answer: entry.answer,
            rows: topology.rows,
            ...arcDiagnostics
          };
        }
        continue;
      }

      const specialClueKey = '0,1';
      const specialHasImage = Boolean(entry.imageKey);
      const specialHasLogic = entry.logic === true;
      const specialDifficultyBand = normalizeDifficultyBand(entry.difficulty);
      const difficultyQuotas = getDifficultyQuotaCounts(domains.length + 1, requirements.difficultyDistribution);
      const initialDifficultyCounts = { 2: 0, 3: 0, 4: 0 };
      initialDifficultyCounts[specialDifficultyBand]++;

      const shortDomains = domains
        .filter(domain => domain.slot.length === 2)
        .map(domain => domain.options.map(option => ({
          answerKey: canonicalAnswerKey(option.entry.answer, { foldYo }),
          answer: option.entry.answer,
          difficulty: normalizeDifficultyBand(option.entry.difficulty),
          coordinates: option.coordinates
        })));
      const specialLetters = new Map([...entry.answer].map((letter, index) => [
        (index + 1) + ',1',
        foldYo && letter === 'Ё' ? 'Е' : letter
      ]));
      if (!canAssignDistinctShortAnswers(shortDomains, {
        excludedAnswers: new Set([canonicalAnswerKey(entry.answer, { foldYo })]),
        letterUses: specialLetters,
        difficultyCounts: initialDifficultyCounts,
        difficultyQuotas,
        foldYo
      })) {
        planDiagnostics.shortAnswerMatchingRejected++;
        continue;
      }
      const imageKeys = new Set(specialHasImage ? [entry.imageKey] : []);
      const imageDomains = [];
      const imageClueCellDomains = [];
      const logicClueCellDomains = [];
      const difficultyDomains = { 2: [], 3: [], 4: [] };
      let minimumDomain = Infinity;
      let totalDomain = 0;
      for (const domain of domains) {
        const answerCount = new Set(domain.options.map(option =>
          canonicalAnswerKey(option.entry.answer, { foldYo })
        )).size;
        minimumDomain = Math.min(minimumDomain, answerCount);
        totalDomain += Math.min(answerCount, 40);

        const candidateImageKeys = new Set();
        const candidateImageClueCells = new Set();
        const candidateLogicClueCells = new Set();
        const candidateDifficultyIds = { 2: new Set(), 3: new Set(), 4: new Set() };
        for (const option of domain.options) {
          const clueKey = option.clueCell.row + ',' + option.clueCell.col;
          if (option.entry.imageKey && option.entry.imageKey !== entry.imageKey) {
            imageKeys.add(option.entry.imageKey);
            candidateImageKeys.add(option.entry.imageKey);
            if (!(specialHasImage && clueKey === specialClueKey)) {
              candidateImageClueCells.add(clueKey);
            }
          }
          if (option.entry.logic === true
            && !(specialHasLogic && clueKey === specialClueKey)) {
            candidateLogicClueCells.add(clueKey);
          }
          candidateDifficultyIds[normalizeDifficultyBand(option.entry.difficulty)].add(canonicalAnswerKey(option.entry.answer, { foldYo }));
        }
        if (candidateImageKeys.size) imageDomains.push([...candidateImageKeys]);
        if (candidateImageClueCells.size) imageClueCellDomains.push([...candidateImageClueCells]);
        if (candidateLogicClueCells.size) logicClueCellDomains.push([...candidateLogicClueCells]);
        for (const level of [2, 3, 4]) {
          if (candidateDifficultyIds[level].size) difficultyDomains[level].push([...candidateDifficultyIds[level]]);
        }
      }

      const imageAssignmentCapacity = maximumDistinctAssignmentCount(imageDomains);
      const imageClueCellCapacity = maximumDistinctAssignmentCount(imageClueCellDomains);
      const logicClueCellCapacity = maximumDistinctAssignmentCount(logicClueCellDomains);
      const difficultyCapacities = {
        2: maximumDistinctAssignmentCount(difficultyDomains[2]) + (specialDifficultyBand === 2 ? 1 : 0),
        3: maximumDistinctAssignmentCount(difficultyDomains[3]) + (specialDifficultyBand === 3 ? 1 : 0),
        4: maximumDistinctAssignmentCount(difficultyDomains[4]) + (specialDifficultyBand === 4 ? 1 : 0)
      };
      const difficultyCapacityValid = [2, 3, 4].every(level =>
        difficultyCapacities[level] >= difficultyQuotas[level]
      );
      const imageCapacityValid = imageAssignmentCapacity + (specialHasImage ? 1 : 0) >= requiredImageCount
        && imageClueCellCapacity + (specialHasImage ? 1 : 0) >= requiredImageCount;
      const logicCapacityValid = logicClueCellCapacity + (specialHasLogic ? 1 : 0) >= minimumLogicClueCells;

      if (!imageCapacityValid || !logicCapacityValid || !difficultyCapacityValid) {
        planDiagnostics.contentRequirementsRejected++;
        if (!planDiagnostics.firstContentFailure) {
          planDiagnostics.firstContentFailure = {
            answer: entry.answer,
            rows: topology.rows,
            distinctImageKeys: imageKeys.size,
            imageAssignmentCapacity,
            imageClueCellCapacity,
            requiredImageCount,
            logicClueCellCapacity,
            minimumLogicClueCells,
            difficultyCapacities,
            difficultyQuotas,
            domains: domains.map(domain => ({
              slotId: domain.slot.id,
              length: domain.slot.length,
              candidateCount: domain.options.length,
              imageKeys: [...new Set(domain.options.map(option => option.entry.imageKey).filter(Boolean))],
              imageClueCells: [...new Set(domain.options.filter(option => option.entry.imageKey).map(option =>
                option.clueCell.row + ',' + option.clueCell.col
              ))],
              logicClueCells: [...new Set(domain.options.filter(option => option.entry.logic === true).map(option =>
                option.clueCell.row + ',' + option.clueCell.col
              ))]
            }))
          };
        }
        continue;
      }

      const compatibleImageSelection = chooseCompatibleImageSelection(
        domains,
        requiredImageCount,
        entry,
        foldYo,
        requirements.imageSelectionSearchNodes ?? 2500,
        difficultyQuotas,
        shortDomains
      );
      if (!compatibleImageSelection) {
        planDiagnostics.imageAssignmentRejected++;
        continue;
      }

      plans.push({
        answer: entry.answer,
        answerDifficultyBand: normalizeDifficultyBand(entry.difficulty),
        rows: topology.rows,
        patternKey: topology.patternKey ?? ('split-' + topology.rows.join('-')),
        specialPattern: topology.specialPattern ?? topology.result.topology.pattern,
        // Preserve the AC-3-pruned dictionary domains so the production CSP
        // does not reopen candidates already proven incompatible at crossings.
        allowedEntryIdsBySlot: new Map(domains.map(domain => [
          domain.slot.id,
          new Set(domain.options.map(option => option.entry.id))
        ])),
        // Preserve AC-3-approved orientations as well as entry IDs. Otherwise
        // the CSP can reopen a reversed placement that AC-3 already removed.
        allowedPlacementKeysBySlot: new Map(domains.map(domain => [
          domain.slot.id,
          new Set(domain.options.map(option =>
            option.entry.id + '|' + option.direction + '|' + option.clueCell.row + ',' + option.clueCell.col
          ))
        ])),
        preferredImagePlacementsBySlot: new Map(compatibleImageSelection.map(item => [
          item.slotId,
          {
            entryId: item.entryId,
            clueKey: item.clueCell.row + ',' + item.clueCell.col,
            direction: item.direction
          }
        ])),
        // Prefer grade-seven medium/easy long answers when geometry is
        // otherwise comparable; do not let a specialist 11-letter word win
        // solely because its crossing domains happen to be broader.
        score: minimumDomain * 100000 + totalDomain * 100
          + (imageAssignmentCapacity + (specialHasImage ? 1 : 0)) * 10000
          + (imageClueCellCapacity + (specialHasImage ? 1 : 0)) * 1000
          + (logicClueCellCapacity + (specialHasLogic ? 1 : 0)) * 100
          + (specialDifficultyBand === 3 ? 50000
            : specialDifficultyBand === 2 ? 25000 : 0),
        tie: random()
      });
    }
  }

  planDiagnostics.viablePlans = plans.length;
  planDiagnostics.distinctSpecialAnswers = new Set(plans.map(plan => canonicalAnswerKey(plan.answer, { foldYo }))).size;
  planDiagnostics.noCompatiblePlans = plans.length === 0;
  if (requirements.planDiagnostics) Object.assign(requirements.planDiagnostics, planDiagnostics);
  if (!plans.length) return null;

  // Keep the strongest topology for each answer first, then interleave the
  // next-best topologies. This prevents the first bounded CSP retries from
  // spending their entire budget on near-identical layouts for one word.
  plans.sort((a, b) => b.score - a.score || a.tie - b.tie);
  const plansByAnswer = new Map();
  for (const plan of plans) {
    const key = canonicalAnswerKey(plan.answer, { foldYo });
    if (!plansByAnswer.has(key)) plansByAnswer.set(key, []);
    plansByAnswer.get(key).push(plan);
  }
  const answerGroups = [...plansByAnswer.values()];
  const interleavedPlans = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const group of answerGroups) {
      if (group[round]) {
        interleavedPlans.push(group[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  const rankedPlans = interleavedPlans.map(plan => ({
    answer: plan.answer,
    answerDifficultyBand: plan.answerDifficultyBand,
    rows: plan.rows,
    patternKey: plan.patternKey,
    specialPattern: plan.specialPattern,
    allowedEntryIdsBySlot: plan.allowedEntryIdsBySlot,
    allowedPlacementKeysBySlot: plan.allowedPlacementKeysBySlot,
    preferredImagePlacementsBySlot: plan.preferredImagePlacementsBySlot,
    score: plan.score,
    planKey: canonicalAnswerKey(plan.answer, { foldYo }) + '|' + plan.rows.join(',') + '|' + plan.patternKey
  }));
  if (requirements.returnAllPlans === true) return rankedPlans;
  return rankedPlans[0] ?? null;
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
export function shouldRequestSpecialElevenLetter(sequenceIndex, randomValue, chance = CONFIG.SPECIAL_ELEVEN_LETTER_CHANCE) {
  if (Number.isSafeInteger(sequenceIndex) && sequenceIndex > 0) return sequenceIndex % 5 === 0;
  const probability = Number.isFinite(Number(chance)) ? Math.max(0, Math.min(1, Number(chance))) : CONFIG.SPECIAL_ELEVEN_LETTER_CHANCE;
  return Number.isFinite(Number(randomValue)) && Number(randomValue) < probability;
}

export function generateScanword(inputDictionary, options = {}) {
  const started = now();
  const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) >>> 0 : Date.now() >>> 0;
  const random = createRng(seed);
  const maxTopologies = Math.max(1, Math.min(64, options.maxTopologyAttempts ?? 16));
  const maxNodes = Math.max(500, options.maxNodes ?? 120000);
  const maxCspTimeMs = Math.max(25, options.maxCspTimeMs ?? 450);
  // Special 11-letter puzzles need a little more CSP time: the full word
  // constrains every left-to-right crossing. Keep ordinary puzzles on the
  // normal interactive budget; cap special retries so the worker stays bounded.
  const specialMaxCspTimeMs = Math.max(
    maxCspTimeMs,
    Number.isFinite(options.specialMaxCspTimeMs) ? options.specialMaxCspTimeMs : 1500
  );
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const rejectedReasons = Object.create(null);
  const attempts = [];

  if (options.requireFullTopRow === true) {
    const feasibility = analyzeRequiredBorderFeasibility({ requireFullTopRow: true });
    return fail(feasibility.reason, seed, started, attempts, rejectedReasons, { feasibility, message: feasibility.message });
  }

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
  const sequenceIndex = Number.isSafeInteger(options.sequenceIndex) && options.sequenceIndex > 0
    ? options.sequenceIndex
    : null;
  // Production uses a five-puzzle cadence: the special boundary answer
  // appears no more than once in every five generated scanwords.
  // Direct callers without a sequence index use the matching 20% fallback.
  const wantsEleven = hasElevenLetterAnswers && (
    sequenceIndex !== null
      ? shouldRequestSpecialElevenLetter(sequenceIndex)
      : shouldRequestSpecialElevenLetter(
          null,
          random(),
          options.specialElevenLetterChance ?? CONFIG.SPECIAL_ELEVEN_LETTER_CHANCE
        )
  );
  // Build and rank the compatible special plan pool once per puzzle. Re-running
  // the full dictionary/topology arc-consistency pass for every retry was
  // unnecessary work and could consume most of the worker's 16-second limit.
  const specialPlanDiagnostics = {};
  const specialPlanPool = wantsEleven
    ? (chooseSpecialElevenPlan(prepared.entries, random, options.foldYo === true, indexes, {
        ...options,
        returnAllPlans: true,
        planDiagnostics: options.capturePlanDiagnostics ? specialPlanDiagnostics : null
      }) ?? [])
    : [];

  // Prefer exactly one low-short topology attempt when it has a compatible
  // dictionary/CSP domain, then retain the best conventional topology as the
  // bounded fallback. Do not spend both retries on near-identical templates.
  const firstLowShortPlan = specialPlanPool.find(plan => plan.patternKey.startsWith('low-short'));
  const conventionalSpecialPlans = specialPlanPool.filter(plan => !plan.patternKey.startsWith('low-short'));
  const additionalLowShortPlans = specialPlanPool.filter(plan =>
    plan.patternKey.startsWith('low-short') && plan !== firstLowShortPlan
  );
  const specialPlanSequence = firstLowShortPlan
    ? [firstLowShortPlan, ...conventionalSpecialPlans, ...additionalLowShortPlans]
    : specialPlanPool;
  if (options.capturePlanDiagnostics) {
    specialPlanDiagnostics.lowShortViablePlans = specialPlanPool.filter(plan => plan.patternKey.startsWith('low-short')).length;
  }

  // In the 100-seed production batch, four retries still left 11/33
  // requested special puzzles unsolved and pushed p95 generation beyond 6s.
  // The first ranked plan is the useful attempt; failed later plans only
  // multiplied the wait before the already-working standard fallback.
  const specialPlanOffset = Math.max(0, Math.min(
    specialPlanSequence.length,
    Number.isInteger(options.specialPlanOffset) ? options.specialPlanOffset : 0
  ));
  const specialAttempts = wantsEleven
    ? Math.min(maxTopologies, options.specialTopologyAttempts ?? 2, specialPlanSequence.length - specialPlanOffset)
    : 0;
  let bestDiagnostic = null;
  const specialElevenPlanDiagnostics = [];

  for (let attempt = 0; attempt < maxTopologies; attempt++) {
    const useSpecial = wantsEleven && attempt < specialAttempts;
    const specialPlan = useSpecial ? specialPlanSequence[specialPlanOffset + attempt] ?? null : null;
    if (useSpecial && options.capturePlanDiagnostics) {
      specialElevenPlanDiagnostics.push({
        attempt: attempt + 1,
        selected: Boolean(specialPlan),
        selectedAnswer: specialPlan?.answer ?? null,
        selectedRows: specialPlan?.rows ?? null,
        selectedPlanKey: specialPlan?.planKey ?? null,
        selectedPlanIndex: specialPlanOffset + attempt,
        excludedPlanCount: specialPlanOffset + attempt + 1,
        viablePlans: specialPlanPool.length,
        lowShortViablePlans: specialPlanDiagnostics.lowShortViablePlans ?? null,
        ...(attempt === 0 ? specialPlanDiagnostics : {})
      });
    }
    const useSpecialTopology = Boolean(specialPlan);
    const topologySeed = (seed + Math.imul(attempt + 1, 7919)) >>> 0;
    const topologyResult = generateTopology({
      seed: topologySeed,
      includeSpecialEleven: useSpecialTopology,
      specialSplitRows: specialPlan?.rows,
      specialPattern: specialPlan?.specialPattern,
      maxAttempts: options.topologyMutationAttempts ?? 96,
      maxTwoLetterSlots: useSpecialTopology
        ? (specialPlan?.patternKey === 'low-short' ? 4 : options.specialMaxTwoLetterSlots ?? 5)
        : (options.maxTwoLetterSlots ?? 5)
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

    const plannedImageDiagnostics = options.capturePlanDiagnostics && specialPlan
      ? [...(specialPlan.preferredImagePlacementsBySlot ?? new Map()).entries()].map(([slotId, placement]) => {
          const slot = topology.slots.find(item => item.id === slotId);
          const orientation = slot?.directionOptions.find(option =>
            option.direction === placement.direction
            && option.clueCell.row === Number(placement.clueKey.split(',')[0])
            && option.clueCell.col === Number(placement.clueKey.split(',')[1])
          );
          const allowedIds = specialPlan.allowedEntryIdsBySlot?.get(slotId);
          return {
            slotId,
            entryId: placement.entryId,
            clueKey: placement.clueKey,
            direction: placement.direction,
            slotExists: Boolean(slot),
            orientationExists: Boolean(orientation),
            entryAllowed: Boolean(allowedIds?.has(placement.entryId))
          };
        })
      : null;

    const cspSeed = (seed ^ Math.imul(attempt + 1, 104729)) >>> 0;
    const solved = solveSlotsCsp(topology.slots, inputDictionary, {
      seed: cspSeed,
      foldYo: options.foldYo === true,
      preparedDictionary: prepared,
      indexes,
      maxNodes,
      maxTimeMs: useSpecialTopology ? specialMaxCspTimeMs : maxCspTimeMs,
      requiredImageCount,
      minimumLogicClueCells,
      requireEveryClueStarts: false,
      requireDifficultyBalance: true,
      difficultyDistribution: options.difficultyDistribution,
      allowedDirections: ['right', 'left', 'down', 'up'],
      history: options.history,
      signal: options.signal,
      repeatWordPenalty: options.repeatWordPenalty,
      repeatQuestionPenalty: options.repeatQuestionPenalty,
      preferredSpecialAnswer: specialPlan?.answer,
      allowedEntryIdsBySlot: specialPlan?.allowedEntryIdsBySlot,
      allowedPlacementKeysBySlot: specialPlan?.allowedPlacementKeysBySlot,
      preferredImagePlacementsBySlot: specialPlan?.preferredImagePlacementsBySlot,
      enforcePreferredImagePlacements: useSpecialTopology,
      captureTrace: options.captureTrace === true
    });

    if (!solved.ok) {
      countFailure(rejectedReasons, solved.reason);
      attempts.push({
        attempt: attempt + 1,
        seed: topologySeed,
        reason: solved.reason,
        specialAnswer: specialPlan?.answer ?? null,
        specialSplitRows: specialPlan?.rows ?? null,
        specialPlanKey: specialPlan?.planKey ?? null,
        specialPatternKey: specialPlan?.patternKey ?? null,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: solved.elapsedMs,
        lastDeadEnd: solved.lastDeadEnd,
        deepestDeadEnd: solved.deepestDeadEnd,
        ...(options.captureTrace && solved.searchTrace ? { searchTrace: solved.searchTrace } : {}),
        ...(plannedImageDiagnostics ? { plannedImageDiagnostics } : {})
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
      sequenceIndex,
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
      requireConnected: true,
      requireDifficultyBalance: true,
      difficultyDistribution: options.difficultyDistribution
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
        sequenceIndex,
        attempts: attempt + 1,
        topologyAttempts: topologyResult.attempts,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: Math.round(now() - started),
        cspElapsedMs: solved.elapsedMs,
        score,
        difficultyCounts: solved.difficultyCounts,
        difficultyQuotas: solved.difficultyQuotas,
        specialElevenLetterQuestion: scanword.metadata.specialElevenLetterQuestion,
        specialElevenRequested: wantsEleven,
        specialElevenMissed: wantsEleven && !scanword.metadata.specialElevenLetterQuestion,
        specialElevenAttempted: specialAttempts,
        specialElevenFailureDiagnostics: specialElevenAttemptDiagnostics,
        ...(options.capturePlanDiagnostics ? { specialElevenPlanDiagnostics } : {}),
        dictionary: prepared.stats,
        rejectedReasons: { ...rejectedReasons }
      }
    };
  }

  return fail('NO_VALID_SCANWORD', seed, started, attempts, rejectedReasons, {
    dictionaryStats: prepared.stats,
    lastDiagnostic: bestDiagnostic,
    requestedSpecialEleven: wantsEleven,
    specialElevenPlanDiagnostics: wantsEleven ? specialPlanDiagnostics : null,
    specialElevenPlanCount: specialPlanPool.length,
    specialElevenAttemptCount: specialAttempts
  });
}
