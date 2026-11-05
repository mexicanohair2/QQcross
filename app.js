const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const THEME_KEY="qqcross_theme_v1";
const THEME_PRESETS={burgundy:"Глубокий бордовый",black:"Тёмно-серый",blue:"Синий",green:"Зелёный",white:"Белый"};
let activeTheme=(()=>{try{const saved=localStorage.getItem(THEME_KEY);return THEME_PRESETS[saved]?saved:"burgundy"}catch{return "burgundy"}})();
function applyTheme(theme=activeTheme){
  activeTheme=THEME_PRESETS[theme]?theme:"burgundy";
  document.documentElement.dataset.qqTheme=activeTheme;
  try{localStorage.setItem(THEME_KEY,activeTheme)}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",({burgundy:"#35131f",black:"#202329",blue:"#142b46",green:"#17372c",white:"#f4f5f7"})[activeTheme]||"#35131f");
}
const SUPABASE_URL="https://lzpkronttfzbubbfggsb.supabase.co";
const SUPABASE_KEY="sb_publishable_2PD3wYGG1aYoxRqhyM8wMA_OIQrwm3k";
const supabaseClient=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
let authMode="signup";
let socialChannel=null;
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null,playMenuOpen:false};
let puzzle=null;
const expected={};
let letterBag=[];
let draggingLetter=false;
let suppressCellClick=false;


function makeRandomPuzzle(){
  puzzle={id:"scanword-grid-"+Date.now(),title:"Пустая сетка",w:8,h:12,words:[]};
  Object.keys(expected).forEach(k=>delete expected[k]);
  return true;
}
function loadPuzzle(){
  makeRandomPuzzle();
  letterBag=[];
  return true;
}
function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}renderShell(root)}
function renderRegister(root){root.innerHTML=`<div class="screen"><div class="splash register-splash"><div class="logo">QQ</div></div><div class="card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button type="button" class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}" aria-label="${NAMES[i]}" aria-pressed="${i===state.selectedAvatar}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><button class="btn full" type="button" id="guestPlay">Играть без регистрации</button><p class="small muted" id="authMessage"></p>${authMode==="signup"?'':""}</div></div>`;
$("#showSignup").onclick=()=>{authMode="signup";renderRegister(root)};$("#showLogin").onclick=()=>{authMode="login";renderRegister(root)};$("#guestPlay").onclick=()=>{const username="Игрок"+String(Date.now()).slice(-4);state.profile={id:"local-"+Date.now(),username,avatar:state.selectedAvatar,coins:0,wins:0,games:0,points:0,items:defaultItems(),friends:[]};save();render();toast("Ты вошёл в гостевом режиме")};
root.querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{
  state.selectedAvatar=Number(b.dataset.avatar);
  root.querySelectorAll("[data-avatar]").forEach(x=>{
    const selected=Number(x.dataset.avatar)===state.selectedAvatar;
    x.classList.toggle("selected",selected);
    x.setAttribute("aria-pressed",String(selected));
  });
});
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!supabaseClient){msg.textContent="Не загрузился сервис авторизации. Проверь интернет и обнови страницу.";return}if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.textContent="Подожди…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:"https://mexicanohair2.github.io/QQcross/"}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);render()}else{msg.textContent="Аккаунт создан. Проверь почту и подтверди адрес, затем открой «Войти».";authMode="login";btn.disabled=false;btn.textContent="Войти";}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){msg.textContent=e.message||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","Друзья","Магазин","Профиль","Настройки"],icons=["⌂","♧","🛍","◉","⚙"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${AVATARS[state.profile.avatar]||"🐱"}</div><div><b>${esc(state.profile.username)}</b></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
function home(){return `<section class="card hero home-hero"><div class="home-mark">QQ</div><h2>QQcross</h2><p class="muted">Сканворды для игры одному и с друзьями</p><button class="btn primary full" id="play-toggle" aria-expanded="${state.playMenuOpen}">Играть</button>${state.playMenuOpen?`<div class="play-options"><button class="btn full" id="practice">Играть одному</button><button class="btn full" id="createParty">Играть с друзьями</button></div>`:""}</section><h3 class="section-title">Входящие приглашения</h3>${state.invite?`<div class="notice"><b>Приглашение в партию</b><p class="small muted">От игрока ${esc(state.invite.from)} · ${state.invite.size} участника(ов)</p><div class="grid2"><button class="btn primary" id="acceptInvite">Согласиться</button><button class="btn" id="rejectInvite">Отклонить</button></div></div>`:`<div class="notice"><b>Пока нет приглашений</b></div>`}</section>`}
function friends(){return `
  <h2>Друзья</h2>
  <div class="card">
    <label class="small muted" for="friendName">Найти игрока по нику</label>
    <input class="input" id="friendName" maxlength="16" placeholder="Например, Mex">
    <button class="btn primary full" id="searchFriends">Найти игрока</button>
    <div id="friendSearchResults"></div>
  </div>
  <h3 class="section-title">Входящие заявки</h3>
  <div id="incomingFriendRequests"><p class="muted small">Загрузка…</p></div>
  <h3 class="section-title">Отправленные заявки</h3>
  <div id="outgoingFriendRequests"><p class="muted small">Загрузка…</p></div>
  <h3 class="section-title">Мои друзья</h3>
  <div id="friendsList"><p class="muted small">Загрузка…</p></div>
`}

