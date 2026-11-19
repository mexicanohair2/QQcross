import { normalizeAnswer, canonicalAnswerKey, normalizeQuestion, prepareDictionary } from './dictionary.js';

const DEFAULT_SHORT_ANSWERS = Object.freeze(['ЁЖ', 'ЯД', 'УМ', 'ЮГ', 'УС']);
const IMAGE_PROMPT = /изображено на картинке|показано на картинке/iu;

function keyOf(point) {
  return point.row + ',' + point.col;
}

function sameImagePrompt(question) {
  return IMAGE_PROMPT.test(String(question ?? ''));
}

/**
 * Dictionary-backed bounded CSP for the strict v2.2 slot contract.
 *
 * It deliberately solves shared clue cells as one prompt: two slots that start
 * from the same coordinate may only receive entries with the same normalized
 * clue text. A shared clue cannot host a picture entry because one cell cannot
 * present two separate picture targets.
 */
export function solveEtalonV22Slots(slots, dictionary, options = {}) {
  const started = Date.now();
  const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 1;
  const maxNodes = Math.max(1, options.maxNodes ?? 180000);
  const maxTimeMs = Math.max(1, options.maxTimeMs ?? 4000);
  const requiredImageCount = options.requiredImageCount ?? 5;
  const minimumLogicClueCells = options.minimumLogicClueCells ?? 3;
  const foldYo = options.foldYo === true;
  const shortAnswers = new Set((options.allowedShortAnswers ?? DEFAULT_SHORT_ANSWERS)
    .map(answer => canonicalAnswerKey(answer, { foldYo })));
  const prepared = prepareDictionary(dictionary, { foldYo });
  const candidatesByLength = new Map();

  for (const entry of prepared.variants) {
    if (entry.answer.length === 2 && !shortAnswers.has(canonicalAnswerKey(entry.answer, { foldYo }))) continue;
    if (!candidatesByLength.has(entry.answer.length)) candidatesByLength.set(entry.answer.length, []);
    candidatesByLength.get(entry.answer.length).push(entry);
  }

  const clueSlots = new Map();
  for (const slot of slots) {
    const clueKey = keyOf(slot.clueCell);
    if (!clueSlots.has(clueKey)) clueSlots.set(clueKey, []);
    clueSlots.get(clueKey).push(slot.id);
  }
  const sharedClues = new Set([...clueSlots.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key]) => key));

  const state = {
    answers: new Set(),
    letters: new Map(),
    clueText: new Map(),
    questions: new Map(),
    images: new Set(),
    imageClues: new Set(),
    logicClues: new Set(),
    assignments: new Map()
  };

  const orderedSlots = [...slots];
  let nodes = 0;
  let deepest = 0;
  let budgetExceeded = false;
  let bestDepth = 0;
  let bestFailure = null;

  const normalizedLetter = value => foldYo && value === 'Ё' ? 'Е' : value;

  function candidatesFor(slot) {
    const clueKey = keyOf(slot.clueCell);
    const isShared = sharedClues.has(clueKey);
    const clueText = state.clueText.get(clueKey);
    const domain = candidatesByLength.get(slot.length) ?? [];
    const result = [];

    for (const entry of domain) {
      const answerKey = canonicalAnswerKey(entry.answer, { foldYo });
      if (state.answers.has(answerKey)) continue;
      if (isShared && entry.imageKey) continue;
      if (clueText !== undefined && normalizeQuestion(entry.question) !== clueText) continue;

      let lettersMatch = true;
      for (let index = 0; index < slot.coordinates.length; index++) {
        const point = slot.coordinates[index];
        const existing = state.letters.get(keyOf(point));
        if (existing !== undefined && normalizedLetter(existing) !== normalizedLetter(entry.answer[index])) {
          lettersMatch = false;
          break;
        }
      }
      if (!lettersMatch) continue;

      if (entry.imageKey) {
        if (state.images.has(entry.imageKey) || state.imageClues.has(clueKey)
          || state.images.size >= requiredImageCount) continue;
      }

      if (entry.logic && !state.logicClues.has(clueKey)
        && state.logicClues.size >= minimumLogicClueCells
        && isShared && state.clueText.has(clueKey)) {
        // The first answer at a shared clue cell already consumes the prompt;
        // adding a second logic tag cannot create a new logic clue cell.
      }

      const normalizedQuestion = normalizeQuestion(entry.question);
      const previousUses = state.questions.get(normalizedQuestion) ?? [];
      if (previousUses.length) {
        const isSameClue = previousUses.every(use => use.clueKey === clueKey);
        const isDistinctImageReuse = !isSameClue
          && entry.imageKey
          && sameImagePrompt(normalizedQuestion)
          && previousUses.every(use => use.imageKey && use.imageKey !== entry.imageKey
            && use.clueKey !== clueKey);
        if (!isSameClue && !isDistinctImageReuse) continue;
        if (isSameClue && previousUses.some(use => use.entryId === entry.id)) continue;
      }

      result.push(entry);
    }

    // Content quota is a hard constraint, but candidates satisfying currently
    // missing picture/logic quotas are tried first for faster bounded search.
    result.sort((a, b) => {
      const aImage = a.imageKey && !state.images.has(a.imageKey) ? 1 : 0;
      const bImage = b.imageKey && !state.images.has(b.imageKey) ? 1 : 0;
      const aLogic = a.logic && !state.logicClues.has(clueKey) ? 1 : 0;
      const bLogic = b.logic && !state.logicClues.has(clueKey) ? 1 : 0;
      return (bImage * (state.images.size < requiredImageCount ? 1000 : 0)
        + bLogic * (state.logicClues.size < minimumLogicClueCells ? 100 : 0)
        - Number(b.difficulty || 1))
        - (aImage * (state.images.size < requiredImageCount ? 1000 : 0)
        + aLogic * (state.logicClues.size < minimumLogicClueCells ? 100 : 0)
        - Number(a.difficulty || 1));
    });
    return result;
  }

  function canStillMeetQuotas(unassigned) {
    const neededImages = requiredImageCount - state.images.size;
    const neededLogic = minimumLogicClueCells - state.logicClues.size;
    if (neededImages > unassigned.length || neededLogic > unassigned.length) return false;
    if (neededImages > 0) {
      let imagePossible = 0;
      for (const slot of unassigned) {
        if ((candidatesByLength.get(slot.length) ?? []).some(entry => entry.imageKey
          && !state.images.has(entry.imageKey)
          && !state.imageClues.has(keyOf(slot.clueCell)))) imagePossible++;
      }
      if (imagePossible < neededImages) return false;
    }
    if (neededLogic > 0) {
      const possibleClues = new Set();
      for (const slot of unassigned) {
        const clueKey = keyOf(slot.clueCell);
        if (!state.logicClues.has(clueKey)
          && (candidatesByLength.get(slot.length) ?? []).some(entry => entry.logic)) {
          possibleClues.add(clueKey);
        }
      }
      if (possibleClues.size < neededLogic) return false;
    }
    return true;
  }

  function add(slot, entry) {
    const clueKey = keyOf(slot.clueCell);
    const answerKey = canonicalAnswerKey(entry.answer, { foldYo });
    const normalizedQuestion = normalizeQuestion(entry.question);
    state.answers.add(answerKey);
    if (!state.clueText.has(clueKey)) state.clueText.set(clueKey, normalizedQuestion);
    const uses = state.questions.get(normalizedQuestion) ?? [];
    uses.push({ clueKey, entryId: entry.id, imageKey: entry.imageKey ?? null });
    state.questions.set(normalizedQuestion, uses);
    const addedLetters = [];
    for (let index = 0; index < slot.coordinates.length; index++) {
      const key = keyOf(slot.coordinates[index]);
      if (!state.letters.has(key)) {
        state.letters.set(key, entry.answer[index]);
        addedLetters.push(key);
      }
    }
    if (entry.imageKey) {
      state.images.add(entry.imageKey);
      state.imageClues.add(clueKey);
    }
    if (entry.logic) state.logicClues.add(clueKey);
    state.assignments.set(slot.id, { entry, addedLetters, clueKey, normalizedQuestion });
  }

  function remove(slot) {
    const saved = state.assignments.get(slot.id);
    if (!saved) return;
    state.answers.delete(canonicalAnswerKey(saved.entry.answer, { foldYo }));
    for (const key of saved.addedLetters) state.letters.delete(key);
    const uses = state.questions.get(saved.normalizedQuestion) ?? [];
    const remainingUses = uses.filter(use => use.entryId !== saved.entry.id);
    if (remainingUses.length) state.questions.set(saved.normalizedQuestion, remainingUses);
    else state.questions.delete(saved.normalizedQuestion);

    const clueStillUsed = [...state.assignments.values()].some(item =>
      item.clueKey === saved.clueKey && item !== saved);
    if (!clueStillUsed) state.clueText.delete(saved.clueKey);

    if (saved.entry.imageKey) {
      state.images.delete(saved.entry.imageKey);
      state.imageClues.delete(saved.clueKey);
    }
    if (saved.entry.logic) {
      const otherLogic = [...state.assignments.entries()].some(([id, item]) =>
        id !== slot.id && item.clueKey === saved.clueKey && item.entry.logic);
      if (!otherLogic) state.logicClues.delete(saved.clueKey);
    }
    state.assignments.delete(slot.id);
  }

  function search() {
    if (options.signal?.aborted) return false;
    if (nodes >= maxNodes || Date.now() - started >= maxTimeMs) {
      budgetExceeded = true;
      return false;
    }
    nodes++;
    deepest = Math.max(deepest, state.assignments.size);
    bestDepth = Math.max(bestDepth, state.assignments.size);

    if (state.assignments.size === orderedSlots.length) {
      return state.images.size === requiredImageCount
        && state.imageClues.size === requiredImageCount
        && state.logicClues.size >= minimumLogicClueCells;
    }

    const unassigned = orderedSlots.filter(slot => !state.assignments.has(slot.id));
    if (!canStillMeetQuotas(unassigned)) {
      bestFailure = { reason: 'CONTENT_QUOTAS_UNREACHABLE', depth: state.assignments.size };
      return false;
    }

    let chosen = null;
    let chosenDomain = null;
    for (const slot of unassigned) {
      const domain = candidatesFor(slot);
      if (!domain.length) {
        bestFailure = {
          reason: 'EMPTY_DOMAIN',
          depth: state.assignments.size,
          slotId: slot.id,
          length: slot.length,
          clueCell: slot.clueCell,
          shared: sharedClues.has(keyOf(slot.clueCell)),
          knownLetters: slot.coordinates.flatMap((point, index) => {
            const letter = state.letters.get(keyOf(point));
            return letter === undefined ? [] : [{ index, letter }];
          })
        };
        return false;
      }
      if (chosenDomain === null || domain.length < chosenDomain.length) {
        chosen = slot;
        chosenDomain = domain;
      }
      if (chosenDomain.length === 1) break;
    }

    for (const entry of chosenDomain) {
      add(chosen, entry);
      if (search()) return true;
      remove(chosen);
      if (budgetExceeded) return false;
    }
    return false;
  }

  const solved = search();
  const elapsedMs = Date.now() - started;
  if (!solved) {
    return {
      ok: false,
      reason: budgetExceeded ? 'SEARCH_BUDGET_EXCEEDED' : 'NO_DICTIONARY_FILL',
      seed,
      nodes,
      deepest,
      elapsedMs,
      bestDepth,
      bestFailure,
      dictionaryStats: prepared.stats,
      slots: slots.length,
      sharedClueCells: [...sharedClues]
    };
  }

  const assignments = orderedSlots.map(slot => {
    const assignment = state.assignments.get(slot.id);
    return {
      slotId: slot.id,
      answer: assignment.entry.answer,
      clue: assignment.entry.question,
      clueCell: { ...slot.clueCell },
      direction: slot.directionOptions[0].direction,
      length: slot.length,
      imageKey: assignment.entry.imageKey ?? null,
      logic: assignment.entry.logic === true,
      entryId: assignment.entry.id,
      coordinates: slot.coordinates.map(point => ({ ...point }))
    };
  });

  return {
    ok: true,
    seed,
    nodes,
    elapsedMs,
    dictionaryStats: prepared.stats,
    metrics: {
      words: assignments.length,
      pictures: new Set(assignments.filter(word => word.imageKey).map(word => word.imageKey)).size,
      logicClueCells: new Set(assignments.filter(word => word.logic).map(word => keyOf(word.clueCell))).size,
      sharedClueCells: [...sharedClues].length,
      twoLetterAnswers: assignments.filter(word => word.length === 2).length
    },
    assignments
  };
}
