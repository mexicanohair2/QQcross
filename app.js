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
const WORD_POOL = [
  ["ПУТЕШЕСТВИЕ","Поездка в далёкие или новые места","🧳"],["ПРИКЛЮЧЕНИЕ","Необычное и захватывающее событие","🗺️"],
  ["ЯД","Опасное вещество, способное вызвать отравление","☠️"],["УС","Волосы над верхней губой","🥸"],["ОС","Короткое название насекомого","🐝"],["УХ","Междометие удивления или часть головы","👂"],["ОН","Местоимение мужского рода","👤"],
  ["СОЛНЦЕ","Звезда, вокруг которой вращается Земля","☀️"],["КОМПАС","Прибор для определения сторон света","🧭"],["ПИРАТЫ","Морские разбойники","🏴‍☠️"],["БИБЛИЯ","Священная книга христиан","📖"],["КАРМАН","Отделение в одежде для мелочей","👖"],["РАКЕТА","Летательный аппарат для космоса","🚀"],["ВОКЗАЛ","Место отправления поездов","🚉"],["КОЛЕСО","Круглая деталь для движения транспорта","🛞"],["МОЛОКО","Белый напиток, который дают коровы","🥛"],["ЗЕРКАЛО","Предмет, в котором видно отражение","🪞"],["СОБАКА","Домашнее животное, которое часто охраняет дом","🐕"],["БАБОЧКА","Насекомое с большими разноцветными крыльями","🦋"],["ПОДУШКА","Мягкая вещь, на которой спят","🛏️"],["КОРОНА","Украшение на голове монарха","👑"],["КЛАВИШИ","Кнопки на пианино или клавиатуре","🎹"],["МЕДАЛЬ","Награда за победу или заслуги","🏅"],["ФОНАРЬ","Источник света, который берут на прогулку","🔦"],["ЛЕСТНИЦА","Сооружение для подъёма между этажами","🪜"],["ТЕЛЕФОН","Устройство для звонков и сообщений","📱"],["МУЗЫКА","Искусство звуков и мелодий","🎵"],
  ["АВТОБУС","Большой городской транспорт","🚌"],["БАРАБАН","Музыкальный инструмент, по которому ударяют","🥁"],["БРИЛЛИАНТ","Очень твёрдый драгоценный камень","💎"],["ВЕРТОЛЁТ","Летательный аппарат с винтом сверху","🚁"],["ДИНОЗАВР","Древнее животное, жившее миллионы лет назад","🦖"],["КАЛЕНДАРЬ","Таблица дней, недель и месяцев","🗓️"],["МАГНИТОФОН","Устройство для записи и воспроизведения звука","📼"],["ПАРАШЮТ","Купол, который замедляет падение","🪂"],["ПЕРЧАТКА","Одежда для защиты кисти руки","🧤"],["ПОЛОТЕНЦЕ","Ткань, которой вытираются после воды","🧺"],["ПРОГРАММА","Набор команд для компьютера","💻"],["СВЕТОФОР","Устройство с цветными сигналами на дороге","🚦"],["САМОЛЁТИК","Маленькая модель воздушного судна","✈️"],["ЧЕРЕПАХА","Животное с панцирем","🐢"],
  ["АКУЛА","Большая хищная рыба","🦈"],["АРБУЗ","Большая ягода с зелёной коркой","🍉"],["БАНАН","Жёлтый изогнутый фрукт","🍌"],["БИЛЕТ","Документ для прохода или поездки","🎟️"],["ВИЛКА","Столовый прибор с зубцами","🍴"],["ГРИБЫ","То, что собирают в лесу после дождя","🍄"],["ДВЕРЬ","То, через что входят в комнату","🚪"],["ЖИРАФ","Животное с очень длинной шеей","🦒"],["ЗЕБРА","Полосатое африканское животное","🦓"],["КНИГА","Печатное произведение для чтения","📚"],["ЛАМПА","Предмет, который освещает комнату","💡"],["ЛИМОН","Жёлтый кислый цитрус","🍋"],["МЕТРО","Подземный городской транспорт","🚇"],["МЫШЬ","Маленький грызун или компьютерный манипулятор","🐭"],["ОКЕАН","Огромное пространство солёной воды","🌊"],["ПАЛЕЦ","Одна из частей кисти руки","☝️"],["ПЛЕД","Тёплое покрывало","🧶"],["ПОЧТА","Служба доставки писем и посылок","📮"],["САЛЮТ","Праздничные огни в небе","🎆"],["САХАР","Сладкие кристаллы для чая","🧂"],["ТЕАТР","Место, где показывают спектакли","🎭"],["ТИГР","Полосатая большая кошка","🐅"],["ТУЧА","Большое скопление облаков","🌧️"],["УТЮГ","Прибор для разглаживания одежды","♨️"],["ФАКЕЛ","Горящая палка для освещения","🔥"],["ЦИРК","Место выступлений акробатов и клоунов","🎪"],["ЧАСЫ","Прибор для определения времени","⌚"],["ШАРФ","Тёплая вещь, которую носят на шее","🧣"],["ЯХТА","Небольшое прогулочное судно","⛵"],
  ["АКТ","Часть пьесы","🎭"],["БОК","Боковая часть тела","🧍"],["ГОД","Период в двенадцать месяцев","📅"],["ДОМ","Здание для жилья","🏠"],["ЁЖ","Колючее лесное животное","🦔"],["ЖУК","Насекомое с твёрдыми крыльями","🐞"],["ЗАЛ","Большое помещение для собраний","🏛️"],["ЛЁД","Замёрзшая вода","🧊"],["ЛУК","Овощ или оружие со стрелами","🧅"],["МЯЧ","Предмет для многих спортивных игр","⚽"],["НОС","Орган обоняния на лице","👃"],["РАЙ","Место вечного блаженства в религии","🌈"],["РОТ","Отверстие для еды и речи","👄"],["САД","Участок, где растут деревья и цветы","🌳"],["СОН","Состояние отдыха ночью","😴"],["ТОК","Движение электрического заряда","⚡"],["ЧАЙ","Популярный горячий напиток","🍵"],["ШАГ","Одно движение при ходьбе","👣"],
  ["АКТ","Часть пьесы","🎭"],["БОЙ","Сражение или поединок","🥊"],["ВЕК","Промежуток в сто лет","⌛"],["ВИД","То, что можно увидеть; облик","👀"],["ДНО","Нижняя часть сосуда или водоёма","🫙"],["ЖАР","Сильный нагрев или высокая температура","🌡️"],["ЗУБ","Твёрдая часть во рту","🦷"],["КИТ","Крупнейшее морское млекопитающее","🐋"],["ЛЕС","Место, где растёт много деревьев","🌲"],["МИР","Отсутствие войны или планета людей","🕊️"],["РАК","Знак зодиака и речное животное","🦀"],["РОК","Музыкальное направление","🎸"],["СЫР","Молочный продукт","🧀"],["ТОН","Оттенок звука или цвета","🎨"],["ХОД","Действие игрока в настольной игре","♟️"]
];