async function searchFriends(){
  const input=$("#friendName"),out=$("#friendSearchResults");
  const q=input?.value.trim()||"";
  if(!out)return;
  if(q.length<2){out.innerHTML='<p class="small muted">Введи хотя бы 2 символа.</p>';return}
  if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){
    out.innerHTML='<p class="small muted">Поиск доступен после входа в аккаунт.</p>';return;
  }
  out.innerHTML='<p class="small muted">Ищем игрока…</p>';
  try{
    const {data,error}=await supabaseClient.rpc("search_qqcross_players_with_status",{search_text:q});
    if(error)throw error;
    if(!data?.length){out.innerHTML='<p class="small muted">Игрок не найден.</p>';return}
    out.innerHTML=data.map(p=>{
      const status=p.relation_status||"none";
      const label=status==="friends"?"Уже друзья":status==="outgoing"?"Заявка отправлена":status==="incoming"?"У него есть заявка — проверь входящие":"Добавить";
      const disabled=status!=="none";
      return '<div class="card row between"><div class="row"><div class="avatar">'+(AVATARS[p.avatar]||"🐱")+'</div><b>'+esc(p.username)+'</b></div><button class="btn '+(disabled?"":"primary")+' send-friend-request" data-username="'+esc(p.username)+'" '+(disabled?"disabled":"")+'>'+label+'</button></div>';
    }).join("");
    out.querySelectorAll(".send-friend-request:not(:disabled)").forEach(b=>b.onclick=async()=>{
      b.disabled=true;b.textContent="Отправка…";
      try{
        const {error}=await supabaseClient.rpc("send_qqcross_friend_request",{target_username:b.dataset.username});
        if(error)throw error;
        b.textContent="Заявка отправлена";toast("Заявка отправлена");
        await searchFriends();await loadSocialData();
      }catch(e){toast(e.message||"Не удалось отправить заявку");b.disabled=false;b.textContent="Добавить"}
    });
  }catch(e){
    console.error("QQcross friend search:",e);
    out.innerHTML='<p class="small muted">Не удалось выполнить поиск. Проверь подключение базы данных.</p>';
  }
}

async function loadSocialData(){
  const incoming=$("#incomingFriendRequests"),list=$("#friendsList"),outgoing=$("#outgoingFriendRequests");
  if(!incoming||!list)return;
  if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){
    incoming.innerHTML='<p class="muted small">Войди в аккаунт, чтобы получать заявки.</p>';
    if(outgoing)outgoing.innerHTML='<p class="muted small">Доступно после входа в аккаунт.</p>';
    list.innerHTML='<p class="muted small">У гостевого профиля нет облачного списка друзей.</p>';return;
  }
  incoming.innerHTML='<p class="muted small">Загружаем…</p>';
  list.innerHTML='<p class="muted small">Загружаем…</p>';
  try{
    const calls=[
      supabaseClient.rpc("list_qqcross_friends"),
      supabaseClient.rpc("list_qqcross_incoming_friend_requests"),
      supabaseClient.rpc("list_qqcross_outgoing_friend_requests")
    ];
    const [fr,ir,orq]=await Promise.all(calls);
    if(fr.error)throw fr.error;
    if(ir.error)throw ir.error;
    if(orq.error)throw orq.error;
    list.innerHTML=fr.data?.length?fr.data.map(p=>'<div class="card row"><div class="avatar">'+(AVATARS[p.avatar]||"🏳️")+'</div><b>'+esc(p.username)+'</b></div>').join(""):'<p class="muted small">Пока нет друзей.</p>';
    incoming.innerHTML=ir.data?.length?ir.data.map(p=>'<div class="card"><div class="row"><div class="avatar">'+(AVATARS[p.avatar]||"🏳️")+'</div><b>'+esc(p.username)+' хочет добавить тебя в друзья</b></div><div class="grid2"><button class="btn primary respond-friend" data-id="'+esc(p.request_id)+'" data-accept="true">Принять</button><button class="btn respond-friend" data-id="'+esc(p.request_id)+'" data-accept="false">Отклонить</button></div></div>').join(""):'<p class="muted small">Новых заявок нет.</p>';
    if(outgoing)outgoing.innerHTML=orq.data?.length?orq.data.map(p=>'<div class="card row"><div class="avatar">'+(AVATARS[p.avatar]||"🏳️")+'</div><div class="grow"><b>'+esc(p.username)+'</b><div class="small muted">Ожидает ответа</div></div><span class="pill">Отправлено</span></div>').join(""):'<p class="muted small">Нет ожидающих заявок.</p>';
    incoming.querySelectorAll(".respond-friend").forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try{
        const {error}=await supabaseClient.rpc("respond_qqcross_friend_request",{request_id:b.dataset.id,accept_request:b.dataset.accept==="true"});
        if(error)throw error;
        toast(b.dataset.accept==="true"?"Теперь вы друзья":"Заявка отклонена");
        await loadSocialData();
      }catch(e){toast(e.message||"Не удалось обработать заявку");b.disabled=false}
    });
  }catch(e){
    console.error("QQcross social data:",e);
    incoming.innerHTML='<p class="muted small">Не удалось загрузить заявки. Проверь, применены ли миграции Supabase.</p>';
    if(outgoing)outgoing.innerHTML="";
    list.innerHTML="";
  }
}

