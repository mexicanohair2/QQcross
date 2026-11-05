
/* Fit all scanword cells to the available board area while preserving square geometry. */
function enforceSquareScanword(){document.querySelectorAll(".game-screen .scanword-board").forEach(board=>{
 const set=(p,v)=>board.style.setProperty(p,v,"important");
 set("display","grid");set("grid-template-columns","repeat(12,minmax(0,1fr))");set("grid-template-rows","repeat(12,minmax(0,1fr))");set("width","min(100%, calc(100dvh - 22dvh))");set("height","auto");set("aspect-ratio","1 / 1");set("min-width","0");set("min-height","0");set("max-width","100%");set("max-height","100%");set("gap","2px");set("transform","none");
 const wrap=board.parentElement;wrap.style.setProperty("overflow","hidden","important");wrap.style.setProperty("touch-action","pan-y","important");
 board.querySelectorAll(":scope > .scan-cell").forEach(cell=>{["width","height","min-width","min-height","max-width","max-height"].forEach(p=>cell.style.setProperty(p,"auto","important"));cell.style.setProperty("flex","none","important");cell.style.setProperty("aspect-ratio","1 / 1","important");cell.style.setProperty("box-sizing","border-box","important");cell.style.setProperty("margin","0","important");});
});}
const squareScanwordObserver=new MutationObserver(()=>enforceSquareScanword());squareScanwordObserver.observe(document.documentElement,{childList:true,subtree:true});

const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const THEME_KEY="qqcross_theme_v1";
const MATCHES_KEY="qqcross_local_matches_v1";
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
const AUTH_REDIRECT_URL="https://mexicanohair2.github.io/QQcross/";
const supabaseClient=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:"implicit"}}):null;
let authMode="signup";
let authNotice="";
let authRecoveryMode=false;
let socialChannel=null;
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null,playMenuOpen:false};
let puzzle=null;
const expected={};
let letterBag=[];
let draggingLetter=false;
let suppressCellClick=false;


function makeRandomPuzzle(){
  Object.keys(expected).forEach(k=>delete expected[k]);
  const entries=getScanwordDictionary();
  const built=buildScanword(entries);
  if(!built){puzzle=null;letterBag=[];return false}
  puzzle=built;
  puzzle.words.forEach(word=>word.cells.forEach((cell,i)=>{expected[cell.join(",")]=word.answer[i]}));
  letterBag=Object.values(expected);
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]]}
  return true;
}
function loadPuzzle(){return makeRandomPuzzle()}

