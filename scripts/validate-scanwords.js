const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const expectedPictures = {
  ЯБЛОКО: "apple",
  ТОМАТ: "tomato",
  КОТ: "cat",
  ВЕЛОСИПЕД: "bicycle",
  ЧАСЫ: "clock"
};
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
const normalize = value => String(value || "").toLocaleUpperCase("ru-RU").replace(/Ё/g, "Е").replace(/[^А-ЯA-Z]/g, "");
if (!Array.isArray(dictionary) || dictionary.length < 2000) {
  fail("Expected the current scanword dictionary with at least 2000 entries");
  process.exit();
}
for (const [answer, imageKey] of Object.entries(expectedPictures)) {
  const matches = dictionary.filter(item => normalize(item.answer || item.word) === answer && item.imageKey === imageKey);
  if (matches.length !== 1) fail(`Expected exactly one ${answer} picture clue, found ${matches.length}`);
  const asset = `assets/scanword/${imageKey}.svg`;
  if (!fs.existsSync(asset)) fail(`Missing picture clue asset: ${asset}`);
  else if (!fs.readFileSync(asset, "utf8").includes("<svg")) fail(`Invalid SVG picture clue asset: ${asset}`);
}
const seenSingleLetters = new Set();
const seenClues = new Map();
const seenPairs = new Set();
const clueKey = value => String(value || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[«»"'.,!?—:;()]/g, "").replace(/\s+/g, " ").trim();
for (let i = 0; i < dictionary.length; i++) {
  const item = dictionary[i];
  const answer = normalize(item?.answer || item?.word);
  const clue = clueKey(item?.clue || item?.question || item?.emoji || item?.flag || item?.clueShort);
  const pair = answer + "|" + clue;
  if (seenPairs.has(pair)) fail(`Duplicate dictionary entry for ${answer}: ${clue}`);
  seenPairs.add(pair);
  if (answer.length === 1) {
    if (seenSingleLetters.has(answer)) fail(`Duplicate one-letter answer: ${answer}`);
    seenSingleLetters.add(answer);
  }
  if (clue && clue !== "что изображено на картинке") {
    const previous = seenClues.get(clue);
    if (previous && previous !== answer) fail(`Ambiguous clue shared by ${previous} and ${answer}: ${clue}`);
    seenClues.set(clue, answer);
  }
}
if (seenSingleLetters.size > 33) fail(`Unexpected number of one-letter answers: ${seenSingleLetters.size}`);
let valid = 0;
for (let i = 0; i < dictionary.length; i++) {
  const item = dictionary[i];
  const answer = normalize(item?.answer || item?.word);
  const clue = String(item?.clue || item?.question || item?.emoji || item?.flag || item?.clueShort || "").trim();
  if (!answer || answer.length > 12 || !clue) fail(`Dictionary entry ${i + 1} is incomplete or outside the 1–12 letter range`);
  else valid++;
}
if (!process.exitCode) console.log(`Validated ${valid} dictionary entries and all five picture clue assets.`);
