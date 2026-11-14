const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateTopology } = await import("../scanword-engine/src/topology-builder.js");
  const { prepareDictionary, normalizeAnswer, findCandidates, buildIndexes } = await import("../scanword-engine/src/dictionary.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");

  const raw = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const prepared = prepareDictionary(raw);
  const indexes = buildIndexes(prepared.variants);
  const elevenAnswers = [...new Set(prepared.variants
    .filter(entry => entry.answer.length === 11)
    .map(entry => entry.answer))];
  const tried = [];
  let successes = [];

  function pointKey(point) { return point.row + "," + point.col; }
  function crossingConstraints(orientation, letters) {
    const constraints = [];
    for (let index = 0; index < orientation.coordinates.length; index++) {
      const point = orientation.coordinates[index];
      const letter = letters.get(pointKey(point));
      if (letter !== undefined) constraints.push({ position: index, letter });
    }
    return constraints;
  }

  for (let topologySeed = 120000; topologySeed < 120040 && !successes.length; topologySeed++) {
    const generated = generateTopology({
      seed: topologySeed,
      includeSpecialEleven: true,
      maxAttempts: 96
    });
    if (!generated.ok) continue;

    const topology = generated.topology;
    const special = topology.slots.find(slot => slot.special === "ELEVEN_LETTER_BOTTOM_BOUNDARY");
    if (!special) continue;

    const specialCells = new Set(special.coordinates.map(pointKey));
    const crossingSlots = topology.slots.filter(slot =>
      slot.id !== special.id
      && slot.coordinates.some(point => specialCells.has(pointKey(point)))
    );

    const ranked = [];
    for (const answer of elevenAnswers) {
      const imposedLetters = new Map(special.coordinates.map((point, index) => [
        pointKey(point), answer[index]
      ]));
      let unsupported = 0;
      let totalSupport = 0;
      const rows = [];
      for (const slot of crossingSlots) {
        let best = 0;
        let bestDirection = null;
        for (const orientation of slot.directionOptions) {
          const constraints = crossingConstraints(orientation, imposedLetters);
          if (!constraints.length) continue;
          const matches = findCandidates(indexes, slot.length, constraints)
            .filter(entry => entry.answer !== answer);
          const unique = new Set(matches.map(entry => entry.answer)).size;
          if (unique > best) {
            best = unique;
            bestDirection = orientation.direction;
          }
        }
        if (!best) unsupported++;
        totalSupport += best;
        rows.push({ slotId: slot.id, length: slot.length, options: best, direction: bestDirection });
      }
      if (unsupported === 0) ranked.push({ answer, totalSupport, rows });
    }

    ranked.sort((a, b) => b.totalSupport - a.totalSupport);
    const bestCandidates = ranked.slice(0, 4);
    for (let index = 0; index < bestCandidates.length; index++) {
      const candidate = bestCandidates[index];
      const dictionary = raw.filter(item =>
        normalizeAnswer(item.answer).length !== 11
        || normalizeAnswer(item.answer) === candidate.answer
      );
      const started = performance.now();
      const solved = solveSlotsCsp(topology.slots, dictionary, {
        seed: topologySeed * 13 + index,
        requiredImageCount: 5,
        minimumLogicClueCells: 3,
        requireEveryClueStarts: false,
        maxNodes: 180000,
        maxTimeMs: 450
      });

      let validation = null;
      let validationErrors = null;
      let assembled = null;
      if (solved.ok) {
        assembled = assembleScanword({
          seed: topologySeed * 13 + index,
          words: solved.words,
          questions: solved.questions
        });
        if (assembled.ok) {
          validation = validateScanword(assembled.scanword, raw, {
            requiredImageCount: 5,
            minimumLogicClueCells: 3,
            requireLeftBorderClues: true,
            requireTopAnchor: true,
            requireConnected: true
          });
          validationErrors = validation.errors.slice(0, 12);
        } else validationErrors = assembled.errors.slice(0, 12);
      }

      tried.push({
        topologySeed,
        candidate: candidate.answer,
        support: candidate.totalSupport,
        ok: solved.ok,
        valid: Boolean(validation?.valid),
        reason: solved.reason ?? null,
        nodes: solved.nodes,
        deepest: solved.deepest,
        elapsedMs: Math.round(performance.now() - started),
        lastDeadEnd: solved.lastDeadEnd ?? null,
        validationErrors,
        rowSupport: candidate.rows
      });

      if (validation?.valid) {
        successes.push({
          topologySeed,
          answer: candidate.answer,
          metrics: validation.metrics,
          score: assembled.scanword.metadata?.score ?? null,
          pattern: topology.pattern,
          words: assembled.scanword.words.map(word => ({
            answer: word.answer,
            question: word.question,
            clue: word.clue,
            direction: word.direction,
            length: word.length,
            imageKey: word.imageKey,
            logic: word.logic
          }))
        });
        break;
      }
    }
  }

  console.log(JSON.stringify({
    dictionary: {
      raw: raw.length,
      variants: prepared.stats.validVariants,
      uniqueAnswers: prepared.stats.accepted,
      elevenLetterAnswers: elevenAnswers.length
    },
    topologiesTried: new Set(tried.map(item => item.topologySeed)).size,
    candidateAttempts: tried.length,
    successes,
    attempts: tried
  }, null, 2));

  if (!successes.length) {
    console.error("No independently valid optional 11-letter puzzle found in this bounded search.");
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
