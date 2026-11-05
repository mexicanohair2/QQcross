/* QQCross release themes4: graphite, purple, burgundy */
const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const THEME_KEY="qqcross_theme_v1";
const MATCHES_KEY="qqcross_local_matches_v1";
const THEME_PRESETS={gray:"Тёмно-серый",purple:"Тёмно-фиолетовый",burgundy:"Тёмно-бордовый",light:"Светлая · голубая"};
let activeTheme=(()=>{try{const saved=localStorage.getItem(THEME_KEY);return THEME_PRESETS[saved]?saved:"purple"}catch{return "purple"}})();
function applyTheme(theme=activeTheme){
  activeTheme=THEME_PRESETS[theme]?theme:"purple";
  document.documentElement.dataset.qqTheme=activeTheme;
  try{localStorage.setItem(THEME_KEY,activeTheme)}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",({gray:"#0b0d12",purple:"#090610",burgundy:"#10070d",light:"#f4f9fd"})[activeTheme]||"#090610");
}
const SUPABASE_URL="https://lzpkronttfzbubbfggsb.supabase.co";
const SUPABASE_KEY="sb_publishable_2PD3wYGG1aYoxRqhyM8wMA_OIQrwm3k";
const AUTH_REDIRECT_URL="https://mexicanohair2.github.io/QQcross/";
let supabaseClient=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:"implicit"}}):null;
function configureSupabase(){
  if(!supabaseClient&&window.supabase?.createClient){
    supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:"implicit"}});
    if(authStarted)initAuth();
  }
}
let authMode="signup";
let authNotice="";
let authRecoveryMode=false;
let socialChannel=null;
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null,playMenuOpen:false,matchInvites:[],myOnlineMatches:[],selectedInviteIds:[],pendingMatchId:null,onlineMatchId:null,onlinePlayers:[],onlineVersion:0,onlineFinished:false,rewardSubmitted:false};
let puzzle=null;
const expected={};
let letterBag=[];
let scanwordCandidateCache=null;
let draggingLetter=false;
let suppressCellClick=false;


