import { CONFIG, DIRECTIONS } from './config.js';
import { buildIndexes, findCandidates, normalizeQuestion, prepareDictionary } from './dictionary.js';
import { createRng, shuffle } from './rng.js';

function pointKey(point) {
  return point.row + ',' + point.col;
}

function crossingConstraints(orientation, letters) {
  const constraints = [];
  for (let position = 0; position < orientation.coordinates.length; position++) {
    const coordinate = orientation.coordinates[position];
    const letter = letters.get(pointKey(coordinate));
    if (letter !== undefined) constraints.push({ position, letter });
  }
  return constraints;
}

function validateSlotGeometry(slot) {
  if (
    !slot
    || !Array.isArray(slot.endpoints)
    || slot.endpoints.length !== 2
    || !Array.isArray(slot.coordinates)
    || slot.coordinates.length !== slot.length
  ) return false;
  const firstKey = pointKey(slot.endpoints[0]);
  const lastKey = pointKey(slot.endpoints[1]);

  if (slot.special === 'ELEVEN_LETTER_BOTTOM_BOUNDARY') {
    if (
      slot.length !== 11
      || slot.directionOptions.length !== 1
      || pointKey(slot.endpoints[0]) !== '0,1'
      || slot.endpoints[1]?.row !== CONFIG.HEIGHT
      || slot.endpoints[1]?.col !== 1
      || slot.endpoints[1]?.boundary !== true
    ) return false;
    const option = slot.directionOptions[0];
    if (
      pointKey(option.clueCell) !== '0,1'
      || option.direction !== 'down'
      || !option.terminalCell?.boundary
      || option.terminalCell.row !== CONFIG.HEIGHT
      || option.terminalCell.col !== 1
      || option.coordinates.length !== 11
    ) return false;
    return option.coordinates.every((coordinate, index) =>
      coordinate.row === index + 1
      && coordinate.col === 1
      && slot.coordinates[index]?.row === coordinate.row
      && slot.coordinates[index]?.col === coordinate.col
    );
  }

  if (
    slot.endpoints.some(endpoint =>
      endpoint.boundary
      || !Number.isInteger(endpoint.row)
      || !Number.isInteger(endpoint.col)
      || endpoint.row < 0 || endpoint.row >= CONFIG.HEIGHT
      || endpoint.col < 0 || endpoint.col >= CONFIG.WIDTH
    )
    || slot.directionOptions.length !== 2
  ) return false;

  const [start, end] = slot.endpoints;
  const horizontal = start.row === end.row;
  const vertical = start.col === end.col;
  if (horizontal === vertical) return false;
  const distance = Math.abs(end.row - start.row) + Math.abs(end.col - start.col);
  if (distance !== slot.length + 1) return false;

  const rowStep = Math.sign(end.row - start.row);
  const colStep = Math.sign(end.col - start.col);
  for (let index = 0; index < slot.length; index++) {
    const expected = {
      row: start.row + rowStep * (index + 1),
      col: start.col + colStep * (index + 1)
    };
    if (
      slot.coordinates[index]?.row !== expected.row
      || slot.coordinates[index]?.col !== expected.col
    ) return false;
  }

  const expectedDirections = horizontal ? new Set(['right', 'left']) : new Set(['down', 'up']);
  if (
    slot.directionOptions.length !== expectedDirections.size
    || slot.directionOptions.some(option => !expectedDirections.has(option.direction))
  ) return false;

  for (const option of slot.directionOptions ?? []) {
    const vector = DIRECTIONS[option.direction];
    if (!vector || !option.clueCell || !option.terminalCell) return false;

    const clueKey = pointKey(option.clueCell);
    const terminalKey = pointKey(option.terminalCell);
    if (!(
      (clueKey === firstKey && terminalKey === lastKey)
      || (clueKey === lastKey && terminalKey === firstKey)
    )) return false;

    if (!Array.isArray(option.coordinates) || option.coordinates.length !== slot.length) return false;
    const baseCoordinates = new Set(slot.coordinates.map(pointKey));
    if (option.coordinates.some(coordinate => !baseCoordinates.has(pointKey(coordinate)))) return false;
    for (let index = 0; index < option.coordinates.length; index++) {
      const expectedRow = option.clueCell.row + vector.dr * (index + 1);
      const expectedCol = option.clueCell.col + vector.dc * (index + 1);
      if (
        option.coordinates[index].row !== expectedRow
        || option.coordinates[index].col !== expectedCol
        || expectedRow < 0
        || expectedCol < 0
        || expectedRow >= CONFIG.HEIGHT
        || expectedCol >= CONFIG.WIDTH
      ) return false;
    }
    const last = option.coordinates[option.coordinates.length - 1];
    const terminalRow = last.row + vector.dr;
    const terminalCol = last.col + vector.dc;
    if (terminalRow !== option.terminalCell.row || terminalCol !== option.terminalCell.col) return false;
  }

  return slot.directionOptions.length > 0;
}

