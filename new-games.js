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
    const words=[...new Set(d.words.map(norm).filter(w=>/^[А-Я]{3,18}$/.test(w)))];
    if(words.length!==50000)throw new Error("В словаре обнаружены дубликаты или некорректные записи");
    return words;
  }).catch(e=>{lexiconPromise=null;throw e;});
  return lexiconPromise;
}
function sound(kind) {
  try {
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    const ctx=new Ctx();const now=ctx.currentTime;
    const notes=kind==="win"?[523.25,659.25,783.99]:kind==="hint"?[392,494]:[440,554.37];
    notes.forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,now+i*.09);gain.gain.exponentialRampToValueAtTime(.045,now+i*.09+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.09+.19);osc.connect(gain);gain.connect(ctx.destination);osc.start(now+i*.09);osc.stop(now+i*.09+.2);});
    setTimeout(()=>ctx.close().catch(()=>{}),900);
  } catch (_) {}
}
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
 function markPath(path){clear();selection=path;path.forEach(p=>cellAt(p.x,p.y)?.classList.add("qq-selected"));}
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
 if(!puzzle){const seed=shuffle(words.filter(w=>w.length>=6&&w.length<=8))[0]||"КОРАБЛЬ";const candidates=words.filter(w=>w.length>=3&&canBuild(w,seed)).slice(0,6);puzzle={seed,layout:layoutWords(candidates,13),words:candidates};}
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
 const seen=new Set();
 const pool=shuffle(clues.filter(x=>x&&x.answer&&x.clue&&!x.imageKey&&norm(x.answer).length>=4&&norm(x.answer).length<=9).filter(x=>{const w=norm(x.answer);if(seen.has(w))return false;seen.add(w);return true;}));
 const byInitial=new Map();
 pool.forEach(item=>{const initial=norm(item.answer)[0],list=byInitial.get(initial)||[];list.push(item);byInitial.set(initial,list);});
 let puzzle=null;
 const secretCandidates=shuffle(words.slice(0,7000).filter(w=>w.length>=4&&w.length<=5));
 for(const secretWord of secretCandidates){
  const used=new Set(),items=[];let possible=true;
  for(const letter of secretWord){
   const item=(byInitial.get(letter)||[]).find(x=>!used.has(norm(x.answer)));
   if(!item){possible=false;break;}
   used.add(norm(item.answer));items.push(item);
  }
  if(!possible)continue;
  const layout=layoutWords(items.map(x=>norm(x.answer)),13);
  if(layout.placed.length===items.length){puzzle={layout,items,secret:secretWord};break;}
 }
 for(let tries=0;tries<35&&!puzzle;tries++){
  const group=pool.slice(tries*8,tries*8+8);if(group.length<3)continue;
  const layout=layoutWords(group.map(x=>norm(x.answer)),13);
  if(layout.placed.length>=3){
   const items=layout.placed.map(p=>group.find(x=>norm(x.answer)===p.word)).filter(Boolean);
   puzzle={layout,items,secret:items.map(x=>norm(x.answer)[0]).join("")};
  }
 }
 if(!puzzle){
  const group=pool.slice(0,8),layout=layoutWords(group.map(x=>norm(x.answer)),13);
  const items=layout.placed.map(p=>group.find(x=>norm(x.answer)===p.word)).filter(Boolean);
  puzzle={layout,items,secret:items.map(x=>norm(x.answer)[0]).join("")};
 }
 let solved=new Set(),active=0,usedHint=false;
 const body='<p class="qq-extra-sub">Решай тематические вопросы, заполняй пересекающиеся слова и открой секретное слово.</p><div class="qq-cody-progress" id="qqCodyProgress">Решено: 0 / '+puzzle.items.length+'</div>'+drawCrossword(puzzle.layout,"qqCodyBoard")+'<div class="qq-secret" id="qqSecret"><span>Секретное слово</span><b>· · · · ·</b></div><div class="qq-cody-clues" id="qqCodyClues">'+puzzle.items.map((x,i)=>'<button type="button" class="qq-cody-clue '+(i===0?"active":"")+'" data-clue="'+i+'"><span class="qq-cody-number">'+(i+1)+'</span><span class="qq-cody-question">'+escapeHtml(x.clue)+'</span><b>'+norm(x.answer).length+' букв</b></button>').join("")+'</div><div class="qq-cody-tools"><button class="btn" id="qqCodyLoupe">⌕ Лупа</button><button class="btn" id="qqCodyHint">Подсказка</button></div><div class="qq-cody-entry"><input id="qqCodyInput" class="input" maxlength="12" autocomplete="off" placeholder="Введи ответ"><button class="btn primary" id="qqCodyCheck">Ответить</button></div><p class="qq-extra-small" id="qqCodyMessage" aria-live="polite">Выбери вопрос и введи ответ.</p>';
 shell(root,"Кроссворды",onExit,body);
 const board=root.querySelector("#qqCodyBoard"),list=root.querySelector("#qqCodyClues"),input=root.querySelector("#qqCodyInput"),message=root.querySelector("#qqCodyMessage"),secret=root.querySelector("#qqSecret");
 function renderBoard(){puzzle.layout.placed.forEach((p,i)=>p.cells.forEach((pos,j)=>{const c=board.querySelector('[data-pos="'+pos.x+','+pos.y+'"]');if(!c)return;if(solved.has(p.word)){c.textContent=p.word[j];c.classList.add("revealed");if(j===0)c.classList.add("secret-letter");}}));}
 function renderSecret(){const letters=puzzle.items.map(x=>solved.has(norm(x.answer))?norm(x.answer)[0]:"·");secret.querySelector("b").textContent=letters.join(" ");if(solved.size===puzzle.items.length){secret.classList.add("complete");message.textContent="Все ответы найдены! Секретное слово открыто.";sound("win");}}
 function select(i){active=i;list.querySelectorAll(".qq-cody-clue").forEach(b=>b.classList.toggle("active",+b.dataset.clue===i));input.value="";input.focus();}
 function answer(){const item=puzzle.items[active],value=norm(input.value);if(!item||solved.has(norm(item.answer)))return;if(value!==norm(item.answer)){message.textContent="Пока неверно. Попробуй ещё раз.";message.classList.add("qq-shake");setTimeout(()=>message.classList.remove("qq-shake"),300);sound("hint");return;}solved.add(value);list.querySelector('[data-clue="'+active+'"]')?.classList.add("done");renderBoard();renderSecret();root.querySelector("#qqCodyProgress").textContent="Решено: "+solved.size+" / "+puzzle.items.length;message.textContent="Верно!";sound("good");const next=puzzle.items.findIndex((x,i)=>!solved.has(norm(x.answer)));if(next>=0)select(next);}
 list.addEventListener("click",e=>{const b=e.target.closest("[data-clue]");if(b)select(+b.dataset.clue);});
 root.querySelector("#qqCodyCheck").onclick=answer;input.addEventListener("keydown",e=>{if(e.key==="Enter")answer();});
 root.querySelector("#qqCodyLoupe").onclick=()=>{const item=puzzle.items[active],word=norm(item?.answer);if(!word)return;const p=puzzle.layout.placed.find(x=>x.word===word);if(!p)return;const missing=p.cells.find((pos,i)=>{const c=board.querySelector('[data-pos="'+pos.x+','+pos.y+'"]');return c&&!c.textContent;});if(!missing){message.textContent="В этом слове больше нечего открывать.";return;}const i=p.cells.findIndex(pos=>pos.x===missing.x&&pos.y===missing.y);const c=board.querySelector('[data-pos="'+missing.x+','+missing.y+'"]');c.textContent=word[i];c.classList.add("revealed","qq-hint-reveal");message.textContent="Лупа открыла одну букву.";sound("hint");};
 root.querySelector("#qqCodyHint").onclick=()=>{const item=puzzle.items[active];message.textContent=item?"Подсказка: "+(item.clueShort||item.clue):"Выбери вопрос.";sound("hint");};
 renderSecret();select(0);
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