async function watchSocialUpdates(){
  if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")||socialChannel)return;
  socialChannel=supabaseClient.channel("qqcross-social-"+state.profile.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"friend_requests",filter:"receiver_id=eq."+state.profile.id},()=>{
      if(state.tab==="Друзья")loadSocialData();else toast("У тебя новая заявка в друзья");
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"friend_requests",filter:"sender_id=eq."+state.profile.id},()=>{
      if(state.tab==="Друзья")loadSocialData();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"friendships",filter:"user_id=eq."+state.profile.id},()=>{
      if(state.tab==="Друзья")loadSocialData();
    })
    .subscribe((status)=>{
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("QQcross social realtime:",status);
    });
}
function shop(){const products=[["magnifier","🔎","Лупы","Проверка и подсказка"],["clock","⏱","Часы","Добавить 20 секунд"],["trash","🗑️","Мусорки","Заменить набор букв"]];return `<h2>Магазин</h2>${products.map(([key,ico,name,desc])=>`<div class="card"><div class="row"><div class="avatar">${ico}</div><div class="grow"><b>${name}</b><div class="small">В наличии: ${state.profile.items[key]}</div></div></div><div class="grid2 shop-buy"><button class="btn buy" data-item="${key}" data-qty="5">5 шт. · 100 🪙</button><button class="btn primary buy" data-item="${key}" data-qty="10">10 шт. · 200 🪙</button></div></div>`).join("")}`}
function profile(){return `<h2>Профиль</h2><div class="card row"><div class="avatar big">${AVATARS[state.profile.avatar]}</div><div><h3>${esc(state.profile.username)}</h3><span class="muted small">Игрок QQcross</span></div></div><div class="grid2"><div class="card"><b>${state.profile.wins}</b><div class="muted small">Победы</div></div><div class="card"><b>${state.profile.games}</b><div class="muted small">Матчи</div></div><div class="card"><b>${state.profile.points}</b><div class="muted small">Очки</div></div><div class="card"><b>${state.profile.coins}</b><div class="muted small">Монеты</div></div></div><div class="card"><b>Мои предметы</b><p class="small">🔎 Лупы: ${state.profile.items.magnifier}　⏱ Часы: ${state.profile.items.clock}　🗑️ Мусорки: ${state.profile.items.trash}</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button>`}
function settings(){
  const themes=[["burgundy","Бордовый","Насыщенный глубокий бордо"],["black","Тёмно-серый","Спокойный графитовый"],["blue","Синий","Глубокий синий"],["green","Зелёный","Тёмный зелёный"],["white","Белый","Светлая нейтральная тема"]];
  return `<h2>Настройки</h2>
    <section class="card settings-card">
      <span class="pill">Персонализация</span>
      <h3>Цвет интерфейса</h3>
      
      <div class="theme-list">${themes.map(([key,name,desc])=>`<button class="theme-choice ${activeTheme===key?"selected":""}" data-theme-choice="${key}" aria-pressed="${activeTheme===key}">
        <span class="theme-swatch theme-swatch-${key}"></span>
        <span class="theme-copy"><b>${name}</b></span>
        <span class="theme-check">${activeTheme===key?"✓":""}</span>
      </button>`).join("")}</div>
    </section>
    `;
}
function wireContent(){const toggle=$("#play-toggle");if(toggle)toggle.onclick=()=>{state.playMenuOpen=!state.playMenuOpen;render()};const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const sf=$("#searchFriends");if(sf)sf.onclick=searchFriends;const fi=$("#friendName");if(fi)fi.addEventListener("keydown",e=>{if(e.key==="Enter")searchFriends()});if($("#friendsList"))loadSocialData();document.querySelectorAll(".buy").forEach(b=>b.onclick=()=>{const qty=+b.dataset.qty,cost=qty===5?100:200;if(state.profile.coins<cost){toast("Не хватает монет");return}state.profile.coins-=cost;state.profile.items[b.dataset.item]+=qty;save();render();toast(`Куплено: ${qty} шт.`)});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();if(supabaseClient&&socialChannel){await supabaseClient.removeChannel(socialChannel);socialChannel=null}localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Оформление изменено")})}
function renderLobby(root){
  root.innerHTML=`<div class="screen">
    <div class="top"><button class="btn" id="back">← Назад</button><div class="coins">🪙 ${state.profile.coins}</div></div>
    <h2>Новая партия</h2>
    <div class="card">
      <b>Сколько игроков будет в партии?</b>
      <div class="party-options">${[2,3,4].map(n=>`<button class="party-option ${state.partySize===n?"selected":""}" data-size="${n}">${n}</button>`).join("")}</div>
      <p class="small muted">Настоящие приглашения и общее лобби подключаются через Supabase. Демонстрационные приглашения отключены, чтобы не показывать фальшивые заявки.</p>
    </div>
  </div>`;
  $("#back").onclick=()=>{state.screen="";render()};
  root.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{state.partySize=+b.dataset.size;renderLobby(root)});
}
function begin(size=1){try{if(!loadPuzzle())return}catch(error){console.error("QQcross puzzle generation:",error);toast(error&&error.message?error.message:"Не удалось создать кроссворд. Попробуй ещё раз.");return}state.screen="game";state.partySize=size;state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;state.completed=new Set();state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=60;state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));state.letters=state.playerRacks[0];state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";state.pendingMoves=[];render()}
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
function pictureUrl(emoji){
  const code=Array.from(emoji).map(ch=>ch.codePointAt(0).toString(16)).filter(x=>x!=="fe0f"&&x!=="fe0e").join("-");
  return "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/"+code+".png";
}
function renderGame(root){
  clearInterval(state.interval);
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill&&state.rackNeedsRefill[state.turn]){refillRack(state.turn);state.rackNeedsRefill[state.turn]=false;}
  state.letters=state.playerRacks[state.turn]||[];
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);

  const boardH=12,boardW=8;
  const rows=[];
  for(let y=0;y<boardH;y++){
    for(let x=0;x<boardW;x++){
      rows.push('<div class="scan-cell scan-grid-cell" aria-hidden="true"></div>');
    }
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?'Ты':'Игрок '+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+n+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><button class="btn" id="exit">← Выйти</button><button class="btn" id="refresh-page" type="button">↻ Обновить</button></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+rows.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div>'+
    '<p class="game-hint">Перетащи буквы в пустые клетки. ✓ проверяет расстановку и передаёт ход.</p></div></div>';
  // Старые панели со списком вопросов больше не используются.
  root.querySelectorAll(".questions,.clue-panel,.clue-list-readable,.clue-heading,.clue-title,.clue-row").forEach(el=>el.remove());
  // Подсказки сканворда отображаются прямо в клетках; отдельные всплывающие вопросы не нужны.
  root.querySelectorAll("[data-cell]").forEach(cell=>cell.addEventListener("click",()=>{if(!state.loupeActive)return;const k=cell.dataset.cell;if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k))return;if(!useItem("magnifier")){state.loupeActive=false;return}state.hints[k]=expected[k];state.loupeActive=false;renderGame(root);toast("Буква подсвечена. Поставь её настоящей буквой позже.");}));
  let dragIndex=-1,dragPointer=-1,dragButton=null,dragGhost=null,hoverCell=null,hoverClue=null,dragFromCell=null;
  const clearDrag=()=>{
    if(dragButton)dragButton.classList.remove("dragging");
    if(hoverCell)hoverCell.classList.remove("drop-hover");
    if(hoverClue)hoverClue.classList.remove("drop-clue-hover");
    dragIndex=-1;dragPointer=-1;dragButton=null;hoverCell=null;hoverClue=null;dragFromCell=null;
    document.removeEventListener("pointermove",onMove);
    document.removeEventListener("pointerup",onUp);
    document.removeEventListener("pointercancel",onCancel);
  };
  const moveGhost=(x,y)=>{
    if(!dragGhost)return;
    const w=dragGhost.offsetWidth,h=dragGhost.offsetHeight;
    dragGhost.style.transform="translate3d("+(x-w/2)+"px,"+(y-h/2)+"px,0) scale(1.12)";
    const under=document.elementsFromPoint(x,y);
    const clue=under.map(el=>el.closest&&el.closest("[data-show-clue]")).find(Boolean);
    const cell=clue?null:under.map(el=>el.closest&&el.closest("[data-cell]")).find(el=>el&&expected[el.dataset.cell]!==undefined);
    if(hoverClue!==clue){if(hoverClue)hoverClue.classList.remove("drop-clue-hover");hoverClue=clue;if(hoverClue)hoverClue.classList.add("drop-clue-hover")}
    if(hoverCell!==cell){if(hoverCell)hoverCell.classList.remove("drop-hover");hoverCell=cell;if(hoverCell)hoverCell.classList.add("drop-hover")}
  };
  const onMove=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    moveGhost(e.clientX,e.clientY);e.preventDefault();
  };
  const onUp=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    const under=document.elementsFromPoint(e.clientX,e.clientY);
    const cell=under.map(el=>el.closest&&el.closest("[data-cell]")).find(el=>el&&expected[el.dataset.cell]!==undefined);
    const index=dragIndex,ghost=dragGhost,fromCell=dragFromCell;
    const valid=cell&&!state.filled[cell.dataset.cell]&&(!state.pendingMoves.some(m=>m.k===cell.dataset.cell)||cell.dataset.cell===fromCell);
    clearDrag();dragGhost=null;
    if(ghost&&valid&&fromCell&&cell.dataset.cell!==fromCell){
      const move=state.pendingMoves.find(m=>m.k===fromCell);
      if(move&&!state.pendingMoves.some(m=>m.k===cell.dataset.cell)){
        move.k=cell.dataset.cell;ghost.remove();renderGame(root);
      }else ghost.remove();
    }else if(ghost&&valid&&!fromCell){
      const r=cell.getBoundingClientRect();
      ghost.style.transition="transform 180ms cubic-bezier(.2,.8,.2,1),opacity 180ms";
      ghost.style.transform="translate3d("+r.left+"px,"+r.top+"px,0) scale(.72)";
      ghost.style.opacity=".25";
      setTimeout(()=>{ghost.remove();placeAtCell(cell.dataset.cell,index,root)},185);
    }else if(ghost){
      ghost.style.transition="opacity 120ms";ghost.style.opacity="0";setTimeout(()=>ghost.remove(),125);
    }
    e.preventDefault();
  };
  const onCancel=e=>{
    if(dragIndex<0||e.pointerId!==dragPointer)return;
    const ghost=dragGhost;clearDrag();dragGhost=null;
    if(ghost){ghost.style.transition="opacity 120ms";ghost.style.opacity="0";setTimeout(()=>ghost.remove(),125)}
  };
  root.querySelectorAll("[data-letter]").forEach(b=>{
    b.addEventListener("pointerdown",e=>{
      if(dragIndex!==-1)return;
      dragIndex=Number(b.dataset.letter);dragPointer=e.pointerId;dragButton=b;
      const r=b.getBoundingClientRect();
      dragGhost=b.cloneNode(true);dragGhost.classList.add("drag-ghost");
      Object.assign(dragGhost.style,{position:"fixed",left:"0",top:"0",width:r.width+"px",height:r.height+"px",margin:"0",zIndex:"99999",pointerEvents:"none",transition:"none",opacity:"1",transform:"translate3d("+r.left+"px,"+r.top+"px,0) scale(1.05)"});
      document.body.appendChild(dragGhost);b.classList.add("dragging");
      moveGhost(e.clientX,e.clientY);
      document.addEventListener("pointermove",onMove,{passive:false});
      document.addEventListener("pointerup",onUp);
      document.addEventListener("pointercancel",onCancel);
      e.preventDefault();
    });
  });

  root.querySelectorAll("[data-cell].pending-cell").forEach(cell=>{
    cell.addEventListener("pointerdown",e=>{
      if(dragIndex!==-1)return;
      const move=state.pendingMoves.find(m=>m.k===cell.dataset.cell);
      if(!move)return;
      dragIndex=0;dragPointer=e.pointerId;dragButton=cell;dragFromCell=cell.dataset.cell;
      const r=cell.getBoundingClientRect();
      dragGhost=document.createElement("div");dragGhost.className="letter drag-ghost";dragGhost.textContent=move.l;
      Object.assign(dragGhost.style,{position:"fixed",left:"0",top:"0",width:r.width+"px",height:r.height+"px",margin:"0",zIndex:"99999",pointerEvents:"none",transition:"none",opacity:"1",transform:"translate3d("+r.left+"px,"+r.top+"px,0) scale(1.05)"});
      document.body.appendChild(dragGhost);cell.classList.add("dragging");
      moveGhost(e.clientX,e.clientY);
      document.addEventListener("pointermove",onMove,{passive:false});
      document.addEventListener("pointerup",onUp);
      document.addEventListener("pointercancel",onCancel);
      e.preventDefault();
    });
  });
  $("#refresh-page").onclick=()=>window.location.reload();
  $("#exit").onclick=()=>{if(state.pendingMoves.length&&!confirm("Незавершённые буквы этого хода будут потеряны. Выйти?"))return;state.pendingMoves=[];state.screen="";render()};
  $("#endturn").onclick=()=>finishTurn(root);
  $("#magnifier").onclick=()=>{if(state.profile.items.magnifier<=0){toast("Лупы закончились — загляни в магазин");return}state.loupeActive=true;toast("Лупа активна: нажми на пустую клетку");};
  $("#clock").onclick=()=>{if(!useItem("clock"))return;state.seconds+=20;renderGame(root)};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);renderGame(root)};
  $("#magnifier").onclick=()=>{if(!useItem("magnifier"))return;const w=puzzle.words[0],next=w.cells.find(c=>!state.filled[c.join(",")]&&!state.pendingMoves.some(m=>m.k===c.join(",")));if(!next){toast("В этом слове больше нет пустых клеток");return}const k=next.join(","),needed=expected[k],ix=state.letters.indexOf(needed);if(ix>=0){state.letters.splice(ix,1);state.pendingMoves.push({k,l:needed});state.playerRacks[state.turn]=state.letters}renderGame(root);toast("Подсказка добавлена")};
  state.interval=setInterval(()=>{state.seconds--;const t=$("#timer");if(t)t.textContent="⏱ "+state.seconds;if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},1000);
}
function placeAtCell(k,letterIndex,root){
  if(state.loupeActive){if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k))return;if(!useItem("magnifier")){state.loupeActive=false;return}state.hints[k]=expected[k];state.loupeActive=false;renderGame(root);toast("Буква подсвечена. Поставь её настоящей буквой позже.");return}
  if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k)){toast("Клетка уже занята");return}
  const letter=state.letters[letterIndex];if(!letter)return;
  state.pendingMoves.push({k,l:letter});delete state.feedback[k];state.letters.splice(letterIndex,1);state.playerRacks[state.turn]=state.letters;renderGame(root);
}
function finishTurn(root,timeout=false){
  const moves=state.pendingMoves||[];let correct=0,incorrect=0;
  moves.forEach(m=>{if(state.filled[m.k]){state.letters.push(m.l);return}
    if(m.l===expected[m.k]){state.filled[m.k]=m.l;state.owners[m.k]=state.turn;state.feedback[m.k]="correct";delete state.hints[m.k];state.playerScores[state.turn]++;state.scores++;correct++}
    else{state.feedback[m.k]="wrong";state.letters.push(m.l);incorrect++}
  });
  state.pendingMoves=[];state.playerRacks[state.turn]=state.letters;if(correct)checkWords();
  if(state.screen!=="game"){render();return}
  if(!state.rackNeedsRefill)state.rackNeedsRefill=Array(state.partySize).fill(false);
  state.rackNeedsRefill[state.turn]=true;
  if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;if(state.turn===0)state.round=(state.round||1)+1;}
  else state.round=(state.round||1)+1;
  state.seconds=60;state.selectedLetter=-1;state.letters=state.playerRacks[state.turn];renderGame(root);

}
function refillRack(player){const rack=state.playerRacks[player]||(state.playerRacks[player]=[]);while(rack.length<7&&letterBag.length)rack.push(...drawLetters(Math.min(7-rack.length,letterBag.length)));}
function useItem(key){if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}state.profile.items[key]--;save();return true}
function place(k,root){
  if(state.selectedLetter<0){toast("Сначала выбери букву");return}
  if(expected[k]===undefined)return;
  if(state.filled[k]){toast("Клетка уже занята");return}
  const l=state.letters[state.selectedLetter];
  if(expected[k]===l){
    state.filled[k]=l;state.owners[k]=state.turn;
    state.letters.splice(state.selectedLetter,1);
    if(letterBag.length)state.letters.push(drawLetters(1)[0]);
    state.playerRacks[state.turn]=state.letters;
    state.selectedLetter=-1;state.selectedCell=null;state.wrong=null;
    state.playerScores[state.turn]++;state.scores++;state.playerRacks[state.turn]=state.letters;
    checkWords();renderGame(root);
  }else{
    state.wrong=k;renderGame(root);
    setTimeout(()=>{state.wrong=null;const el=document.querySelector('[data-cell="'+k+'"]');if(el)el.classList.remove("wrong")},500);
  }
}
function checkWords(){
  puzzle.words.forEach(w=>{
    if(!state.completed.has(w.id)&&w.cells.every(c=>state.filled[c.join(",")]===expected[c.join(",")])){
      state.completed.add(w.id);state.playerScores[state.turn]+=5;state.scores+=5;toast("Слово собрано! +5");
    }
  });
  if(state.completed.size===puzzle.words.length){
    state.profile.games++;state.profile.points+=state.scores;state.profile.coins+=Math.max(10,state.scores);save();state.screen="";
    setTimeout(()=>{render();toast("Партия завершена!")},500);
  }
}
async function loadCloudProfile(userId){const {data,error}=await supabaseClient.from("profiles").select("id,username,avatar,wins,games,points").eq("id",userId).single();if(error)throw error;let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch{}const same=saved&&saved.id===data.id;state.profile={id:data.id,username:data.username,avatar:data.avatar||0,coins:same?(saved.coins||0):0,wins:data.wins||0,games:data.games||0,points:data.points||0,items:same&&saved.items?{...defaultItems(),...saved.items}:defaultItems(),friends:same&&Array.isArray(saved.friends)?saved.friends:[]};save();watchSocialUpdates();}