function calculateSlotDegrees(slots) {
  const cellSets = slots.map(slot => new Set(slot.coordinates.map(pointKey)));
  return slots.map((slot, index) => {
    let degree = 0;
    for (let other = 0; other < slots.length; other++) {
      if (other === index) continue;
      if (slots[other].coordinates.some(point => cellSets[index].has(pointKey(point)))) degree++;
    }
    return degree;
  });
}

function hasUnassignedOutgoingOption(questionKeys, unassignedSlots, directionUse) {
  for (const clueKey of questionKeys) {
    if ((directionUse.get(clueKey)?.size ?? 0) > 0) continue;

    const possible = unassignedSlots.some(slot =>
      slot.directionOptions.some(option =>
        pointKey(option.clueCell) === clueKey
        && !directionUse.get(clueKey)?.has(option.direction)
      )
    );
    if (!possible) return false;
  }
  return true;
}

function hasEnoughContentCapacity(unassignedCount, usedImages, usedLogicClues, requiredImageCount, minimumLogicClueCells) {
  if (requiredImageCount - usedImages.size > unassignedCount) return false;
  if (minimumLogicClueCells - usedLogicClues.size > unassignedCount) return false;
  return true;
}

function makePlacementCandidates(slot, state, indexes, options, random) {
  const result = [];
  for (const orientation of slot.directionOptions ?? []) {
    const clueKey = pointKey(orientation.clueCell);
    const usedDirections = state.directionUse.get(clueKey);
    if (usedDirections?.has(orientation.direction)) continue;

    const constraints = crossingConstraints(orientation, state.letters);
    const candidates = findCandidates(indexes, slot.length, constraints);

    for (const entry of candidates) {
      if (state.usedAnswers.has(entry.answer)) continue;
      if (state.usedQuestions.has(normalizeQuestion(entry.question))) continue;

      if (entry.imageKey) {
        if (state.usedImages.has(entry.imageKey)) continue;
        if (state.usedImages.size >= options.requiredImageCount) continue;
      }

      const isNewLogicClue = entry.logic && !state.usedLogicClues.has(clueKey);
      const priority =
        (entry.imageKey && state.usedImages.size < options.requiredImageCount ? 1000 : 0)
        + (isNewLogicClue && state.usedLogicClues.size < options.minimumLogicClueCells ? 100 : 0)
        - Math.max(0, Number(entry.difficulty) - 1);

      result.push({
        slotId: slot.id,
        entry,
        clueCell: { ...orientation.clueCell },
        terminalCell: { ...orientation.terminalCell },
        direction: orientation.direction,
        coordinates: orientation.coordinates.map(point => ({ ...point })),
        priority,
        tie: random()
      });
    }
  }

  result.sort((a, b) => b.priority - a.priority || a.tie - b.tie);
  return result;
}

/**
 * Bounded CSP/Backtracking solver for a fixed set of geometric answer slots.
 *
 * Each slot must receive exactly one real dictionary entry and one endpoint
 * orientation. The solver uses positional-letter indexes, MRV slot ordering,
 * crossing propagation, duplicate-answer exclusion, per-clue direction locks,
 * and reversible state changes.
 *
 * This is a solver kernel, not a complete board-mask generator. A separate
 * topology builder must supply the slots and validate the 96-cell role grid.
 */