function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(state.profile&&authRecoveryMode){renderRecovery(root);return}if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}renderShell(root)}
function renderRegister(root){root.innerHTML=`<div class="screen register-screen"><div class="splash register-splash"><div class="logo">QQ</div><h1>QQCross</h1><p class="muted">Сканворды для игры одному и с друзьями</p></div><div class="card register-card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button type="button" class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}" aria-label="${NAMES[i]}" aria-pressed="${i===state.selectedAvatar}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><button class="btn full" type="button" id="guestPlay">Играть без регистрации</button><p class="small muted auth-message" id="authMessage" aria-live="polite">${esc(authNotice)}</p>${authMode==="login"?'<button class="btn full" type="button" id="resendConfirm">Отправить письмо подтверждения повторно</button><button class="btn full" type="button" id="forgotPassword">Забыли пароль?</button>':""}</div></div>`;
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
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!supabaseClient){msg.textContent="Не загрузился сервис авторизации. Проверь интернет и обнови страницу.";return}if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.setAttribute("aria-busy","true");btn.textContent=authMode==="signup"?"Создаём аккаунт…":"Входим…";msg.textContent=authMode==="signup"?"Отправляем данные. Это может занять несколько секунд.":"Проверяем данные…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);authNotice="";render()}else{authNotice="Аккаунт создан. Проверь почту и перейди по ссылке из письма. После подтверждения вернись сюда и войди.";authMode="login";renderRegister(root);}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){const raw=String(e.message||"");msg.textContent=/email not confirmed/i.test(raw)?"Почта ещё не подтверждена. Открой ссылку из письма или нажми «Отправить письмо подтверждения повторно».":raw||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","История","Друзья","Магазин","Профиль","Настройки"],icons=["⌂","◷","♧","🛍","◉","⚙"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${AVATARS[state.profile.avatar]||"🐱"}</div><div><b>${esc(state.profile.username)}</b></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="История")return matchHistory();if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
function home(){return '<section class="card hero home-hero"><div class="home-mark">QQ</div><h2>QQCross</h2><p class="muted">Сканворды для игры одному и с друзьями</p><button class="btn primary full" id="play-toggle" aria-expanded="'+state.playMenuOpen+'">Играть</button>'+(state.playMenuOpen?'<div class="play-options"><button class="btn full" id="practice">Играть одному</button><button class="btn full" id="createParty">Играть с друзьями</button></div>':'')+'</section><h3 class="section-title">Приглашения в партии</h3><div id="matchInvites"><p class="small muted">Загрузка…</p></div><h3 class="section-title">Мои онлайн-партии</h3><div id="myOnlineMatches"><p class="small muted">Загрузка…</p></div>'}

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
    console.error("QQCross friend search:",e);
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
    console.error("QQCross social data:",e);
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
    .on("postgres_changes",{event:"*",schema:"public",table:"match_players",filter:"user_id=eq."+state.profile.id},()=>{
      if(state.tab==="Главная")loadMatchInbox();
      if(state.screen==="lobby"&&state.pendingMatchId)refreshPartyLobby();
    })
    .subscribe((status)=>{
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("QQCross social realtime:",status);
    });
}
function shop(){const products=[["magnifier","🔎","Лупы","Проверка и подсказка"],["clock","⏱","Часы","Добавить 20 секунд"],["trash","🗑️","Мусорки","Заменить набор букв"]];return `<h2>Магазин</h2>${products.map(([key,ico,name,desc])=>`<div class="card"><div class="row"><div class="avatar">${ico}</div><div class="grow"><b>${name}</b><div class="small">В наличии: ${state.profile.items[key]}</div></div></div><div class="grid2 shop-buy"><button class="btn buy" data-item="${key}" data-qty="5">5 шт. · 100 🪙</button><button class="btn primary buy" data-item="${key}" data-qty="10">10 шт. · 200 🪙</button></div></div>`).join("")}`}
function profile(){return `<h2>Профиль</h2><div class="card row"><div class="avatar big">${AVATARS[state.profile.avatar]}</div><div><h3>${esc(state.profile.username)}</h3><span class="muted small">Игрок QQCross</span></div></div><div class="grid2"><div class="card"><b>${state.profile.wins}</b><div class="muted small">Победы</div></div><div class="card"><b>${state.profile.games}</b><div class="muted small">Матчи</div></div><div class="card"><b>${state.profile.points}</b><div class="muted small">Очки</div></div><div class="card"><b>${state.profile.coins}</b><div class="muted small">Монеты</div></div></div><div class="card"><b>Мои предметы</b><p class="small">🔎 Лупы: ${state.profile.items.magnifier}　⏱ Часы: ${state.profile.items.clock}　🗑️ Мусорки: ${state.profile.items.trash}</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button>`}
function settings(){
  const themes=[["light","Светлая · голубая","Белый фон и мягкие голубые ячейки"],["gray","Тёмно-серый","Графитовые оттенки"],["purple","Тёмно-фиолетовый","Глубокие фиолетовые оттенки"],["burgundy","Тёмно-бордовый","Тёмные винные оттенки"]];
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
function wireContent(){rootMatchHistoryBindings();const toggle=$("#play-toggle");if(toggle)toggle.onclick=()=>{state.playMenuOpen=!state.playMenuOpen;render()};const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const sf=$("#searchFriends");if(sf)sf.onclick=searchFriends;const fi=$("#friendName");if(fi)fi.addEventListener("keydown",e=>{if(e.key==="Enter")searchFriends()});if($("#friendsList"))loadSocialData();if($("#matchInvites"))loadMatchInbox();document.querySelectorAll(".buy").forEach(b=>b.onclick=async()=>{
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
});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();if(supabaseClient&&socialChannel){await supabaseClient.removeChannel(socialChannel);socialChannel=null}if(supabaseClient&&onlineChannel){await supabaseClient.removeChannel(onlineChannel);onlineChannel=null;onlineChannelId=null}localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Оформление изменено")})}
function renderLobby(root){
 if(state.pendingMatchId){
  root.innerHTML='<div class="screen"><div class="top"><button class="btn" id="back">← Назад</button></div><h2>Ожидание игроков</h2><div id="partyStatus" class="card">Загружаем…</div><div class="grid2"><button class="btn" id="refreshParty">Обновить</button><button class="btn primary" id="startOnlineMatch">Начать партию</button></div></div>';
  $("#back").onclick=()=>{clearInterval(partyRefreshTimer);state.pendingMatchId=null;render()};$("#refreshParty").onclick=refreshPartyLobby;$("#startOnlineMatch").onclick=startOnlineMatch;clearInterval(partyRefreshTimer);partyRefreshTimer=setInterval(refreshPartyLobby,5000);refreshPartyLobby();return;
 }
 root.innerHTML='<div class="screen"><div class="top"><button class="btn" id="back">← Назад</button></div><h2>Новая онлайн-партия</h2><div class="card"><b>Выбери друзей</b><p class="small muted">От 1 до 3 друзей.</p><div id="lobbyFriends">Загружаем…</div><button class="btn primary full" id="createOnlineMatch">Создать партию и пригласить</button></div></div>';
 $("#back").onclick=()=>{state.screen="";render()};$("#createOnlineMatch").onclick=createOnlineMatch;loadLobbyFriends();
}
async function loadLobbyFriends(){
 const out=$("#lobbyFriends");if(!out)return;
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){out.textContent="Для онлайн-игры войди в аккаунт.";return}
 try{
  const {data,error}=await supabaseClient.rpc("list_qqcross_friends");if(error)throw error;
  if(!data?.length){out.textContent="Сначала добавь друзей во вкладке «Друзья».";return}
  out.innerHTML=data.map(p=>'<label class="friend-pick"><input type="checkbox" value="'+esc(p.id)+'"><span class="avatar">'+(AVATARS[p.avatar]||"🐱")+'</span><b>'+esc(p.username)+'</b></label>').join("");
 }catch(e){out.textContent=e.message||"Не удалось загрузить друзей"}
}
function puzzleSnapshot(){
 return {puzzle:{id:puzzle.id,title:puzzle.title,w:puzzle.w,h:puzzle.h,words:puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]}))},expected:{...expected},letterBag:[...letterBag]};
}
function serializeOnlineState(){
 return {filled:{...state.filled},owners:{...state.owners},feedback:{...state.feedback},hints:{...state.hints},completed:[...(state.completed||[])],
 scores:state.scores,playerScores:[...(state.playerScores||[])],turn:state.turn,round:state.round,seconds:Math.max(0,Math.ceil(((state.turnDeadlineAt||Date.now())-Date.now())/1000)),turnDeadlineAt:state.turnDeadlineAt||Date.now()+((state.round||1)<=1?90000:60000),
 rackNeedsRefill:[...(state.rackNeedsRefill||[])],playerRacks:(state.playerRacks||[]).map(r=>[...r]),
 pendingMoves:(state.pendingMoves||[]).map(m=>({...m})),returning:{...(state.returning||{})},letterBag:[...letterBag]};
}
async function createOnlineMatch(){
 const button=$("#createOnlineMatch"),ids=Array.from(document.querySelectorAll("#lobbyFriends input:checked")).map(x=>x.value);
 if(!ids.length||ids.length>3){toast("Выбери от 1 до 3 друзей");return}
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){toast("Войди в аккаунт");return}
 button.disabled=true;button.textContent="Создаём…";
 try{
  if(!window.QQCROSS_DICTIONARY?.length||!window.QQCROSS_SCANWORDS?.puzzles?.length)await preloadScanwordDictionary();
  if(!loadPuzzle())throw new Error("Не удалось собрать сканворд");
  const {data,error}=await supabaseClient.rpc("create_qqcross_match",{invited_user_ids:ids,puzzle_data:puzzleSnapshot()});
  if(error)throw error;state.pendingMatchId=data;renderLobby($("#app"));
 }catch(e){toast(e.message||"Не удалось создать партию");button.disabled=false;button.textContent="Создать партию и пригласить"}
}
async function refreshPartyLobby(){
 if(!state.pendingMatchId)return;const out=$("#partyStatus");if(!out)return;
 try{
  const {data,error}=await supabaseClient.rpc("get_qqcross_match",{target_match_id:state.pendingMatchId});if(error)throw error;
  out.innerHTML='<b>Игроки: '+data.players.length+' / '+data.player_limit+'</b>'+data.players.map(p=>'<div class="row"><span class="avatar">'+(AVATARS[p.avatar]||"🐱")+'</span><b>'+esc(p.username)+'</b><span class="pill">'+(p.status==="accepted"?"Принял":"Ожидает")+'</span></div>').join("");
  const b=$("#startOnlineMatch");if(b){b.disabled=data.host_id!==state.profile.id||data.players.filter(p=>["accepted","playing"].includes(p.status)).length<2;if(data.host_id!==state.profile.id)b.hidden=true;}
 }catch(e){out.textContent=e.message||"Ошибка"}
}
async function startOnlineMatch(){
 const b=$("#startOnlineMatch");if(b){b.disabled=true;b.textContent="Запускаем…"}
 try{
  const {data,error}=await supabaseClient.rpc("start_qqcross_match",{target_match_id:state.pendingMatchId});if(error)throw error;
  const s=data.puzzle_snapshot;puzzle={...s.puzzle,words:s.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(),clueKeys:new Set()};
  Object.keys(expected).forEach(k=>delete expected[k]);Object.assign(expected,s.expected);letterBag=[...(s.letterBag||[])];
  state.onlineMatchId=data.match_id;state.matchId=data.match_id;state.onlinePlayers=data.players;state.onlineVersion=1;state.partySize=data.players.length;state.turn=0;
  state.filled={};state.owners={};state.feedback={};state.hints={};state.completed=new Set();state.scores=0;state.playerScores=Array(state.partySize).fill(0);state.round=1;state.seconds=90;state.turnDeadlineAt=Date.now()+90000;state.rackNeedsRefill=Array(state.partySize).fill(false);state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));state.pendingMoves=[];state.returning={};state.rewardSubmitted=false;
  const {data:version,error:initError}=await supabaseClient.rpc("init_qqcross_match_state",{target_match_id:state.onlineMatchId,initial_state:serializeOnlineState()});if(initError)throw initError;
  state.onlineVersion=version;clearInterval(partyRefreshTimer);state.pendingMatchId=null;state.screen="game";subscribeOnlineMatch(state.onlineMatchId);pushGameHistoryEntry();render();
 }catch(e){toast(e.message||"Не удалось начать партию");if(b){b.disabled=false;b.textContent="Начать партию"}}
}
async function loadMatchInbox(){
 const invites=$("#matchInvites"),matches=$("#myOnlineMatches");
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){if(invites)invites.textContent="Войди в аккаунт, чтобы получать приглашения.";if(matches)matches.textContent="Онлайн-игра доступна после входа.";return}
 try{
  const [ir,mr]=await Promise.all([supabaseClient.rpc("list_qqcross_match_invites"),supabaseClient.rpc("list_qqcross_my_matches")]);
  if(ir.error)throw ir.error;if(mr.error)throw mr.error;
  if(invites)invites.innerHTML=ir.data?.length?ir.data.map(x=>'<div class="card"><b>'+esc(x.host_username)+'</b><p class="small muted">Приглашение · '+x.player_limit+' игрока</p><div class="grid2"><button class="btn primary match-accept" data-id="'+x.match_id+'">Принять</button><button class="btn match-reject" data-id="'+x.match_id+'">Отклонить</button></div></div>').join(""):'<p class="small muted">Новых приглашений нет.</p>';
  if(matches)matches.innerHTML=mr.data?.length?mr.data.map(x=>'<div class="card"><b>Партия от '+esc(x.host_username)+'</b><p class="small muted">'+(x.status==="waiting"?"Ожидает запуска":x.status==="finished"?"Завершена":"Идёт партия")+'</p><button class="btn primary open-online-match" data-id="'+x.match_id+'">Открыть</button></div>').join(""):'<p class="small muted">Пока нет онлайн-партий.</p>';
  document.querySelectorAll(".match-accept").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:true});if(error)throw error;await loadMatchInbox();toast("Приглашение принято")}catch(e){toast(e.message||"Ошибка");b.disabled=false}});
  document.querySelectorAll(".match-reject").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:false});if(error)throw error;await loadMatchInbox()}catch(e){toast(e.message||"Ошибка");b.disabled=false}});
  document.querySelectorAll(".open-online-match").forEach(b=>b.onclick=()=>openOnlineMatch(b.dataset.id));
 }catch(e){if(invites)invites.textContent=e.message||"Не удалось загрузить приглашения"}
}
async function openOnlineMatch(id){
 try{
  const {data,error}=await supabaseClient.rpc("get_qqcross_match",{target_match_id:id});if(error)throw error;
  if(data.status==="waiting"){if(data.host_id===state.profile.id){state.pendingMatchId=id;state.screen="lobby";renderLobby($("#app"))}else toast("Создатель ещё не запустил партию");return}
  if(!data.game_state)throw new Error("Состояние партии ещё не готово");
  applyOnlineMatch(data);
 }catch(e){toast(e.message||"Не удалось открыть партию")}
}
let onlineChannel=null;
let onlineChannelId=null;
let partyRefreshTimer=null;
function subscribeOnlineMatch(id){
 if(!supabaseClient||!id)return;
 if(onlineChannel)supabaseClient.removeChannel(onlineChannel).catch(()=>{});
 onlineChannel=supabaseClient.channel("qqcross-match-"+id)
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"matches",filter:"id=eq."+id},()=>refreshOnlineMatch())
  .subscribe();
}
function applyOnlineMatch(m){
 const alreadyInThisMatch=state.onlineMatchId===m.match_id&&state.screen==="game";
 const s=m.puzzle_snapshot,g=m.game_state;
 puzzle={...s.puzzle,words:s.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(),clueKeys:new Set()};
 Object.keys(expected).forEach(k=>delete expected[k]);Object.assign(expected,s.expected);letterBag=[...(g.letterBag||s.letterBag||[])];
 state.onlineMatchId=m.match_id;state.matchId=m.match_id;state.onlinePlayers=m.players||[];state.onlineVersion=m.state_version;state.partySize=state.onlinePlayers.length;
 state.turn=Math.max(0,state.onlinePlayers.findIndex(p=>p.id===m.current_turn_user_id));
 Object.assign(state,{screen:"game",filled:{...(g.filled||{})},owners:{...(g.owners||{})},feedback:{...(g.feedback||{})},hints:{...(g.hints||{})},
 completed:new Set(g.completed||[]),scores:g.scores||0,playerScores:(m.players||[]).map(p=>Number(p.score)||0),round:g.round||1,seconds:Math.max(0,Math.ceil(((g.turnDeadlineAt||Date.now()+((g.round||1)<=1?90000:60000))-Date.now())/1000)),turnDeadlineAt:g.turnDeadlineAt||Date.now()+((g.round||1)<=1?90000:60000),
 rackNeedsRefill:[...(g.rackNeedsRefill||[])],playerRacks:(g.playerRacks||[]).map(x=>[...x]),pendingMoves:(g.pendingMoves||[]).map(x=>({...x})),returning:{...(g.returning||{})},rewardSubmitted:false});
 state.letters=state.playerRacks[state.turn]||[];subscribeOnlineMatch(state.onlineMatchId);if(!alreadyInThisMatch)pushGameHistoryEntry();render();
 if(m.status==="finished")awardOnlineResult();
}
async function refreshOnlineMatch(force=false){
 if(!state.onlineMatchId)return;
 try{const {data,error}=await supabaseClient.rpc("get_qqcross_match",{target_match_id:state.onlineMatchId});if(error)throw error;
  if((force||data.state_version>state.onlineVersion)&&data.game_state)applyOnlineMatch(data);
  else if(data.status==="finished"&&!state.rewardSubmitted)awardOnlineResult();
 }catch(e){console.warn("QQCross online refresh:",e)}
}
async function awardOnlineResult(){
 if(state.rewardSubmitted||!state.onlineMatchId)return;state.rewardSubmitted=true;
 try{const {data,error}=await supabaseClient.rpc("award_qqcross_match_result",{points:state.scores,match_id:String(state.onlineMatchId)});if(error)throw error;
  state.profile.coins=Number(data.coins)||state.profile.coins;state.profile.games=Number(data.games)||state.profile.games;state.profile.wins=Number(data.wins)||state.profile.wins;state.profile.points=Number(data.points)||state.profile.points;save();state.screen="";render();toast("Партия завершена · награда начислена");
 }catch(e){state.rewardSubmitted=false;toast(e.message||"Не удалось начислить награду")}
}
async function saveOnlineTurn(pointsEarned,finished){
 const nextTurn=finished?state.turn:(state.turn+1)%state.partySize,nextUser=finished?null:state.onlinePlayers[nextTurn]?.id;
 if(!finished&&nextTurn===0)state.round=(state.round||1)+1;
 state.turn=nextTurn;state.seconds=(state.round||1)<=1?90:60;state.turnDeadlineAt=Date.now()+state.seconds*1000;state.selectedLetter=-1;state.letters=state.playerRacks[state.turn]||[];
 try{const nextState=serializeOnlineState();nextState.feedback={};const {data,error}=await supabaseClient.rpc("submit_qqcross_match_turn",{target_match_id:state.onlineMatchId,expected_version:state.onlineVersion,next_state:nextState,points_earned:pointsEarned,next_user_id:nextUser,is_finished:finished});if(error)throw error;
  state.onlineVersion=data.state_version;if(finished){state.screen="";await awardOnlineResult()}else renderGame($("#app"));
 }catch(e){toast(e.message||"Не удалось сохранить ход");await refreshOnlineMatch(true)}
}