/* Поле остаётся пустым до загрузки пользовательского словаря. */
function makeRandomPuzzle(){
  puzzle={id:"scanword-grid-"+Date.now(),title:"Пустая сетка",w:8,h:12,words:[]};
  Object.keys(expected).forEach(k=>delete expected[k]);
  letterBag=[];
  return true;
}
function loadPuzzle(){return makeRandomPuzzle()}
function renderGame(root){
  clearInterval(state.interval);
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill&&state.rackNeedsRefill[state.turn]){
    refillRack(state.turn);state.rackNeedsRefill[state.turn]=false;
  }
  state.letters=state.playerRacks[state.turn]||[];
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map(puzzle.words.map(w=>[w.cells[0][0]+",0",w]));
  const cells=[];
  for(let y=0;y<puzzle.h;y++){
    for(let x=0;x<puzzle.w;x++){
      const key=y+","+x;
      if(x===0&&clueAt.has(key)){
        const w=clueAt.get(key);
        cells.push('<div class="scan-cell scan-grid-cell scan-clue" aria-label="'+esc(w.clue)+'"><span class="scan-arrow">➜</span><span class="scan-clue-text">'+esc(w.clue)+'</span></div>');
      }else if(expected[key]!==undefined){
        const value=state.filled[key]||pending[key]||"";
        const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(state.feedback[key]==="wrong"?" wrong":"");
        cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква '+(x)+' в слове '+(y+1)+'">'+(value?'<span class="cell-letter">'+esc(value)+'</span>':'')+'</button>');
      }else{
        cells.push('<div class="scan-cell scan-grid-cell scan-empty" aria-hidden="true"></div>');
      }
    }
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?"Ты":"Игрок "+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><button class="btn" id="exit">← Выйти</button></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+cells.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+'" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div></div></div>';
  root.querySelectorAll("[data-letter]").forEach(b=>b.onclick=()=>{
    state.selectedLetter=Number(b.dataset.letter);
    root.querySelectorAll("[data-letter]").forEach(x=>x.classList.toggle("selected",x===b));
  });
  root.querySelectorAll("[data-cell]").forEach(cell=>{
    cell.onclick=()=>{
      const key=cell.dataset.cell;
      const pendingMove=state.pendingMoves.find(m=>m.k===key);
      if(pendingMove){
        const ix=state.pendingMoves.indexOf(pendingMove);
        state.letters.push(pendingMove.l);state.pendingMoves.splice(ix,1);
        state.playerRacks[state.turn]=state.letters;state.selectedLetter=-1;renderGame(root);return;
      }
      if(state.selectedLetter<0){toast("Сначала выбери букву снизу");return}
      const chosen=state.selectedLetter;state.selectedLetter=-1;placeAtCell(key,chosen,root);
    };
  });
  $("#exit").onclick=()=>{
    if(state.pendingMoves.length&&!confirm("Незавершённые буквы этого хода будут потеряны. Выйти?"))return;
    state.pendingMoves=[];state.screen="";render();
  };
  $("#endturn").onclick=()=>finishTurn(root);
  $("#magnifier").onclick=()=>{
    if(!useItem("magnifier"))return;
    const word=puzzle.words.find(w=>w.cells.some(c=>!state.filled[c.join(",")]));
    const cell=word&&word.cells.find(c=>!state.filled[c.join(",")]&&!state.pendingMoves.some(m=>m.k===c.join(",")));
    if(!cell){toast("Нет пустых клеток для подсказки");return}
    const key=cell.join(","),needed=expected[key],ix=state.letters.indexOf(needed);
    if(ix<0){toast("Нужная буква сейчас не выпала. Попробуй позже");return}
    state.letters.splice(ix,1);state.pendingMoves.push({k:key,l:needed});state.playerRacks[state.turn]=state.letters;renderGame(root);
  };
  $("#clock").onclick=()=>{if(useItem("clock")){state.seconds+=20;renderGame(root)}};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);renderGame(root)};
  state.interval=setInterval(()=>{
    state.seconds--;const timer=$("#timer");if(timer)timer.textContent="⏱ "+state.seconds;
    if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}
  },1000);
}

