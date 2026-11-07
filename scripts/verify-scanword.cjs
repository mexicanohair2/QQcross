const fs = require("node:fs");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const app = fs.readFileSync("app.js", "utf8");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
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
  if (!puzzle || puzzle.w !== 15 || puzzle.h !== 15) throw new Error("Run " + run + ": grid is not 15x15");
  const total = puzzle.w * puzzle.h;
  if (puzzle.coverage !== 1 || puzzle.used.size + puzzle.clueKeys.size !== total) {
    throw new Error("Run " + run + ": incomplete coverage " + (puzzle.used.size + puzzle.clueKeys.size) + "/" + total);
  }
  for (const key of puzzle.clueKeys) {
    if (puzzle.used.has(key)) throw new Error("Run " + run + ": clue/letter overlap at " + key);
  }

  const letters = new Map();
  const owners = new Map();
  const answers = new Set();
  for (let i = 0; i < puzzle.words.length; i++) {
    const word = puzzle.words[i];
    if (!word.clue || !word.answer || word.answer.length !== word.cells.length) throw new Error("Run " + run + ": malformed word " + word.id);
    if (word.answer.length > 1 && answers.has(word.answer)) throw new Error("Run " + run + ": duplicate answer " + word.answer);
    if (word.answer.length > 1) answers.add(word.answer);
    const [cy, cx] = word.clueCell;
    if (cy < 0 || cx < 0 || cy >= 15 || cx >= 15 || !puzzle.clueKeys.has(cy + "," + cx)) throw new Error("Run " + run + ": invalid clue cell");
    for (let k = 0; k < word.cells.length; k++) {
      const [y, x] = word.cells[k];
      if (y < 0 || x < 0 || y >= 15 || x >= 15) throw new Error("Run " + run + ": out-of-bounds letter");
      const key = y + "," + x;
      if (puzzle.clueKeys.has(key)) throw new Error("Run " + run + ": answer crosses a clue cell");
      if (letters.has(key) && letters.get(key) !== word.answer[k]) throw new Error("Run " + run + ": conflicting letter at " + key);
      letters.set(key, word.answer[k]);
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(i);
    }
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
      if (sharedClue || adjacentClueToAnswer) { graph[i].add(j); graph[j].add(i); }
    }
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop();
    for (const j of graph[i]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  if (seen.size !== puzzle.words.length) throw new Error("Run " + run + ": words are not connected by matching letters (" + seen.size + "/" + puzzle.words.length + ")");
  if (puzzle.words.length < 10) throw new Error("Run " + run + ": suspiciously few questions");
  const pictureWords = puzzle.words.filter(word => word.imageKey);
  const pictureKeys = pictureWords.map(word => word.imageKey);
  if (pictureKeys.length !== 3 || new Set(pictureKeys).size !== 3) {
    throw new Error("Run " + run + ": expected three distinct picture clues, found " + pictureKeys.join(","));
  }
  const pictureAnswers = new Map([["airplane","САМОЛЕТ"],["apple","ЯБЛОКО"],["ball","МЯЧ"],["banana","БАНАН"],["bear","МЕДВЕДЬ"],["bee","ПЧЕЛА"],["bicycle","ВЕЛОСИПЕД"],["boat","ЛОДКА"],["book","КНИГА"],["bus","АВТОБУС"],["butterfly","БАБОЧКА"],["car","МАШИНА"],["carrot","МОРКОВЬ"],["cat","КОТ"],["clock","ЧАСЫ"],["cloud","ОБЛАКО"],["crocodile","КРОКОДИЛ"],["cucumber","ОГУРЕЦ"],["cup","ЧАШКА"],["dog","СОБАКА"],["dolphin","ДЕЛЬФИН"],["fish","РЫБА"],["fox","ЛИСА"],["giraffe","ЖИРАФ"],["grapes","ВИНОГРАД"],["guitar","ГИТАРА"],["hedgehog","ЕЖ"],["house","ДОМ"],["kangaroo","КЕНГУРУ"],["key","КЛЮЧ"],["lemon","ЛИМОН"],["lion","ЛЕВ"],["octopus","ОСЬМИНОГ"],["orange","АПЕЛЬСИН"],["owl","СОВА"],["parrot","ПОПУГАЙ"],["penguin","ПИНГВИН"],["snail","УЛИТКА"],["spider","ПАУК"],["strawberry","КЛУБНИКА"],["sun","СОЛНЦЕ"],["sunflower","ПОДСОЛНУХ"],["tiger","ТИГР"],["tomato","ПОМИДОР"],["whale","КИТ"],["zebra","ЗЕБРА"]]);
  for (const word of pictureWords) {
    if (pictureAnswers.get(word.imageKey) !== word.answer) {
      throw new Error("Run " + run + ": picture " + word.imageKey + " does not match answer " + word.answer);
    }
  }
  return { words: puzzle.words.length, clueCells: puzzle.clueKeys.size, letters: puzzle.used.size, oneLetterAnswers: puzzle.words.filter(word => word.answer.length === 1).length, pictureKeys };
}

const timings = [];
const summaries = [];
for (let run = 1; run <= 20; run++) {
  const math = Object.create(Math);
  math.random = seededRandom(run * 7919);
  const context = {
    window: { QQCROSS_DICTIONARY: dictionary },
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
  const puzzle = context.__buildScanword(dictionary);
  const elapsed = performance.now() - t0;
  timings.push(elapsed);
  summaries.push({ run, ...validate(puzzle, run), ms: Math.round(elapsed) });
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({
  dictionaryEntries: dictionary.length,
  validRuns: summaries.length,
  medianMs: Math.round((timings[3] + timings[4]) / 2),
  p95Ms: Math.round(timings[timings.length - 1]),
  runs: summaries
}, null, 2));
