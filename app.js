const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const SUPABASE_URL="https://lzpkronttfzbubbfggsb.supabase.co";
const SUPABASE_KEY="sb_publishable_2PD3wYGG1aYoxRqhyM8wMA_OIQrwm3k";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let authMode="signup";
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,completed:new Set(),partySize:2,inviteName:"",invite:null,levelId:1};
let puzzle=null;
const expected={};
let letterBag=[];
let draggingLetter=false;
let suppressCellClick=false;
function loadPuzzle(){
  const data=[
    {answer:"УРАН",clue:"Планета-гигант с необычным наклоном оси",row:0,col:4,dir:"v"},
    {answer:"ИК",clue:"Сокращение для инфракрасного излучения",row:1,col:0,dir:"v"},
    {answer:"ЗАТМЕНИЕ",clue:"Явление, при котором одно небесное тело закрывает другое",row:1,col:2,dir:"v"},
    {answer:"ПЛАНЕТОХОДЫ",clue:"Аппараты для исследования поверхности других планет",row:1,col:14,dir:"v"},
    {answer:"КВАЗАРЫ",clue:"Чрезвычайно яркие далёкие активные ядра галактик",row:2,col:0,dir:"h"},
    {answer:"ПЛАНЕТА",clue:"Небесное тело, вращающееся вокруг звезды",row:3,col:8,dir:"h"},
    {answer:"АСТЕРОИД",clue:"Небольшое каменное тело, обращающееся вокруг Солнца",row:3,col:10,dir:"v"},
    {answer:"МАРС",clue:"Красная планета",row:4,col:0,dir:"v"},
    {answer:"ГАЗ",clue:"Состояние вещества, из которого состоят многие туманности",row:4,col:7,dir:"v"},
    {answer:"ПЛАНЕТЫ",clue:"Небесные тела, вращающиеся вокруг звёзд",row:5,col:5,dir:"h"},
    {answer:"ПУЛЬСАР",clue:"Нейтронная звезда, испускающая регулярные импульсы",row:5,col:5,dir:"v"},
    {answer:"СПИРАЛЬ",clue:"Форма галактик с закрученными рукавами",row:7,col:0,dir:"h"},
    {answer:"НЕБО",clue:"Видимое пространство над поверхностью Земли",row:8,col:7,dir:"h"},
    {answer:"ЛУНА",clue:"Естественный спутник Земли",row:10,col:2,dir:"h"},
    {answer:"УФ",clue:"Сокращение для ультрафиолетового излучения",row:10,col:3,dir:"v"},
    {answer:"ГОД",clue:"Период обращения планеты вокруг звезды",row:10,col:8,dir:"h"},
    {answer:"ЛЁД",clue:"Замёрзшая вода, встречающаяся на кометах",row:10,col:12,dir:"h"}
  ];
  puzzle={id:"cosmos-test",title:"Космос",w:15,h:12,words:[]};
  Object.keys(expected).forEach(key=>delete expected[key]);
  const starts={};
  data.forEach((word,index)=>{
    const key=word.row+","+word.col;
    if(!starts[key])starts[key]=0;
  });
  const ordered=Object.keys(starts).sort((a,b)=>{
    const [ar,ac]=a.split(",").map(Number),[br,bc]=b.split(",").map(Number);
    return ar-br||ac-bc;
  });
  const numbers={};
  ordered.forEach((key,index)=>numbers[key]=index+1);
  data.forEach((word,index)=>{
    const length=word.answer.length;
    if(word.dir==="h" ? word.col+length>puzzle.w : word.row+length>puzzle.h) throw new Error("Слово выходит за границы сетки: "+word.answer);
    const cells=Array.from({length},(_,i)=>[word.row+(word.dir==="v"?i:0)+1,word.col+(word.dir==="h"?i:0)+1]);
    puzzle.words.push({id:"w"+(index+1),number:numbers[word.row+","+word.col],answer:word.answer,clue:word.clue,cells,dir:word.dir});
    cells.forEach((cell,i)=>{
      const key=cell.join(",");
      if(expected[key]&&expected[key]!==word.answer[i])throw new Error("Не совпали буквы на пересечении: "+word.answer);
      expected[key]=word.answer[i];
    });
  });
  const crossing={};
  puzzle.words.forEach(word=>word.cells.forEach(cell=>{
    const key=cell.join(",");
    crossing[key]=(crossing[key]||0)+1;
  }));
  puzzle.words.forEach(word=>{
    if(!word.cells.some(cell=>crossing[cell.join(",")]>1))throw new Error("Слово не пересекается: "+word.answer);
  });
  letterBag=puzzle.words.flatMap(word=>word.answer.split(""));
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]];}
  state.levelId=1;
  return true;
}
function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}renderShell(root)}
function renderRegister(root){root.innerHTML=`<div class="screen"><div class="splash"><div class="logo">QQ</div><h1>QQcross</h1><p>Собирай слова. Побеждай друзей.</p></div><div class="card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><p class="small muted">Латиница, цифры и подчёркивание.</p><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><p class="small muted" id="authMessage">Аккаунт будет доступен на разных устройствах после входа.</p>${authMode==="signup"?'<p class="small muted">🎁 Новичку: по 5 луп, часов и мусорок бесплатно.</p>':""}</div></div>`;
$("#showSignup").onclick=()=>{authMode="signup";renderRegister(root)};$("#showLogin").onclick=()=>{authMode="login";renderRegister(root)};
root.querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{state.selectedAvatar=+b.dataset.avatar;renderRegister(root)});
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.textContent="Подожди…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:"https://mexicanohair2.github.io/QQcross/"}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);render()}else{msg.textContent="Аккаунт создан. Проверь почту и подтверди адрес, затем открой «Войти».";authMode="login";btn.disabled=false;btn.textContent="Войти";}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){msg.textContent=e.message||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","Друзья","Магазин","Профиль"],icons=["⌂","♧","🛍","◉"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${AVATARS[state.profile.avatar]}</div><div><b>@${esc(state.profile.username)}</b><div class="small muted">Добро пожаловать!</div></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();return home()}
function home(){return `<section class="card hero"><span class="pill">Кроссворд для друзей</span><h2>Собирай слова.<br>Побеждай друзей.</h2><p class="muted">Создай партию и пригласи друзей.</p><button class="btn primary full" id="createParty">Создать партию</button></section><section class="card row between"><div><b>Космический кроссворд</b><div class="small muted">17 слов с настоящими пересечениями</div></div><span class="pill">17 слов</span></section><h3 class="section-title">Входящие приглашения</h3>${state.invite?`<div class="notice"><b>Приглашение в партию</b><p class="small muted">От игрока @${esc(state.invite.from)} · ${state.invite.size} участника(ов)</p><div class="grid2"><button class="btn primary" id="acceptInvite">Согласиться</button><button class="btn" id="rejectInvite">Отказаться</button></div></div>`:`<div class="notice"><b>Пока нет приглашений</b><div class="small muted">Здесь появятся приглашения от друзей.</div></div>`}<h3 class="section-title">Начать игру</h3><div class="card row between"><div><b>Одиночная игра</b><div class="small muted">17 пересекающихся слов</div></div><button class="btn blue" id="practice">Играть</button></div>`}
function renderLevels(root){
  root.innerHTML=`<div class="screen"><div class="top"><button class="btn" id="levelsBack">← Назад</button><span class="pill">10 уровней</span></div><h2>Выбери кроссворд</h2><div class="grid2">${window.QQCROSS_LEVELS.map(level=>`<button class="btn level-button" data-level="${level.level_id}"><b>Уровень ${level.level_id}</b><br><span class="small muted">${esc(level.theme)}</span></button>`).join("")}</div></div>`;
  $("#levelsBack").onclick=()=>{state.screen="";render()};
  root.querySelectorAll("[data-level]").forEach(button=>button.onclick=()=>begin(1,+button.dataset.level));
}
function friends(){return `<h2>Друзья</h2><div class="card"><p class="muted">Добавляй игроков по имени и приглашай их в партию.</p><input class="input" id="friendName" placeholder="Имя игрока"><button class="btn primary full" id="addFriend">Добавить друга</button></div><h3 class="section-title">Мои друзья</h3>${(state.profile.friends||[]).length?state.profile.friends.map(n=>`<div class="card row between"><b>@${esc(n)}</b><button class="btn inviteFriend" data-name="${esc(n)}">Пригласить</button></div>`).join(""):`<p class="muted">Список пока пуст.</p>`}`}
function shop(){const products=[["magnifier","🔎","Лупы","Проверка и подсказка"],["clock","⏱","Часы","Добавить 20 секунд"],["trash","🗑️","Мусорки","Заменить набор букв"]];return `<h2>Магазин</h2><p class="muted">Предметы и монеты принадлежат каждому игроку отдельно.</p>${products.map(([key,ico,name,desc])=>`<div class="card"><div class="row"><div class="avatar">${ico}</div><div class="grow"><b>${name}</b><div class="small muted">${desc}</div><div class="small">В наличии: ${state.profile.items[key]}</div></div></div><div class="grid2 shop-buy"><button class="btn buy" data-item="${key}" data-qty="5">5 шт. · 100 🪙</button><button class="btn primary buy" data-item="${key}" data-qty="10">10 шт. · 200 🪙</button></div></div>`).join("")}`}
function profile(){return `<h2>Профиль</h2><div class="card row"><div class="avatar big">${AVATARS[state.profile.avatar]}</div><div><h3>@${esc(state.profile.username)}</h3><span class="muted small">Игрок QQcross</span></div></div><div class="grid2"><div class="card"><b>${state.profile.wins}</b><div class="muted small">Победы</div></div><div class="card"><b>${state.profile.games}</b><div class="muted small">Матчи</div></div><div class="card"><b>${state.profile.points}</b><div class="muted small">Очки</div></div><div class="card"><b>${state.profile.coins}</b><div class="muted small">Монеты</div></div></div><div class="card"><b>Мои предметы</b><p class="small">🔎 Лупы: ${state.profile.items.magnifier}　⏱ Часы: ${state.profile.items.clock}　🗑️ Мусорки: ${state.profile.items.trash}</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button><p class="small muted">Сброс удалит локальный профиль на этом устройстве.</p>`}
function wireContent(){const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const af=$("#addFriend");if(af)af.onclick=()=>{const n=$("#friendName").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(n)){toast("Проверь имя игрока");return}if(n.toLowerCase()===state.profile.username.toLowerCase()){toast("Нельзя добавить самого себя");return}if(!state.profile.friends.includes(n))state.profile.friends.push(n);save();render();toast("Добавлено в демо-список")};document.querySelectorAll(".inviteFriend").forEach(b=>b.onclick=()=>openInvite(b.dataset.name));document.querySelectorAll(".buy").forEach(b=>b.onclick=()=>{const qty=+b.dataset.qty,cost=qty===5?100:200;if(state.profile.coins<cost){toast("Не хватает монет");return}state.profile.coins-=cost;state.profile.items[b.dataset.item]+=qty;save();render();toast(`Куплено: ${qty} шт.`)});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){await supabaseClient.auth.signOut();localStorage.removeItem(STORE_KEY);state.profile=null;render()}}}
function renderLobby(root){root.innerHTML=`<div class="screen"><div class="top"><button class="btn" id="back">← Назад</button><div class="coins">🪙 ${state.profile.coins}</div></div><h2>Новая партия</h2><div class="card"><b>Сколько игроков будет в партии?</b><div class="party-options">${[2,3,4].map(n=>`<button class="party-option ${state.partySize===n?"selected":""}" data-size="${n}">${n}</button>`).join("")}</div><p class="small muted">Ты — первый игрок. Остальные места займут приглашённые друзья.</p><label class="small muted">Кого пригласить?</label><input id="inviteName" class="input" placeholder="Username друга"><button class="btn primary full" id="sendInvite">Отправить приглашение</button></div><div class="card"><b>Как работает приглашение</b><p class="small muted">Игрок увидит плашку с выбором: согласиться или отказаться. Сейчас это демонстрация интерфейса; доставка между разными устройствами заработает после подключения сервера.</p><button class="btn full" id="demoInvite">Показать входящее приглашение (демо)</button></div>`;$("#back").onclick=()=>{state.screen="";render()};root.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{state.partySize=+b.dataset.size;renderLobby(root)});$("#sendInvite").onclick=()=>{const n=$("#inviteName").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(n)){toast("Введи username друга");return}openInvite(n)};$("#demoInvite").onclick=()=>{state.invite={from:"friend_demo",size:state.partySize};state.screen="";state.tab="Главная";render()}}
function openInvite(name){state.invite={from:name,size:state.partySize};state.screen="";state.tab="Главная";render();toast("Демо-приглашение создано")}
function begin(size=1){if(!loadPuzzle())return;state.screen="game";state.partySize=size;state.filled={};state.completed=new Set();state.scores=0;state.turn=0;state.seconds=60;state.letters=drawLetters(7);state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";render()}
function drawLetters(n){
  const out=[];
  for(let i=0;i<n&&letterBag.length;i++){
    const index=Math.floor(Math.random()*letterBag.length);
    out.push(letterBag.splice(index,1)[0]);
  }
  return out;
}
function ensureWordLetter(){const w=currentWord(),c=nextCell(w);if(!c)return;const needed=expected[c.join(",")];if(!state.letters.includes(needed)&&state.letters.length)state.letters[state.letters.length-1]=needed}
function currentWord(){return puzzle.words.find(w=>!state.completed.has(w.id))||puzzle.words[0]}
function nextCell(word){return word.cells.find(c=>!state.filled[c.join(",")])}
function renderGame(root){
  const starts={};
  puzzle.words.forEach(w=>{
    const k=w.cells[0].join(",");
    if(!starts[k])starts[k]=[];
    starts[k].push(w.number+(w.dir==="h"?"→":"↓"));
  });
  let cells=[];
  for(let y=1;y<=puzzle.h;y++)for(let x=1;x<=puzzle.w;x++){
    const k=y+","+x,exists=expected[k]!==undefined,filled=state.filled[k];
    cells.push('<button class="cell '+(!exists?'block ':'')+(filled?'filled':'')+(state.wrong===k?' wrong':'')+'" data-cell="'+k+'" '+(!exists?'disabled':'')+'>'+(starts[k]?'<span class="cell-mark">'+starts[k].join(" ")+'</span>':'')+'<span class="cell-letter">'+(filled||'')+'</span></button>');
  }
  root.innerHTML=
    '<div class="screen game-screen">'+
      '<div class="top"><button class="btn" id="exit">← Выйти</button><div class="timer" id="timer">⏱ '+state.seconds+'</div></div>'+
      '<div class="game-head"><div><b>Космос · 17 слов</b><div class="small muted">'+(state.partySize===1?'Тренировка':'Партия · '+state.partySize+' игрока(ов)')+' · Ход: '+(state.turn===0?'Ты':'Игрок '+(state.turn+1))+'</div></div><span class="pill">Очки: '+state.scores+'</span></div>'+
      '<div class="board-wrap"><div class="board" style="grid-template-columns:repeat('+puzzle.w+',minmax(0,1fr))">'+cells.join('')+'</div></div>'+
      '<div class="clue-title">Все вопросы <span>17 слов · все открыты</span></div>'+
      '<div class="questions">'+puzzle.words.map(w=>'<div class="question"><b>'+w.number+(w.dir==="h"?" →":" ↓")+'</b><span>'+esc(w.clue)+'</span><small>'+w.answer.length+' бук.</small></div>').join('')+'</div>'+
      '<div class="game-tools">'+
        '<div class="items">'+
          '<button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button>'+
          '<button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы +20с</button>'+
          '<button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button>'+
        '</div>'+
        '<div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+'" data-letter="'+i+'">'+l+'</button>').join('')+'</div></div>'+
        '<button class="btn primary full compact-action" id="endturn">'+(state.partySize>1?'Завершить ход':'Перемешать буквы')+'</button>'+
      '</div>'+
    '</div>';
  root.querySelectorAll("[data-letter]").forEach(b=>b.addEventListener("pointerdown",e=>{
    e.preventDefault();
    state.selectedLetter=+b.dataset.letter;
    draggingLetter=true;
    b.classList.add("selected");
  }));
  document.onpointerup=e=>{
    if(!draggingLetter)return;
    draggingLetter=false;
    const target=document.elementFromPoint(e.clientX,e.clientY);
    const cell=target&&target.closest?target.closest("[data-cell]"):null;
    if(cell&&!cell.disabled){
      suppressCellClick=true;
      place(cell.dataset.cell,root);
    }else{
      renderGame(root);
    }
  };
  root.querySelectorAll("[data-cell]").forEach(b=>b.onclick=()=>{
    if(suppressCellClick){suppressCellClick=false;return;}
    place(b.dataset.cell,root);
  });
  root.querySelectorAll("[data-letter]").forEach(b=>b.onclick=()=>{
    state.selectedLetter=+b.dataset.letter;
    renderGame(root);
  });
  $("#exit").onclick=()=>{state.screen="";render()};
  $("#endturn").onclick=()=>{
    if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;state.seconds=60;}
    else{
      letterBag.push(...state.letters);
      for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]];}
      state.letters=drawLetters(7);
      state.selectedLetter=-1;
    }
    renderGame(root);
  };
  $("#clock").onclick=()=>{if(!useItem("clock"))return;state.seconds+=20;renderGame(root)};
  $("#trash").onclick=()=>{
    if(!useItem("trash"))return;
    letterBag.push(...state.letters);
    for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]];}
    state.letters=drawLetters(7);state.selectedLetter=-1;renderGame(root);
  };
  $("#magnifier").onclick=()=>{
    if(!useItem("magnifier"))return;
    const next=puzzle.words.flatMap(w=>w.cells).find(c=>!state.filled[c.join(",")]);
    if(!next){toast("Все клетки заполнены");return}
    const k=next.join(","),needed=expected[k];
    let ix=state.letters.indexOf(needed);
    if(ix>=0)state.letters.splice(ix,1);
    else{ix=letterBag.indexOf(needed);if(ix>=0)letterBag.splice(ix,1);}
    state.filled[k]=needed;
    if(state.letters.length<7&&letterBag.length)state.letters.push(drawLetters(1)[0]);
    state.scores++;checkWords();save();renderGame(root);toast("Лупа открыла букву");
  };
  state.interval=setInterval(()=>{
    state.seconds--;
    const t=$("#timer");if(t)t.textContent="⏱ "+state.seconds;
    if(state.seconds<=0){clearInterval(state.interval);state.turn=(state.turn+1)%Math.max(1,state.partySize);state.seconds=60;renderGame(root)}
  },1000);
}
function useItem(key){if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}state.profile.items[key]--;save();return true}
function place(k,root){
  if(state.selectedLetter<0){toast("Перетащи букву из нижнего ряда в клетку");return}
  if(expected[k]===undefined){return}
  if(state.filled[k]){toast("Клетка уже заполнена");return}
  const l=state.letters[state.selectedLetter];
  if(expected[k]===l){
    state.filled[k]=l;
    state.letters.splice(state.selectedLetter,1);
    if(letterBag.length)state.letters.push(drawLetters(1)[0]);
    state.selectedLetter=-1;state.selectedCell=null;state.wrong=null;
    checkWords();renderGame(root);
  }else{
    state.wrong=k;renderGame(root);toast("Эта буква сюда не подходит");
    setTimeout(()=>{state.wrong=null;const el=document.querySelector('[data-cell="'+k+'"]');if(el)el.classList.remove("wrong")},500);
  }
}
function checkWords(){puzzle.words.forEach(w=>{if(!state.completed.has(w.id)&&w.cells.every(c=>state.filled[c.join(",")]===expected[c.join(",")])){state.completed.add(w.id);state.scores+=5;toast(`Слово «${w.answer}» собрано! +5`)}});if(state.completed.size===puzzle.words.length){state.profile.games++;state.profile.points+=state.scores;state.profile.coins+=Math.max(10,state.scores);save();state.screen="";setTimeout(()=>{render();toast("Партия завершена!")},500)}}
async function loadCloudProfile(userId){const {data,error}=await supabaseClient.from("profiles").select("id,username,avatar,wins,games,points").eq("id",userId).single();if(error)throw error;state.profile={id:data.id,username:data.username,avatar:data.avatar||0,coins:0,wins:data.wins||0,games:data.games||0,points:data.points||0,items:defaultItems(),friends:[]};localStorage.setItem(STORE_KEY,JSON.stringify(state.profile));}
async function initAuth(){try{const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;if(data.session){await loadCloudProfile(data.session.user.id)}}catch(e){console.error("QQcross auth:",e);toast("Не удалось загрузить аккаунт. Попробуй обновить страницу.")}render()}
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
initAuth();
