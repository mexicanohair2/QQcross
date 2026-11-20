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

// Small offline recognizer for common silhouettes. It reads stroke geometry only;
// it never receives the secret word and does not fall back to random answers.
export function recognizeDrawing(strokes = []) {
  const valid = (strokes || []).map((stroke) => ({
    points: (stroke?.points || []).filter((p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
  })).filter((stroke) => stroke.points.length >= 2);
  if (!valid.length) return [];

  const all = valid.flatMap((stroke) => stroke.points);
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const diagonal = Math.hypot(maxX - minX, maxY - minY) || 1;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const features = valid.map(({ points }) => {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const sx = Math.min(...xs), ex = Math.max(...xs), sy = Math.min(...ys), ey = Math.max(...ys);
    const width = ex - sx, height = ey - sy, boxDiagonal = Math.hypot(width, height) || 1;
    let length = 0;
    for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    const chord = Math.hypot(points[0].x - points[points.length-1].x, points[0].y - points[points.length-1].y);
    const closed = points.length >= 7 && chord <= boxDiagonal * 0.24;
    let twiceArea = 0;
    if (closed) for (let i = 0; i < points.length; i += 1) {
      const a = points[i], b = points[(i+1) % points.length];
      twiceArea += a.x * b.y - b.x * a.y;
    }
    const perimeter = closed ? length + chord : length;
    const circularity = perimeter > 0 ? (4 * Math.PI * Math.abs(twiceArea / 2)) / (perimeter * perimeter) : 0;
    let corners = 0;
    for (let i = 2; i < points.length - 2; i += 1) {
      const a = points[i-2], b = points[i], c = points[i+2];
      const ux = a.x-b.x, uy = a.y-b.y, vx = c.x-b.x, vy = c.y-b.y;
      const denom = Math.hypot(ux,uy) * Math.hypot(vx,vy);
      if (!denom) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, (ux*vx+uy*vy)/denom)));
      if (angle > 0.78) corners += 1;
    }
    const aspect = width / Math.max(height, 0.0001);
    const isCircle = closed && circularity > 0.42 && aspect > 0.55 && aspect < 1.8;
    const isTriangle = closed && corners >= 2 && corners <= 5 && circularity < 0.58;
    const isRectangle = closed && corners >= 3 && corners <= 7 && circularity >= 0.12 && circularity < 0.78;
    const line = !closed && length > diagonal * 0.12 && chord > 0 && length / chord < 1.55;
    const angle = Math.atan2(points[points.length-1].y-points[0].y, points[points.length-1].x-points[0].x);
    const tiny = boxDiagonal < diagonal * 0.12;
    const radial = line && Math.min(
      Math.hypot(points[0].x-center.x, points[0].y-center.y),
      Math.hypot(points[points.length-1].x-center.x, points[points.length-1].y-center.y)
    ) < diagonal * 0.2;
    return { isCircle, isTriangle, isRectangle, line, angle, tiny, radial };
  });
  const count = (key) => features.filter((f) => f[key]).length;
  const circles = count("isCircle"), triangles = count("isTriangle"), rectangles = count("isRectangle");
  const lines = features.filter((f) => f.line), dots = count("tiny"), radial = count("radial");
  let parallel = 0;
  for (let i = 0; i < lines.length; i += 1) for (let j = i+1; j < lines.length; j += 1) {
    const diff = Math.abs(Math.atan2(Math.sin(lines[i].angle-lines[j].angle), Math.cos(lines[i].angle-lines[j].angle)));
    if (Math.min(diff, Math.PI-diff) < 0.28) parallel += 1;
  }
  const ranked = [];
  const add = (word, score, minimum = 0.62) => { if (score >= minimum) ranked.push({ word, confidence: Math.min(0.96, Number(score.toFixed(2))) }); };
  if (circles >= 1 && radial >= 4) add("солнце", 0.28 + Math.min(radial,8)*0.085 + Math.min(circles,2)*0.12, 0.68);
  if (circles >= 2 && rectangles >= 1) add("машина", 0.35 + Math.min(circles,2)*0.22 + Math.min(rectangles,2)*0.22, 0.78);
  if (circles >= 2 && lines.length >= 2) add("велосипед", 0.32 + Math.min(circles,2)*0.22 + Math.min(lines.length,4)*0.09, 0.78);
  if (circles >= 1 && triangles >= 1) add("рыба", 0.34 + Math.min(circles,2)*0.24 + Math.min(triangles,2)*0.22, 0.76);
  if (triangles >= 1 && dots >= 2) add("пицца", 0.38 + Math.min(triangles,2)*0.24 + Math.min(dots,4)*0.08, 0.76);
  if (circles >= 1 && triangles >= 2 && dots >= 2) add("кошка", 0.24 + Math.min(circles,2)*0.18 + Math.min(triangles,2)*0.22 + Math.min(dots,3)*0.08, 0.78);
  if (circles >= 1 && parallel >= 2) add("арбуз", 0.35 + Math.min(circles,2)*0.2 + Math.min(parallel,4)*0.1, 0.78);
  if (rectangles >= 1 && lines.length >= 1 && dots >= 2) add("домино", 0.34 + Math.min(rectangles,2)*0.2 + Math.min(lines.length,2)*0.12 + Math.min(dots,3)*0.08, 0.78);
  return ranked.sort((a,b) => b.confidence-a.confidence);
}
