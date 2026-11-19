const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const expectedPictures = {
  "airplane": "САМОЛЕТ",
  "apple": "ЯБЛОКО",
  "ball": "МЯЧ",
  "banana": "БАНАН",
  "bear": "МЕДВЕДЬ",
  "bee": "ПЧЕЛА",
  "bicycle": "ВЕЛОСИПЕД",
  "boat": "ЛОДКА",
  "book": "КНИГА",
  "bus": "АВТОБУС",
  "butterfly": "БАБОЧКА",
  "car": "МАШИНА",
  "carrot": "МОРКОВЬ",
  "cat": "КОТ",
  "clock": "ЧАСЫ",
  "cloud": "ОБЛАКО",
  "crocodile": "КРОКОДИЛ",
  "cucumber": "ОГУРЕЦ",
  "cup": "ЧАШКА",
  "dog": "СОБАКА",
  "dolphin": "ДЕЛЬФИН",
  "fish": "РЫБА",
  "fox": "ЛИСА",
  "giraffe": "ЖИРАФ",
  "grapes": "ВИНОГРАД",
  "guitar": "ГИТАРА",
  "hedgehog": "ЕЖ",
  "house": "ДОМ",
  "kangaroo": "КЕНГУРУ",
  "key": "КЛЮЧ",
  "lemon": "ЛИМОН",
  "lion": "ЛЕВ",
  "octopus": "ОСЬМИНОГ",
  "orange": "АПЕЛЬСИН",
  "owl": "СОВА",
  "parrot": "ПОПУГАЙ",
  "penguin": "ПИНГВИН",
  "snail": "УЛИТКА",
  "spider": "ПАУК",
  "strawberry": "КЛУБНИКА",
  "sun": "СОЛНЦЕ",
  "sunflower": "ПОДСОЛНУХ",
  "tiger": "ТИГР",
  "tomato": "ПОМИДОР",
  "whale": "КИТ",
  "zebra": "ЗЕБРА"
};
const pictureDescriptions = {
  apple: "яблоко",
  tomato: "помидор",
  cat: "кошка",
  bicycle: "велосипед",
  clock: "часы"
};
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
const normalize = value => String(value || "").toLocaleUpperCase("ru-RU").replace(/Ё/g, "Е").replace(/[^А-ЯA-Z]/g, "");
if (!Array.isArray(dictionary) || dictionary.length < 2000) {
  fail("Expected the current scanword dictionary with at least 2000 entries");
  process.exit();
}
const allPictureEntries = dictionary.filter(item => item.imageKey);
if (allPictureEntries.length !== 46 || new Set(allPictureEntries.map(item => item.imageKey)).size !== 46) {
  fail("The dictionary must contain exactly 46 unique picture clues, with no repeated image keys");
}
for (const item of allPictureEntries) {
  const answer = normalize(item.answer || item.word);
  const expectedAnswer = expectedPictures[item.imageKey];
  if (!expectedAnswer || answer !== expectedAnswer) fail(`Picture ${item.imageKey} does not match answer ${answer}; expected ${expectedAnswer || "a known answer"}`);
  if (!/что изображено/i.test(item.clue || "")) fail(`Picture ${item.imageKey} is missing its image-based clue prompt`);
}
for (const [imageKey, expectedAnswer] of Object.entries(expectedPictures)) {
  const answer = normalize(expectedAnswer);
  const matches = dictionary.filter(item => normalize(item.answer || item.word) === answer && item.imageKey === imageKey);
  if (matches.length !== 1) fail(`Expected exactly one ${answer} picture clue, found ${matches.length}`);
  const asset = `assets/scanword/${imageKey}.svg`;
  if (!fs.existsSync(asset)) fail(`Missing picture clue asset: ${asset}`);
  else if (!fs.readFileSync(asset, "utf8").includes("<svg")) fail(`Invalid SVG picture clue asset: ${asset}`);
}
const seenSingleLetters = new Set();
const seenClues = new Map();
const seenPairs = new Set();
const declaredSharedClueGroups = new Map();
const clueKey = value => String(value || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[«»"'.,!?—:;()]/g, "").replace(/\s+/g, " ").trim();
for (let i = 0; i < dictionary.length; i++) {
  const item = dictionary[i];
  const answer = normalize(item?.answer || item?.word);
  const clue = clueKey(item?.clue || item?.question || item?.emoji || item?.flag || item?.clueShort);
  const pair = answer + "|" + clue;
  if (seenPairs.has(pair)) fail(`Duplicate dictionary entry for ${answer}: ${clue}`);
  seenPairs.add(pair);
  const sharedClueGroup = String(item?.sharedClueGroup || "").trim();
  if (sharedClueGroup) {
    if (!/^[a-z0-9_-]{3,80}$/u.test(sharedClueGroup)) {
      fail(`Invalid sharedClueGroup identifier for ${answer}: ${sharedClueGroup}`);
    }
    if (!declaredSharedClueGroups.has(sharedClueGroup)) {
      declaredSharedClueGroups.set(sharedClueGroup, []);
    }
    declaredSharedClueGroups.get(sharedClueGroup).push({
      answer,
      clue,
      imageKey: item?.imageKey ?? null
    });
  }
  if (answer.length === 1) {
    if (seenSingleLetters.has(answer)) fail(`Duplicate one-letter answer: ${answer}`);
    seenSingleLetters.add(answer);
  }
  if (clue && clue !== "что изображено на картинке") {
    const previous = seenClues.get(clue);
    const sameDeclaredPair = Boolean(
      previous
      && sharedClueGroup
      && previous.sharedClueGroup === sharedClueGroup
    );
    if (previous && previous.answer !== answer && !sameDeclaredPair) {
      fail(`Ambiguous clue shared by ${previous.answer} and ${answer}: ${clue}`);
    }
    if (!previous) {
      seenClues.set(clue, {
        answer,
        sharedClueGroup,
        imageKey: item?.imageKey ?? null
      });
    }
  }
}
for (const [groupId, entries] of declaredSharedClueGroups) {
  const uniqueAnswers = new Set(entries.map(entry => entry.answer));
  if (entries.length !== 2 || uniqueAnswers.size !== 2 || entries.some(entry => entry.imageKey)) {
    fail(`Shared clue group ${groupId} must contain exactly two different text answers and no image clues; got ${entries.length} records.`);
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
if (!process.exitCode) console.log(`Validated ${valid} dictionary entries and all ${Object.keys(expectedPictures).length} unique picture clue assets.`);
