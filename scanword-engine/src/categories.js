export const DICTIONARY_CATEGORIES = Object.freeze([
  { id: 'animals', label: 'Животные', description: 'Дикие и домашние животные, птицы, рыбы и насекомые.' },
  { id: 'plants', label: 'Растения', description: 'Деревья, цветы, травы, грибы и плоды растений.' },
  { id: 'food', label: 'Еда и напитки', description: 'Продукты, блюда, напитки и кулинария.' },
  { id: 'nature', label: 'Природа', description: 'Погода, природные явления, ландшафты и окружающий мир.' },
  { id: 'geography', label: 'География', description: 'Страны, города, регионы, водоёмы и географические объекты.' },
  { id: 'science', label: 'Наука и техника', description: 'Научные понятия, техника, приборы и технологии.' },
  { id: 'household', label: 'Быт и предметы', description: 'Дом, одежда, мебель, инструменты и повседневные вещи.' },
  { id: 'transport', label: 'Транспорт', description: 'Машины, суда, самолёты и другие средства передвижения.' },
  { id: 'culture', label: 'Культура и искусство', description: 'Музыка, литература, театр, искусство и традиции.' },
  { id: 'sport', label: 'Спорт', description: 'Виды спорта, инвентарь, соревнования и движения.' },
  { id: 'people', label: 'Люди и профессии', description: 'Профессии, занятия и роли людей.' },
  { id: 'logic', label: 'Логика и загадки', description: 'Логические вопросы, загадки и задачи на сообразительность.' },
  { id: 'concepts', label: 'Понятия', description: 'Абстрактные понятия, свойства, состояния и отношения.' },
  { id: 'other', label: 'Другое', description: 'Слова, которым пока не назначена более точная категория.' }
]);

const CATEGORY_IDS = new Set(DICTIONARY_CATEGORIES.map(item => item.id));
const ALIASES = new Map([
  ['животные', 'animals'], ['животное', 'animals'], ['animals', 'animals'],
  ['растения', 'plants'], ['растение', 'plants'], ['plants', 'plants'],
  ['еда', 'food'], ['пища', 'food'], ['напитки', 'food'], ['food', 'food'],
  ['природа', 'nature'], ['nature', 'nature'],
  ['география', 'geography'], ['страны', 'geography'], ['geography', 'geography'],
  ['наука', 'science'], ['техника', 'science'], ['science', 'science'],
  ['быт', 'household'], ['предметы', 'household'], ['household', 'household'],
  ['транспорт', 'transport'], ['transport', 'transport'],
  ['культура', 'culture'], ['искусство', 'culture'], ['culture', 'culture'],
  ['спорт', 'sport'], ['sport', 'sport'],
  ['профессии', 'people'], ['люди', 'people'], ['people', 'people'],
  ['логика', 'logic'], ['загадки', 'logic'], ['logic', 'logic'],
  ['понятия', 'concepts'], ['concepts', 'concepts'],
  ['другое', 'other'], ['прочее', 'other'], ['other', 'other']
]);

const RULES = [
  ['animals', /животн|звер|птиц|рыб|насеком|млекопита|кошач|собач|хищник|домашн(?:ее|его) животн/iu],
  ['plants', /растени|дерев|цвет|цветок|кустарник|трава|гриб|ягод|плод|листв|корн/iu],
  ['food', /фрукт|овощ|ягод|еда|пищ|напит|выпеч|блюд|сладост|мясо|молочн|кулинар|завтрак|обед|ужин/iu],
  ['transport', /транспорт|автомобил|машин|велосипед|самол[её]т|вертол[её]т|корабл|судн|поезд|вагон|автобус|трамва|метро/iu],
  ['geography', /стран|город|столиц|континент|материк|остров|полуостров|океан|море|река|озер|залив|пустын|гора|горн(?:ый|ая) хребет|флаг/iu],
  ['science', /наук|физик|хими|биолог|математ|минерал|веществ|энерги|электр|прибор|устройств|технолог|измерени|механизм|атом|молекул/iu],
  ['household', /предмет|вещь|инструмент|мебел|одежд|обув|посуда|кухон|домашн|комнат|здани|строительств|ключ|часы|телефон/iu],
  ['culture', /музык|песн|композитор|писател|поэт|книг|роман|театр|кино|фильм|искусств|картина|художник|литератур|танец|традиц/iu],
  ['sport', /спорт|игр(?:а|е|у)|соревнован|чемпион|трениров|мяч|команд|атлет|плаван|бег|прыж|лыж|шахмат/iu],
  ['people', /професс|работник|специалист|врач|учител|повар|строител|водител|пожарн|учёный|ученый|мастер|человек|люд[ие]/iu],
  ['logic', /логическ|загадк|сообразитель|задач[аеу]|что возвращает|кто всегда|найди закономерност/iu],
  ['nature', /природ|погод|облако|дожд|снег|ветер|гроз|молни|радуг|климат|ландшафт|землетряс|вулкан|пейзаж/iu]
];