function drawLetters(n){
  const out=[];
  for(let i=0;i<n&&letterBag.length;i++){
    const index=Math.floor(Math.random()*letterBag.length);
    out.push(letterBag.splice(index,1)[0]);
  }
  return out;
}
function ensureWordLetter(player=state.turn){
  const w=currentWord(),c=nextCell(w);if(!c)return false;
  const needed=expected[c.join(",")];if(!needed)return false;
  const racks=state.playerRacks||[];
  const rack=racks[player]||(player===state.turn?state.letters:[]);
  if(!rack||rack.includes(needed))return true;
  const bagIndex=letterBag.indexOf(needed);
  if(bagIndex>=0){
    const tile=letterBag.splice(bagIndex,1)[0];
    if(rack.length>=7)letterBag.push(rack.pop());
    rack.push(tile);
  }else{
    const otherIndex=racks.findIndex((r,i)=>i!==player&&Array.isArray(r)&&r.includes(needed));
    if(otherIndex>=0){
      const other=racks[otherIndex],neededIndex=other.indexOf(needed);
      const neededTile=other.splice(neededIndex,1)[0];
      if(rack.length>=7)other.push(rack.pop());
      rack.push(neededTile);
    }else if(rack.length){
      letterBag.push(rack[rack.length-1]);
      rack[rack.length-1]=needed;
    }else rack.push(needed);
  }
  if(state.playerRacks)state.playerRacks[player]=rack;
  if(player===state.turn)state.letters=rack;
  return true;
}
function currentWord(){return puzzle.words.find(w=>!state.completed.has(w.id))||puzzle.words[0]}
function nextCell(word){return word.cells.find(c=>!state.filled[c.join(",")])}
function pictureUrl(emoji){
  const code=Array.from(emoji).map(ch=>ch.codePointAt(0).toString(16)).filter(x=>x!=="fe0f"&&x!=="fe0e").join("-");
  return "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/"+code+".png";
}
function placeAtCell(k,letterIndex,root){
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
  if(state.loupeActive){toast("Нажми на клетку, чтобы открыть букву");return}
  if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k)){toast("Клетка уже занята");return}
  const letter=state.letters[letterIndex];if(!letter)return;
  state.pendingMoves.push({k,l:letter});delete state.feedback[k];
  state.letters.splice(letterIndex,1);state.playerRacks[state.turn]=state.letters;renderGame(root);
}
async function finishTurn(root,timeout=false){
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
  const moves=state.pendingMoves||[];let correct=0,incorrect=0;const incorrectKeys=[];const correctKeys=[];state.returning=state.returning||{};
  moves.forEach(m=>{if(state.filled[m.k]){state.letters.push(m.l);return}
    if(m.l===expected[m.k]){state.filled[m.k]=m.l;state.owners[m.k]=state.turn;state.feedback[m.k]="correct";delete state.hints[m.k];state.playerScores[state.turn]++;state.scores++;correct++;correctKeys.push(m.k)}
    else{state.feedback[m.k]="wrong";state.returning[m.k]=m.l;incorrectKeys.push(m.k);state.letters.push(m.l);incorrect++}
  });
  state.pendingMoves=[];state.playerRacks[state.turn]=state.letters;
  const newlyCompleted=correct?checkWords():[];
  const refilled=refillRack(state.turn);
  state.rackNewIndices=state.partySize===1?refilled.map((_,i)=>state.playerRacks[state.turn].length-refilled.length+i):[];
  if(state.rackNewIndices.length){clearTimeout(state.rackAnimationTimer);state.rackAnimationTimer=setTimeout(()=>{state.rackNewIndices=[];if(state.screen==="game")renderGame(root)},520);}
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
  if(state.onlineMatchId){await saveOnlineTurn(correct+newlyCompleted.length*5,!!state.onlineFinished);if(incorrect||correct){setTimeout(()=>{incorrectKeys.forEach(k=>{delete state.returning[k];delete state.feedback[k]});correctKeys.forEach(k=>delete state.feedback[k]);if(state.screen==="game")renderGame($("#app"))},520)}return}
  if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;if(state.turn===0)state.round=(state.round||1)+1;}
  else state.round=(state.round||1)+1;
  state.seconds=(state.round||1)<=1?90:60;state.turnDeadlineAt=Date.now()+state.seconds*1000;state.selectedLetter=-1;ensureWordLetter(state.turn);state.letters=state.playerRacks[state.turn];renderGame(root);
  if(incorrect||correct){setTimeout(()=>{incorrectKeys.forEach(k=>{delete state.returning[k];delete state.feedback[k]});correctKeys.forEach(k=>delete state.feedback[k]);if(state.screen==="game")renderGame(root)},520)}

}
function refillRack(player){const rack=state.playerRacks[player]||(state.playerRacks[player]=[]);const count=Math.min(Math.max(0,7-rack.length),letterBag.length);if(!count)return [];const added=drawLetters(count);rack.push(...added);return added;}
function useItem(key){
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return false}
  if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}
  state.profile.items[key]--;save();
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
    supabaseClient.rpc("use_qqcross_item",{item_type:key}).then(({data,error})=>{
      if(error){state.profile.items[key]++;save();toast("Не удалось списать предмет: "+(error.message||"ошибка"));if(state.screen==="game")render()}
      else{state.profile.items[key]=data;save();const el=document.querySelector("#"+key);if(el){const strong=el.querySelector("strong");if(strong)strong.textContent=(key==="magnifier"?"🔎 ":key==="clock"?"⏱ ":"🗑️ ")+data}}
    }).catch(error=>{console.warn("QQCross inventory:",error)});
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
    checkWords();ensureWordLetter(state.turn);renderGame(root);
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
  if(state.completed.size===puzzle.words.length&&state.onlineMatchId){state.onlineFinished=true;}
  else if(state.completed.size===puzzle.words.length&&!state.rewardSubmitted){
    state.rewardSubmitted=true;
    persistCurrentMatch("completed");
    const cloud=!!(supabaseClient&&state.profile?.id&&!String(state.profile.id).startsWith("local-"));
    state.screen="";
    setTimeout(async()=>{
      if(cloud){
        try{
          const {data,error}=await supabaseClient.rpc("award_qqcross_match_result",{points:state.scores,match_id:String(state.matchId||("match-"+Date.now()))});
          if(error)throw error;
          state.profile.coins=Number(data.coins)||0;
          state.profile.games=Number(data.games)||state.profile.games;
          state.profile.wins=Number(data.wins)||state.profile.wins;
          state.profile.points=Number(data.points)||state.profile.points;
          save();
          toast("Награда получена: +"+(Number(data.reward)||0)+" монет");
        }catch(error){
          state.rewardSubmitted=false;
          toast("Не удалось начислить награду: "+(error.message||"ошибка сервера"));
        }
      }else{
        state.profile.games++;state.profile.wins++;state.profile.points+=state.scores;state.profile.coins+=Math.max(10,state.scores);save();
      }
      render();toast("Сканворд завершён!");
    },100);
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
  authTask.catch(e=>console.error("QQCross auth:",e));
  try{
    await Promise.race([
      authTask,
      new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(new Error("Авторизация не ответила за 6 секунд"))},6000)})
    ]);
  }catch(e){
    console.error("QQCross auth:",e);
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
  return String(value||"").replace(/\s+/g," ").trim();
}
function fitScanwordClue(value){
  const text=compactScanwordClue(value);
  const words=text.split(" ").filter(Boolean);
  if(words.length<=3&&text.length<=25)return text;
  const selected=words.slice(0,2);
  if(selected.length===2&&/^(и|или|для|на|в|из|по|от|с|к|о|об|под|при)$/i.test(selected[1])&&words[2])return words.slice(0,3).join(" ");
  return selected.join(" ");
}
function normalizeScanwordEntry(item){
  if(!item||typeof item!=="object")return null;
  const answer=String(item.answer||item.word||"").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
  const rawClue=String(item.emoji||item.flag||item.clue||item.question||item.clueShort||"").trim();
  const clue=compactScanwordClue(rawClue);
  const clueShort=compactScanwordClue(item.clueShort||item.shortClue||clue);
  if(answer.length<1||answer.length>12||!clue)return null;
  return {answer,clue,clueShort,emoji:/[\u{1F1E6}-\u{1F1FF}\p{Extended_Pictographic}]/u.test(clue),logic:!!item.logic};
}
function buildScanword(entries){
  const source=window.QQCROSS_SCANWORDS;
  if(!source||!Array.isArray(source.puzzles)||!source.puzzles.length)return null;
  let normalized,candidates;
  if(scanwordCandidateCache&&scanwordCandidateCache.entries===entries&&scanwordCandidateCache.source===source){
    ({normalized,candidates}=scanwordCandidateCache);
  }else{
    normalized=entries.map(normalizeScanwordEntry);
    candidates=source.puzzles.map((chosen,index)=>{
      if(!Array.isArray(chosen.top)||chosen.top.length!==12||!Array.isArray(chosen.extras)||(chosen.extras.length<14||chosen.extras.length>15))return null;
      const top=chosen.top.map(i=>normalized[i]);
      if(top.some(entry=>!entry)||top[0].answer.length!==12)return null;
      return {chosen,index,top};
    }).filter(Boolean);
    scanwordCandidateCache={entries,source,normalized,candidates};
  }
  if(!candidates.length)throw new Error("Не найден шаблон сканворда с 12 вопросами в верхнем ряду");
  const selected=candidates[Math.floor(Math.random()*candidates.length)];
  const {chosen,top}=selected;
  const words=[],occupied=new Map(),clueKeys=new Set(),usedSources=new Set();
  const addWord=(entry,dir,x,y,id)=>{
    if(!entry||usedSources.has(entry.answer))return false;
    const vertical=dir==="down";
    const isTop=id.startsWith("top-");
    if(!vertical&&x+entry.answer.length>=13)return false;
    if(vertical&&(y+entry.answer.length>=13||(!isTop&&x>=12)))return false;
    const cells=Array.from({length:entry.answer.length},(_,k)=>vertical?[y+1+k,isTop?x:x+1]:[y,x+1+k]);
    const clueKey=y+","+x;
    if(clueKeys.has(clueKey)||occupied.has(clueKey))return false;
    for(let k=0;k<cells.length;k++){
      const key=cells[k].join(",");
      if(clueKeys.has(key)||(occupied.has(key)&&occupied.get(key)!==entry.answer[k]))return false;
    }
    cells.forEach((cell,k)=>occupied.set(cell.join(","),entry.answer[k]));
    clueKeys.add(clueKey);
    usedSources.add(entry.answer);
    words.push({id,answer:entry.answer,sourceAnswer:entry.answer,clue:entry.clue,clueShort:entry.clueShort,isEmoji:!!entry.emoji,dir,cells,clueCell:[y,x]});
    return true;
  };
  // Все 12 клетки верхнего ряда — вопросы. Их ответы идут вниз.
  top.forEach((entry,x)=>{
    if(!addWord(entry,"down",x+1,0,"top-"+x))throw new Error("Конфликт верхнего вопроса №"+(x+1));
  });
  const mainWord=words[0];
  if(!mainWord||mainWord.answer.length!==12||mainWord.clueCell[0]!==0||mainWord.clueCell[1]!==1||mainWord.cells.some((cell,index)=>cell[0]!==index+1||cell[1]!==1))
    throw new Error("Вопрос на 11 букв должен стоять слева от своего вертикального ответа");
  chosen.extras.forEach((extra,index)=>{
    const entry=normalized[extra.index];
    if(!entry||!addWord(entry,extra.dir,extra.x,extra.y,"extra-"+index))
      throw new Error("Ошибка размещения дополнительного вопроса №"+(index+1));
  });
  if(words.length!==12+chosen.extras.length)throw new Error("Некорректное число вопросов: "+words.length);
  if(clueKeys.size!==words.length||Array.from({length:12},(_,x)=>clueKeys.has("0,"+(x+1))).some(v=>!v))
    throw new Error("Верхний ряд должен состоять из 12 отдельных вопросов");
  return {id:"scanword-"+Date.now(),title:"Сканворд",w:13,h:13,words,used:new Set(occupied.keys()),clueKeys,coverage:(occupied.size+clueKeys.size)/169};
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


async function begin(size=1){
  const playButton=$("#practice");
  if(playButton){playButton.disabled=true;playButton.textContent="Собираем сканворд…"}
  try{
    if(!Array.isArray(window.QQCROSS_DICTIONARY)||!window.QQCROSS_SCANWORDS?.puzzles?.length){
      await preloadScanwordDictionary();
    }
    if(!Array.isArray(window.QQCROSS_DICTIONARY)||!window.QQCROSS_DICTIONARY.length||!window.QQCROSS_SCANWORDS?.puzzles?.length){
      throw new Error("Не загрузился словарь сканворда. Проверь интернет и нажми «Играть одному» ещё раз.");
    }
    let loaded=false,lastError=null;
    for(let attempt=0;attempt<5&&!loaded;attempt++){
      try{loaded=!!loadPuzzle()}catch(error){lastError=error;console.error("QQCross: puzzle start failed",error)}
    }
    if(!loaded)throw lastError||new Error("Не удалось собрать сканворд из 34 вопросов. Попробуй ещё раз.");
    state.screen="game";state.partySize=size;state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;
    state.onlineMatchId=null;state.onlinePlayers=[];state.onlineVersion=0;state.onlineFinished=false;state.completed=new Set();state.rewardSubmitted=false;state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=90;state.turnDeadlineAt=Date.now()+90000;
    state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));state.letters=state.playerRacks[0];ensureWordLetter(0);state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";state.rackNewIndices=state.partySize===1?[0,1,2,3,4,5,6]:[];state.wordFlashKeys=new Set();state.pendingMoves=[];state.matchId="match-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
    pushGameHistoryEntry();render();if(state.rackNewIndices.length){clearTimeout(state.rackAnimationTimer);state.rackAnimationTimer=setTimeout(()=>{state.rackNewIndices=[];if(state.screen==="game")render()},520)}
  }catch(error){
    console.error("QQCross: single-player start failed",error);
    toast(error&&error.message?error.message:"Не удалось запустить игру. Попробуй ещё раз.");
    if(playButton){playButton.disabled=false;playButton.textContent="Играть одному"}
  }
}
function renderGame(root){
  clearInterval(state.interval);
  if(!puzzle||!puzzle.words.length){state.screen="";render();toast("Не удалось собрать сканворд.");return}
  persistCurrentMatch();
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(7));
  if(state.rackNeedsRefill?.[state.turn]){
    const added=refillRack(state.turn);
    state.rackNewIndices=added.map((_,i)=>state.playerRacks[state.turn].length-added.length+i);
    state.rackNeedsRefill[state.turn]=false;
    clearTimeout(state.rackAnimationTimer);
    if(state.rackNewIndices.length){
      state.rackAnimationTimer=setTimeout(()=>{state.rackNewIndices=[];if(state.screen==="game")renderGame(root)},520);
    }
  }
  state.letters=state.playerRacks[state.turn]||[];
  const onlineIsMyTurn=!state.onlineMatchId||state.onlinePlayers[state.turn]?.id===state.profile?.id;
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map(puzzle.words.map(w=>[w.clueCell.join(","),w]));
  const wordEnds=new Map();
  puzzle.words.forEach(w=>{const last=w.cells[w.cells.length-1];if(!last)return;const k=last.join(",");const dirs=wordEnds.get(k)||[];dirs.push(w.dir);wordEnds.set(k,dirs)});
  const cells=[];
  for(let y=0;y<puzzle.h;y++)for(let x=0;x<puzzle.w;x++){
    const key=y+","+x,word=clueAt.get(key),position=' style="grid-column:'+(x+1)+';grid-row:'+(y+1)+'"';
    if(word){
      const clue=word.clue;
      const displayClue=word.isEmoji?clue:fitScanwordClue(word.clueShort||clue);
      const directionClass=word.dir==="down"?"scan-clue-down":"scan-clue-across";
      cells.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+directionClass+' '+(word.isEmoji?'scan-clue-emoji':'')+'" data-clue="'+esc(clue)+'" data-answer-length="'+word.answer.length+'" title="'+esc(clue)+'" aria-label="Вопрос: '+esc(clue)+'"'+position+'><span class="scan-clue-text">'+esc(displayClue)+'</span></button>');
    }else if(expected[key]!==undefined){
      const value=state.filled[key]||pending[key]||"";
      const hint=state.hints?.[key]||"";
      const wordFlash=state.wordFlashKeys?.has(key);
      const endClass=(wordEnds.get(key)||[]).map(dir=>"answer-end-"+dir).join(" ");
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(hint?" hinted-cell":"")+(state.feedback[key]==="wrong"?" wrong":"")+(state.feedback[key]==="correct"?" correct":"")+(wordFlash?" word-complete-flash":"")+(endClass?" "+endClass:"");
      const letterMarkup=value?'<span class="cell-letter">'+esc(value)+'</span>':hint?'<span class="hint-letter" aria-hidden="true">'+esc(hint)+'</span>':'';
      cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в слове"'+position+'>'+letterMarkup+'</button>');
    }else cells.push('<div class="scan-cell scan-grid-cell scan-filler" aria-hidden="true"'+position+'><span>✦</span></div>');
  }
  const names=Array.from({length:state.partySize},(_,i)=>state.onlineMatchId?(state.onlinePlayers[i]?.username||("Игрок "+(i+1))):(i===0?"Ты":"Игрок "+(i+1)));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  root.innerHTML='<div class="screen game-screen"><div class="top"><span class="small muted">Свайпни от края экрана назад — прогресс сохранится</span></div>'+
    '<div class="score-strip">'+scores+'</div><div class="board-wrap scanword-wrap"><div class="scanword-board">'+cells.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+(state.rackNewIndices?.includes(i)?' letter-enter':'')+'" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div></div></div>';
  root.querySelectorAll("[data-clue]").forEach(b=>{
    b.onclick=()=>{
      const wrap=root.querySelector(".board-wrap");
      wrap?.querySelector(".clue-popup-backdrop")?.remove();
      if(!wrap)return;
      const popup=document.createElement("div");
      popup.className="clue-popup-backdrop";
      popup.innerHTML='<div class="clue-popup"><div class="clue-popup-number">ВОПРОС</div><div class="clue-popup-text"></div><div class="clue-popup-length"></div><button type="button" class="clue-popup-close">Понятно</button></div>';
      popup.querySelector(".clue-popup-text").textContent=b.dataset.clue||"";
      popup.querySelector(".clue-popup-length").textContent="Ответ: "+(b.dataset.answerLength||"?")+" букв";
      const close=()=>popup.remove();
      popup.querySelector(".clue-popup-close").onclick=close;
      popup.onclick=event=>{if(event.target===popup)close()};
      wrap.append(popup);
    };
    b.setAttribute("aria-label",b.dataset.clue);
  });
  let activeDrag=null,dragGhost=null;
  const startDrag=(event,source)=>{
    if(event.button!==undefined&&event.button!==0)return;
    event.preventDefault();
    if(source.type==="rack"){
      const index=Number(source.element.dataset.letter),letter=state.letters[index];if(!letter)return;
      activeDrag={type:"rack",index,letter};
      source.element.classList.add("dragging");
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
  const moveGhost=event=>{if(!dragGhost)return;if(event.cancelable)event.preventDefault();dragGhost.style.left=event.clientX+"px";dragGhost.style.top=event.clientY+"px"};
  const finishDrag=event=>{
    if(!activeDrag)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-cell],.hand");
    const drag=activeDrag;activeDrag=null;dragGhost?.remove();dragGhost=null;document.body.classList.remove("qq-dragging");
    document.removeEventListener("pointermove",moveGhost);document.removeEventListener("pointerup",finishDrag);document.removeEventListener("pointercancel",finishDrag);
    root.querySelectorAll(".drag-source,.dragging").forEach(el=>el.classList.remove("drag-source","dragging"));
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
      const key=cell.dataset.cell;
      if(state.loupeActive){
        if(expected[key]===undefined){toast("Выбери клетку с буквой ответа");return}
        if(state.filled[key]||state.pendingMoves.some(m=>m.k===key)){toast("Эта клетка уже заполнена");return}
        if(state.hints?.[key]){toast("Подсказка для этой буквы уже открыта");return}
        if(!useItem("magnifier")){state.loupeActive=false;return}
        state.hints=state.hints||{};
        state.hints[key]=expected[key];
        state.loupeActive=false;
        renderGame(root);
        toast("Правильная буква подсвечена");
        return;
      }
      const existing=state.pendingMoves.find(m=>m.k===key);
      if(existing){state.letters.push(existing.l);state.pendingMoves.splice(state.pendingMoves.indexOf(existing),1);state.playerRacks[state.turn]=state.letters;renderGame(root);return}
      if(state.selectedLetter<0){toast("Перетащи букву из набора в клетку");return}
      const index=state.selectedLetter;state.selectedLetter=-1;placeAtCell(key,index,root);
    };
  });
    $("#endturn").onclick=()=>finishTurn(root);
  $("#magnifier").onclick=()=>{
    if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
    if(state.profile.items.magnifier<=0){toast("Лупы закончились — загляни в магазин");return}
    const hasTarget=puzzle.words.some(w=>w.cells.some(c=>!state.filled[c.join(",")]&&!state.pendingMoves.some(m=>m.k===c.join(","))&&!state.hints?.[c.join(",")]));
    if(!hasTarget){toast("Все доступные буквы уже открыты");return}
    state.loupeActive=!state.loupeActive;
    toast(state.loupeActive?"Нажми на любую пустую клетку с буквой":"Выбор клетки отменён");
    root.querySelector("#magnifier")?.classList.toggle("active",state.loupeActive);
  };
  $("#clock").onclick=()=>{if(useItem("clock")){state.seconds+=20;renderGame(root)}};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);ensureWordLetter(state.turn);renderGame(root)};
  if(onlineIsMyTurn)state.interval=setInterval(()=>{state.seconds=Math.max(0,Math.ceil(((state.turnDeadlineAt||Date.now())-Date.now())/1000));const timer=$("#timer");if(timer)timer.textContent="⏱ "+state.seconds;persistCurrentMatch();if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},250);
}


