(function () {
"use strict";
const LETTERS = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
let lexiconPromise = null;
let clueIndex = new Map();
const EXTRA_CLUES={
 "МОНИТОР":"Экран компьютера, на котором отображается изображение.",
 "МЫШКА":"Устройство для управления курсором на компьютере.",
 "ПЛАНШЕТ":"Портативное устройство с сенсорным экраном.",
 "ПРИНТЕР":"Устройство, которое печатает документы и изображения.",
 "НАУШНИКИ":"Аксессуар, через который слушают звук лично.",
 "ДИНАМИК":"Устройство, превращающее сигнал в звук.",
 "ПРОЦЕССОР":"Главный вычислительный компонент компьютера.",
 "КАБЕЛЬ":"Провод для передачи электричества или данных.",
 "СЕРВЕР":"Компьютер или программа, предоставляющие данные другим.",
 "НОУТБУК":"Переносной компьютер с экраном и клавиатурой.",
 "СМАРТФОН":"Мобильный телефон с операционной системой и приложениями.",
 "ПРИЛОЖЕНИЕ":"Программа для выполнения определённой задачи.",
 "ИНТЕРНЕТ":"Глобальная сеть, соединяющая компьютеры.",
 "ДИСПЛЕЙ":"Экран электронного устройства.",
 "КОРПУС":"Внешняя оболочка устройства или компьютера.",
 "ПАМЯТЬ":"Компонент, где компьютер хранит данные.",
 "ФАЙЛ":"Именованный набор данных на устройстве.",
 "САЙТ":"Набор связанных веб-страниц.",
 "СЕТЬ":"Соединение устройств для обмена данными.",
 "МОДЕМ":"Устройство для подключения к сети передачи данных.",
 "ЗАРЯДКА":"Устройство для пополнения энергии аккумулятора.",
 "КОЛОНКА":"Акустическое устройство для воспроизведения звука.",
 "ПЛАТА":"Основа с электронными компонентами и дорожками.",
 "ЧИП":"Миниатюрная электронная микросхема.",
 "КОД":"Запись команд или данных с помощью символов.",
 "ДАННЫЕ":"Информация, которую можно хранить и обрабатывать.",
 "СЕРВИС":"Онлайн-служба или функция, доступная пользователю.",
 "АНТЕННА":"Устройство для приёма или передачи радиосигнала."
};
const clueFor = word => clueIndex.get(norm(word)) || EXTRA_CLUES[norm(word)] || "Подумай, что обозначает это слово.";
const norm = value => String(value || "").toUpperCase().replace(/Ё/g, "Е").replace(/[^А-Я]/g, "");
const shuffle = values => { const a = [...values]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const counts = word => [...norm(word)].reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{});
function canBuild(word, bag) { const a=counts(word), b=counts(bag); return Object.keys(a).every(k=>(b[k]||0)>=a[k]); }
async function loadLexicon() {
  if (!lexiconPromise) lexiconPromise = (async()=>{
    let d;
    try{const r=await fetch("./data/russian-words-100000.json");if(!r.ok)throw new Error("100k lexicon unavailable");d=await r.json();}
    catch(_){const r=await fetch("./data/russian-words-50000.json");if(!r.ok)throw new Error("Не удалось загрузить словарь");d=await r.json();}
    if(d.language!=="ru"||![50000,100000].includes(d.count)||!Array.isArray(d.words)||d.words.length!==d.count)throw new Error("Словарь не прошёл проверку количества слов");
    const words=[...new Set(d.words.map(norm).filter(w=>/^[А-Я]{2,18}$/.test(w)))];
    if(words.length!==d.count)throw new Error("В словаре обнаружены дубликаты или некорректные записи");
    return words;
  })().catch(e=>{lexiconPromise=null;throw e;});
  return lexiconPromise;
}
function sound(kind) {window.QQAudio?.play(({win:"word",hint:"wrong",good:"correct",letter:"letter",select:"select"})[kind]||"correct");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function bindStrawHat(root){root.querySelectorAll(".qq-straw-hat").forEach(hat=>{if(hat.dataset.qqHatBound)return;hat.dataset.qqHatBound="true";hat.dataset.qqStrawHatTrigger="";hat.setAttribute("role","button");hat.setAttribute("tabindex","0");const tap=()=>{const n=window.QQProgression?.tapHat?.()||0;if(n===15)hat.setAttribute("aria-label","Секретный титул Mugiwara открыт");};hat.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();tap()});hat.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tap()}})})}
function shell(root,title,onExit,body){root.innerHTML='<div class="screen qq-extra-screen"><div class="top qq-extra-top"><button type="button" class="btn" data-exit>← Назад</button><b>'+title+'</b><span class="qq-extra-mark">QQ <span class="qq-straw-hat" title="Сенная шляпа">👒</span></span></div>'+body+'</div>';root.querySelector("[data-exit]").onclick=onExit;bindStrawHat(root);}
function pathBetween(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(Math.abs(dx),Math.abs(dy));
 if(!steps)return [{x:a.x,y:a.y}];
 const out=[];let x=a.x,y=a.y,ix=0,iy=0;
 out.push({x,y});
 while(ix<Math.abs(dx)||iy<Math.abs(dy)){
  const lhs=(1+2*ix)*Math.abs(dy),rhs=(1+2*iy)*Math.abs(dx);
  if(lhs===rhs){x+=Math.sign(dx);y+=Math.sign(dy);ix++;iy++;}
  else if(lhs<rhs){x+=Math.sign(dx);ix++;}
  else{y+=Math.sign(dy);iy++;}
  out.push({x,y});
 }
 return out;
}
const LEVEL_TOTAL=1000;
const SEARCH_THEMES=[
{name:"Животный мир",words:"КОШКА СОБАКА ЛОШАДЬ КОРОВА ОВЦА КОЗА ЗАЯЦ БЕЛКА ЛИСИЦА ВОЛК МЕДВЕДЬ ТИГР ЛЕВ ЖИРАФ СЛОН ЗЕБРА ПАНДА ЕНОТ ХОМЯК ВЫДРА ОРЕЛ ВОРОНА ЛЕБЕДЬ УТКА ПИНГВИН ДЕЛЬФИН КИТ АКУЛА КРОЛИК БАРСУК БОБР КРОТ ЕЖ БУЙВОЛ АНТИЛОПА ЛЕОПАРД КРОКОДИЛ ЧЕРЕПАХА ЯЩЕРИЦА ЗМЕЯ ЛЯГУШКА ПЧЕЛА МУРАВЕЙ БАБОЧКА СТРЕКОЗА КОМАР МУХА ОСА ПАУК ГОЛУБЬ ГУСЬ ИНДЮК ПЕТУХ КУРИЦА".split(" ")},
{name:"Зимний лес",words:"ЕЛЬ СОСНА БЕРЕЗА ОСИНА КЕДР ЛИСТВА ВЕТКА КОРЕНЬ СНЕГ МОРОЗ ИНЕЙ СУГРОБ ШИШКА ТРОПА ПОЛЯНА РУЧЕЙ ЗАЙЦЫ ЛИСА ВОЛК СОВА ДЯТЕЛ ЛОСЬ ОЛЕНЬ ЛЕС ПИХТА ЛИПА ДУБ КЛЕН РЯБИНА ЧЕРЕМУХА ОРЕШНИК БУК ЯСЕНЬ ОПУШКА БУРЕЛОМ СНЕГОПАД МЕТЕЛЬ ВЬЮГА СНЕГОВИК КОРЯГА ЗИМА ЛЕД ХОЛОД".split(" ")},
{name:"Морское путешествие",words:"КОРАБЛЬ МАЯК ПАРУС ЯКОРЬ ВОЛНА ОКЕАН МОРЕ БЕРЕГ ОСТРОВ КАПИТАН МАТРОС ШТОРМ РЫБАК ЧАЙКА ДЕЛЬФИН КИТ РАКУШКА КОРАЛЛ ПРИБОЙ ПОДЛОДКА КАТЕР ЛОДКА ЯХТА БАРЖА ПАРОМ ПИРС ПРИСТАНЬ ОТЛИВ ПРИЛИВ БУЙ МЕДУЗА КРАБ КАЛЬМАР СКАТ ОСЬМИНОГ УСТРИЦА МИДИЯ ТЮЛЕНЬ МОРЖ КАСАТКА ПЕЛИКАН".split(" ")},
{name:"Домашний уют",words:"КОМНАТА КУХНЯ ДИВАН КРЕСЛО ПОДУШКА ОДЕЯЛО КОВЕР ЛАМПА ОКНО ДВЕРЬ ПОЛКА КНИГА ЧАШКА ЧАЙНИК СВЕЧА ЗЕРКАЛО ШТОРА КОМОД КРОВАТЬ СТОЛ СТУЛ ПЛИТА ПЕЧЬ ХОЛОДИЛЬНИК ТЕЛЕВИЗОР КАРТИНА КАСТРЮЛЯ СКОВОРОДА ТАРЕЛКА ЛОЖКА ВИЛКА НОЖ ПОДНОС ПОЛОТЕНЦЕ ВАЗА КОВРИК ПРИХОЖАЯ ВАННАЯ БАЛКОН ГАРДЕРОБ ШКАФ".split(" ")},
{name:"Космос",words:"КОСМОС ПЛАНЕТА ЗВЕЗДА КОМЕТА МЕТЕОР ОРБИТА РАКЕТА СПУТНИК ЛУНА СОЛНЦЕ ГАЛАКТИКА ВАКУУМ АСТРОНОМ ТЕЛЕСКОП САТУРН МАРС ВЕНЕРА ЮПИТЕР АСТЕРОИД АСТРОНАВТ КОСМОНАВТ НЕВЕСОМОСТЬ РОБОТ СКАФАНДР КОСМОДРОМ ЗАТМЕНИЕ СОЗВЕЗДИЕ ТУМАННОСТЬ МЕРКУРИЙ НЕПТУН УРАН ПЛУТОН ВОСХОД ЗАКАТ".split(" ")},
{name:"Вкусная кухня",words:"ЯБЛОКО БАНАН ГРУША СЛИВА ВИШНЯ ЛИМОН АПЕЛЬСИН МОРКОВЬ КАРТОФЕЛЬ ОГУРЕЦ ПОМИДОР КАПУСТА ТЫКВА КАША ПИРОГ СУП САЛАТ ХЛЕБ МЕД КЛУБНИКА МАЛИНА ЧЕРНИКА СМОРОДИНА АРБУЗ ДЫНЯ ПЕРСИК АБРИКОС МАНГО АНАНАС ГРАНАТ ФИНИК ИЗЮМ ОРЕХ ГРИБ СЫР ТВОРОГ КЕФИР ЙОГУРТ СМЕТАНА МУКА САХАР СОЛЬ ПЕРЕЦ УКРОП ПЕТРУШКА".split(" ")},
{name:"Город",words:"УЛИЦА ПЛОЩАДЬ ПАРК МОСТ ДОРОГА ВОКЗАЛ МУЗЕЙ ТЕАТР ШКОЛА БИБЛИОТЕКА МАГАЗИН АПТЕКА ФОНТАН БАШНЯ ТРАМВАЙ АВТОБУС МЕТРО ПЕРЕХОД ПЕРЕУЛОК ПРОСПЕКТ БУЛЬВАР ПОДЪЕЗД ДОМ ДВОР ЗДАНИЕ НЕБОСКРЕБ ПАМЯТНИК ВОРОТА СТАДИОН КИНОТЕАТР БОЛЬНИЦА ПОЛИКЛИНИКА ПОЧТА БАНК РЫНОК ПЕКАРНЯ КАФЕ РЕСТОРАН ЗАПРАВКА ТРОТУАР".split(" ")},
{name:"Путешествия",words:"БИЛЕТ ВОКЗАЛ ПОЕЗД САМОЛЕТ АЭРОПОРТ ЧЕМОДАН ПАСПОРТ КАРТА МАРШРУТ ГОСТИНИЦА ПАЛАТКА РЮКЗАК ПРИЧАЛ ЭКСКУРСИЯ ПЛЯЖ ДОЛИНА ВОСТОК ЗАПАД ПУТЕШЕСТВИЕ ПОХОД СПАЛЬНИК КОМПАС НАВИГАТОР РАСПИСАНИЕ ПЛАТФОРМА ВАГОН КУПЕ КАЮТА КРУИЗ СУВЕНИР ФОТОАППАРАТ БИНОКЛЬ ТУРИСТ ПРИКЛЮЧЕНИЕ КАРАВАН ПЕРЕВАЛ ПРИВАЛ ПЕРЕПРАВА".split(" ")},
{name:"Растения",words:"РОМАШКА РОЗА ТЮЛЬПАН ПИОН СИРЕНЬ ЛИЛИЯ ГВОЗДИКА МАК ВАСИЛЕК ПОДСОЛНУХ КЛЕВЕР КАКТУС ПАПОРОТНИК БАМБУК ЖАСМИН ЛЕПЕСТОК ПОДСНЕЖНИК ЛЮТИК НЕЗАБУДКА ГЕРАНЬ ФИАЛКА ГОРТЕНЗИЯ ОДУВАНЧИК КОЛОКОЛЬЧИК КУВШИНКА ЛОТОС МОЖЖЕВЕЛЬНИК КИПАРИС ТОПОЛЬ ИВА КАШТАН СЕМЯ РОСТОК БУТОН СТЕБЕЛЬ".split(" ")},
{name:"Техника",words:"КОМПЬЮТЕР МОНИТОР КЛАВИАТУРА МЫШКА ТЕЛЕФОН ПЛАНШЕТ КАМЕРА РОБОТ ПРИНТЕР НАУШНИКИ ДИНАМИК МИКРОФОН БАТАРЕЯ ПРОЦЕССОР ЭКРАН КАБЕЛЬ СЕРВЕР НОУТБУК СМАРТФОН ПРИЛОЖЕНИЕ ПРОГРАММА ИНТЕРНЕТ СИСТЕМА ДИСПЛЕЙ КОРПУС ПАМЯТЬ ДИСК ФАЙЛ ПАПКА САЙТ СЕТЬ МОДЕМ СИГНАЛ АНТЕННА АККУМУЛЯТОР ЗАРЯДКА КОЛОНКА ГАРНИТУРА ПЛАТА ЧИП КОД ДАННЫЕ ПАРОЛЬ ОБЛАКО СЕРВИС".split(" ")}
];
function readUnlocked(key){try{return Math.max(1,Math.min(LEVEL_TOTAL,Number(localStorage.getItem(key))||1));}catch(_){return 1;}}
function unlockNext(key,level){try{localStorage.setItem(key,String(Math.max(readUnlocked(key),Math.min(LEVEL_TOTAL,level+1))));}catch(_){}}
function renderLevelMap(root,title,onExit,key,openLevel){
 const unlocked=readUnlocked(key);
 shell(root,title,onExit,'<section class="qq-level-intro"><b>ПУТЕШЕСТВИЕ ПО СЛОВАМ</b><span>Открыто до '+unlocked+' уровня из '+LEVEL_TOTAL+'</span></section><div class="qq-level-grid" aria-label="Выбор уровня">'+Array.from({length:LEVEL_TOTAL},(_,i)=>{const n=i+1,done=n<unlocked,locked=n>unlocked;return '<button type="button" class="qq-level-dot '+(done?"done":locked?"locked":"current")+'" data-level="'+n+'" '+(locked?"disabled":"")+' aria-label="Уровень '+n+'">'+n+'</button>';}).join("")+'</div>');
 root.querySelector(".qq-extra-screen").classList.add("qq-level-screen");
 root.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>openLevel(+b.dataset.level));
 root.querySelector(".qq-level-dot.current")?.scrollIntoView({block:"center"});
}
function levelComplete(root,key,level,next){
 unlockNext(key,level);
 const panel=document.createElement("section");panel.className="qq-level-complete";
 panel.innerHTML='<b>Уровень '+level+' пройден</b><span>Следующий уровень открыт.</span><button type="button" class="btn primary" id="qqLevelContinue">'+(level===LEVEL_TOTAL?"К уровням":"Следующий уровень")+'</button>';
 root.querySelector(".qq-extra-screen")?.append(panel);
 const button=panel.querySelector("#qqLevelContinue");const timer=setTimeout(next,1800);button.onclick=()=>{clearTimeout(timer);next();};
}
function buildSearchPuzzle(words,level){
 const theme=SEARCH_THEMES[(level-1)%SEARCH_THEMES.length],lexicon=new Set(words);
 const pool=shuffle(theme.words.filter(w=>w.length>=4&&w.length<=12&&lexicon.has(w)&&(clueIndex.has(w)||EXTRA_CLUES[w])));
 const count=Math.min(30,level<=20?5+Math.floor((level-1)/2):14+Math.floor((level-20)/30));
 let size=Math.min(25,level<=20?9+Math.floor((level-1)/2):18+Math.floor((level-20)/100));
 let chosen=pool.slice(0,count);
 if(chosen.length<5)chosen=shuffle(theme.words.filter(w=>w.length>=4&&w.length<=12&&lexicon.has(w)&&(clueIndex.has(w)||EXTRA_CLUES[w]))).slice(0,Math.max(5,count));
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
 let grid,placed;
 for(let grow=0;grow<8;grow++){
  grid=Array.from({length:size},()=>Array(size).fill(""));placed=[];
  for(const word of [...chosen].sort((a,b)=>b.length-a.length)){
   let done=false;
   for(let attempt=0;attempt<500&&!done;attempt++){
    const d=dirs[Math.floor(Math.random()*dirs.length)],x=Math.floor(Math.random()*size),y=Math.floor(Math.random()*size),ex=x+d[0]*(word.length-1),ey=y+d[1]*(word.length-1);
    if(ex<0||ex>=size||ey<0||ey>=size)continue;
    let ok=true;for(let i=0;i<word.length;i++){const old=grid[y+d[1]*i][x+d[0]*i];if(old&&old!==word[i]){ok=false;break;}}
    if(!ok)continue;
    const cells=[];for(let i=0;i<word.length;i++){const p={x:x+d[0]*i,y:y+d[1]*i};grid[p.y][p.x]=word[i];cells.push(p);}
    placed.push({word,cells,found:false});done=true;
   }
  }
  if(placed.length>=Math.min(chosen.length,Math.max(5,count-2))||size>=25)break;
  size++;
 }
 const targets=new Set(placed.map(p=>p.word));let decoy="";
 for(const p of placed){
  const chars=[...p.word];
  for(let i=1;i<chars.length-1&&!decoy;i++){
   const old=chars[i];
   for(const ch of LETTERS){if(ch===old)continue;chars[i]=ch;const candidate=chars.join("");if(!lexicon.has(candidate)&&!targets.has(candidate)){decoy=candidate;break;}}
   chars[i]=old;
  }
  if(decoy)break;
 }
 if(decoy){
  let inserted=false;
  for(let a=0;a<120&&!inserted;a++){
   const d=dirs[Math.floor(Math.random()*dirs.length)],x=Math.floor(Math.random()*size),y=Math.floor(Math.random()*size),ex=x+d[0]*(decoy.length-1),ey=y+d[1]*(decoy.length-1);
   if(ex<0||ex>=size||ey<0||ey>=size)continue;
   let ok=true;for(let i=0;i<decoy.length;i++){const old=grid[y+d[1]*i][x+d[0]*i];if(old&&old!==decoy[i]){ok=false;break;}}
   if(ok){for(let i=0;i<decoy.length;i++)grid[y+d[1]*i][x+d[0]*i]=decoy[i];inserted=true;}
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!grid[y][x])grid[y][x]=LETTERS[Math.floor(Math.random()*LETTERS.length)];
 return {size,grid,placed,theme:theme.name,decoy};
}
function mountSearch(root,onExit,words){
 const KEY="qqcross.search.unlocked.v1";
 const showMap=()=>renderLevelMap(root,"Поиск слов",onExit,KEY,playLevel);
 function playLevel(level){
  const puzzle=buildSearchPuzzle(words,level);let start=null,drag=false,solved=new Set(),selection=[],tapStart=null,completed=false;
  const body='<div class="qq-search-level-meta"><span>УРОВЕНЬ '+level+'</span><b>'+puzzle.theme+'</b></div><div class="qq-search-progress" id="qqProgress">Найдено: 0 / '+puzzle.placed.length+'</div><div class="qq-search-grid" id="qqSearchGrid" style="--qq-cols:'+puzzle.size+';--qq-size:'+puzzle.size+'">'+puzzle.grid.map((row,y)=>row.map((letter,x)=>'<button type="button" class="qq-search-cell" data-x="'+x+'" data-y="'+y+'" aria-label="Строка '+(y+1)+', столбец '+(x+1)+'">'+letter+'</button>').join("")).join("")+'</div><div class="qq-search-clues" id="qqSearchClues" aria-label="Вопросы к словам">'+puzzle.placed.map((p,i)=>'<div class="qq-search-clue" data-clue-word="'+p.word+'"><b>'+(i+1)+'.</b><span>'+escapeHtml(clueFor(p.word))+'</span></div>').join("")+'</div><div class="qq-search-actions"><span class="qq-search-hint">Ищи слова по горизонтали, вертикали и диагонали.</span><button type="button" class="btn" id="qqSearchBulb">💡 Подсказка</button></div><div class="qq-word-discovery-list" id="qqSearchFoundList"></div>';
  shell(root,"Поиск слов · "+level,showMap,body);root.querySelector(".qq-extra-screen").classList.add("qq-search-screen");
  const grid=root.querySelector("#qqSearchGrid"),progress=root.querySelector("#qqProgress"),cellAt=(x,y)=>grid.querySelector('[data-x="'+x+'"][data-y="'+y+'"]');
  function clear(){grid.querySelectorAll(".qq-search-cell").forEach(c=>c.classList.remove("qq-selected"));selection=[];}
  function markPath(path){clear();selection=path;path.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-selected"));}
  function finish(path){
   if(!path.length||completed)return;
   const value=path.map(p=>puzzle.grid[p.y][p.x]).join(""),reverse=[...value].reverse().join("");
   const found=puzzle.placed.find(p=>!p.found&&(p.word===value||p.word===reverse));
   if(found){
    found.found=true;solved.add(found.word);window.QQProgression?.recordWord?.(found.word);const chip=document.createElement("button");chip.type="button";chip.className="pill";chip.dataset.qqWord=found.word;chip.textContent=found.word;root.querySelector("#qqSearchFoundList")?.append(chip);found.cells.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-found"));root.querySelector('[data-clue-word="'+found.word+'"]')?.classList.add("done");
    progress.textContent="Найдено: "+solved.size+" / "+puzzle.placed.length;sound(solved.size===puzzle.placed.length?"win":"good");
    if(solved.size===puzzle.placed.length){completed=true;window.QQEconomy?.awardLevel?.("search",level);window.QQProgression?.recordUnique("searchLevels","search:"+level);unlockNext(KEY,level);setTimeout(()=>levelComplete(root,KEY,level,()=>level===LEVEL_TOTAL?showMap():playLevel(level+1)),250);}
   }else{path.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-miss"));setTimeout(()=>path.forEach(p=>cellAt(p.x,p.y)?.classList.remove("qq-miss")),300);sound("hint");}
   clear();
  }
  function cellFromPoint(clientX,clientY){
   const cells=grid.querySelectorAll("[data-x]");let best=null,bestDistance=Infinity;
   for(const cell of cells){
    const rect=cell.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const dx=Math.abs(clientX-cx),dy=Math.abs(clientY-cy);
    if(dx>rect.width*.68+8||dy>rect.height*.68+8)continue;
    const distance=dx*dx+dy*dy;
    if(distance<bestDistance){bestDistance=distance;best=cell;}
   }
   return best;
  }
  root.querySelector("#qqSearchBulb").onclick=()=>{
   const target=puzzle.placed.find(p=>!p.found);if(!target){return;}
   if(!window.QQEconomy?.useBulb?.()){return;}
   const cell=target.cells[0],node=cellAt(cell.x,cell.y);node?.classList.add("qq-search-hinted");node?.scrollIntoView({block:"nearest",inline:"nearest"});
   root.querySelector('[data-clue-word="'+target.word+'"]')?.classList.add("hinted");
  };
  grid.addEventListener("pointerdown",e=>{
   const c=e.target.closest("[data-x]");if(!c||completed)return;
   e.preventDefault();drag=true;start={x:+c.dataset.x,y:+c.dataset.y};markPath([start]);
   grid.classList.add("qq-search-dragging");try{grid.setPointerCapture(e.pointerId)}catch(_){}
  });
  const track=e=>{
   if(!drag||!start)return;e.preventDefault();
   const c=cellFromPoint(e.clientX,e.clientY);if(!c)return;
   const target={x:+c.dataset.x,y:+c.dataset.y},last=selection[selection.length-1]||start;
   if(last.x===target.x&&last.y===target.y)return;
   const segment=pathBetween(last,target);if(!segment.length)return;
   const next=segment.slice(1),seen=new Set(selection.map(p=>p.x+","+p.y));
   if(next.some(p=>seen.has(p.x+","+p.y)))return;
   markPath([...selection,...next]);
  };
  const end=e=>{
   if(!drag)return;if(e)track(e);drag=false;grid.classList.remove("qq-search-dragging");
   if(selection.length>1){finish(selection);tapStart=null;}
   else if(start){if(!tapStart){tapStart=start;markPath([start]);}else{finish(pathBetween(tapStart,start));tapStart=null;}}
   start=null;
  };
  const cancel=()=>{if(!drag)return;drag=false;start=null;grid.classList.remove("qq-search-dragging");clear();};
  grid.addEventListener("pointermove",track,{passive:false});
  grid.addEventListener("pointerup",end);
  grid.addEventListener("pointercancel",cancel);
  grid.addEventListener("lostpointercapture",cancel);
 }
 showMap();
}
function layoutWords(words,size=13){
 const grid=Array.from({length:size},()=>Array(size).fill(null)),placed=[];
 function fits(word,x,y,dir){
  let crossings=0;
  for(let i=0;i<word.length;i++){
   const xx=x+dir[0]*i,yy=y+dir[1]*i;
   if(xx<0||yy<0||xx>=size||yy>=size)return -1;
   const old=grid[yy][xx];if(old&&old!==word[i])return -1;if(old===word[i])crossings++;
  }
  return crossings;
 }
 function put(word,x,y,dir){
  const cells=[];for(let i=0;i<word.length;i++){const p={x:x+dir[0]*i,y:y+dir[1]*i};grid[p.y][p.x]=word[i];cells.push(p);}
  placed.push({word,cells,orientation:dir[0]?"h":"v",found:false});
 }
 if(!words.length)return {grid,placed,size};
 const first=words[0],x=Math.max(0,Math.floor((size-first.length)/2)),y=Math.floor(size/2);put(first,x,y,[1,0]);
 for(const word of words.slice(1)){
  if(placed.some(p=>p.word===word))continue;
  const options=[];
  for(const existing of shuffle(placed)){
   const dir=existing.orientation==="h"?[0,1]:[1,0];
   for(let i=0;i<word.length;i++)for(let j=0;j<existing.word.length;j++){
    if(word[i]!==existing.word[j])continue;
    const cx=existing.cells[j].x-dir[0]*i,cy=existing.cells[j].y-dir[1]*i,crossings=fits(word,cx,cy,dir);
    if(crossings>0)options.push({x:cx,y:cy,dir,crossings,center:Math.abs(cx+dir[0]*(word.length-1)/2-size/2)+Math.abs(cy+dir[1]*(word.length-1)/2-size/2)});
   }
  }
  options.sort((a,b)=>a.center-b.center||a.crossings-b.crossings);
  if(options.length){const p=options[0];put(word,p.x,p.y,p.dir);}
 }
 return {grid,placed,size};
}
function drawCrossword(layout,rootId){
 const cells=[];for(let y=0;y<layout.size;y++)for(let x=0;x<layout.size;x++){const ch=layout.grid[y][x];cells.push(ch?'<span class="qq-cross-cell" data-pos="'+x+','+y+'"></span>':'<span class="qq-cross-empty"></span>');}
 return '<div class="qq-cross-board" id="'+rootId+'" data-word-count="'+layout.placed.length+'" data-grid-size="'+layout.size+'" style="--qq-cols:'+layout.size+';--qq-rows:'+layout.size+'">'+cells.join("")+'</div>';
}
function mountWheel(root,onExit,words){
 const KEY="qqcross.wow.unlocked.v1";
 const showMap=()=>renderLevelMap(root,"Word of Wonders",onExit,KEY,playLevel);
 function build(level){
  const targetCount=Math.min(30,level<=20?5+Math.floor((level-1)/2):14+Math.floor((level-20)/30));
  const size=Math.min(25,level<=20?9+Math.floor((level-1)/2):18+Math.floor((level-20)/100));
  let result=null,best=null;
  const seeds=shuffle(words.filter(w=>w.length>=6&&w.length<=9&&new Set(w).size>=5&&clueIndex.has(w)));
  for(const seed of seeds.slice(0,24)){
   const candidates=shuffle(words.filter(w=>w.length>=3&&w.length<=seed.length&&w!==seed&&canBuild(w,seed)&&clueIndex.has(w))).slice(0,140).sort((a,b)=>b.length-a.length);
   const layout=layoutWords([seed,...candidates].slice(0,targetCount),size);
   const actual=layout.placed.map(p=>p.word);
   if(!best||actual.length>best.words.length)best={seed,layout,words:actual};
   if(actual.length>=Math.max(5,Math.ceil(targetCount*.85))){result={seed,layout,words:actual};break;}
  }
  return result||best||{seed:"КОРАБЛЬ",layout:layoutWords(["КОРАБЛЬ"],size),words:["КОРАБЛЬ"]};
 }
 function playLevel(level){
  const puzzle=build(level);
  let selected=[],solved=new Set(),dragging=false,dragPath=false,dragSelection=[],lastDragIndex=-1,completed=false,suppressClick=false;
  const wheelMarkup=seed=>[...seed].map((l,i)=>'<button type="button" class="qq-wheel-letter" data-index="'+i+'" style="--qq-index:'+i+';--qq-count:'+seed.length+'">'+l+'</button>').join("");
  const body='<div class="qq-wow-level-meta"><span>УРОВЕНЬ '+level+'</span><b id="qqWheelProgress">Найдено: 0 / '+puzzle.words.length+'</b></div>'+drawCrossword(puzzle.layout,"qqWheelBoard")+'<div class="qq-wow-clues" id="qqWowClues" aria-label="Вопросы к словам">'+puzzle.words.map((w,i)=>'<div class="qq-wow-clue" data-wow-clue="'+w+'"><b>'+(i+1)+'.</b><span>'+escapeHtml(clueFor(w))+'</span></div>').join("")+'</div><div class="qq-wheel-answer" id="qqWheelAnswer" aria-live="polite"></div><div class="qq-word-discovery-list" id="qqWowFoundWords"></div><div class="qq-wow-controls"><div class="qq-wheel" id="qqWheel" style="--qq-wheel-radius:48px">'+wheelMarkup(puzzle.seed)+'</div><div class="qq-wheel-actions"><button type="button" class="btn" id="qqWheelClear">Очистить</button><button type="button" class="btn" id="qqWheelMix">Перемешать</button><button type="button" class="btn" id="qqWheelBulb">💡</button></div></div>';
  shell(root,"Word of Wonders · "+level,showMap,body);root.querySelector(".qq-extra-screen").classList.add("qq-wow-screen");
  const wheel=root.querySelector("#qqWheel"),answer=root.querySelector("#qqWheelAnswer"),board=root.querySelector("#qqWheelBoard"),progress=root.querySelector("#qqWheelProgress");
  function refresh(show=selected){answer.textContent=show.map(i=>puzzle.seed[i]).join("");wheel.querySelectorAll("button").forEach(b=>b.classList.toggle("chosen",show.includes(+b.dataset.index)));}
  function complete(){if(completed)return;completed=true;window.QQEconomy?.awardLevel?.("wow",level);window.QQProgression?.recordUnique("wowLevels","wow:"+level);unlockNext(KEY,level);setTimeout(()=>levelComplete(root,KEY,level,()=>level===LEVEL_TOTAL?showMap():playLevel(level+1)),350);}
  function solveWord(indices,feedback=true){
   const word=indices.map(i=>puzzle.seed[i]).join("");if(!word)return false;
   const target=puzzle.words.find(w=>w===word&&!solved.has(w));
   if(target){
    solved.add(target);window.QQProgression?.recordWord?.(target);const chip=document.createElement("button");chip.type="button";chip.className="pill";chip.dataset.qqWord=target;chip.textContent=target;root.querySelector("#qqWowFoundWords")?.append(chip);const entry=puzzle.layout.placed.find(p=>p.word===target);
    entry?.cells.forEach(p=>{const c=board.querySelector('[data-pos="'+p.x+','+p.y+'"]');if(c){c.textContent=puzzle.layout.grid[p.y][p.x];c.classList.add("revealed");}});
    progress.textContent="Найдено: "+solved.size+" / "+puzzle.words.length;root.querySelector('[data-wow-clue="'+target+'"]')?.classList.add("done");sound(solved.size===puzzle.words.length?"win":"good");
    selected=[];refresh();if(solved.size===puzzle.words.length)complete();return true;
   }
   if(puzzle.words.includes(word))answer.textContent="Уже найдено";
   else if(feedback){answer.classList.add("qq-shake");setTimeout(()=>answer.classList.remove("qq-shake"),300);sound("hint");}
   selected=[];refresh();return false;
  }
  function addTap(i){
   if(completed||selected.includes(i))return;
   selected.push(i);refresh();
   const word=selected.map(n=>puzzle.seed[n]).join("");
   if(puzzle.words.includes(word)){solveWord(selected,false);return;}
   if(selected.length>=puzzle.seed.length)solveWord(selected,true);
  }
  root.querySelector("#qqWheelBulb").onclick=()=>{
   const target=puzzle.words.find(w=>!solved.has(w));if(!target)return;
   if(!window.QQEconomy?.useBulb?.())return;
   const index=puzzle.seed.indexOf(target[0]),button=wheel.querySelector('[data-index="'+index+'"]');
   button?.classList.add("qq-wheel-hinted");button?.scrollIntoView({block:"nearest",inline:"nearest"});
   answer.textContent="Начни с подсвеченной буквы";
  };
  wheel.addEventListener("pointerdown",e=>{
   const b=e.target.closest("[data-index]");if(!b||completed)return;
   e.preventDefault();dragging=true;dragPath=false;dragSelection=[+b.dataset.index];lastDragIndex=+b.dataset.index;
   try{wheel.setPointerCapture(e.pointerId);}catch(_){}
  });
  const wheelButtonAt=(x,y)=>{
   const direct=document.elementFromPoint(x,y)?.closest("#qqWheel [data-index]");
   if(direct)return direct;
   let nearest=null,best=Infinity;
   wheel.querySelectorAll("[data-index]").forEach(button=>{
    const r=button.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(cx-x,cy-y);
    if(d<best){best=d;nearest=button;}
   });
   return nearest&&best<=Math.max(24,Math.min(nearest.getBoundingClientRect().width,nearest.getBoundingClientRect().height)*.72)?nearest:null;
  };
  const track=e=>{
   if(!dragging)return;
   const b=wheelButtonAt(e.clientX,e.clientY);if(!b)return;
   const i=+b.dataset.index;
   if(i!==lastDragIndex){dragPath=true;lastDragIndex=i;if(!dragSelection.includes(i)){dragSelection.push(i);refresh(dragSelection);}}
  };
  const stop=e=>{
   if(!dragging)return;track(e);dragging=false;
   if(dragPath&&dragSelection.length>1){suppressClick=true;setTimeout(()=>{suppressClick=false;},350);solveWord(dragSelection,true);}
   dragSelection=[];lastDragIndex=-1;dragPath=false;
  };
  wheel.addEventListener("pointermove",track);wheel.addEventListener("pointerup",stop);wheel.addEventListener("pointercancel",stop);
  wheel.addEventListener("click",e=>{const b=e.target.closest("[data-index]");if(!b)return;if(suppressClick){suppressClick=false;return;}addTap(+b.dataset.index);});
  root.querySelector("#qqWheelClear").onclick=()=>{selected=[];refresh();};
  root.querySelector("#qqWheelMix").onclick=()=>{puzzle.seed=shuffle([...puzzle.seed]).join("");wheel.innerHTML=wheelMarkup(puzzle.seed);selected=[];refresh();};
  refresh();
 }
 showMap();
}
async function loadClues(){
 if(Array.isArray(window.QQCROSS_DICTIONARY)&&window.QQCROSS_DICTIONARY.length)return window.QQCROSS_DICTIONARY;
 const r=await fetch("./data/scanword-dictionary.json");if(!r.ok)throw new Error("Не удалось загрузить вопросы");return r.json();
}
function mountCody(root,onExit,clues,words){
 const COLS=9,CENTER=4,GROUPS=220,PER_GROUP=5,TOTAL=GROUPS*PER_GROUP;
 const STORAGE_KEY="qqcross.cody.progress.v3";
 const SECRET_WORDS=["ПУТЕШЕСТВИЕ","ПРИКЛЮЧЕНИЕ","ВООБРАЖЕНИЕ","ОБРАЗОВАНИЕ","ТЕЛЕВИДЕНИЕ","АРХИТЕКТУРА","ЛИТЕРАТУРА","ФОТОГРАФИЯ","БИБЛИОТЕКА","МАТЕМАТИКА","ГЕОГРАФИЯ","ЭКОНОМИКА","ТЕХНОЛОГИЯ","ЭНЦИКЛОПЕДИЯ","КОМПЬЮТЕРЫ","ИЗОБРАЖЕНИЕ","УВЛЕЧЕНИЕ","ПРОИЗВЕДЕНИЕ","СОЗВЕЗДИЕ","ИССЛЕДОВАНИЕ","ПРЕДПРИЯТИЕ","САМОРАЗВИТИЕ","КОНСТРУКЦИЯ","НАБЛЮДЕНИЕ","ПРОФЕССИЯ","СОРЕВНОВАНИЕ","МОРЕПЛАВАНИЕ","ПЕРЕПЛЕТЕНИЕ","ПЕРЕМЕЩЕНИЕ","УДИВЛЕНИЕ","ЗНАМЕНИТОСТЬ","ВЫРАЖЕНИЕ","СОДЕРЖАНИЕ"];
 const GROUP_NAMES=["Первые шаги","Словесная тропа","Новые загадки","Путь эрудита","Первые открытия","Мир вопросов","Загадки вокруг","Продолжаем путь","Сложнее и интереснее","Словесный маршрут","Новые горизонты","Проверка знаний","Дальняя дорога","Большая экспедиция","Мастер слова","Секреты букв","Трудные вопросы","Высший уровень","Финальные загадки","Последний рубеж"];
 const cleanClues=clues.filter(x=>x&&x.answer&&typeof x.clue==="string"&&x.clue.trim()&&/[А-Яа-яЁёA-Za-z]/.test(x.clue.trim())).map(x=>({answer:norm(x.answer),clue:String(x.clue).trim(),hint:String(x.clueShort||"").trim()})).filter(x=>/^[А-Я]{3,9}$/.test(x.answer)&&x.clue.length>3);
 const pool=[...new Map(cleanClues.map(x=>[x.answer,x])).values()].sort((a,b)=>a.answer.localeCompare(b.answer,"ru"));
 const randomFor=seed=>{let x=(seed>>>0)||1;return()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
 const shuffleSeed=(arr,rng)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let progress={completed:[],states:{}};
 try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem("qqcross.cody.progress.v2")||"null");if(saved&&Array.isArray(saved.completed)){progress={completed:saved.completed,states:saved.states&&localStorage.getItem(STORAGE_KEY)?saved.states:{}};}}catch(_){}
 const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));}catch(_){}};
 const puzzleId=n=>"p"+String(n+1).padStart(3,"0");
 function buildPuzzle(level){
  const rng=randomFor(20261107+level*7919),secrets=shuffleSeed(SECRET_WORDS,rng);
  for(const secret of secrets){
   const used=new Set(),items=[];let ok=true;
   for(let row=0;row<secret.length;row++){
    const letter=secret[row];
    const candidates=shuffleSeed(pool.filter(x=>x.answer.includes(letter)&&!used.has(x.answer)),rng);
    const fitsAt=(word,at)=>word[at]===letter&&CENTER-at>=0&&CENTER-at+word.length<=COLS;
    const options=candidates.map(entry=>({entry,positions:[...entry.answer].map((ch,at)=>at).filter(at=>fitsAt(entry.answer,at))})).filter(x=>x.positions.length).sort((a,b)=>Math.min(...a.positions.map(p=>Math.abs(p-(a.entry.answer.length-1)/2)))-Math.min(...b.positions.map(p=>Math.abs(p-(b.entry.answer.length-1)/2))));
    const chosen=options[0]?.entry;
    if(!chosen){ok=false;break;}
    used.add(chosen.answer);
    const crossIndex=options[0].positions.sort((a,b)=>Math.abs(a-(chosen.answer.length-1)/2)-Math.abs(b-(chosen.answer.length-1)/2))[0];
    items.push({...chosen,crossIndex,row,cells:[...chosen.answer].map((ch,i)=>({x:CENTER-crossIndex+i,y:row,letter:ch}))});
   }
   if(ok&&items.length>=4)return{id:puzzleId(level),level,secret,items,cols:COLS,rows:secret.length};
  }
  throw new Error("Не удалось собрать кроссворд из проверенных вопросов. Попробуй открыть другой уровень.");
 }
 function isComplete(n){return progress.completed.includes(puzzleId(n));}
 function groupUnlocked(group){if(group===0)return true;for(let i=(group-1)*PER_GROUP-1;i>=0;i--)if(!isComplete(i))return false;return true;}
 function groupDone(group){for(let i=group*PER_GROUP;i<(group+1)*PER_GROUP;i++)if(!isComplete(i))return false;return true;}
 function completedCount(group){let n=0;for(let i=group*PER_GROUP;i<(group+1)*PER_GROUP;i++)if(isComplete(i))n++;return n;}
 function getState(id){if(!progress.states[id])progress.states[id]={solved:[],revealed:{},drafts:{}};const s=progress.states[id];if(!Array.isArray(s.solved))s.solved=[];if(!s.revealed||typeof s.revealed!=="object")s.revealed={};if(!s.drafts||typeof s.drafts!=="object")s.drafts={};return s;}
 function renderTop(title,backLabel,backFn){root.innerHTML='<div class="screen qq-extra-screen qq-cody-app"><div class="top qq-extra-top"><button type="button" class="btn" id="qqCodyBack">← '+backLabel+'</button><b>'+escapeHtml(title)+'</b><span class="qq-extra-mark">QQ <span class="qq-straw-hat" title="Сенная шляпа">👒</span></span></div><div id="qqCodyView"></div></div>';root.querySelector("#qqCodyBack").onclick=backFn;bindStrawHat(root);}
 function renderMap(){
  renderTop("Кроссворды","Назад",onExit);
  const view=root.querySelector("#qqCodyView");
  view.innerHTML='<section class="qq-cody-world"><div class="qq-cody-world-mark">МИР СЛОВ</div><h2>Путешествие по словам</h2><p>220 групп · 5 головоломок в каждой. Внутри группы можно выбирать любой открытый уровень.</p><div class="qq-cody-total">'+progress.completed.length+' / '+TOTAL+' решено</div><div class="qq-cody-total-track"><span style="width:'+Math.min(100,progress.completed.length/TOTAL*100)+'%"></span></div></section><div class="qq-cody-group-grid">'+Array.from({length:GROUPS},(_,g)=>{const name=GROUP_NAMES[g]||("Новые горизонты "+(g+1)),done=completedCount(g),unlocked=groupUnlocked(g);return '<button type="button" class="qq-cody-group '+(unlocked?"":"locked")+' '+(groupDone(g)?"complete":"")+'" data-group="'+g+'" '+(unlocked?"":"disabled")+'><span class="qq-cody-group-no">ГРУППА '+(g+1)+'</span><b>'+escapeHtml(name)+'</b><span class="qq-cody-group-progress">'+done+' / '+PER_GROUP+' уровней</span><span class="qq-cody-dots">'+Array.from({length:PER_GROUP},(_,i)=>'<i class="'+(isComplete(g*PER_GROUP+i)?"done":"")+'"></i>').join("")+'</span>'+(unlocked?"":'<span class="qq-cody-lock">Закрыта</span>')+'</button>';}).join("")+'</div><p class="qq-extra-small qq-cody-footnote">Прогресс сохраняется на этом устройстве. Все вопросы берутся из проверенного словаря QQCross.</p>';
  view.querySelectorAll("[data-group]").forEach(b=>b.onclick=()=>renderGroup(+b.dataset.group));
 }
 function renderGroup(group){
  renderTop("Группа "+(group+1),"Миры",renderMap);
  const view=root.querySelector("#qqCodyView"),done=completedCount(group);
  view.innerHTML='<section class="qq-cody-group-head"><span>МИР СЛОВ</span><h2>'+escapeHtml(GROUP_NAMES[group]||("Новые горизонты "+(group+1)))+'</h2><p>Реши пять кроссвордов, чтобы открыть следующую группу.</p><b>'+done+' / 5 завершено</b></section><div class="qq-cody-level-grid">'+Array.from({length:PER_GROUP},(_,i)=>{const n=group*PER_GROUP+i,complete=isComplete(n);return '<button type="button" class="qq-cody-level '+(complete?"complete":"")+'" data-level="'+n+'"><span class="qq-cody-level-number">'+(i+1)+'</span><span><b>Кроссворд '+(i+1)+'</b><small>'+(complete?"Решён": "Секретное слово · "+"в сетке")+'</small></span><strong>'+(complete?"✓":"→")+'</strong></button>';}).join("")+'</div>'+(groupDone(group)&&group<GROUPS-1?'<button class="btn primary full qq-cody-next-group" id="qqCodyNextGroup">Открыть следующую группу</button>':"");
  view.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>startPuzzle(+b.dataset.level,group));
  const next=view.querySelector("#qqCodyNextGroup");if(next)next.onclick=()=>renderGroup(group+1);
 }
 function startPuzzle(level,group){let puzzle;try{puzzle=buildPuzzle(level);}catch(e){renderTop("Кроссворды","К группе",()=>renderGroup(group));root.querySelector("#qqCodyView").innerHTML='<div class="card"><h3>Не удалось собрать уровень</h3><p>'+escapeHtml(e.message)+'</p><button class="btn primary full" id="qqCodyRetry">Повторить</button></div>';root.querySelector("#qqCodyRetry").onclick=()=>startPuzzle(level,group);return;}renderPuzzle(puzzle,group);}
 function renderPuzzle(puzzle,group){
  const id=puzzle.id,s=getState(id);let active=s.solved.length===puzzle.items.length?0:puzzle.items.findIndex((x,i)=>!s.solved.includes(x.answer));if(active<0)active=0;let cursor=0,message="Выбери слово на поле или вопрос из списка.";
  const isSolved=i=>s.solved.includes(puzzle.items[i].answer);
  const revealed=(i,j)=>isSolved(i)||((s.revealed[i]||[]).includes(j));
  const valueAt=(i,j)=>revealed(i,j)?puzzle.items[i].answer[j]:(s.drafts[i]||{})[j]||"";
  function persist(){save();}
  function rowMarkup(wi){
   const item=puzzle.items[wi];let cells="";
   for(let x=0;x<COLS;x++){
    const j=item.cells.findIndex(p=>p.x===x);
    if(j<0){cells+='<span class="qq-cody-empty-cell" aria-hidden="true"></span>';continue;}
    const val=valueAt(wi,j),secret=x===CENTER;
    cells+='<button type="button" class="qq-cody-cell '+(secret?"secret":"")+' '+(wi===active?"active":"")+' '+(isSolved(wi)?"solved":"")+' '+(val?"filled":"")+' '+(wi===active&&cursor===j?"cursor":"")+'" data-word="'+wi+'" data-slot="'+j+'" aria-label="Слово '+(wi+1)+', буква '+(j+1)+(val?", "+val:"")+ '">'+(val?escapeHtml(val):secret?"·":"")+'</button>';
   }
   return '<div class="qq-cody-row" '+(isSolved(wi)?'data-qq-word="'+escapeHtml(item.answer)+'"':'')+'><button type="button" class="qq-cody-row-clue '+(wi===active?"active":"")+' '+(isSolved(wi)?"done":"")+'" data-clue="'+wi+'"><span class="qq-cody-row-meta"><b>'+(wi+1)+'</b><span>'+(isSolved(wi)?"РЕШЕНО":item.answer.length+" БУКВ")+'</span></span><span class="qq-cody-row-clue-text">'+escapeHtml(item.clue)+'</span></button><div class="qq-cody-row-cells">'+cells+'</div></div>';
  }
  function render(){
   const view=root.querySelector("#qqCodyView");view.className="qq-cody-puzzle-view";root.querySelector(".qq-cody-app").classList.add("qq-cody-playing");const draft=s.drafts[active]||{};
   view.classList.add("qq-cody-puzzle-view");
   const secretView=puzzle.secret.split("").map((ch,i)=>{const row=puzzle.items[i],j=row.crossIndex;return '<span class="'+(revealed(i,j)?"open":"")+'">'+(revealed(i,j)?ch:"·")+'</span>';}).join("");
   view.innerHTML='<div class="qq-cody-level-top"><span>ГРУППА '+(group+1)+' · УРОВЕНЬ '+((puzzle.level%PER_GROUP)+1)+'</span><b>'+s.solved.length+' / '+puzzle.items.length+'</b></div><div class="qq-cody-progress-track"><span style="width:'+s.solved.length/puzzle.items.length*100+'%"></span></div><div class="qq-cody-secret-wrap"><div class="qq-cody-secret-label">СЕКРЕТНОЕ СЛОВО</div><div class="qq-cody-secret">'+secretView+'</div></div><div class="qq-cody-play-layout" style="--qq-cody-rows:'+puzzle.rows+'">'+puzzle.items.map((x,i)=>rowMarkup(i)).join("")+'</div><div class="qq-cody-tools"><button type="button" class="btn" id="qqCodyLoupe">⌕ Лупа</button><button type="button" class="btn" id="qqCodyHint">💡 Подсказка</button></div><div class="qq-cody-keyboard" aria-label="Русская клавиатура"><div class="qq-cody-key-row">'+("ЙЦУКЕНГШЩЗХЪ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row">'+("ФЫВАПРОЛДЖЭ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row">'+("ЯЧСМИТЬБЮ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row special"><button type="button" data-action="delete">⌫</button><button type="button" data-action="clear">Очистить</button><button type="button" data-action="check">Проверить</button></div></div><p class="qq-cody-message" id="qqCodyMessage" aria-live="polite">'+escapeHtml(message)+'</p>';
   view.querySelectorAll("[data-word]").forEach(b=>b.onclick=()=>{active=+b.dataset.word;cursor=+b.dataset.slot;message="Выбрана клетка "+(cursor+1)+" из "+puzzle.items[active].answer.length+".";render();});
   view.querySelectorAll("[data-clue]").forEach(b=>b.onclick=()=>{active=+b.dataset.clue;cursor=firstMissing(active);message="Вопрос выбран.";render();});
   view.querySelectorAll("[data-letter]").forEach(b=>b.onclick=()=>enterLetter(b.dataset.letter));
   view.querySelector('[data-action="delete"]').onclick=deleteLetter;
   view.querySelector('[data-action="clear"]').onclick=()=>{s.drafts[active]={};cursor=firstMissing(active);message="Введённые буквы очищены.";persist();render();};
   view.querySelector('[data-action="check"]').onclick=checkAnswer;
   view.querySelector("#qqCodyLoupe").onclick=()=>revealLetter(cursor);
   view.querySelector("#qqCodyHint").onclick=()=>{if(window.QQEconomy?.useBulb?.())revealLetter(firstMissing(active));};
  }
  function firstMissing(i){const item=puzzle.items[i],draft=s.drafts[i]||{};for(let j=0;j<item.answer.length;j++)if(!revealed(i,j)&&!draft[j])return j;for(let j=0;j<item.answer.length;j++)if(!revealed(i,j))return j;return 0;}
  function enterLetter(letter){if(isSolved(active))return;const item=puzzle.items[active],draft=s.drafts[active]||(s.drafts[active]={});let pos=cursor;while(pos<item.answer.length&&(revealed(active,pos)||draft[pos]))pos++;if(pos>=item.answer.length)pos=firstMissing(active);if(revealed(active,pos))return;draft[pos]=letter;cursor=Math.min(item.answer.length-1,pos+1);message="";sound("letter");persist();render();}
  function deleteLetter(){if(isSolved(active))return;const draft=s.drafts[active]||(s.drafts[active]={});let pos=Math.min(cursor,puzzle.items[active].answer.length-1);while(pos>=0&&(!draft[pos]||revealed(active,pos)))pos--;if(pos<0)pos=firstMissing(active);delete draft[pos];cursor=Math.max(0,pos);message="";persist();render();}
  function revealLetter(pos){if(isSolved(active))return;const item=puzzle.items[active];if(pos<0||pos>=item.answer.length||revealed(active,pos)){pos=firstMissing(active);if(revealed(active,pos)){message="В этом слове все буквы уже открыты.";render();return;}}const list=s.revealed[active]||(s.revealed[active]=[]);if(!list.includes(pos))list.push(pos);if(s.drafts[active])delete s.drafts[active][pos];cursor=firstMissing(active);message="Открыта буква «"+item.answer[pos]+"».";sound("hint");persist();render();}
  function checkAnswer(){if(isSolved(active))return;const item=puzzle.items[active],draft=s.drafts[active]||{};let typed="";for(let j=0;j<item.answer.length;j++)typed+=revealed(active,j)?item.answer[j]:(draft[j]||"");if(typed.length!==item.answer.length){message="Заполни все клетки слова.";render();return;}if(typed!==item.answer){message="Ответ не совпал. Попробуй ещё раз.";s.drafts[active]={};cursor=0;sound("hint");persist();render();return;}s.solved.push(item.answer);window.QQProgression?.recordWord?.(item.answer);delete s.drafts[active];const next=puzzle.items.findIndex((x,i)=>!isSolved(i));if(next>=0){const target=puzzle.items[next],hidden=target.answer.split("").map((_,i)=>i).filter(i=>i!==target.crossIndex&&!revealed(next,i));if(hidden.length){const rng=randomFor(7000+puzzle.level*31+s.solved.length);const pos=hidden[Math.floor(rng()*hidden.length)];const arr=s.revealed[next]||(s.revealed[next]=[]);if(!arr.includes(pos))arr.push(pos);}}message="Верно! Буквы появились в пересекающихся клетках.";sound(s.solved.length===puzzle.items.length?"win":"good");persist();if(s.solved.length===puzzle.items.length){window.QQEconomy?.awardLevel?.("cody",Number(id.slice(1)));window.QQProgression?.recordUnique("codyLevels","cody:"+id);if(!progress.completed.includes(id))progress.completed.push(id);if(groupDone(group))window.QQProgression?.recordUnique("groups","cody-group:"+group);save();renderComplete();return;}active=next;cursor=firstMissing(active);render();}
  renderTop("Кроссворд "+((puzzle.level%PER_GROUP)+1),"Группа",()=>renderGroup(group));render();if(s.solved.length===puzzle.items.length)renderComplete();
 }
 function renderComplete(){
  const view=root.querySelector("#qqCodyView"),next=puzzleNext(currentLevel),nextLevel=currentLevel+1,hasNext=nextLevel<TOTAL,canOpenNext=hasNext&&(Math.floor(nextLevel/PER_GROUP)===Math.floor(currentLevel/PER_GROUP)||groupDone(Math.floor(currentLevel/PER_GROUP)));
  view.innerHTML='<section class="qq-cody-finish"><div class="qq-cody-finish-icon">✓</div><h2>Кроссворд решён!</h2><p>Ты открыл секретное слово <b>'+escapeHtml(next.secret)+'</b>.</p><div class="qq-cody-secret-finish">'+next.secret.split("").join(" · ")+'</div><button type="button" class="btn primary full" id="qqCodyNext">'+(canOpenNext?"Следующий уровень":currentLevel===TOTAL-1?"Вернуться к мирам":"К группе")+'</button><button type="button" class="btn full" id="qqCodyGroup">К группе</button></section>';
  view.querySelector("#qqCodyNext").onclick=()=>canOpenNext?startPuzzle(nextLevel,Math.floor(nextLevel/PER_GROUP)):currentLevel===TOTAL-1?renderMap():renderGroup(Math.floor(currentLevel/PER_GROUP));
  view.querySelector("#qqCodyGroup").onclick=()=>renderGroup(Math.floor(currentLevel/PER_GROUP));
 }
 let currentLevel=0;
 function puzzleNext(level){const p=buildPuzzle(level);return{secret:p.secret};}
 const originalStart=startPuzzle;
 startPuzzle=function(level,group){currentLevel=level;originalStart(level,group);};
 renderMap();
}
async function mount(root,mode,onExit){
 try{
  const words=await loadLexicon(),clues=await loadClues();
  clueIndex=new Map();
  clues.forEach(entry=>{const word=norm(entry?.answer||entry?.word),clue=String(entry?.clue||entry?.question||"").trim();if(word&&clue&&!/[ \u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}]/u.test(clue)&&!clueIndex.has(word))clueIndex.set(word,clue);});
  if(mode==="search")mountSearch(root,onExit,words);
  else if(mode==="wheel")mountWheel(root,onExit,words);
  else if(mode==="cody")mountCody(root,onExit,clues,words);
  else throw new Error("Неизвестный режим");
 }catch(error){
  shell(root,"QQCross",onExit,'<div class="card"><h3>Не удалось открыть игру</h3><p class="muted">'+escapeHtml(error.message||"Ошибка загрузки данных")+'</p><p class="qq-extra-small">Проверь подключение и обнови приложение. Игровые данные не изменены.</p><button class="btn primary full" id="qqExtraRetry">Повторить</button></div>');
  root.querySelector("#qqExtraRetry").onclick=()=>mount(root,mode,onExit);
 }
}
window.QQExtraGames={mount};
})();