function makeRandomPuzzle(){
  const counts={11:1,8:2,7:5,4:4,3:3,2:2};
  const chosen=[];
  for(const [len,count] of Object.entries(counts)){
    const pool=WORD_POOL.filter(x=>Array.from(x[0]).length===+len);
    if(pool.length<count)throw new Error("Недостаточно слов длины "+len);
    const shuffled=pool.slice().sort(()=>Math.random()-.5);
    chosen.push(...shuffled.slice(0,count).map(x=>({answer:x[0],clue:x[1],art:x[2]})));
  }
  for(let attempt=0;attempt<250;attempt++){
    const grid=Array.from({length:25},()=>Array(25).fill(""));
    const placed=[];
    const words=chosen.slice().sort((a,b)=>b.answer.length-a.answer.length);
    const first=words.shift();
    const firstRow=12,firstCol=Math.floor((25-first.answer.length)/2);
    for(let i=0;i<first.answer.length;i++)grid[firstRow][firstCol+i]=first.answer[i];
    placed.push({...first,row:firstRow,col:firstCol,dir:"h"});
    let failed=false;
    for(const word of words){
      const candidates=[];
      for(let r=1;r<24;r++)for(let c=1;c<24;c++)for(const dir of ["h","v"]){
        const len=word.answer.length, er=r+(dir==="v"?len-1:0),ec=c+(dir==="h"?len-1:0);
        if(er>=24||ec>=24)continue;
        let crosses=0,valid=true;
        for(let i=0;i<len&&valid;i++){
          const rr=r+(dir==="v"?i:0),cc=c+(dir==="h"?i:0),existing=grid[rr][cc],ch=word.answer[i];
          if(existing&&existing!==ch){valid=false;break}
          if(existing===ch)crosses++;
          if(!existing){
            const side=dir==="h"?[[rr-1,cc],[rr+1,cc]]:[[rr,cc-1],[rr,cc+1]];
            if(side.some(([a,b])=>grid[a]?.[b]))valid=false;
          }
        }
        if(!valid||crosses===0)continue;
        const before=dir==="h"?[r,c-1]:[r-1,c],after=dir==="h"?[r,c+len]:[r+len,c];
        if(grid[before[0]]?.[before[1]]||grid[after[0]]?.[after[1]])continue;
        candidates.push({row:r,col:c,dir,crosses});
      }
      if(!candidates.length){failed=true;break}
      const centerR=placed.reduce((n,w)=>n+w.row,0)/placed.length,centerC=placed.reduce((n,w)=>n+w.col,0)/placed.length;
      candidates.sort((a,b)=>b.crosses-a.crosses||(Math.abs(a.row-centerR)+Math.abs(a.col-centerC))-(Math.abs(b.row-centerR)+Math.abs(b.col-centerC)));
      const best=candidates.slice(0,Math.min(8,candidates.length));
      const spot=best[Math.floor(Math.random()*best.length)];
      for(let i=0;i<word.answer.length;i++)grid[spot.row+(spot.dir==="v"?i:0)][spot.col+(spot.dir==="h"?i:0)]=word.answer[i];
      placed.push({...word,...spot});
    }
    if(failed||placed.length!==17)continue;
    const numbers={};
    placed.forEach(w=>{const k=w.row+","+w.col;if(!numbers[k])numbers[k]=0});
    Object.keys(numbers).sort((a,b)=>{const [ar,ac]=a.split(",").map(Number),[br,bc]=b.split(",").map(Number);return ar-br||ac-bc}).forEach((k,i)=>numbers[k]=i+1);
    const minRow=Math.min(...placed.map(w=>w.row)),minCol=Math.min(...placed.map(w=>w.col));
    const maxRow=Math.max(...placed.map(w=>w.row+(w.dir==="v"?w.answer.length-1:0)));
    const maxCol=Math.max(...placed.map(w=>w.col+(w.dir==="h"?w.answer.length-1:0)));
    puzzle={id:"random-"+Date.now(),title:"Случайный кроссворд",w:maxCol-minCol+1,h:maxRow-minRow+1,words:[]};
    Object.keys(expected).forEach(k=>delete expected[k]);
    placed.forEach((w,i)=>{
      const cells=Array.from({length:w.answer.length},(_,j)=>[w.row-minRow+(w.dir==="v"?j:0)+1,w.col-minCol+(w.dir==="h"?j:0)+1]);
      puzzle.words.push({id:"w"+(i+1),number:numbers[w.row+","+w.col],answer:w.answer,clue:w.clue,art:w.art,cells,dir:w.dir});
      cells.forEach((cell,j)=>expected[cell.join(",")]=w.answer[j]);
    });
    const crossings={};
    puzzle.words.forEach(w=>w.cells.forEach(c=>crossings[c.join(",")]=(crossings[c.join(",")]||0)+1));
    if(!puzzle.words.every(w=>w.cells.some(c=>crossings[c.join(",")]>1)))continue;
    return true;
  }
  throw new Error("Не удалось собрать случайный кроссворд. Попробуй ещё раз.");
}
function loadPuzzle(){
  const ok=makeRandomPuzzle();
  letterBag=puzzle.words.flatMap(word=>word.answer.split(""));
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]];}
  state.levelId=1;
  return ok;
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
function home(){return `<section class="card hero"><span class="pill">Кроссворд для друзей</span><h2>Собирай слова.<br>Побеждай друзей.</h2><p class="muted">Создай партию и пригласи друзей.</p><button class="btn primary full" id="createParty">Создать партию</button></section><section class="card row between"><div><b>Случайный кроссворд</b><div class="small muted">17 слов с настоящими пересечениями</div></div><span class="pill">17 слов</span></section><h3 class="section-title">Входящие приглашения</h3>${state.invite?`<div class="notice"><b>Приглашение в партию</b><p class="small muted">От игрока @${esc(state.invite.from)} · ${state.invite.size} участника(ов)</p><div class="grid2"><button class="btn primary" id="acceptInvite">Согласиться</button><button class="btn" id="rejectInvite">Отказаться</button></div></div>`:`<div class="notice"><b>Пока нет приглашений</b><div class="small muted">Здесь появятся приглашения от друзей.</div></div>`}<h3 class="section-title">Начать игру</h3><div class="card row between"><div><b>Одиночная игра</b><div class="small muted">17 пересекающихся слов</div></div><button class="btn blue" id="practice">Играть</button></div>`}
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
      '<div class="game-head"><div><b>Случайные слова · 17 слов</b><div class="small muted">'+(state.partySize===1?'Тренировка':'Партия · '+state.partySize+' игрока(ов)')+' · Ход: '+(state.turn===0?'Ты':'Игрок '+(state.turn+1))+'</div></div><span class="pill">Очки: '+state.scores+'</span></div>'+
      '<div class="board-wrap"><div class="board" style="grid-template-columns:repeat('+puzzle.w+',minmax(0,1fr))">'+cells.join('')+'</div></div>'+
      '<div class="clue-title">Все вопросы <span>17 слов · все открыты</span></div>'+
      '<div class="questions">'+puzzle.words.map(w=>'<div class="question"><b>'+w.number+(w.dir==="h"?" →":" ↓")+'</b><span><i class="question-art">'+(w.art||"✨")+'</i>'+esc(w.clue)+'</span><small>'+w.answer.length+' бук.</small></div>').join('')+'</div>'+
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
