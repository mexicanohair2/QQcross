(function(){
"use strict";
const MAX_ROWS=6;
const KEY_ROWS=[["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З","Х","Ъ"],["Ф","Ы","В","А","П","Р","О","Л","Д","Ж","Э"],["Я","Ч","С","М","И","Т","Ь","Б","Ю"]];
const WIN=["Отлично!","Прекрасно!","Здорово!","Есть!","Почти не пришлось думать!","В последний момент!"];
const LENGTHS=[4,5,6,7,8];
const BAD=new Set(["БЛЯДЬ","БЛЯТЬ","ЕБАТЬ","ЕБАЛО","ХУЙНЯ","ПИЗДА","ГОВНО","МУДАК","ДЕРЬМО","ПИЗДЕЦ","НАХУЙ","СУКА","МРАЗЬ"]);
function normalize(value){return String(value||"").toUpperCase().replace(/Ё/g,"Е").replace(/[^А-Я]/g,"")}
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
function mount(root,onExit,options={}){
 const dailyConfig=options.daily||null;
 let dailyReported=!!dailyConfig?.completed;
 let length=5,row=0,col=0,target="",gameOver=false,revealing=false,loading=true,valid=new Set(),answers=[],validByLength={},answersByLength={},tiles=[],keyMap=new Map(),timers=[],messageTimer=null,alive=true;
 root.innerHTML='<div class="screen wordle-screen" data-daily-length="5"><div class="top wordle-top"><button type="button" class="btn" id="wordleBack">← Назад</button><b class="wordle-brand">WORDLE <span class="qq-straw-hat" title="Сенная шляпа" data-qq-straw-hat-trigger>👒</span></b><button type="button" class="btn" id="wordleNew">Новая игра</button></div><div class="wordle-lengths" id="wordleLengths" aria-label="Длина слова">'+LENGTHS.map(n=>'<button type="button" data-length="'+n+'" class="'+(n===5?"active":"")+'" aria-pressed="'+(n===5)+'">'+n+'</button>').join("")+'</div><p class="wordle-subtitle" id="wordleSubtitle">Угадай слово из пяти букв за шесть попыток</p><div class="wordle-message" id="wordleMessage" role="status" aria-live="polite"></div><div class="wordle-board" id="wordleBoard" aria-label="Игровое поле"></div><div class="wordle-keyboard" id="wordleKeyboard" aria-label="Экранная клавиатура"></div><p class="wordle-help"><b>Важно:</b> серые клавиши не блокируются — их можно нажимать в следующих словах. Цвет показывает, есть ли буква в загаданном слове.</p><div class="wordle-footer"><span>QQCross · Wordle</span><button type="button" class="wordle-text-button" id="wordleAgain">Сыграть ещё раз</button></div></div>';
 const board=root.querySelector("#wordleBoard"),keyboard=root.querySelector("#wordleKeyboard"),message=root.querySelector("#wordleMessage"),subtitle=root.querySelector("#wordleSubtitle"),lengths=root.querySelector("#wordleLengths");
 if(dailyConfig){length=Number(dailyConfig.length)||5;lengths.hidden=true;lengths.style.display="none";root.querySelector("#wordleNew").textContent="Испытание дня";root.querySelector(".wordle-screen").dataset.dailyLength=String(length);root.querySelector(".wordle-screen").dataset.daily="true";}
 const timeout=(fn,delay)=>{const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);if(alive)fn()},delay);timers.push(id);return id};
 function show(text){message.textContent=text;message.classList.add("visible");clearTimeout(messageTimer);messageTimer=setTimeout(()=>message.classList.remove("visible"),2200)}
 function clearTimers(){timers.forEach(clearTimeout);timers=[];clearTimeout(messageTimer)}
 function createBoard(){board.innerHTML="";tiles=[];board.style.setProperty("--wordle-cols",String(length));for(let r=0;r<MAX_ROWS;r++){const line=document.createElement("div");line.className="wordle-row";line.dataset.row=String(r);line.style.setProperty("--wordle-cols",String(length));for(let c=0;c<length;c++){const tile=document.createElement("div");tile.className="wordle-tile";tile.setAttribute("aria-label","Пустая клетка");const letter=document.createElement("span");tile.appendChild(letter);line.appendChild(tile);tiles.push(tile)}board.appendChild(line)}}
 function createKeyboard(){keyboard.innerHTML="";keyMap.clear();KEY_ROWS.forEach((letters,index)=>{const line=document.createElement("div");line.className="wordle-key-row";if(index===2){const enter=document.createElement("button");enter.type="button";enter.className="wordle-key wordle-key-wide";enter.textContent="ВВОД";enter.dataset.key="ENTER";line.appendChild(enter)}letters.forEach(letter=>{const key=document.createElement("button");key.type="button";key.className="wordle-key";key.textContent=letter;key.dataset.key=letter;key.disabled=false;keyMap.set(normalize(letter),key);line.appendChild(key)});if(index===2){const back=document.createElement("button");back.type="button";back.className="wordle-key wordle-key-wide";back.textContent="⌫";back.dataset.key="BACKSPACE";back.setAttribute("aria-label","Удалить букву");line.appendChild(back)}keyboard.appendChild(line)})}
 function resetKeyboard(){keyMap.forEach(key=>{key.classList.remove("correct","present","absent");key.removeAttribute("aria-label")})}
 function currentGuess(){return tiles.slice(row*length,row*length+length).map(tile=>tile.textContent).join("")}
 function insert(letter){if(gameOver||revealing||loading||col>=length||row>=MAX_ROWS)return;const value=normalize(letter);if(!/^[А-Я]$/.test(value))return;const tile=tiles[row*length+col];tile.firstChild.textContent=value;tile.classList.add("filled","pop");timeout(()=>tile.classList.remove("pop"),150);col++;window.QQAudio?.play("letter")}
 function remove(){if(gameOver||revealing||loading||col===0||row>=MAX_ROWS)return;col--;const tile=tiles[row*length+col];tile.firstChild.textContent="";tile.classList.remove("filled")}
 function evaluate(guess,answer){const result=Array(length).fill("absent"),counts={};for(const ch of answer)counts[ch]=(counts[ch]||0)+1;for(let i=0;i<length;i++)if(guess[i]===answer[i]){result[i]="correct";counts[guess[i]]--}for(let i=0;i<length;i++)if(result[i]!=="correct"&&counts[guess[i]]>0){result[i]="present";counts[guess[i]]--}return result}
 function updateKeys(guess,result){const priority={absent:1,present:2,correct:3};for(let i=0;i<length;i++){const key=keyMap.get(guess[i]);if(!key)continue;let old=key.classList.contains("correct")?"correct":key.classList.contains("present")?"present":key.classList.contains("absent")?"absent":null;if(old&&priority[old]>=priority[result[i]])continue;key.classList.remove("correct","present","absent");key.classList.add(result[i]);key.disabled=false;key.setAttribute("aria-label",guess[i]+(result[i]==="absent"?" — нет в загаданном слове, можно вводить":result[i]==="present"?" — есть в слове, другая позиция":" — правильная позиция"))}}
 function shake(){const line=board.children[row];if(!line)return;line.classList.remove("shake");void line.offsetWidth;line.classList.add("shake")}
 function submit(){
  if(gameOver||revealing)return;if(loading){show("Загружаем слова…");return}
  if(col!==length){show("Нужно ввести "+length+" букв");shake();return}
  const guess=currentGuess();if(!validByLength[length]?.has(guess)){show("Такого слова нет в словаре");shake();return}
  const result=evaluate(guess,target);window.QQAudio?.play("word");revealing=true;
  for(let i=0;i<length;i++){const tile=tiles[row*length+i];timeout(()=>{tile.classList.add("flip");timeout(()=>{tile.classList.add(result[i]);tile.classList.remove("flip")},260)},i*120)}
  timeout(()=>{updateKeys(guess,result);revealing=false;window.QQAudio?.play(guess===target?"correct":"wrong");if(guess===target){gameOver=true;const line=board.children[row];line.dataset.qqWord=target;line.title="Дважды нажми на слово, чтобы открыть его значение";line.querySelectorAll(".wordle-tile").forEach((tile,i)=>tile.style.setProperty("--i",String(i)));line.classList.add("wordle-bounce");show(WIN[row]||"Угадал!");if(!dailyReported){dailyReported=true;if(!dailyConfig||!dailyConfig.completed){window.QQProgression?.record("wordleWins");window.QQProgression?.recordWord?.(target);options.onWin?.(target,dailyConfig?.date||options.sessionId||Math.floor(Date.now()/1000));}}return}row++;col=0;if(row===MAX_ROWS){gameOver=true;show("Слово: "+target)}},length*120+300);
 }
 function newGame(nextLength=length){
  if(loading){length=dailyConfig?Number(dailyConfig.length)||5:nextLength;return}
  clearTimers();length=dailyConfig?Number(dailyConfig.length)||5:nextLength;valid=validByLength[length]||new Set();answers=answersByLength[length]||[];row=0;col=0;gameOver=false;revealing=false;if(!dailyConfig)dailyReported=false;
  const pool=answersByLength[length]||[];
  if(dailyConfig){const rng=window.QQProgression?.randomFor(Number(dailyConfig.seed)||1)||Math.random;target=pool[Math.floor(rng()*pool.length)]||"";}
  else target=pool[Math.floor(Math.random()*pool.length)]||"";
  if(!target){show("Для этой длины пока нет слов.");return}
  createBoard();resetKeyboard();message.classList.remove("visible");message.textContent="";
  subtitle.textContent="Угадай слово из "+length+" букв за шесть попыток";
  root.querySelector(".wordle-screen").dataset.dailyLength=String(length);
  lengths.querySelectorAll("[data-length]").forEach(b=>{const active=+b.dataset.length===length;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
 }
 function onKey(event){if(!alive||root.querySelector(".wordle-screen")===null)return;if(event.ctrlKey||event.metaKey||event.altKey)return;const active=document.activeElement;if(active&&/INPUT|TEXTAREA|SELECT/.test(active.tagName))return;const key=event.key.toUpperCase();if(key==="ENTER"){event.preventDefault();event.stopImmediatePropagation();submit()}else if(key==="BACKSPACE"){event.preventDefault();event.stopImmediatePropagation();remove()}else if(/^[А-ЯЁ]$/.test(key)){event.preventDefault();event.stopImmediatePropagation();insert(key)}}
 function handleKeyboard(event){const key=event.target.closest("[data-key]");if(!key)return;const value=key.dataset.key;if(value==="ENTER")submit();else if(value==="BACKSPACE")remove();else insert(value)}
 const back=root.querySelector("#wordleBack");back.addEventListener("click",()=>{cleanup();onExit()});
 const hat=root.querySelector("[data-qq-straw-hat-trigger]");if(hat)hat.addEventListener("click",()=>{const n=window.QQProgression?.tapHat?.()||0;if(n===15)show("Секретный титул Mugiwara открыт!");else if(n%5===0)show("Соломенная шляпа: "+n+" / 15")});
 root.querySelector("#wordleNew").addEventListener("click",()=>newGame(length));root.querySelector("#wordleAgain").addEventListener("click",()=>newGame(length));
 lengths.addEventListener("click",e=>{const b=e.target.closest("[data-length]");if(b)newGame(+b.dataset.length)});
 keyboard.addEventListener("click",handleKeyboard);document.addEventListener("keydown",onKey,true);
 function cleanup(){alive=false;clearTimers();document.removeEventListener("keydown",onKey,true);keyboard.removeEventListener("click",handleKeyboard)}
 createBoard();createKeyboard();
 Promise.all([
  fetch("./data/wordle-words.json").then(r=>{if(!r.ok)throw new Error("Wordle dictionary unavailable");return r.json()}),
  fetch("./data/russian-words-100000.json").then(r=>{if(!r.ok)throw new Error("100k lexicon unavailable");return r.json()}).catch(()=>fetch("./data/russian-words-50000.json").then(r=>{if(!r.ok)throw new Error("Russian lexicon unavailable");return r.json()}))
 ]).then(([wordle,lexicon])=>{
  if(!alive)return;
  if(lexicon.language!=="ru"||!Array.isArray(lexicon.words)||lexicon.words.length!==lexicon.count)throw new Error("Основной словарь не прошёл проверку");
  const common=lexicon.words.map(normalize).filter(w=>/^[А-Я]{4,8}$/.test(w)&&new Set(w).size>=3&&!BAD.has(w)&&!/(.)\1\1/.test(w));
  for(const n of LENGTHS){const pool=common.filter(w=>w.length===n).sort();validByLength[n]=new Set(pool);answersByLength[n]=pool.slice(0,Math.min(8000,pool.length));}
  const fiveValid=(wordle.valid||[]).map(normalize).filter(w=>w.length===5),fiveAnswers=(wordle.answers||[]).map(normalize).filter(w=>w.length===5);
  validByLength[5]=new Set(fiveValid);answersByLength[5]=fiveAnswers.filter(w=>validByLength[5].has(w));
  if(!answersByLength[5].length)throw new Error("Нет пятибуквенных слов для игры");
  valid=validByLength[5];answers=answersByLength[5];loading=false;newGame(dailyConfig?dailyConfig.length:length);
 }).catch(error=>{if(!alive)return;loading=true;show("Не удалось загрузить словарь. Проверь подключение и обнови игру.");console.error("QQCross Wordle:",error)});
 return cleanup;
}
window.QQWordle={mount};
})();