function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(state.profile&&authRecoveryMode){renderRecovery(root);return}if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}renderShell(root)}
function renderRegister(root){root.innerHTML=`<div class="screen"><div class="splash register-splash"><div class="logo">QQ</div></div><div class="card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button type="button" class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}" aria-label="${NAMES[i]}" aria-pressed="${i===state.selectedAvatar}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><button class="btn full" type="button" id="guestPlay">Играть без регистрации</button><p class="small muted" id="authMessage">${esc(authNotice)}</p>${authMode==="login"?'<button class="btn full" type="button" id="resendConfirm">Отправить письмо подтверждения повторно</button><button class="btn full" type="button" id="forgotPassword">Забыли пароль?</button>':""}</div></div>`;
$("#showSignup").onclick=()=>{authMode="signup";renderRegister(root)};$("#showLogin").onclick=()=>{authMode="login";renderRegister(root)};$("#guestPlay").onclick=()=>{const username="Игрок"+String(Date.now()).slice(-4);state.profile={id:"local-"+Date.now(),username,avatar:state.selectedAvatar,coins:0,wins:0,games:0,points:0,items:defaultItems(),friends:[]};save();render();toast("Ты вошёл в гостевом режиме")};
root.querySelectorAll("[data-avatar]").forEach(b=>b.onclick=()=>{
  state.selectedAvatar=Number(b.dataset.avatar);
  root.querySelectorAll("[data-avatar]").forEach(x=>{
    const selected=Number(x.dataset.avatar)===state.selectedAvatar;
    x.classList.toggle("selected",selected);
    x.setAttribute("aria-pressed",String(selected));
  });
});
const forgotButton=$("#forgotPassword");if(forgotButton)forgotButton.onclick=async()=>{
  const email=$("#email").value.trim(),msg=$("#authMessage");
  if(!email){msg.textContent="Сначала введи электронную почту.";return}
  forgotButton.disabled=true;
  try{
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:AUTH_REDIRECT_URL});
    if(error)throw error;
    msg.textContent="Письмо для восстановления отправлено. Проверь входящие и папку «Спам».";
  }catch(error){msg.textContent=error.message||"Не удалось отправить письмо."}
  finally{forgotButton.disabled=false}
};
const resendButton=$("#resendConfirm");if(resendButton)resendButton.onclick=async()=>{const email=$("#email").value.trim(),msg=$("#authMessage");if(!email){msg.textContent="Сначала введи электронную почту.";return}resendButton.disabled=true;try{const {error}=await supabaseClient.auth.resend({type:"signup",email,options:{emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;msg.textContent="Письмо отправлено повторно. Проверь входящие и папку «Спам»."}catch(e){msg.textContent=e.message||"Не удалось отправить письмо."}finally{resendButton.disabled=false}};
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!supabaseClient){msg.textContent="Не загрузился сервис авторизации. Проверь интернет и обнови страницу.";return}if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.textContent="Подожди…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);authNotice="";render()}else{authNotice="Аккаунт создан. Проверь почту и перейди по ссылке из письма. После подтверждения вернись сюда и войди.";authMode="login";renderRegister(root);}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){const raw=String(e.message||"");msg.textContent=/email not confirmed/i.test(raw)?"Почта ещё не подтверждена. Открой ссылку из письма или нажми «Отправить письмо подтверждения повторно».":raw||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","История","Друзья","Магазин","Профиль","Настройки"],icons=["⌂","◷","♧","🛍","◉","⚙"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${AVATARS[state.profile.avatar]||"🐱"}</div><div><b>${esc(state.profile.username)}</b></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="История")return matchHistory();if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
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
function wireContent(){rootMatchHistoryBindings();const toggle=$("#play-toggle");if(toggle)toggle.onclick=()=>{state.playMenuOpen=!state.playMenuOpen;render()};const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const sf=$("#searchFriends");if(sf)sf.onclick=searchFriends;const fi=$("#friendName");if(fi)fi.addEventListener("keydown",e=>{if(e.key==="Enter")searchFriends()});if($("#friendsList"))loadSocialData();document.querySelectorAll(".buy").forEach(b=>b.onclick=async()=>{
  const qty=+b.dataset.qty,item=b.dataset.item,cost=qty===5?100:200;
  if(state.profile.coins<cost){toast("Не хватает монет");return}
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
    b.disabled=true;
    try{
      const {data,error}=await supabaseClient.rpc("purchase_qqcross_items",{item_type:item,quantity:qty});
      if(error)throw error;
      state.profile.coins=data.coins;
      await loadCloudProfile(state.profile.id);
      render();toast("Куплено: "+qty+" шт.");
    }catch(error){toast(error.message||"Покупка не прошла");b.disabled=false}
  }else{
    state.profile.coins-=cost;state.profile.items[item]+=qty;save();render();toast("Куплено: "+qty+" шт.");
  }
});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();if(supabaseClient&&socialChannel){await supabaseClient.removeChannel(socialChannel);socialChannel=null}localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Оформление изменено")})}
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
  if(!puzzle||!puzzle.words?.length){root.innerHTML='<div class="screen"><div class="card">Сканворд загружается…</div></div>';return}
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill&&state.rackNeedsRefill[state.turn]){refillRack(state.turn);state.rackNeedsRefill[state.turn]=false;}
  state.letters=state.playerRacks[state.turn]||[];
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map(),letterAt=new Map();
  puzzle.words.forEach(word=>{
    clueAt.set(word.clueCell.join(","),word);
    word.cells.forEach((cell,i)=>letterAt.set(cell.join(","),{word,letter:word.answer[i]}));
  });
  const rows=[];
  for(let y=0;y<puzzle.h;y++)for(let x=0;x<puzzle.w;x++){
    const key=y+","+x,clue=clueAt.get(key),letter=letterAt.get(key);
    if(clue){
      const clueText=clue.clue;
      rows.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+(clue.isEmoji?'scan-clue-emoji':'')+'" data-show-clue="'+esc(clue.id)+'" aria-label="Вопрос: '+esc(clueText)+'"><span class="scan-clue-text">'+esc(clueText)+'</span></button>');
    }else if(letter){
      const value=state.filled[key]||pending[key]||"";
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(state.feedback?.[key]==="wrong"?" wrong":"")+(state.wordFlashKeys?.has(key)?" word-complete-flash":"");
      rows.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в ответе">'+(value?'<span class="cell-letter">'+esc(value)+'</span>':state.hints?.[key]?'<span class="phantom-letter">'+esc(state.hints[key])+'</span>':'')+'</button>');
    }else{
      rows.push('<div class="scan-cell scan-grid-cell scan-empty" aria-hidden="true"></div>');
    }
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?'Ты':'Игрок '+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><button class="btn" id="exit">← Выйти</button><button class="btn" id="refresh-page" type="button">↻ Обновить</button></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+rows.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div>'+
    '<p class="game-hint">Перетащи буквы в клетки. ✓ проверяет расстановку и передаёт ход.</p></div></div>';
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
  state.pendingMoves.push({k,l:letter});delete state.feedback[k];
  state.letters.splice(letterIndex,1);state.playerRacks[state.turn]=state.letters;renderGame(root);
}
function finishTurn(root,timeout=false){
  const moves=state.pendingMoves||[];let correct=0,incorrect=0;const incorrectKeys=[];const correctKeys=[];state.returning=state.returning||{};
  moves.forEach(m=>{if(state.filled[m.k]){state.letters.push(m.l);return}
    if(m.l===expected[m.k]){state.filled[m.k]=m.l;state.owners[m.k]=state.turn;delete state.hints[m.k];state.playerScores[state.turn]++;state.scores++;correct++;correctKeys.push(m.k)}
    else{state.feedback[m.k]="wrong";state.returning[m.k]=m.l;incorrectKeys.push(m.k);state.letters.push(m.l);incorrect++}
  });
  state.pendingMoves=[];state.playerRacks[state.turn]=state.letters;
  const newlyCompleted=correct?checkWords():[];
  const completedWordKeys=newlyCompleted.flatMap(w=>w.cells.map(cell=>cell.join(",")));
  const flashKeys=[...new Set([...correctKeys,...completedWordKeys])];
  if(flashKeys.length){
    state.wordFlashKeys=new Set(flashKeys);
    clearTimeout(state.wordFlashTimer);
    state.wordFlashTimer=setTimeout(()=>{state.wordFlashKeys=new Set();if(state.screen==="game")renderGame(root)},850);
  }
  if(state.screen!=="game"){render();return}
  if(!state.rackNeedsRefill)state.rackNeedsRefill=Array(state.partySize).fill(false);
  state.rackNeedsRefill[state.turn]=true;
  if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;if(state.turn===0)state.round=(state.round||1)+1;}
  else state.round=(state.round||1)+1;
  state.seconds=60;state.selectedLetter=-1;state.letters=state.playerRacks[state.turn];renderGame(root);
  if(incorrect){setTimeout(()=>{incorrectKeys.forEach(k=>{delete state.returning[k];delete state.feedback[k]});if(state.screen==="game")renderGame(root)},520)}

}
function refillRack(player){const rack=state.playerRacks[player]||(state.playerRacks[player]=[]);while(rack.length<7&&letterBag.length)rack.push(...drawLetters(Math.min(7-rack.length,letterBag.length)));}
function useItem(key){
  if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}
  state.profile.items[key]--;save();
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
    supabaseClient.rpc("use_qqcross_item",{item_type:key}).then(({data,error})=>{
      if(error){state.profile.items[key]++;save();toast("Не удалось списать предмет: "+(error.message||"ошибка"));if(state.screen==="game")render()}
      else{state.profile.items[key]=data;save();const el=document.querySelector("#"+key);if(el){const strong=el.querySelector("strong");if(strong)strong.textContent=(key==="magnifier"?"🔎 ":key==="clock"?"⏱ ":"🗑️ ")+data}}
    }).catch(error=>{console.warn("QQcross inventory:",error)});
  }
  return true;
}
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
  const newlyCompleted=[];
  puzzle.words.forEach(w=>{
    if(!state.completed.has(w.id)&&w.cells.every(c=>state.filled[c.join(",")]===expected[c.join(",")])){
      state.completed.add(w.id);newlyCompleted.push(w);state.playerScores[state.turn]+=5;state.scores+=5;toast("Слово собрано! +5");
    }
  });
  if(state.completed.size===puzzle.words.length){
    persistCurrentMatch("completed");
    const cloud=!!(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-"));
    if(cloud){
      toast("Партия завершена. Облачные награды появятся после подключения серверной проверки результата.");
    }else{
      state.profile.games++;state.profile.points+=state.scores;state.profile.coins+=Math.max(10,state.scores);save();
    }
    state.screen="";
    setTimeout(()=>{render();toast("Партия завершена!")},500);
  }
  return newlyCompleted;
}
async function loadCloudProfile(userId){
  const {data,error}=await supabaseClient.from("profiles").select("id,username,avatar,coins,wins,games,points").eq("id",userId).single();
  if(error)throw error;
  const {data:inventory,error:inventoryError}=await supabaseClient.from("inventory").select("item_type,quantity").eq("user_id",userId);
  if(inventoryError)throw inventoryError;
  let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch{}
  const items=defaultItems();
  (inventory||[]).forEach(row=>{if(Object.prototype.hasOwnProperty.call(items,row.item_type))items[row.item_type]=row.quantity});
  state.profile={id:data.id,username:data.username,avatar:data.avatar||0,coins:data.coins||0,wins:data.wins||0,games:data.games||0,points:data.points||0,items,friends:saved&&saved.id===data.id&&Array.isArray(saved.friends)?saved.friends:[]};
  save();watchSocialUpdates();
}

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
  const clueAt=new Map(puzzle.words.map(w=>[w.clueCell.join(","),w]));
  const cells=[];
  for(let y=0;y<puzzle.h;y++){
    for(let x=0;x<puzzle.w;x++){
      const key=y+","+x,clue=clueAt.get(key);
      if(clue){
        cells.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+(clue.isEmoji?'scan-clue-emoji':'')+'" data-clue="'+esc(clue.clue)+'" aria-label="Вопрос: '+esc(clue.clue)+'"><span class="scan-clue-text">'+esc(clue.clue)+'</span></button>');
      }else if(expected[key]!==undefined){
        const value=state.filled[key]||pending[key]||state.returning?.[key]||"";
        const cls=(state.filled[key]?"filled feedback-correct":"")+(pending[key]?" pending-cell":"")+(state.feedback[key]==="wrong"?" wrong":"");
        cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в сканворде">'+(value?'<span class="cell-letter">'+esc(value)+'</span>':'')+'</button>');
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

function renderRecovery(root){
  root.innerHTML='<div class="screen"><div class="splash"><div class="logo">QQ</div></div><div class="card"><h2>Новый пароль</h2><p class="small muted">Придумай новый пароль для своего аккаунта.</p><input id="newPassword" class="input" type="password" minlength="8" autocomplete="new-password" placeholder="Новый пароль"><button class="btn primary full" id="saveNewPassword">Сохранить пароль</button><p class="small muted" id="recoveryMessage"></p></div></div>';
  $("#saveNewPassword").onclick=async()=>{
    const password=$("#newPassword").value,msg=$("#recoveryMessage"),button=$("#saveNewPassword");
    if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}
    button.disabled=true;button.textContent="Сохраняем…";
    try{
      const {error}=await supabaseClient.auth.updateUser({password});
      if(error)throw error;
      authRecoveryMode=false;
      history.replaceState(null,"",location.pathname+location.search);
      render();toast("Пароль обновлён");
    }catch(error){msg.textContent=error.message||"Не удалось изменить пароль.";button.disabled=false;button.textContent="Сохранить пароль"}
  };
}
function readAuthRedirectError(){
  const params=new URLSearchParams((location.hash||"").replace(/^#/,""));
  const query=new URLSearchParams(location.search||"");
  const code=params.get("error_code")||query.get("error_code")||"";
  const description=params.get("error_description")||query.get("error_description")||"";
  if(!code&&!description)return "";
  if(code==="otp_expired")return "Ссылка подтверждения устарела или уже использована. Нажми «Отправить письмо подтверждения повторно».";
  if(code==="access_denied")return "Ссылка подтверждения недействительна или срок её действия истёк. Запроси новое письмо.";
  return description||"Не удалось подтвердить почту. Запроси новое письмо.";
}

async function initAuth(){
  if(!supabaseClient){render();return}
  const authHashParams=new URLSearchParams((location.hash||"").replace(/^#/,""));
  authRecoveryMode=authHashParams.get("type")==="recovery";
  authNotice=readAuthRedirectError();
  let timedOut=false,timer;
  const authTask=(async()=>{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;
    if(data.session){await loadCloudProfile(data.session.user.id);authNotice="";}
  })();
  authTask.catch(e=>console.error("QQcross auth:",e));
  try{
    await Promise.race([
      authTask,
      new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new Error("Авторизация не ответила за 6 секунд"))},6000)})
    ]);
  }catch(e){
    console.error("QQcross auth:",e);
    if(timedOut)authNotice="Сервис аккаунта отвечает слишком долго. Можно продолжить как гость.";
    else authNotice="Не удалось восстановить аккаунт. Попробуй войти ещё раз.";
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
function compactScanwordClue(value){
  const raw=String(value||"").replace(/\s+/g," ").trim();
  if(!raw||/[\u{1F1E6}-\u{1F1FF}\p{Extended_Pictographic}]/u.test(raw)||raw.length<=18)return raw;
  const words=raw.split(" ");let short="";
  for(const word of words){const next=short?short+" "+word:word;if(next.length>18)break;short=next}
  return short||raw.slice(0,17)+"…";
}
function normalizeScanwordEntry(item){
  if(!item||typeof item!=="object")return null;
  const answer=String(item.answer||item.word||"").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
  const rawClue=String(item.emoji||item.flag||item.clueShort||item.clue||item.question||"").trim();
  const clue=compactScanwordClue(rawClue);
  if(answer.length<2||answer.length>12||!clue)return null;
  return {answer,clue,emoji:/[\u{1F1E6}-\u{1F1FF}\p{Extended_Pictographic}]/u.test(clue)};
}
function buildScanword(entries){
  const source=window.QQCROSS_SCANWORDS;
  if(!source||!Array.isArray(source.puzzles)||!source.puzzles.length)return null;

  const normalized=entries.map(normalizeScanwordEntry);
  const byAnswer=new Map();
  normalized.forEach(entry=>{if(entry&&!byAnswer.has(entry.answer))byAnswer.set(entry.answer,entry)});

  // Prefer templates whose crossing letters also form extra vertical answers.
  const candidates=source.puzzles.map((chosen,index)=>{
    const verticalEntry=normalizeScanwordEntry(entries[chosen.vertical]);
    if(!verticalEntry||verticalEntry.answer.length!==11||!Array.isArray(chosen.across)||chosen.across.length!==11)return null;
    const across=chosen.across.map(i=>normalizeScanwordEntry(entries[i]));
    if(across.some((entry,row)=>!entry||entry.answer.length>11||entry.answer[0]!==verticalEntry.answer[row]))return null;
    const derived=[];
    for(let x=2;x<12;x++){
      let answer="";
      for(const entry of across){if(entry.answer.length<x)break;answer+=entry.answer[x-1]}
      const match=answer.length>=2?byAnswer.get(answer):null;
      if(match&&answer!==verticalEntry.answer)derived.push({x,entry:match});
    }
    const topExtraXs=new Set((chosen.extras||[]).filter(e=>e.y===0&&e.dir==="down").map(e=>e.x));
    const uniqueDerived=derived.filter(item=>!topExtraXs.has(item.x));
    return {chosen,index,verticalEntry,across,derived:uniqueDerived,score:1+uniqueDerived.length+topExtraXs.size};
  }).filter(Boolean);
  if(!candidates.length)throw new Error("Не найден подходящий шаблон сканворда");
  const bestScore=Math.max(...candidates.map(c=>c.score));
  const pool=candidates.filter(c=>c.score===bestScore);
  const selected=pool[Math.floor(Math.random()*pool.length)];
  const {chosen,verticalEntry,across,derived}=selected;

  const words=[],occupied=new Map(),clueKeys=new Set();
  const addWord=(entry,index,dir,x,y,id)=>{
    if(!entry||!["across","down"].includes(dir))return false;
    const vertical=dir==="down";
    const cells=Array.from({length:entry.answer.length},(_,k)=>vertical?[y+1+k,x]:[y,x+1+k]);
    if((!vertical&&x+entry.answer.length>=12)||(vertical&&y+entry.answer.length>=12))return false;
    const clueKey=y+","+x;
    if(clueKeys.has(clueKey)||occupied.has(clueKey))return false;
    for(let k=0;k<cells.length;k++){
      const key=cells[k].join(",");
      if(clueKeys.has(key))return false;
      if(occupied.has(key)&&occupied.get(key)!==entry.answer[k])return false;
    }
    cells.forEach((cell,k)=>occupied.set(cell.join(","),entry.answer[k]));
    clueKeys.add(clueKey);
    words.push({id,answer:entry.answer,clue:entry.clue,isEmoji:entry.emoji,dir,cells,clueCell:[y,x]});
    return true;
  };

  // The main vertical clue is fixed at the top; all eleven left-edge clues remain fixed.
  addWord(verticalEntry,chosen.vertical,"down",1,0,"vertical");
  across.forEach((entry,row)=>addWord(entry,chosen.across[row],"across",0,row+1,"w"+(row+1)));

  // Add top-edge questions only where existing crossing letters form a real dictionary word.
  derived.forEach(({x,entry})=>addWord(entry,-1,"down",x,0,"top-"+x));

  // Center clues are re-positioned randomly on every new board.
  const extras=[...(chosen.extras||[])];
  for(let i=extras.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[extras[i],extras[j]]=[extras[j],extras[i]]}
  const canPlace=(entry,dir,x,y)=>{
    const vertical=dir==="down";
    const cells=Array.from({length:entry.answer.length},(_,k)=>vertical?[y+1+k,x]:[y,x+1+k]);
    if((!vertical&&x+entry.answer.length>=12)||(vertical&&y+entry.answer.length>=12))return null;
    const clueKey=y+","+x;
    if(x<1||y<1||clueKeys.has(clueKey)||occupied.has(clueKey))return null;
    let intersections=0;
    for(let k=0;k<cells.length;k++){
      const key=cells[k].join(",");
      if(clueKeys.has(key))return null;
      if(occupied.has(key)){
        if(occupied.get(key)!==entry.answer[k])return null;
        intersections++;
      }
    }
    return intersections?{x,y,dir,intersections}:null;
  };
  extras.forEach((extra,i)=>{
    const entry=normalizeScanwordEntry(entries[extra.index]);
    if(!entry||words.some(word=>word.answer===entry.answer))return;
    const placements=[];
    for(const dir of (Math.random()<.5?["across","down"]:["down","across"])){
      for(let y=1;y<12;y++)for(let x=1;x<12;x++){
        const placement=canPlace(entry,dir,x,y);
        if(placement)placements.push(placement);
      }
    }
    if(placements.length){
      const placement=placements[Math.floor(Math.random()*placements.length)];
      addWord(entry,extra.index,placement.dir,placement.x,placement.y,"extra"+i);
    }else{
      addWord(entry,extra.index,extra.dir,extra.x,extra.y,"extra"+i);
    }
  });

  const expectedMap={};occupied.forEach((value,key)=>expectedMap[key]=value);
  return {id:"scanword-"+Date.now(),title:"Сканворд",w:12,h:12,words,used:new Set(occupied.keys()),clueKeys,coverage:occupied.size/144};
}
function makeRandomPuzzle(){
  Object.keys(expected).forEach(k=>delete expected[k]);
  const built=buildScanword(getScanwordDictionary());
  if(!built){puzzle=null;letterBag=[];return false}
  puzzle=built;
  puzzle.words.forEach(w=>w.cells.forEach((c,i)=>{
    const key=c.join(","),letter=w.answer[i];
    if(expected[key]!==undefined&&expected[key]!==letter)throw new Error("Конфликт букв в ответах");
    expected[key]=letter;
  }));
  letterBag=Object.values(expected);
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]]}
  return true;
}
function loadPuzzle(){return makeRandomPuzzle()}