function matchesForThisDevice(){
  try{const all=JSON.parse(localStorage.getItem(MATCHES_KEY)||"{}");return Array.isArray(all[state.profile?.id||"guest"])?all[state.profile?.id||"guest"]:[]}catch{return []}
}
function saveMatchesForThisDevice(matches){
  try{const all=JSON.parse(localStorage.getItem(MATCHES_KEY)||"{}");all[state.profile?.id||"guest"]=matches.slice(0,30);localStorage.setItem(MATCHES_KEY,JSON.stringify(all));return true}catch(e){console.warn("QQCross local save:",e);return false}
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

let dictionaryLoadPromise=null;
function preloadScanwordDictionary(){
  if(Array.isArray(window.QQCROSS_DICTIONARY)&&window.QQCROSS_DICTIONARY.length&&window.QQCROSS_SCANWORDS?.puzzles?.length)return Promise.resolve(true);
  if(dictionaryLoadPromise)return dictionaryLoadPromise;
  dictionaryLoadPromise=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const version="20261106-gridrepair1";
      const [dictionaryResponse,puzzlesResponse]=await Promise.all([
        fetch("./data/scanword-dictionary.json?v="+version,{signal:controller.signal,cache:"no-store"}),
        fetch("./data/scanwords-1000.json?v="+version,{signal:controller.signal,cache:"no-store"})
      ]);
      if(!dictionaryResponse.ok)throw new Error("Словарь: HTTP "+dictionaryResponse.status);
      if(!puzzlesResponse.ok)throw new Error("Шаблоны: HTTP "+puzzlesResponse.status);
      const [dictionary,puzzles]=await Promise.all([dictionaryResponse.json(),puzzlesResponse.json()]);
      if(!Array.isArray(dictionary)||!dictionary.length||!puzzles||!Array.isArray(puzzles.puzzles)||!puzzles.puzzles.length)throw new Error("Некорректные данные сканвордов");
      window.QQCROSS_DICTIONARY=dictionary;
      window.QQCROSS_SCANWORDS=puzzles;
      return true;
    }catch(error){
      console.warn("QQCross data:",error);
      dictionaryLoadPromise=null;
      if(error?.name==="AbortError")throw new Error("Загрузка сканвордов заняла больше 12 секунд. Проверь интернет и попробуй ещё раз.");
      throw error;
    }finally{clearTimeout(timeout)}
  })();
  return dictionaryLoadPromise;
}

if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(error=>console.warn("QQCross offline mode:",error)));
applyTheme(activeTheme);
let authStarted=false;
window.QQ_SUPABASE_READY=configureSupabase;
configureSupabase();
function startAuthOnce(){if(authStarted)return;authStarted=true;initAuth()}
const dictionaryReady=preloadScanwordDictionary();
Promise.race([dictionaryReady,new Promise(resolve=>setTimeout(resolve,3500))]).finally(startAuthOnce);
