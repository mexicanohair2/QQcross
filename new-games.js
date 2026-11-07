(function () {
"use strict";
const LETTERS = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
let lexiconPromise = null;
const norm = value => String(value || "").toUpperCase().replace(/Ё/g, "Е").replace(/[^А-Я]/g, "");
const shuffle = values => { const a = [...values]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const counts = word => [...norm(word)].reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{});
function canBuild(word, bag) { const a=counts(word), b=counts(bag); return Object.keys(a).every(k=>(b[k]||0)>=a[k]); }
async function loadLexicon() {
  if (!lexiconPromise) lexiconPromise = fetch("./data/russian-words-50000.json").then(r=>{if(!r.ok)throw new Error("Не удалось загрузить словарь");return r.json();}).then(d=>{
    if(d.language!=="ru"||d.count!==50000||!Array.isArray(d.words)||d.words.length!==50000)throw new Error("Словарь не прошёл проверку количества слов");
    const words=[...new Set(d.words.map(norm).filter(w=>/^[А-Я]{2,18}$/.test(w)))];
    if(words.length!==50000)throw new Error("В словаре обнаружены дубликаты или некорректные записи");
    return words;
  }).catch(e=>{lexiconPromise=null;throw e;});
  return lexiconPromise;
}
function sound(kind) {window.QQAudio?.play(({win:"word",hint:"wrong",good:"correct",letter:"letter",select:"select"})[kind]||"correct");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function shell(root,title,onExit,body){root.innerHTML='<div class="screen qq-extra-screen"><div class="top qq-extra-top"><button type="button" class="btn" data-exit>← Назад</button><b>'+title+'</b><span class="qq-extra-mark">QQ</span></div>'+body+'</div>';root.querySelector("[data-exit]").onclick=onExit;}
function pathBetween(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,steps=Math.max(Math.abs(dx),Math.abs(dy));
 if(!steps||!(dx===0||dy===0||Math.abs(dx)===Math.abs(dy)))return [];
 const sx=Math.sign(dx),sy=Math.sign(dy),out=[];
 for(let i=0;i<=steps;i++)out.push({x:a.x+sx*i,y:a.y+sy*i});
 return out;
}
function buildSearchPuzzle(words){
 const size=11,grid=Array.from({length:size},()=>Array(size).fill(""));
 const chosen=shuffle(words.filter(w=>w.length>=4&&w.length<=9)).slice(0,9).sort((a,b)=>b.length-a.length),placed=[];
 for(const word of chosen){
  let done=false;
  for(let attempt=0;attempt<220&&!done;attempt++){
   const dir=shuffle([[1,0],[0,1],[1,1],[-1,1]])[0],x=Math.floor(Math.random()*size),y=Math.floor(Math.random()*size),endX=x+dir[0]*(word.length-1),endY=y+dir[1]*(word.length-1);
   if(endX<0||endX>=size||endY<0||endY>=size)continue;
   let ok=true;for(let i=0;i<word.length;i++){const c=grid[y+dir[1]*i][x+dir[0]*i];if(c&&c!==word[i]){ok=false;break;}}
   if(!ok)continue;
   const cells=[];for(let i=0;i<word.length;i++){const p={x:x+dir[0]*i,y:y+dir[1]*i};grid[p.y][p.x]=word[i];cells.push(p);}
   placed.push({word,cells,found:false});done=true;
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!grid[y][x])grid[y][x]=LETTERS[Math.floor(Math.random()*LETTERS.length)];
 return {size,grid,placed};
}
function mountSearch(root,onExit,words){
 const puzzle=buildSearchPuzzle(words);let start=null,drag=false,solved=new Set(),selection=[];
 const body='<p class="qq-extra-sub">Найди спрятанные слова. Выделяй их пальцем по прямой — в любом из восьми направлений.</p><div class="qq-search-progress" id="qqProgress">Найдено: 0 / '+puzzle.placed.length+'</div><div class="qq-search-grid" id="qqSearchGrid" style="--qq-cols:'+puzzle.size+'">'+puzzle.grid.map((row,y)=>row.map((letter,x)=>'<button type="button" class="qq-search-cell" data-x="'+x+'" data-y="'+y+'" aria-label="Строка '+(y+1)+', столбец '+(x+1)+'">'+letter+'</button>').join("")).join("")+'</div><div class="qq-word-list" id="qqWordList">'+puzzle.placed.map(p=>'<span data-word="'+p.word+'">'+p.word+'</span>').join("")+'</div><button class="btn full" id="qqSearchNew">Новое поле</button>';
 shell(root,"Поиск слов",onExit,body);
 const grid=root.querySelector("#qqSearchGrid"),progress=root.querySelector("#qqProgress"),list=root.querySelector("#qqWordList");
 const clear=()=>{grid.querySelectorAll(".qq-search-cell").forEach(c=>c.classList.remove("qq-selected"));selection=[];};
 const cellAt=(x,y)=>grid.querySelector('[data-x="'+x+'"][data-y="'+y+'"]');
 function markPath(path){const started=selection.length===0&&path.length>0;clear();selection=path;path.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-selected"));if(started)sound("select");}
 function finish(path){
  if(!path.length)return;
  const value=path.map(p=>puzzle.grid[p.y][p.x]).join("");
  const reverse=[...value].reverse().join("");
  const found=puzzle.placed.find(p=>!p.found&&(p.word===value||p.word===reverse));
  if(found){found.found=true;solved.add(found.word);found.cells.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-found"));list.querySelector('[data-word="'+found.word+'"]')?.classList.add("done");progress.textContent="Найдено: "+solved.size+" / "+puzzle.placed.length;sound(solved.size===puzzle.placed.length?"win":"good");if(solved.size===puzzle.placed.length)progress.textContent="Все слова найдены! Отличная работа.";}
  else {path.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-miss"));setTimeout(()=>path.forEach(p=>cellAt(p.x,p.y)?.classList.remove("qq-miss")),260);}
  clear();
 }
 let tapStart=null;
 grid.addEventListener("pointerdown",e=>{const c=e.target.closest("[data-x]");if(!c)return;drag=true;start={x:+c.dataset.x,y:+c.dataset.y};markPath([start]);});
 grid.addEventListener("pointermove",e=>{if(!drag||!start)return;const c=document.elementFromPoint(e.clientX,e.clientY)?.closest("#qqSearchGrid [data-x]");if(!c)return;const path=pathBetween(start,{x:+c.dataset.x,y:+c.dataset.y});if(path.length)markPath(path);});
 const end=()=>{if(!drag)return;drag=false;if(selection.length>1){finish(selection);tapStart=null;}else if(start){if(!tapStart){tapStart=start;markPath([start]);}else{finish(pathBetween(tapStart,start));tapStart=null;}}start=null;};
 grid.addEventListener("pointerup",end);grid.addEventListener("pointercancel",end);
 root.querySelector("#qqSearchNew").onclick=()=>mountSearch(root,onExit,words);
}
function layoutWords(words,size=13){
 const grid=Array.from({length:size},()=>Array(size).fill(null)),placed=[];
 function fits(word,x,y,dir){
  for(let i=0;i<word.length;i++){const xx=x+dir[0]*i,yy=y+dir[1]*i;if(xx<0||yy<0||xx>=size||yy>=size)return false;const old=grid[yy][xx];if(old&&old!==word[i])return false;}
  return true;
 }
 function put(word,x,y,dir){const cells=[];for(let i=0;i<word.length;i++){const p={x:x+dir[0]*i,y:y+dir[1]*i};grid[p.y][p.x]=word[i];cells.push(p);}placed.push({word,cells,found:false});}
 if(!words.length)return {grid,placed,size};
 const first=words[0],x=Math.floor((size-first.length)/2),y=Math.floor(size/2);put(first,x,y,[1,0]);
 for(const word of words.slice(1)){
  let done=false;
  for(const existing of shuffle(placed)){
   const dir=existing.cells[0].y===existing.cells[existing.cells.length-1].y?[0,1]:[1,0];
   for(let i=0;i<word.length&&!done;i++)for(let j=0;j<existing.word.length&&!done;j++){
    if(word[i]!==existing.word[j])continue;
    const cx=existing.cells[j].x-dir[0]*i,cy=existing.cells[j].y-dir[1]*i;
    if(fits(word,cx,cy,dir)){put(word,cx,cy,dir);done=true;}
   }
  }
 }
 return {grid,placed,size};
}
function drawCrossword(layout,rootId){
 const cells=[];for(let y=0;y<layout.size;y++)for(let x=0;x<layout.size;x++){const ch=layout.grid[y][x];cells.push(ch?'<span class="qq-cross-cell" data-pos="'+x+','+y+'"></span>':'<span class="qq-cross-empty"></span>');}
 return '<div class="qq-cross-board" id="'+rootId+'" style="--qq-cols:'+layout.size+'">'+cells.join("")+'</div>';
}
function mountWheel(root,onExit,words){
 let puzzle=null;
 for(let tries=0;tries<35&&!puzzle;tries++){
  const seed=shuffle(words.filter(w=>w.length>=6&&w.length<=8&&new Set(w).size>=5))[0];if(!seed)break;
  const candidates=shuffle(words.filter(w=>w.length>=3&&w.length<=seed.length&&canBuild(w,seed))).slice(0,24);
  const selected=[seed,...candidates.filter(w=>w!==seed)].slice(0,8);
  const layout=layoutWords(selected,13);if(layout.placed.length>=4)puzzle={seed,layout,words:layout.placed.map(p=>p.word)};
 }
 if(!puzzle){const seed=shuffle(words.filter(w=>w.length>=6&&w.length<=8))[0]||"КОРАБЛЬ";const candidates=words.filter(w=>w.length>=3&&canBuild(w,seed)).slice(0,6);const layout=layoutWords(candidates,13);puzzle={seed,layout,words:layout.placed.map(p=>p.word)};}
 let selected=[],solved=new Set(),dragging=false,dragPath=false,suppressClick=false;
 const body='<p class="qq-extra-sub">Соединяй буквы в круге, составляй слова и открывай клетки кроссворда.</p><div class="qq-wheel-progress" id="qqWheelProgress">Найдено: 0 / '+puzzle.words.length+'</div>'+drawCrossword(puzzle.layout,"qqWheelBoard")+'<div class="qq-wheel-answer" id="qqWheelAnswer" aria-live="polite"></div><div class="qq-wheel" id="qqWheel">'+[...puzzle.seed].map((l,i)=>'<button type="button" class="qq-wheel-letter" data-index="'+i+'">'+l+'</button>').join("")+'</div><div class="qq-wheel-actions"><button type="button" class="btn" id="qqWheelClear">Очистить</button><button type="button" class="btn primary" id="qqWheelSubmit">Проверить</button><button type="button" class="btn" id="qqWheelMix">Перемешать</button></div><p class="qq-extra-small">Каждую букву можно использовать один раз в одном слове. За дополнительные слова начисляются бонусы.</p>';
 shell(root,"Поиск слов из букв",onExit,body);
 const wheel=root.querySelector("#qqWheel"),answer=root.querySelector("#qqWheelAnswer"),board=root.querySelector("#qqWheelBoard"),progress=root.querySelector("#qqWheelProgress");
 function refresh(){answer.textContent=selected.map(i=>puzzle.seed[i]).join("");wheel.querySelectorAll("button").forEach(b=>b.classList.toggle("chosen",selected.includes(+b.dataset.index)));}
 function submit(){
  const word=selected.map(i=>puzzle.seed[i]).join("");
  if(!word){return;}
  const target=puzzle.words.find(w=>w===word&&!solved.has(w));
  if(target){solved.add(target);const entry=puzzle.layout.placed.find(p=>p.word===target);entry?.cells.forEach(p=>{const c=board.querySelector('[data-pos="'+p.x+','+p.y+'"]');if(c){c.textContent=puzzle.layout.grid[p.y][p.x];c.classList.add("revealed");}});progress.textContent="Найдено: "+solved.size+" / "+puzzle.words.length;sound(solved.size===puzzle.words.length?"win":"good");}
  else if(puzzle.words.includes(word))answer.textContent="Это слово уже найдено";
  else {answer.classList.add("qq-shake");setTimeout(()=>answer.classList.remove("qq-shake"),300);sound("hint");}
  selected=[];refresh();
 }
 wheel.addEventListener("pointerdown",e=>{const b=e.target.closest("[data-index]");if(!b)return;dragging=true;dragPath=true;selected=[+b.dataset.index];refresh();});
 wheel.addEventListener("pointerenter",e=>{if(!dragging)return;const b=e.target.closest("[data-index]");if(!b)return;const i=+b.dataset.index;if(!selected.includes(i))selected.push(i);refresh();},true);
 const stop=()=>{if(!dragging)return;dragging=false;if(dragPath&&selected.length>1){submit();suppressClick=true;}else{selected=[];refresh();}dragPath=false;};
 wheel.addEventListener("pointerup",stop);wheel.addEventListener("pointercancel",stop);
 wheel.addEventListener("click",e=>{const b=e.target.closest("[data-index]");if(!b)return;if(suppressClick){suppressClick=false;return;}const i=+b.dataset.index;if(selected.includes(i))selected=selected.filter(x=>x!==i);else selected.push(i);refresh();});
 root.querySelector("#qqWheelSubmit").onclick=submit;
 root.querySelector("#qqWheelClear").onclick=()=>{selected=[];refresh();};
 root.querySelector("#qqWheelMix").onclick=()=>{const letters=shuffle([...puzzle.seed]);wheel.innerHTML=letters.map((l,i)=>'<button type="button" class="qq-wheel-letter" data-index="'+i+'">'+l+'</button>').join("");puzzle.seed=letters.join("");selected=[];refresh();};
 refresh();
}
async function loadClues(){
 if(Array.isArray(window.QQCROSS_DICTIONARY)&&window.QQCROSS_DICTIONARY.length)return window.QQCROSS_DICTIONARY;
 const r=await fetch("./data/scanword-dictionary.json");if(!r.ok)throw new Error("Не удалось загрузить вопросы");return r.json();
}
function mountCody(root,onExit,clues,words){
 const COLS=13,CENTER=6,GROUPS=20,PER_GROUP=5,TOTAL=GROUPS*PER_GROUP;
 const STORAGE_KEY="qqcross.cody.progress.v2";
 const SECRET_WORDS=["ПРИРОДА","КОСМОС","ИСТОРИЯ","МУЗЫКА","ПЛАНЕТА","ЖИВОТНЫЕ","СПОРТ","КНИГА","ГОРОД","МАШИНА","ВРЕМЯ","СЕМЬЯ","ШКОЛА","ДРУЖБА","МОРЕ","РАСТЕНИЯ","ТЕХНИКА","ИСКУССТВО","ЗВЕЗДЫ","ПРОФЕССИЯ","КУЛЬТУРА","НАУКА","ПТИЦЫ","ЦВЕТЫ","ЭНЕРГИЯ","ПУТЕШЕСТВИЕ","ЗДОРОВЬЕ"];
 const GROUP_NAMES=["Первые шаги","Словесная тропа","Новые загадки","Путь эрудита","Первые открытия","Мир вопросов","Загадки вокруг","Продолжаем путь","Сложнее и интереснее","Словесный маршрут","Новые горизонты","Проверка знаний","Дальняя дорога","Большая экспедиция","Мастер слова","Секреты букв","Трудные вопросы","Высший уровень","Финальные загадки","Последний рубеж"];
 const cleanClues=clues.filter(x=>x&&x.answer&&typeof x.clue==="string"&&x.clue.trim()&&/[А-Яа-яЁёA-Za-z]/.test(x.clue.trim())).map(x=>({answer:norm(x.answer),clue:String(x.clue).trim(),hint:String(x.clueShort||"").trim()})).filter(x=>/^[А-Я]{3,11}$/.test(x.answer)&&x.clue.length>3);
 const pool=[...new Map(cleanClues.map(x=>[x.answer,x])).values()].sort((a,b)=>a.answer.localeCompare(b.answer,"ru"));
 const randomFor=seed=>{let x=(seed>>>0)||1;return()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
 const shuffleSeed=(arr,rng)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let progress={completed:[],states:{}};
 try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(saved&&Array.isArray(saved.completed)&&saved.states&&typeof saved.states==="object")progress=saved;}catch(_){}
 const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));}catch(_){}};
 const puzzleId=n=>"p"+String(n+1).padStart(3,"0");
 function buildPuzzle(level){
  const rng=randomFor(20261107+level*7919),secrets=shuffleSeed(SECRET_WORDS,rng);
  for(const secret of secrets){
   const used=new Set(),items=[];let ok=true;
   for(let row=0;row<secret.length;row++){
    const letter=secret[row];
    const candidates=shuffleSeed(pool.filter(x=>x.answer.includes(letter)&&!used.has(x.answer)),rng);
    const chosen=candidates.find(x=>{const at=x.answer.indexOf(letter);return CENTER-at>=0&&CENTER-at+x.answer.length<=COLS;});
    if(!chosen){ok=false;break;}
    used.add(chosen.answer);
    const crossIndex=chosen.answer.indexOf(letter);
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
 function renderTop(title,backLabel,backFn){root.innerHTML='<div class="screen qq-extra-screen qq-cody-app"><div class="top qq-extra-top"><button type="button" class="btn" id="qqCodyBack">← '+backLabel+'</button><b>'+escapeHtml(title)+'</b><span class="qq-extra-mark">QQ</span></div><div id="qqCodyView"></div></div>';root.querySelector("#qqCodyBack").onclick=backFn;}
 function renderMap(){
  renderTop("Кроссворды","Назад",onExit);
  const view=root.querySelector("#qqCodyView");
  view.innerHTML='<section class="qq-cody-world"><div class="qq-cody-world-mark">МИР СЛОВ</div><h2>Путешествие по словам</h2><p>20 групп · 5 головоломок в каждой. Внутри группы можно выбирать любой открытый уровень.</p><div class="qq-cody-total">'+progress.completed.length+' / '+TOTAL+' решено</div><div class="qq-cody-total-track"><span style="width:'+Math.min(100,progress.completed.length/TOTAL*100)+'%"></span></div></section><div class="qq-cody-group-grid">'+GROUP_NAMES.map((name,g)=>{const done=completedCount(g),unlocked=groupUnlocked(g);return '<button type="button" class="qq-cody-group '+(unlocked?"":"locked")+' '+(groupDone(g)?"complete":"")+'" data-group="'+g+'" '+(unlocked?"":"disabled")+'><span class="qq-cody-group-no">ГРУППА '+(g+1)+'</span><b>'+escapeHtml(name)+'</b><span class="qq-cody-group-progress">'+done+' / '+PER_GROUP+' уровней</span><span class="qq-cody-dots">'+Array.from({length:PER_GROUP},(_,i)=>'<i class="'+(isComplete(g*PER_GROUP+i)?"done":"")+'"></i>').join("")+'</span>'+(unlocked?"":'<span class="qq-cody-lock">Закрыта</span>')+'</button>';}).join("")+'</div><p class="qq-extra-small qq-cody-footnote">Прогресс сохраняется на этом устройстве. Все вопросы берутся из проверенного словаря QQCross.</p>';
  view.querySelectorAll("[data-group]").forEach(b=>b.onclick=()=>renderGroup(+b.dataset.group));
 }
 function renderGroup(group){
  renderTop("Группа "+(group+1),"Миры",renderMap);
  const view=root.querySelector("#qqCodyView"),done=completedCount(group);
  view.innerHTML='<section class="qq-cody-group-head"><span>МИР СЛОВ</span><h2>'+escapeHtml(GROUP_NAMES[group])+'</h2><p>Реши пять кроссвордов, чтобы открыть следующую группу.</p><b>'+done+' / 5 завершено</b></section><div class="qq-cody-level-grid">'+Array.from({length:PER_GROUP},(_,i)=>{const n=group*PER_GROUP+i,complete=isComplete(n);return '<button type="button" class="qq-cody-level '+(complete?"complete":"")+'" data-level="'+n+'"><span class="qq-cody-level-number">'+(i+1)+'</span><span><b>Кроссворд '+(i+1)+'</b><small>'+(complete?"Решён": "Секретное слово · "+"в сетке")+'</small></span><strong>'+(complete?"✓":"→")+'</strong></button>';}).join("")+'</div>'+(groupDone(group)&&group<GROUPS-1?'<button class="btn primary full qq-cody-next-group" id="qqCodyNextGroup">Открыть следующую группу</button>':"");
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
  function cellsMarkup(){
   let html="";
   for(let y=0;y<puzzle.rows;y++)for(let x=0;x<COLS;x++){
    const wi=y,item=puzzle.items[wi],j=item.cells.findIndex(p=>p.x===x);
    if(j<0){html+='<span class="qq-cody-empty-cell"></span>';continue;}
    const val=valueAt(wi,j),secret=x===CENTER;
    html+='<button type="button" class="qq-cody-cell '+(secret?"secret":"")+' '+(wi===active?"active":"")+' '+(isSolved(wi)?"solved":"")+' '+(val?"filled":"")+' '+(wi===active&&cursor===j?"cursor":"")+'" data-word="'+wi+'" data-slot="'+j+'" aria-label="Слово '+(wi+1)+', буква '+(j+1)+(val?", "+val:"")+ '">'+(val?escapeHtml(val):secret?"·":"")+'</button>';
   }
   return html;
  }
  function render(){
   const view=root.querySelector("#qqCodyView"),item=puzzle.items[active],draft=s.drafts[active]||{};
   const secretView=puzzle.secret.split("").map((ch,i)=>{const row=puzzle.items[i],j=row.crossIndex;return '<span class="'+(revealed(i,j)?"open":"")+'">'+(revealed(i,j)?ch:"·")+'</span>';}).join("");
   view.innerHTML='<div class="qq-cody-level-top"><span>ГРУППА '+(group+1)+' · УРОВЕНЬ '+((puzzle.level%PER_GROUP)+1)+'</span><b>'+s.solved.length+' / '+puzzle.items.length+'</b></div><div class="qq-cody-progress-track"><span style="width:'+s.solved.length/puzzle.items.length*100+'%"></span></div><div class="qq-cody-secret-wrap"><div class="qq-cody-secret-label">СЕКРЕТНОЕ СЛОВО · ВЫДЕЛЕННАЯ КОЛОНКА</div><div class="qq-cody-secret">'+secretView+'</div></div><div class="qq-cody-board-wrap"><div class="qq-cody-board" style="--qq-cody-cols:'+COLS+';--qq-cody-rows:'+puzzle.rows+'">'+cellsMarkup()+'</div></div><div class="qq-cody-question"><div class="qq-cody-question-top"><span>ВОПРОС '+(active+1)+'</span><b>'+item.answer.length+' БУКВ</b></div><p>'+escapeHtml(item.clue)+'</p><small>Нажми на клетки слова и введи ответ клавиатурой ниже.</small></div><div class="qq-cody-question-list">'+puzzle.items.map((x,i)=>'<button type="button" class="qq-cody-question-item '+(i===active?"active":"")+' '+(isSolved(i)?"done":"")+'" data-clue="'+i+'"><span class="qq-cody-question-index">'+(i+1)+'</span><span class="qq-cody-question-short">'+escapeHtml(x.clue)+'</span><b>'+(isSolved(i)?"✓":x.answer.length+" букв")+'</b></button>').join("")+'</div><div class="qq-cody-tools"><button type="button" class="btn" id="qqCodyLoupe">⌕ Лупа</button><button type="button" class="btn" id="qqCodyHint">Подсказка</button></div><div class="qq-cody-keyboard" aria-label="Русская клавиатура"><div class="qq-cody-key-row">'+("ЙЦУКЕНГШЩЗХЪ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row">'+("ФЫВАПРОЛДЖЭ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row">'+("ЯЧСМИТЬБЮ").split("").map(k=>'<button type="button" data-letter="'+k+'">'+k+'</button>').join("")+'</div><div class="qq-cody-key-row special"><button type="button" data-action="delete">⌫</button><button type="button" data-action="clear">Очистить</button><button type="button" data-action="check">Проверить</button></div></div><p class="qq-cody-message" id="qqCodyMessage" aria-live="polite">'+escapeHtml(message)+'</p>';
   view.querySelectorAll("[data-word]").forEach(b=>b.onclick=()=>{active=+b.dataset.word;cursor=+b.dataset.slot;message="Выбрана клетка "+(cursor+1)+" из "+puzzle.items[active].answer.length+".";render();});
   view.querySelectorAll("[data-clue]").forEach(b=>b.onclick=()=>{active=+b.dataset.clue;cursor=firstMissing(active);message="Вопрос выбран.";render();});
   view.querySelectorAll("[data-letter]").forEach(b=>b.onclick=()=>enterLetter(b.dataset.letter));
   view.querySelector('[data-action="delete"]').onclick=deleteLetter;
   view.querySelector('[data-action="clear"]').onclick=()=>{s.drafts[active]={};cursor=firstMissing(active);message="Введённые буквы очищены.";persist();render();};
   view.querySelector('[data-action="check"]').onclick=checkAnswer;
   view.querySelector("#qqCodyLoupe").onclick=()=>revealLetter(cursor);
   view.querySelector("#qqCodyHint").onclick=()=>revealLetter(firstMissing(active));
  }
  function firstMissing(i){const item=puzzle.items[i],draft=s.drafts[i]||{};for(let j=0;j<item.answer.length;j++)if(!revealed(i,j)&&!draft[j])return j;for(let j=0;j<item.answer.length;j++)if(!revealed(i,j))return j;return 0;}
  function enterLetter(letter){if(isSolved(active))return;const item=puzzle.items[active],draft=s.drafts[active]||(s.drafts[active]={});let pos=cursor;while(pos<item.answer.length&&(revealed(active,pos)||draft[pos]))pos++;if(pos>=item.answer.length)pos=firstMissing(active);if(revealed(active,pos))return;draft[pos]=letter;cursor=Math.min(item.answer.length-1,pos+1);message="";sound("letter");persist();render();}
  function deleteLetter(){if(isSolved(active))return;const draft=s.drafts[active]||(s.drafts[active]={});let pos=Math.min(cursor,puzzle.items[active].answer.length-1);while(pos>=0&&(!draft[pos]||revealed(active,pos)))pos--;if(pos<0)pos=firstMissing(active);delete draft[pos];cursor=Math.max(0,pos);message="";persist();render();}
  function revealLetter(pos){if(isSolved(active))return;const item=puzzle.items[active];if(pos<0||pos>=item.answer.length||revealed(active,pos)){pos=firstMissing(active);if(revealed(active,pos)){message="В этом слове все буквы уже открыты.";render();return;}}const list=s.revealed[active]||(s.revealed[active]=[]);if(!list.includes(pos))list.push(pos);if(s.drafts[active])delete s.drafts[active][pos];cursor=firstMissing(active);message="Открыта буква «"+item.answer[pos]+"».";sound("hint");persist();render();}
  function checkAnswer(){if(isSolved(active))return;const item=puzzle.items[active],draft=s.drafts[active]||{};let typed="";for(let j=0;j<item.answer.length;j++)typed+=revealed(active,j)?item.answer[j]:(draft[j]||"");if(typed.length!==item.answer.length){message="Заполни все клетки слова.";render();return;}if(typed!==item.answer){message="Ответ не совпал. Попробуй ещё раз.";s.drafts[active]={};cursor=0;sound("hint");persist();render();return;}s.solved.push(item.answer);delete s.drafts[active];const next=puzzle.items.findIndex((x,i)=>!isSolved(i));if(next>=0){const target=puzzle.items[next],hidden=target.answer.split("").map((_,i)=>i).filter(i=>i!==target.crossIndex&&!revealed(next,i));if(hidden.length){const rng=randomFor(7000+puzzle.level*31+s.solved.length);const pos=hidden[Math.floor(rng()*hidden.length)];const arr=s.revealed[next]||(s.revealed[next]=[]);if(!arr.includes(pos))arr.push(pos);}}message="Верно! Буквы появились в пересекающихся клетках.";sound(s.solved.length===puzzle.items.length?"win":"good");persist();if(s.solved.length===puzzle.items.length){if(!progress.completed.includes(id))progress.completed.push(id);save();renderComplete();return;}active=next;cursor=firstMissing(active);render();}
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
  const words=await loadLexicon();
  if(mode==="search")mountSearch(root,onExit,words);
  else if(mode==="wheel")mountWheel(root,onExit,words);
  else if(mode==="cody")mountCody(root,onExit,await loadClues(),words);
  else throw new Error("Неизвестный режим");
 }catch(error){
  shell(root,"QQCross",onExit,'<div class="card"><h3>Не удалось открыть игру</h3><p class="muted">'+escapeHtml(error.message||"Ошибка загрузки данных")+'</p><p class="qq-extra-small">Проверь подключение и обнови приложение. Игровые данные не изменены.</p><button class="btn primary full" id="qqExtraRetry">Повторить</button></div>');
  root.querySelector("#qqExtraRetry").onclick=()=>mount(root,mode,onExit);
 }
}
window.QQExtraGames={mount};
})();
