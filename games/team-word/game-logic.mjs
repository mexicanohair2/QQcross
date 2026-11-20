export const TEAM_WORD_REVEAL_INTERVAL_MS = 60_000;

export const TEAM_WORDS = Object.freeze([
  "арбуз","банан","берег","билет","белка","бочка","ветер","вилка","вишня","волна",
  "ворона","время","глина","гнездо","город","гриб","груша","дверь","дождь","доска",
  "ежик","жираф","завод","замок","запах","зебра","земля","зима","игрок","кабан",
  "кактус","камень","камин","капля","карта","катер","качели","кепка","кисть","книга",
  "кнопка","кобра","ковер","колено","колесо","комета","комната","конверт","корзина",
  "корова","космос","костер","кошка","краб","кран","кресло","кролик","кружка","крыша",
  "кузнец","кукла","курица","лавина","лампа","ландыш","леска","лимон","линейка","лиса",
  "листок","лодка","лопата","лошадь","луна","лыжи","магнит","майка","макет","малина",
  "маска","машина","медаль","медведь","мелок","метель","метро","молот","морковь","мост",
  "мотор","муха","мячик","набор","навес","нитка","ножницы","облако","огонь","океан",
  "окно","олень","орех","осень","остров","отель","пальма","панда","парус","паста",
  "паук","певец","пенал","перец","песок","петух","печать","печенье","письмо","пицца",
  "пламя","плита","погода","подкова","подушка","поезд","пожар","полка","помидор",
  "попугай","порог","порт","порция","поток","почка","пчела","пятно","радуга","ракета",
  "рамка","рубашка","рыба","рюкзак","сапог","сахар","свеча","свитер","север","сердце",
  "сетка","сигнал","сирень","скала","скворец","скрипка","солнце","сосна","спичка",
  "стакан","стена","степь","столик","струна","сумка","сурок","сцена","сырник","табак",
  "такси","тарелка","театр","телефон","тетрадь","тигр","ткань","тополь","торт","трава",
  "труба","туман","тыква","угол","улица","утка","факел","фазан","фонарь","футбол",
  "халат","хвост","хлеб","хлопок","хомяк","холод","цветок","чайник","часы","чашка",
  "чемодан","черепаха","чертеж","чехол","шапка","шарик","шахматы","шишка","школа",
  "шляпа","шоколад","шоссе","штора","штурвал","щетка","экран","эскимо","юбка","ящик"
]);

export function normalizeWord(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
}

export function revealRandomLetter(word, revealed = [], rng = Math.random) {
  const normalized = normalizeWord(word);
  const alreadyOpen = new Set(revealed.map((item) => Number(item.index)));
  const closed = Array.from({ length: normalized.length }, (_, index) => index)
    .filter((index) => !alreadyOpen.has(index));
  if (!closed.length) return null;
  const index = closed[Math.min(closed.length - 1, Math.floor(rng() * closed.length))];
  return { index, letter: normalized[index] };
}

export function scoreWordGuess(guess, answer) {
  const g = normalizeWord(guess).split("");
  const a = normalizeWord(answer).split("");
  if (g.length !== a.length) throw new RangeError("INVALID_WORD_LENGTH");
  const result = Array(g.length).fill("miss");
  const remaining = new Map();

  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === a[i]) result[i] = "green";
    else remaining.set(a[i], (remaining.get(a[i]) || 0) + 1);
  }
  for (let i = 0; i < g.length; i += 1) {
    if (result[i] === "green") continue;
    const count = remaining.get(g[i]) || 0;
    if (count > 0) {
      result[i] = "yellow";
      remaining.set(g[i], count - 1);
    }
  }
  return result;
}

// The bot sees only the mask, word length, and previous attempts. It is never passed the answer.
export function chooseTeamBotGuess({
  length,
  revealed = [],
  previous = [],
  words = TEAM_WORDS,
  rng = Math.random
} = {}) {
  const used = new Set(previous.map((item) => normalizeWord(typeof item === "string" ? item : item.word)));
  const mask = Array.from({ length }, () => null);
  for (const item of revealed) {
    const index = Number(item.index);
    if (Number.isInteger(index) && index >= 0 && index < length) {
      mask[index] = normalizeWord(item.letter).slice(0, 1);
    }
  }
  const pool = words
    .map(normalizeWord)
    .filter((word) => word.length === length && !used.has(word))
    .filter((word) => mask.every((letter, index) => letter === null || word[index] === letter));
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

export function wordMatchesMask(word, length, revealed = []) {
  const normalized = normalizeWord(word);
  if (normalized.length !== length) return false;
  return revealed.every(({ index, letter }) =>
    normalized[Number(index)] === normalizeWord(letter).slice(0, 1)
  );
}