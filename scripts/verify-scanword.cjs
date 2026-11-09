const fs = require("node:fs");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const app = fs.readFileSync("app.js", "utf8");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const commonLexicon = JSON.parse(fs.readFileSync("data/russian-words-common-25000.json", "utf8"));
const normalizeAnswer = value => String(value || "").toLocaleUpperCase("ru-RU").replace(/Ё/g, "Е").replace(/[^А-Я]/g, "");
const commonWords = new Set((commonLexicon.words || []).map(normalizeAnswer));
const enrichedDictionary = dictionary.map(entry => ({ ...entry, common: commonWords.has(normalizeAnswer(entry.answer || entry.word)) }));
const start = app.indexOf("function getScanwordDictionary(){");
const end = app.indexOf("function clonePreparedScanword", start);
if (start < 0 || end < 0) throw new Error("Scanword engine section not found");

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function validate(puzzle, run) {
  if (!puzzle || puzzle.w !== 8 || puzzle.h !== 12) throw new Error("Run " + run + ": grid is not 8 columns × 12 rows");
  const total = puzzle.w * puzzle.h;
  if (puzzle.coverage !== 1 || puzzle.used.size + puzzle.clueKeys.size + (puzzle.reservedKeys?.size || 0) !== total) {
    throw new Error("Run " + run + ": incomplete coverage " + (puzzle.used.size + puzzle.clueKeys.size + (puzzle.reservedKeys?.size || 0)) + "/" + total);
  }
  if (!(puzzle.reservedKeys instanceof Set) || !puzzle.reservedKeys.has("0,0") || puzzle.reservedKeys.size > 20) {
    throw new Error("Run " + run + ": expected the top-left blank and at most 19 deliberate dark blocker cells");
  }
  if (puzzle.used.has("0,0") || puzzle.clueKeys.has("0,0")) throw new Error("Run " + run + ": top-left corner is not blank");
  for (const key of puzzle.clueKeys) {
    if (puzzle.used.has(key)) throw new Error("Run " + run + ": clue/letter overlap at " + key);
  }

  const letters = new Map();
  const owners = new Map();
  const answers = new Set();
  for (let i = 0; i < puzzle.words.length; i++) {
    const word = puzzle.words[i];
    if (!word.clue || !word.answer || word.answer.length !== word.cells.length) throw new Error("Run " + run + ": malformed word " + word.id);
    if (word.answer.length < 2) throw new Error("Run " + run + ": one-letter answers are forbidden");
    if (answers.has(word.answer)) throw new Error("Run " + run + ": duplicate answer " + word.answer);
    answers.add(word.answer);
    const [cy, cx] = word.clueCell;
    const directions = { right: [0, 1], left: [0, -1], down: [1, 0], up: [-1, 0] };
    const delta = directions[word.dir];
    if (!delta) throw new Error("Run " + run + ": invalid direction " + word.dir + " for " + word.id);
    for (let k = 0; k < word.cells.length; k++) {
      const expectedY = cy + delta[0] * (k + 1), expectedX = cx + delta[1] * (k + 1);
      if (word.cells[k][0] !== expectedY || word.cells[k][1] !== expectedX) {
        throw new Error("Run " + run + ": non-contiguous or misdirected cells in " + word.id);
      }
      if (word.answer[k] < "А" || word.answer[k] > "Я") throw new Error("Run " + run + ": invalid answer character in " + word.id);
    }
    if (cy < 0 || cx < 0 || cy >= puzzle.h || cx >= puzzle.w || !puzzle.clueKeys.has(cy + "," + cx)) throw new Error("Run " + run + ": invalid clue cell");
    for (let k = 0; k < word.cells.length; k++) {
      const [y, x] = word.cells[k];
      if (y < 0 || x < 0 || y >= puzzle.h || x >= puzzle.w) throw new Error("Run " + run + ": out-of-bounds letter");
      const key = y + "," + x;
      if (puzzle.reservedKeys.has(key)) throw new Error("Run " + run + ": answer crosses the reserved blank corner");
      if (puzzle.clueKeys.has(key)) throw new Error("Run " + run + ": answer crosses a clue cell");
      if (letters.has(key) && letters.get(key) !== word.answer[k]) throw new Error("Run " + run + ": conflicting letter at " + key);
      letters.set(key, word.answer[k]);
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(i);
    }
    const terminalY=cy+delta[0]*(word.answer.length+1),terminalX=cx+delta[1]*(word.answer.length+1),terminalKey=terminalY+","+terminalX;
    if(terminalY<0||terminalX<0||terminalY>=puzzle.h||terminalX>=puzzle.w||!puzzle.clueKeys.has(terminalKey))throw new Error("Run "+run+": answer "+word.answer+" does not end at a question cell");
  }
  if (letters.size !== puzzle.used.size) throw new Error("Run " + run + ": unused occupied cells");
  for (const key of puzzle.used) if (!letters.has(key)) throw new Error("Run " + run + ": orphan letter cell");

  const graph = puzzle.words.map(() => new Set());
  for (const set of owners.values()) {
    const ids = [...set];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      graph[ids[i]].add(ids[j]);
      graph[ids[j]].add(ids[i]);
    }
  }
  for (let i = 0; i < puzzle.words.length; i++) {
    const a = puzzle.words[i], aKey = a.clueCell.join(",");
    for (let j = i + 1; j < puzzle.words.length; j++) {
      const b = puzzle.words[j], bKey = b.clueCell.join(",");
      const [ay, ax] = a.clueCell, [by, bx] = b.clueCell;
      const sharedClue = aKey === bKey;
      const adjacentClueToAnswer = b.cells.some(([y,x]) => Math.abs(y-ay)+Math.abs(x-ax)===1) ||
        a.cells.some(([y,x]) => Math.abs(y-by)+Math.abs(x-bx)===1);
      const adjacentClueCells = Math.abs(ay-by)+Math.abs(ax-bx)===1;
      if (sharedClue || adjacentClueToAnswer || adjacentClueCells) { graph[i].add(j); graph[j].add(i); }
    }
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop();
    for (const j of graph[i]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  if (seen.size !== puzzle.words.length) {
    const disconnected = puzzle.words.map((word, index) => ({ index, answer: word.answer, clue: word.clue, clueCell: word.clueCell, dir: word.dir, cells: word.cells }))
      .filter(word => !seen.has(word.index));
    throw new Error("Run " + run + ": words are not connected by matching letters (" + seen.size + "/" + puzzle.words.length + "); disconnected=" + JSON.stringify(disconnected));
  }
  if (puzzle.words.length < 10) throw new Error("Run " + run + ": suspiciously few questions");
  const startKeys = new Set(puzzle.words.map(word => word.clueCell.join(",")));
  if (!startKeys.has("0,2") || !startKeys.has("1,0")) throw new Error("Run " + run + ": missing top/left edge clue anchors");
  const topEdgeClues = [...puzzle.clueKeys].filter(key => key.startsWith("0,") && key !== "0,0").length;
  const leftEdgeClues = [...puzzle.clueKeys].filter(key => key.endsWith(",0") && key !== "0,0").length;
  const delta = { right: [0, 1], left: [0, -1], down: [1, 0], up: [-1, 0] };
  const terminalKeys = new Set(puzzle.words.map(word => {
    const [dy, dx] = delta[word.dir], last = word.cells[word.cells.length - 1];
    return (last[0] + dy) + "," + (last[1] + dx);
  }));
  for (const key of terminalKeys) if (!startKeys.has(key)) throw new Error("Run " + run + ": answer ends at a terminal-only clue cell " + key);
  const playableClues = new Set([...startKeys, ...terminalKeys]);
  for (const key of puzzle.clueKeys) {
    if (!playableClues.has(key)) throw new Error("Run " + run + ": dangling question cell " + key);
  }
  if (topEdgeClues < 2 || leftEdgeClues < 2) throw new Error("Run " + run + ": too few edge clue cells (top=" + topEdgeClues + "/2, left=" + leftEdgeClues + "/2)");
  const textClues = puzzle.words.filter(word => !word.imageKey).map(word => String(word.clueShort || word.clue).normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[^\p{L}\p{N}]+/gu," ").trim());
  if (new Set(textClues).size !== textClues.length) throw new Error("Run " + run + ": duplicate visible clue text");
  const pictureWords = puzzle.words.filter(word => word.imageKey);
  const pictureKeys = pictureWords.map(word => word.imageKey);
  if (pictureKeys.length < 5 || pictureKeys.length > 7 || new Set(pictureKeys).size !== pictureKeys.length) {
    throw new Error("Run " + run + ": expected five to seven distinct picture clues, found " + pictureKeys.join(","));
  }
  const startTileCount = new Set(puzzle.words.map(word => word.clueCell.join(","))).size;
  const splitPromptCount = puzzle.words.length - startTileCount;
  const commonAnswerCount = puzzle.words.filter(word => commonWords.has(normalizeAnswer(word.answer))).length;
  const commonAnswerRatio = commonAnswerCount / puzzle.words.length;
  if (commonAnswerRatio < 0.65) throw new Error("Run " + run + ": too few everyday words (" + commonAnswerCount + "/" + puzzle.words.length + ")");
  const logicClueCells = new Set(puzzle.words.filter(word => word.logic).map(word => word.clueCell.join(",")));
  if (logicClueCells.size < 3) {
    throw new Error("Run " + run + ": expected at least three distinct logical clue cells, found " + logicClueCells.size);
  }
  const pictureAnswers = new Map([["airplane","САМОЛЕТ"],["apple","ЯБЛОКО"],["ball","МЯЧ"],["banana","БАНАН"],["bear","МЕДВЕДЬ"],["bee","ПЧЕЛА"],["bicycle","ВЕЛОСИПЕД"],["boat","ЛОДКА"],["book","КНИГА"],["bus","АВТОБУС"],["butterfly","БАБОЧКА"],["car","МАШИНА"],["carrot","МОРКОВЬ"],["cat","КОТ"],["clock","ЧАСЫ"],["cloud","ОБЛАКО"],["crocodile","КРОКОДИЛ"],["cucumber","ОГУРЕЦ"],["cup","ЧАШКА"],["dog","СОБАКА"],["dolphin","ДЕЛЬФИН"],["fish","РЫБА"],["fox","ЛИСА"],["giraffe","ЖИРАФ"],["grapes","ВИНОГРАД"],["guitar","ГИТАРА"],["hedgehog","ЕЖ"],["house","ДОМ"],["kangaroo","КЕНГУРУ"],["key","КЛЮЧ"],["lemon","ЛИМОН"],["lion","ЛЕВ"],["octopus","ОСЬМИНОГ"],["orange","АПЕЛЬСИН"],["owl","СОВА"],["parrot","ПОПУГАЙ"],["penguin","ПИНГВИН"],["snail","УЛИТКА"],["spider","ПАУК"],["strawberry","КЛУБНИКА"],["sun","СОЛНЦЕ"],["sunflower","ПОДСОЛНУХ"],["tiger","ТИГР"],["tomato","ПОМИДОР"],["whale","КИТ"],["zebra","ЗЕБРА"]]);
  for (const word of pictureWords) {
    if (pictureAnswers.get(word.imageKey) !== word.answer) {
      throw new Error("Run " + run + ": picture " + word.imageKey + " does not match answer " + word.answer);
    }
  }
  return { words: puzzle.words.length, clueCells: puzzle.clueKeys.size, letters: puzzle.used.size, topEdgeClues, leftEdgeClues, pictureKeys, logicalClueCells: logicClueCells.size, splitPromptCount, commonAnswerCount, commonAnswerRatio: Math.round(commonAnswerRatio * 100) };
}

const timings = [];
const summaries = [];
for (let run = 1; run <= 20; run++) {
  const math = Object.create(Math);
  math.random = seededRandom(run * 7919);
  const context = {
    window: { QQCROSS_DICTIONARY: enrichedDictionary },
    localStorage: { getItem: () => "[]" },
    Math: math,
    Date,
    Set,
    Map,
    console
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end) + "\nglobalThis.__buildScanword = buildScanword;", context);
  const t0 = performance.now();
  let puzzle;
  try { puzzle = context.__buildScanword(enrichedDictionary); }
  catch (error) { throw new Error("Seed " + run + " (" + (run * 7919) + ") failed: " + error.message); }
  const elapsed = performance.now() - t0;
  timings.push(elapsed);
  summaries.push({ run, ...validate(puzzle, run), ms: Math.round(elapsed) });
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({
  dictionaryEntries: dictionary.length,
  validRuns: summaries.length,
  seedsChecked: 20,
  medianMs: Math.round((timings[3] + timings[4]) / 2),
  p95Ms: Math.round(timings[timings.length - 1]),
  runs: summaries
}, null, 2));