export function solveSlotsCsp(inputSlots, inputDictionary, options = {}) {
  const started = Date.now();
  const seed = options.seed ?? 1;
  const random = createRng(seed);
  const prepared = prepareDictionary(inputDictionary, { foldYo: options.foldYo === true });
  const maxNodes = options.maxNodes ?? CONFIG.MAX_SEARCH_NODES;
  const maxTimeMs = options.maxTimeMs ?? CONFIG.MAX_GENERATION_MS;
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const requireEveryClueStarts = options.requireEveryClueStarts !== false;

  if (!Array.isArray(inputSlots) || inputSlots.length === 0) {
    return {
      ok: false,
      reason: 'NO_SLOTS',
      message: 'Для CSP не переданы слоты ответов.',
      seed,
      nodes: 0,
      elapsedMs: Date.now() - started,
      dictionaryStats: prepared.stats
    };
  }

  if (prepared.entries.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_DICTIONARY',
      message: 'После проверки в словаре не осталось допустимых ответов.',
      seed,
      nodes: 0,
      elapsedMs: Date.now() - started,
      dictionaryStats: prepared.stats
    };
  }

  const seenSlotIds = new Set();
  for (const slot of inputSlots) {
    if (!slot?.id || seenSlotIds.has(slot.id) || !Number.isInteger(slot.length) || slot.length < 2
      || !Array.isArray(slot.coordinates) || slot.coordinates.length !== slot.length
      || !Array.isArray(slot.directionOptions) || slot.directionOptions.length === 0
      || !validateSlotGeometry(slot)) {
      return {
        ok: false,
        reason: 'INVALID_SLOT',
        message: 'Слот имеет некорректный ID, длину, координаты или варианты направления.',
        slotId: slot?.id ?? null,
        seed,
        nodes: 0,
        elapsedMs: Date.now() - started,
        dictionaryStats: prepared.stats
      };
    }
    seenSlotIds.add(slot.id);
  }

  const indexes = buildIndexes(prepared.entries, { foldYo: options.foldYo === true });
  const slots = inputSlots.map(slot => ({
    ...slot,
    coordinates: slot.coordinates.map(point => ({ ...point })),
    directionOptions: slot.directionOptions.map(option => ({
      ...option,
      clueCell: { ...option.clueCell },
      terminalCell: { ...option.terminalCell },
      coordinates: option.coordinates.map(point => ({ ...point }))
    }))
  }));

  const questionKeys = [...new Set(slots.flatMap(slot =>
    slot.endpoints.filter(point => !point.boundary).map(pointKey)
  ))];

  const state = {
    letters: new Map(),
    directionUse: new Map(),
    usedAnswers: new Set(),
    usedQuestions: new Set(),
    usedEntryIds: new Set(),
    usedImages: new Set(),
    usedLogicClues: new Set(),
    assignments: new Map()
  };

  const degrees = calculateSlotDegrees(slots);
  let nodes = 0;
  let deepest = 0;
  let budgetExceeded = false;
  let cancelled = false;
  let lastDeadEnd = null;

  function addPlacement(placement) {
    const entry = placement.entry;
    const clueKey = pointKey(placement.clueCell);
    if (!state.directionUse.has(clueKey)) state.directionUse.set(clueKey, new Set());
    state.directionUse.get(clueKey).add(placement.direction);

    const addedLetters = [];
    for (let index = 0; index < placement.coordinates.length; index++) {
      const key = pointKey(placement.coordinates[index]);
      if (!state.letters.has(key)) {
        state.letters.set(key, entry.answer[index]);
        addedLetters.push(key);
      }
    }

    state.usedAnswers.add(entry.answer);
    state.usedQuestions.add(normalizeQuestion(entry.question));
    state.usedEntryIds.add(entry.id);
    if (entry.imageKey) state.usedImages.add(entry.imageKey);
    if (entry.logic) state.usedLogicClues.add(clueKey);
    state.assignments.set(placement.slotId, {
      ...placement,
      addedLetters,
      clueKey
    });

    return addedLetters;
  }

  function undoPlacement(placement) {
    const saved = state.assignments.get(placement.slotId);
    if (!saved) return;

    for (const key of saved.addedLetters) state.letters.delete(key);

    const directions = state.directionUse.get(saved.clueKey);
    directions?.delete(saved.direction);
    if (directions?.size === 0) state.directionUse.delete(saved.clueKey);

    state.usedAnswers.delete(saved.entry.answer);
    state.usedQuestions.delete(normalizeQuestion(saved.entry.question));
    state.usedEntryIds.delete(saved.entry.id);
    if (saved.entry.imageKey) state.usedImages.delete(saved.entry.imageKey);
    if (saved.entry.logic) {
      const stillUsedAtClue = [...state.assignments.values()].some(item =>
        item.slotId !== placement.slotId
        && item.clueKey === saved.clueKey
        && item.entry.logic
      );
      if (!stillUsedAtClue) state.usedLogicClues.delete(saved.clueKey);
    }
    state.assignments.delete(placement.slotId);
  }

  function search() {
    if (options.signal?.aborted) {
      cancelled = true;
      return false;
    }
    if (nodes >= maxNodes || Date.now() - started > maxTimeMs) {
      budgetExceeded = true;
      return false;
    }

    nodes++;
    deepest = Math.max(deepest, state.assignments.size);

    if (state.assignments.size === slots.length) {
      return (!requireEveryClueStarts || questionKeys.every(key => (state.directionUse.get(key)?.size ?? 0) > 0))
        && state.usedImages.size === requiredImageCount
        && state.usedLogicClues.size >= minimumLogicClueCells;
    }

    const unassigned = slots.filter(slot => !state.assignments.has(slot.id));
    if (!hasEnoughContentCapacity(
      unassigned.length,
      state.usedImages,
      state.usedLogicClues,
      requiredImageCount,
      minimumLogicClueCells
    )) {
      lastDeadEnd = { reason: 'CONTENT_REQUIREMENTS_UNREACHABLE', remainingSlots: unassigned.length };
      return false;
    }

    if (requireEveryClueStarts && !hasUnassignedOutgoingOption(questionKeys, unassigned, state.directionUse)) {
      lastDeadEnd = { reason: 'CLUE_WITHOUT_OUTGOING_SLOT' };
      return false;
    }

    let chosenSlot = null;
    let chosenCandidates = null;
    let chosenDegree = -1;

    const selectionOrder = shuffle(unassigned, random);
    for (const slot of selectionOrder) {
      const candidates = makePlacementCandidates(slot, state, indexes, {
        requiredImageCount,
        minimumLogicClueCells
      }, random);

      if (candidates.length === 0) {
        lastDeadEnd = { reason: 'EMPTY_CANDIDATE_DOMAIN', slotId: slot.id };
        return false;
      }

      const slotDegree = degrees[slots.findIndex(item => item.id === slot.id)] ?? 0;
      if (
        chosenCandidates === null
        || candidates.length < chosenCandidates.length
        || (candidates.length === chosenCandidates.length && slotDegree > chosenDegree)
      ) {
        chosenSlot = slot;
        chosenCandidates = candidates;
        chosenDegree = slotDegree;
      }
    }

    for (const candidate of chosenCandidates) {
      if (options.signal?.aborted) {
        cancelled = true;
        return false;
      }

      const additions = [];
      let conflict = false;
      for (let index = 0; index < candidate.coordinates.length; index++) {
        const key = pointKey(candidate.coordinates[index]);
        const existing = state.letters.get(key);
        if (existing !== undefined && existing !== candidate.entry.answer[index]) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      addPlacement(candidate);
      if (search()) return true;
      undoPlacement(candidate);

      if (cancelled || budgetExceeded) return false;
    }

    lastDeadEnd = { reason: 'BACKTRACK_EXHAUSTED', slotId: chosenSlot?.id ?? null };
    return false;
  }

  const solved = search();
  const elapsedMs = Date.now() - started;

  if (!solved) {
    return {
      ok: false,
      reason: cancelled ? 'CANCELLED' : budgetExceeded ? 'SEARCH_BUDGET_EXCEEDED' : 'NO_CSP_SOLUTION',
      message: cancelled
        ? 'Поиск отменён.'
        : budgetExceeded
          ? 'Поиск остановлен по лимиту времени или узлов.'
          : 'Не найдено согласованное назначение слов для всех слотов.',
      seed,
      nodes,
      deepest,
      elapsedMs,
      lastDeadEnd,
      dictionaryStats: prepared.stats
    };
  }

  const words = slots.map((slot, index) => {
    const assignment = state.assignments.get(slot.id);
    return {
      id: 'w' + (index + 1),
      entryId: assignment.entry.id,
      answer: assignment.entry.answer,
      question: assignment.entry.question,
      clue: { ...assignment.clueCell },
      direction: assignment.direction,
      length: assignment.entry.answer.length,
      coordinates: assignment.coordinates.map(point => ({ ...point })),
      imageKey: assignment.entry.imageKey ?? null,
      logic: assignment.entry.logic === true,
      special: slot.special ?? null
    };
  });

  const questions = words.map(word => ({
    id: 'q_' + word.id,
    wordId: word.id,
    text: word.question,
    clue: { ...word.clue },
    direction: word.direction,
    length: word.length,
    imageKey: word.imageKey
  }));

  return {
    ok: true,
    words,
    questions,
    letters: new Map(state.letters),
    clueDirections: new Map([...state.directionUse].map(([key, values]) => [key, new Set(values)])),
    metrics: {
      slots: slots.length,
      assignedWords: words.length,
      uniqueAnswers: state.usedAnswers.size,
      crossings: [...state.letters.keys()].filter(key => {
        const count = words.filter(word => word.coordinates.some(point => pointKey(point) === key)).length;
        return count > 1;
      }).length,
      distinctImages: state.usedImages.size,
      logicClueCells: state.usedLogicClues.size
    },
    seed,
    nodes,
    deepest,
    elapsedMs,
    dictionaryStats: prepared.stats
  };
}