function begin(size=1){
  if(!loadPuzzle()){toast("Не удалось собрать сканворд. Попробуй ещё раз.");return}
  state.screen="game";state.partySize=size;state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;
  state.completed=new Set();state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=60;
  state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));
  state.letters=state.playerRacks[0];state.selectedLetter=-1;state.selectedCell=null;state.pendingMoves=[];state.matchId="match-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
  pushGameHistoryEntry();render();
}
function renderGame(root){
  clearInterval(state.interval);
  if(!puzzle||!puzzle.words.length){state.screen="";render();toast("Не удалось собрать сканворд.");return}
  persistCurrentMatch();
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
      const directionClass=word.dir==="down"?"scan-clue-down":"scan-clue-across";
      cells.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+directionClass+' '+(word.isEmoji?'scan-clue-emoji':'')+'" data-clue="'+esc(clue)+'" aria-label="Вопрос: '+esc(clue)+'"><span class="scan-clue-text">'+esc(clue)+'</span></button>');
    }else if(expected[key]!==undefined){
      const value=state.filled[key]||pending[key]||"";
      const wordFlash=state.wordFlashKeys?.has(key);
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(state.feedback[key]==="wrong"?" wrong":"")+(wordFlash?" word-complete-flash":"");
      cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в слове">'+(value?'<span class="cell-letter">'+esc(value)+'</span>':'')+'</button>');
    }else cells.push('<div class="scan-cell scan-grid-cell scan-empty" aria-hidden="true"></div>');
  }
  const names=Array.from({length:state.partySize},(_,i)=>i===0?"Ты":"Игрок "+(i+1));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><span class="small muted">Свайпни от края экрана назад — прогресс сохранится</span></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+cells.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+'" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div></div></div>';
  root.querySelectorAll("[data-clue]").forEach(b=>{b.onclick=null;b.removeAttribute("title");b.setAttribute("aria-label",b.dataset.clue)});
  let activeDrag=null,dragGhost=null;
  const startDrag=(event,source)=>{
    if(event.button!==undefined&&event.button!==0)return;
    event.preventDefault();
    if(source.type==="rack"){
      const index=Number(source.element.dataset.letter),letter=state.letters[index];if(!letter)return;
      activeDrag={type:"rack",index,letter};
    }else{
      const key=source.element.dataset.cell,move=state.pendingMoves.find(m=>m.k===key);if(!move)return;
      state.pendingMoves.splice(state.pendingMoves.indexOf(move),1);
      activeDrag={type:"pending",key,letter:move.l};
      source.element.classList.add("drag-source");
    }
    dragGhost=document.createElement("div");dragGhost.className="qq-drag-ghost";dragGhost.textContent=activeDrag.letter;
    document.body.append(dragGhost);moveGhost(event);
    document.body.classList.add("qq-dragging");
    document.addEventListener("pointermove",moveGhost,{passive:false});
    document.addEventListener("pointerup",finishDrag,{once:true});
    document.addEventListener("pointercancel",finishDrag,{once:true});
  };
  const moveGhost=event=>{if(!dragGhost)return;dragGhost.style.left=event.clientX+"px";dragGhost.style.top=event.clientY+"px"};
  const finishDrag=event=>{
    if(!activeDrag)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-cell],.hand");
    const drag=activeDrag;activeDrag=null;dragGhost?.remove();dragGhost=null;document.body.classList.remove("qq-dragging");
    document.removeEventListener("pointermove",moveGhost);document.removeEventListener("pointerup",finishDrag);document.removeEventListener("pointercancel",finishDrag);
    root.querySelectorAll(".drag-source").forEach(el=>el.classList.remove("drag-source"));
    if(target?.matches("[data-cell]")){
      const key=target.dataset.cell;
      if(drag.type==="rack"){
        if(expected[key]!==undefined&&!state.filled[key]&&!state.pendingMoves.some(m=>m.k===key))placeAtCell(key,drag.index,root);
      }else if(expected[key]!==undefined&&!state.filled[key]&&!state.pendingMoves.some(m=>m.k===key)){
        state.pendingMoves.push({k:key,l:drag.letter});state.playerRacks[state.turn]=state.letters;renderGame(root);
      }else{state.pendingMoves.push({k:drag.key,l:drag.letter});renderGame(root)}
    }else if(target?.matches(".hand")||drag.type==="pending"){
      if(drag.type==="pending"){state.letters.push(drag.letter);state.playerRacks[state.turn]=state.letters;renderGame(root)}
    }else if(drag.type==="pending"){
      state.pendingMoves.push({k:drag.key,l:drag.letter});renderGame(root);
    }
  };
  root.querySelectorAll("[data-letter]").forEach(b=>b.addEventListener("pointerdown",e=>startDrag(e,{type:"rack",element:b})));
  root.querySelectorAll("[data-cell]").forEach(cell=>{
    cell.addEventListener("pointerdown",e=>{if(state.pendingMoves.some(m=>m.k===cell.dataset.cell))startDrag(e,{type:"pending",element:cell})});
    cell.onclick=()=>{
      if(activeDrag)return;
      const key=cell.dataset.cell,existing=state.pendingMoves.find(m=>m.k===key);
      if(existing){state.letters.push(existing.l);state.pendingMoves.splice(state.pendingMoves.indexOf(existing),1);state.playerRacks[state.turn]=state.letters;renderGame(root);return}
      if(state.selectedLetter<0){toast("Перетащи букву из набора в клетку");return}
      const index=state.selectedLetter;state.selectedLetter=-1;placeAtCell(key,index,root);
    };
  });
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
  state.interval=setInterval(()=>{state.seconds--;const timer=$("#timer");if(timer)timer.textContent="⏱ "+state.seconds;persistCurrentMatch();if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},1000);
}