const IMAGE_CATEGORIES = new Map([
  ['apple', 'food'], ['banana', 'food'], ['carrot', 'food'], ['cucumber', 'food'],
  ['grapes', 'food'], ['lemon', 'food'], ['orange', 'food'], ['strawberry', 'food'],
  ['tomato', 'food'], ['cat', 'animals'], ['dog', 'animals'], ['bear', 'animals'],
  ['bee', 'animals'], ['butterfly', 'animals'], ['crocodile', 'animals'],
  ['dolphin', 'animals'], ['fish', 'animals'], ['fox', 'animals'], ['giraffe', 'animals'],
  ['hedgehog', 'animals'], ['kangaroo', 'animals'], ['lion', 'animals'], ['octopus', 'animals'],
  ['owl', 'animals'], ['parrot', 'animals'], ['penguin', 'animals'], ['snail', 'animals'],
  ['spider', 'animals'], ['tiger', 'animals'], ['whale', 'animals'], ['zebra', 'animals'],
  ['sunflower', 'plants'], ['sun', 'nature'], ['cloud', 'nature'],
  ['airplane', 'transport'], ['bicycle', 'transport'], ['boat', 'transport'], ['bus', 'transport'], ['car', 'transport'],
  ['book', 'culture'], ['guitar', 'culture'], ['clock', 'household'], ['cup', 'household'],
  ['house', 'household'], ['key', 'household']
]);

export function normalizeDictionaryCategory(value) {
  const key = String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('ru-RU');
  if (!key) return null;
  const category = ALIASES.get(key);
  return category && CATEGORY_IDS.has(category) ? category : null;
}

export function categorizeDictionaryEntry(raw = {}) {
  const explicit = normalizeDictionaryCategory(raw.category);
  if (explicit) return explicit;
  for (const tag of Array.isArray(raw.tags) ? raw.tags : []) {
    const category = normalizeDictionaryCategory(tag);
    if (category) return category;
  }
  if (raw.logic === true) return 'logic';
  const imageCategory = IMAGE_CATEGORIES.get(String(raw.imageKey ?? raw.image?.key ?? '').trim().toLowerCase());
  if (imageCategory) return imageCategory;
  const text = String(raw.question ?? raw.clue ?? '').normalize('NFC').toLocaleLowerCase('ru-RU');
  if (/[\\u{1F1E6}-\\u{1F1FF}]{2}/u.test(text)) return 'geography';
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) return category;
  }
  return 'other';
}

export function groupDictionaryEntries(entries = []) {
  const groups = Object.fromEntries(DICTIONARY_CATEGORIES.map(item => [item.id, []]));
  for (const entry of entries) {
    const category = normalizeDictionaryCategory(entry?.category) ?? categorizeDictionaryEntry(entry);
    groups[category].push(entry);
  }
  return groups;
}

export function getDictionaryCategoryStats(entries = []) {
  const groups = groupDictionaryEntries(entries);
  return Object.fromEntries(DICTIONARY_CATEGORIES.map(item => [item.id, groups[item.id].length]));
}

export function filterDictionaryByCategories(entries = [], selected = []) {
  const allowed = new Set(selected.map(normalizeDictionaryCategory).filter(Boolean));
  if (!allowed.size) return [...entries];
  return entries.filter(entry => allowed.has(normalizeDictionaryCategory(entry?.category) ?? categorizeDictionaryEntry(entry)));
}