async function initAuth(){
  if(!supabaseClient){render();return}
  let timedOut=false,timer;
  const authTask=(async()=>{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;
    if(data.session)await loadCloudProfile(data.session.user.id);
  })();
  authTask.catch(e=>console.error("QQcross auth:",e));
  try{
    await Promise.race([
      authTask,
      new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new Error("Авторизация не ответила за 6 секунд"))},6000)})
    ]);
  }catch(e){
    console.error("QQcross auth:",e);
    if(timedOut)toast("Сервис аккаунта отвечает слишком долго. Можно продолжить как гость.");
    else toast("Не удалось загрузить аккаунт. Попробуй войти ещё раз.");
  }finally{
    clearTimeout(timer);
    render();
  }
  if(timedOut)authTask.then(()=>render()).catch(()=>{});
}

/* ===== Scanword engine v1: dictionary-driven layout ===== */
function getScanwordDictionary(){
  if(Array.isArray(window.QQCROSS_DICTIONARY)&&window.QQCROSS_DICTIONARY.length)return window.QQCROSS_DICTIONARY;
  try{
    const saved=JSON.parse(localStorage.getItem("qqcross_dictionary_v1")||"[]");
    return Array.isArray(saved)?saved:[];
  }catch{return []}
}
function normalizeScanwordEntry(item){
  if(!item||typeof item!=="object")return null;
  const answer=String(item.answer||item.word||"").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
  const clue=String(item.emoji||item.flag||item.clue||item.question||"").trim();
  if(answer.length<2||answer.length>12||!clue)return null;
  return {answer,clue,emoji:/\p{Extended_Pictographic}/u.test(clue)};
}
function buildScanword(entries){
  const W=8,H=12,grid=Array.from({length:H},()=>Array(W).fill(null)),placed=[],clueOccupied=new Set();
  const candidates=entries.map(normalizeScanwordEntry).filter(Boolean);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
  function tryPlace(entry,x,y,dir,first=false){
    const dx=dir==="across"?1:0,dy=dir==="down"?1:0;
    const ex=x+dx*(entry.answer.length-1),ey=y+dy*(entry.answer.length-1);
    const cx=x-dx,cy=y-dy;
    if(x<0||y<0||ex>=W||ey>=H||cx<0||cy<0)return false;
    if(grid[cy][cx]!==null||clueOccupied.has(cy+","+cx))return false;
    let crossings=0;
    for(let k=0;k<entry.answer.length;k++){
      const px=x+dx*k,py=y+dy*k,old=grid[py][px],letter=entry.answer[k];
      if(clueOccupied.has(py+","+px))return false;
      if(old!==null&&old!==letter)return false;
      if(old===letter)crossings++;
      const before=dir==="across"?grid[py-1]?.[px]:grid[py]?.[px-1];
      const after=dir==="across"?grid[py+1]?.[px]:grid[py]?.[px+1];
      if(old===null&&(before!==null&&before!==undefined||after!==null&&after!==undefined))return false;
    }
    if(!first&&!crossings)return false;
    for(let k=0;k<entry.answer.length;k++)grid[y+dy*k][x+dx*k]=entry.answer[k];
    clueOccupied.add(cy+","+cx);
    placed.push({id:"w"+placed.length,answer:entry.answer,clue:entry.clue,isEmoji:entry.emoji,dir,cells:Array.from({length:entry.answer.length},(_,k)=>[y+dy*k,x+dx*k]),clueCell:[cy,cx],arrow:dir==="across"?"➡️":"⬇️"});
    return true;
  }
  if(!candidates.length)return null;
  const firstIndex=candidates.findIndex(e=>e.answer.length<=7);
  if(firstIndex<0)return null;
  const first=candidates.splice(firstIndex,1)[0];
  if(!tryPlace(first,1,Math.max(0,Math.floor((H-first.answer.length)/2)), "across",true))return null;
  for(const entry of candidates){
    let options=[];
    for(const word of placed)for(let a=0;a<word.answer.length;a++)for(let b=0;b<entry.answer.length;b++){
      if(word.answer[a]!==entry.answer[b])continue;
      const [wy,wx]=word.cells[a];
      const dir=word.dir==="across"?"down":"across";
      const x=dir==="across"?wx-b:wx,y=dir==="down"?wy-b:wy;
      options.push({x,y,dir});
    }
    for(let n=options.length-1;n>0;n--){const j=Math.floor(Math.random()*(n+1));[options[n],options[j]]=[options[j],options[n]]}
    let done=false;
    for(const o of options){if(tryPlace(entry,o.x,o.y,o.dir)){done=true;break}}
    if(!done)continue;
  }
  if(placed.length<1)return null;
  const used=new Set();placed.forEach(w=>w.cells.forEach(c=>used.add(c.join(","))));
  const clueKeys=new Set(placed.map(w=>w.clueCell.join(",")));
  return {id:"scanword-"+Date.now(),title:"Сканворд",w:W,h:H,words:placed,used,clueKeys};
}
function makeRandomPuzzle(){
  Object.keys(expected).forEach(k=>delete expected[k]);
  const built=buildScanword(getScanwordDictionary());
  if(!built){puzzle=null;letterBag=[];return false}
  puzzle=built;
  puzzle.words.forEach(w=>w.cells.forEach((c,i)=>expected[c.join(",")]=w.answer[i]));
  letterBag=puzzle.words.flatMap(w=>w.answer.split(""));
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]]}
  return true;
}
function loadPuzzle(){return makeRandomPuzzle()}
function begin(size=1){
  if(!loadPuzzle()){toast("Не удалось собрать сканворд. Попробуй ещё раз.");return}
  state.screen="game";state.partySize=size;state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;
  state.completed=new Set();state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=60;
  state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));
  state.letters=state.playerRacks[0];state.selectedLetter=-1;state.selectedCell=null;state.pendingMoves=[];render();
}
function renderGame(root){
  clearInterval(state.interval);
  if(!puzzle||!puzzle.words.length){state.screen="";render();toast("Не удалось собрать сканворд.");return}
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill?.[state.turn]){refillRack(state.turn);state.rackNeedsRefill[state.turn]=false}
  state.letters=state.playerRacks[state.turn]||[];
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map(puzzle.words.map(w=>[w.clueCell.join(","),w]));
  const cells=[];
  for(let y=0;y<puzzle.h;y++)for(let x=0;x<puzzle.w;x++){
    const key=y+","+x,word=clueAt.get(key);
    if(word){
      const clue=word.clue;
      cells.push('<div class="scan-cell scan-grid-cell scan-clue '+(word.isEmoji?'scan-clue-emoji':'')+'" title="'+esc(clue)+'"><span class="scan-arrow">'+word.arrow+'</span><span class="scan-clue-text">'+esc(clue)+'</span></div>');
    }else if(expected[key]!==undefined){
      const value=state.filled[key]||pending[key]||"";
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(state.feedback[key]==="wrong"?" wrong":"");
      cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в слове">'+(value?'<span class="cell-letter">'+esc(value)+'</span>':'')+'</button>');
    }else cells.push('<div class="scan-cell scan-grid-cell scan-empty" aria-hidden="true"></div>');
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?"Ты":"Игрок "+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><button class="btn" id="exit">← Выйти</button></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+cells.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+'" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div></div></div>';
  root.querySelectorAll("[data-letter]").forEach(b=>b.onclick=()=>{state.selectedLetter=Number(b.dataset.letter);root.querySelectorAll("[data-letter]").forEach(x=>x.classList.toggle("selected",x===b))});
  root.querySelectorAll("[data-cell]").forEach(cell=>cell.onclick=()=>{
    const key=cell.dataset.cell,existing=state.pendingMoves.find(m=>m.k===key);
    if(existing){state.letters.push(existing.l);state.pendingMoves.splice(state.pendingMoves.indexOf(existing),1);state.playerRacks[state.turn]=state.letters;state.selectedLetter=-1;renderGame(root);return}
    if(state.selectedLetter<0){toast("Сначала выбери букву снизу");return}
    const index=state.selectedLetter;state.selectedLetter=-1;placeAtCell(key,index,root);
  });
  $("#exit").onclick=()=>{if(state.pendingMoves.length&&!confirm("Незавершённые буквы этого хода будут потеряны. Выйти?"))return;state.pendingMoves=[];state.screen="";render()};
  $("#endturn").onclick=()=>finishTurn(root);
  $("#magnifier").onclick=()=>{
    if(!useItem("magnifier"))return;
    const word=puzzle.words.find(w=>w.cells.some(c=>!state.filled[c.join(",")]));
    const cell=word&&word.cells.find(c=>!state.filled[c.join(",")]&&!state.pendingMoves.some(m=>m.k===c.join(",")));
    if(!cell){toast("Нет пустых клеток для подсказки");return}
    const key=cell.join(","),needed=expected[key],ix=state.letters.indexOf(needed);
    if(ix<0){toast("Нужная буква сейчас не выпала. Попробуй позже");return}
    state.letters.splice(ix,1);state.pendingMoves.push({k:key,l:needed});state.playerRacks[state.turn]=state.letters;renderGame(root);
  };
  $("#clock").onclick=()=>{if(useItem("clock")){state.seconds+=20;renderGame(root)}};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);renderGame(root)};
  state.interval=setInterval(()=>{state.seconds--;const timer=$("#timer");if(timer)timer.textContent="⏱ "+state.seconds;if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},1000);
}

async function preloadScanwordDictionary(){
  try{
    const response=await fetch("./data/scanword-dictionary.json",{cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const data=await response.json();
    if(!Array.isArray(data))throw new Error("Словарь должен быть массивом");
    if(data.length)window.QQCROSS_DICTIONARY=data;
  }catch(error){console.warn("QQcross dictionary:",error)}
}

if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister())).catch(()=>{});
applyTheme(activeTheme);
preloadScanwordDictionary().finally(()=>initAuth());
