export const DRAW_WORDS = Object.freeze([
  "арбуз","банан","белка","бочка","вишня","волна","ворона","гриб","груша","дверь",
  "дождь","ежик","жираф","замок","зебра","зеркало","зима","кабан","кактус","камень",
  "камин","капля","карта","каска","катер","качели","кепка","кисть","книга","кнопка",
  "кобра","ковер","колесо","комета","комната","конверт","корзина","корова","космос",
  "костер","кошка","краб","кран","кресло","кролик","кружка","крыша","кузнец","кукла",
  "курица","лампа","лимон","лиса","листок","лодка","лопата","лошадь","луна","лыжи",
  "магазин","магнит","майка","малина","маска","машина","медаль","медведь","мелок",
  "метель","метро","молот","морковь","мост","мотор","муха","мячик","облако","огонь",
  "океан","окно","олень","орех","осень","остров","пальма","панда","парус","паук",
  "пенал","перец","песок","петух","печенье","пианино","письмо","пицца","пламя","плита",
  "подкова","подушка","поезд","пожар","полка","помидор","попугай","порог","порт",
  "пчела","радуга","ракета","рамка","рыба","рюкзак","сапог","сахар","свеча","свитер",
  "сердце","сирень","скала","скворец","скрипка","солнце","сосна","стакан","стена",
  "степь","столик","струна","сумка","сурок","сцена","табак","такси","тарелка","театр",
  "телефон","тетрадь","тигр","ткань","торт","трава","труба","туман","тыква","угол",
  "улица","утка","факел","фазан","фонарь","футбол","халат","хвост","хлеб","хомяк",
  "холод","цветок","чайник","часы","чашка","чемодан","черепаха","чертеж","шапка",
  "шарик","шахматы","шишка","школа","шляпа","шоколад","шоссе","штора","штурвал",
  "щетка","экран","эскимо","юбка","ящик","автобус","аквариум","аккордеон","апельсин",
  "барабан","библиотека","велосипед","вертолет","водопад","гитара","динозавр","домино",
  "карандаш","карнавал","колокольчик","компас","корабль","космонавт","крокодил","мандарин",
  "медуза","мороженое","наушники","паровоз","пирамида","пылесос","самолет","самовар",
  "светофор","скейтборд","снеговик","телескоп","термометр","трамвай","фламинго","фотография",
  "электричка"
]);

export function normalizeDrawWord(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/ё/g,"е");
}

export function chooseLocalBotGuess({ words = DRAW_WORDS, previous = [], rng = Math.random } = {}) {
  const used = new Set(previous.map(normalizeDrawWord));
  const choices = words.map(normalizeDrawWord).filter((word) => word && !used.has(word));
  if (!choices.length) return null;
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

function stableSerialize(value) {
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + stableSerialize(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function appendOrderedEvent(events, event) {
  const sequence = Number(event?.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    return { events, accepted: false, reason: "INVALID_SEQUENCE" };
  }
  const existing = events.find((item) => Number(item.sequence) === sequence);
  if (existing) {
    return {
      events,
      accepted: stableSerialize(existing) === stableSerialize(event),
      duplicate: true,
      reason: stableSerialize(existing) === stableSerialize(event) ? null : "SEQUENCE_CONFLICT"
    };
  }
  const last = events.reduce((max,item) => Math.max(max,Number(item.sequence)||0),0);
  if (sequence !== last + 1) {
    return { events, accepted: false, reason: "SEQUENCE_GAP", expected: last + 1 };
  }
  return { events: [...events,event], accepted: true, duplicate: false };
}

export function replayDrawingEvents(events) {
  const strokes = [];
  const undone = new Set();
  for (const event of [...events].sort((a,b)=>Number(a.sequence)-Number(b.sequence))) {
    const type = event.type || event.event_type;
    const payload = event.payload || {};
    if (type === "clear") {
      strokes.length = 0;
      undone.clear();
    } else if (type === "undo") {
      const id = Number(event.strokeId ?? event.stroke_id ?? payload.strokeId);
      if (Number.isSafeInteger(id)) undone.add(id);
    } else if (type === "begin") {
      strokes.push({
        id: Number(event.strokeId ?? event.stroke_id),
        color: payload.color || "#ffffff",
        thickness: Number(payload.thickness) || 4,
        points: [{x:Number(payload.x),y:Number(payload.y)}]
      });
    } else if (type === "move" || type === "end") {
      const id = Number(event.strokeId ?? event.stroke_id);
      const stroke = strokes.find((item)=>item.id===id);
      if (stroke) stroke.points.push({x:Number(payload.x),y:Number(payload.y)});
    }
  }
  return strokes.filter((stroke)=>!undone.has(stroke.id));
}