function matchesForThisDevice(){
  try{const all=JSON.parse(localStorage.getItem(MATCHES_KEY)||"{}");return Array.isArray(all[state.profile?.id||"guest"])?all[state.profile?.id||"guest"]:[]}catch{return []}
}
function saveMatchesForThisDevice(matches){
  try{const all=JSON.parse(localStorage.getItem(MATCHES_KEY)||"{}");all[state.profile?.id||"guest"]=matches.slice(0,30);localStorage.setItem(MATCHES_KEY,JSON.stringify(all));return true}catch(e){console.warn("QQcross local save:",e);return false}
}
function persistCurrentMatch(status="active"){
  if(state.screen!=="game"||!puzzle||!puzzle.words?.length||!state.profile)return;
  const id=state.matchId||(state.matchId="match-"+Date.now());
  const snapshot={
    id,status,updatedAt:Date.now(),label:state.partySize>1?"Партия с друзьями · "+state.partySize+" игрока":"Одиночный сканворд",
    puzzle:{id:puzzle.id,title:puzzle.title,w:puzzle.w,h:puzzle.h,words:puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c])}))},
    expected:{...expected},letterBag:[...letterBag],
    game:{
      partySize:state.partySize,filled:{...state.filled},owners:{...state.owners},feedback:{...state.feedback},hints:{...state.hints},
      completed:[...(state.completed||[])],scores:state.scores,playerScores:[...(state.playerScores||[])],turn:state.turn,round:state.round,
      seconds:state.seconds,rackNeedsRefill:[...(state.rackNeedsRefill||[])],playerRacks:(state.playerRacks||[]).map(r=>[...r]),
      pendingMoves:(state.pendingMoves||[]).map(m=>({...m})),returning:{...(state.returning||{})}
    }
  };
  const matches=matchesForThisDevice().filter(m=>m.id!==id);
  matches.unshift(snapshot);saveMatchesForThisDevice(matches);
}
function pushGameHistoryEntry(){
  try{history.pushState({qqcrossGame:true},"",location.pathname+location.search+"#game-"+Date.now())}catch{}
}
function restoreLocalMatch(id){
  const match=matchesForThisDevice().find(m=>m.id===id&&m.status!=="completed");
  if(!match)return;
  puzzle={...match.puzzle,words:match.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c])})),used:new Set(),clueKeys:new Set()};
  Object.keys(expected).forEach(k=>delete expected[k]);Object.assign(expected,match.expected||{});
  letterBag=[...(match.letterBag||[])];
  const g=match.game||{};
  Object.assign(state,{
    screen:"game",matchId:match.id,partySize:g.partySize||1,filled:{...(g.filled||{})},owners:{...(g.owners||{})},
    feedback:{...(g.feedback||{})},hints:{...(g.hints||{})},completed:new Set(g.completed||[]),scores:g.scores||0,
    playerScores:[...(g.playerScores||[])],turn:g.turn||0,round:g.round||1,seconds:g.seconds??60,
    rackNeedsRefill:[...(g.rackNeedsRefill||[])],playerRacks:(g.playerRacks||[]).map(r=>[...r]),
    pendingMoves:(g.pendingMoves||[]).map(m=>({...m})),returning:{...(g.returning||{})},selectedLetter:-1,selectedCell:null,loupeActive:false
  });
  state.letters=state.playerRacks[state.turn]||[];
  pushGameHistoryEntry();render();
}
function matchHistory(){
  const matches=matchesForThisDevice();
  if(!matches.length)return '<h2>История боёв</h2><div class="notice">Пока нет сохранённых партий. Незаконченные сканворды будут появляться здесь автоматически.</div>';
  return '<h2>История боёв</h2><p class="small muted">Сохранения хранятся только на этом устройстве.</p>'+matches.map(m=>{
    const date=new Date(m.updatedAt||Date.now()).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    const completed=m.status==="completed";
    const done=m.game?.completed?.length||0,total=m.puzzle?.words?.length||0;
    return '<div class="card match-history-card"><div class="row between"><b>'+esc(m.label||"Сканворд")+'</b><span class="pill">'+(completed?"Завершён":"Не закончен")+'</span></div><p class="small muted">'+date+' · '+done+'/'+total+' слов</p><div class="grid2">'+(completed?'<button class="btn" disabled>Партия завершена</button>':'<button class="btn primary resume-match" data-match-id="'+esc(m.id)+'">Продолжить</button>')+'<button class="btn delete-match" data-match-id="'+esc(m.id)+'">Удалить</button></div></div>';
  }).join("");
}
function rootMatchHistoryBindings(){
  document.querySelectorAll(".resume-match").forEach(b=>b.onclick=()=>restoreLocalMatch(b.dataset.matchId));
  document.querySelectorAll(".delete-match").forEach(b=>b.onclick=()=>{
    const id=b.dataset.matchId;saveMatchesForThisDevice(matchesForThisDevice().filter(m=>m.id!==id));render();
  });
}
window.addEventListener("popstate",()=>{
  if(state.screen==="game"){
    persistCurrentMatch();clearInterval(state.interval);state.screen="";state.tab="История";render();
  }
});
window.addEventListener("pagehide",()=>persistCurrentMatch());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persistCurrentMatch()});

async function preloadScanwordDictionary(){
  try{
    const [dictionaryResponse,puzzlesResponse]=await Promise.all([
      fetch("./data/scanword-dictionary.json",{cache:"no-store"}),
      fetch("./data/scanwords-1000.json",{cache:"no-store"})
    ]);
    if(!dictionaryResponse.ok)throw new Error("Словарь: HTTP "+dictionaryResponse.status);
    if(!puzzlesResponse.ok)throw new Error("Сканворды: HTTP "+puzzlesResponse.status);
    const [dictionary,puzzles]=await Promise.all([dictionaryResponse.json(),puzzlesResponse.json()]);
    if(!Array.isArray(dictionary)||!puzzles||!Array.isArray(puzzles.puzzles))throw new Error("Некорректные данные сканвордов");
    window.QQCROSS_DICTIONARY=dictionary;
    window.QQCROSS_SCANWORDS=puzzles;
  }catch(error){console.warn("QQcross data:",error)}
}

if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(error=>console.warn("QQcross offline mode:",error)));
applyTheme(activeTheme);
preloadScanwordDictionary().finally(()=>initAuth());
