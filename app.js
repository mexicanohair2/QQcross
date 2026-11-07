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
const AMBIENCE_KEY="qqcross_ambience_v1";
let activeAmbience=(()=>{try{const v=localStorage.getItem(AMBIENCE_KEY);return ["forest","sakura","none"].includes(v)?v:"forest"}catch{return "forest"}})();
function applyAmbience(value=activeAmbience){
  activeAmbience=["forest","sakura","none"].includes(value)?value:"forest";
  document.documentElement.dataset.qqAmbience=activeAmbience;
  try{localStorage.setItem(AMBIENCE_KEY,activeAmbience)}catch{}
}
applyAmbience();
function avatarStorageKey(){return "qqcross_avatar_image_"+String(state.profile?.id||"guest");}
function getAvatarImage(){try{const v=localStorage.getItem(avatarStorageKey());return v&&/^data:image\/(webp|png|jpeg);base64,/.test(v)?v:"";}catch{return "";}}
function avatarMarkup(size=""){
  const image=getAvatarImage();
  return image?'<img class="qq-avatar-image '+size+'" src="'+image+'" alt="Моя аватарка">':(AVATARS[state.profile?.avatar]||"🐱");
}
function saveAvatarFile(file){
  if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast("Выбери изображение PNG, JPG или WebP.");return;}
  if(file.size>8*1024*1024){toast("Изображение должно быть меньше 8 МБ.");return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const image=new Image();
    image.onload=()=>{
      const side=256,canvas=document.createElement("canvas");canvas.width=side;canvas.height=side;
      const ctx=canvas.getContext("2d"),crop=Math.min(image.width,image.height),sx=(image.width-crop)/2,sy=(image.height-crop)/2;
      ctx.drawImage(image,sx,sy,crop,crop,0,0,side,side);
      try{localStorage.setItem(avatarStorageKey(),canvas.toDataURL("image/webp",.82));render();toast("Аватарка сохранена на этом устройстве.");}
      catch(_){toast("Не удалось сохранить изображение. Попробуй файл поменьше.");}
    };
    image.onerror=()=>toast("Не удалось открыть это изображение.");
    image.src=String(reader.result||"");
  };
  reader.onerror=()=>toast("Не удалось прочитать файл.");
  reader.readAsDataURL(file);
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
const state={profile:null,tab:"Главная",screen:"",selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null,playMenuOpen:false,aiMatch:false,aiThinkingTurn:null,aiError:"",matchInvites:[],myOnlineMatches:[],selectedInviteIds:[],pendingMatchId:null,onlineMatchId:null,onlinePlayers:[],onlineVersion:0,onlineFinished:false,rewardSubmitted:false};
let puzzle=null;
const expected={};
let letterBag=[];
let scanwordCandidateCache=null;
let preparedScanword=null;
let scanwordPreparing=false;
let scanwordPreparePromise=null;
let scanwordPuzzlePack=[];
let scanwordPackOrder=[];
let scanwordPackLoadPromise=null;
let draggingLetter=false;
let suppressCellClick=false;


function defaultItems(){return {magnifier:5,clock:5,trash:5}}
function save(){if(state.profile)localStorage.setItem(STORE_KEY,JSON.stringify(state.profile))}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(state.profile&&authRecoveryMode){renderRecovery(root);return}if(!state.profile&&authRestoreError){renderAuthRestore(root);return}if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="lobby"){renderLobby(root);return}if(state.screen==="wordle"){renderWordle(root);return}if(state.screen==="extra"){if(window.QQExtraGames)window.QQExtraGames.mount(root,state.extraMode,()=>{state.screen="";render()});else{root.innerHTML='<div class="screen"><p>Не удалось загрузить дополнительные игры.</p><button class="btn" id="extraBack">Назад</button></div>';$("#extraBack").onclick=()=>{state.screen="";render()}}return}renderShell(root)}
function renderWordle(root){if(!window.QQWordle){root.innerHTML='<div class="screen"><p>Не удалось загрузить Wordle.</p><button class="btn" id="wordleBackFallback">Назад</button></div>';$("#wordleBackFallback").onclick=()=>{state.screen="";render()};return}window.QQWordle.mount(root,()=>{state.screen="";render()})}
function renderRegister(root){root.innerHTML=`<div class="screen register-screen"><div class="splash register-splash"><div class="logo">QQ</div><h1>QQCross</h1><p class="muted">Сканворды для одного, друзей и игры с ChatGPT</p></div><div class="card register-card"><div class="grid2"><button class="btn ${authMode==="signup"?"primary":""}" id="showSignup">Регистрация</button><button class="btn ${authMode==="login"?"primary":""}" id="showLogin">Войти</button></div><h2>${authMode==="signup"?"Создать аккаунт":"Войти в аккаунт"}</h2>${authMode==="signup"?`<label class="small muted">Имя игрока (3–16 символов)</label><input id="username" class="input" maxlength="16" placeholder="Например, wordmaster" autocomplete="username"><h3>Выбери аватарку</h3><div class="avatar-grid">${AVATARS.map((a,i)=>`<button type="button" class="avatar-choice ${i===state.selectedAvatar?"selected":""}" data-avatar="${i}" aria-label="${NAMES[i]}" aria-pressed="${i===state.selectedAvatar}">${a}</button>`).join("")}</div>`: ""}<label class="small muted">Электронная почта</label><input id="email" class="input" type="email" placeholder="name@example.com" autocomplete="email"><label class="small muted">Пароль (минимум 8 символов)</label><input id="password" class="input" type="password" placeholder="Пароль" autocomplete="${authMode==="signup"?"new-password":"current-password"}"><button class="btn primary full" id="authSubmit">${authMode==="signup"?"Создать аккаунт":"Войти"}</button><button class="btn full" type="button" id="guestPlay">Играть без регистрации</button><p class="small muted auth-message" id="authMessage" aria-live="polite">${esc(authNotice)}</p>${authMode==="login"?'<button class="btn full" type="button" id="resendConfirm">Отправить письмо подтверждения повторно</button><button class="btn full" type="button" id="forgotPassword">Забыли пароль?</button>':""}</div></div>`;
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
$("#authSubmit").onclick=async()=>{const email=$("#email").value.trim(),password=$("#password").value;const msg=$("#authMessage");if(!supabaseClient){msg.textContent="Не загрузился сервис авторизации. Проверь интернет и обнови страницу.";return}if(!email||!password){msg.textContent="Введи почту и пароль.";return}if(password.length<8){msg.textContent="Пароль должен быть не короче 8 символов.";return}const btn=$("#authSubmit");btn.disabled=true;btn.setAttribute("aria-busy","true");btn.textContent=authMode==="signup"?"Создаём аккаунт…":"Входим…";msg.textContent=authMode==="signup"?"Отправляем данные. Это может занять несколько секунд.":"Проверяем данные…";try{if(authMode==="signup"){const username=$("#username").value.trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){msg.textContent="Имя: 3–16 символов, латиница, цифры или _";btn.disabled=false;btn.textContent="Создать аккаунт";return}const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username,avatar:state.selectedAvatar},emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;if(data.session){await loadCloudProfile(data.user.id);authNotice="";render()}else{authNotice="Аккаунт создан. Проверь почту и перейди по ссылке из письма. После подтверждения вернись сюда и войди.";authMode="login";renderRegister(root);}}else{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await loadCloudProfile(data.user.id);render()}}catch(e){const raw=String(e.message||"");try{const {data}=await supabaseClient.auth.getSession();if(data?.session){authRestoreError="Вход выполнен, но профиль не загрузился: "+(raw||"ошибка сервера")+". Сессия сохранена — повтори загрузку.";render();return}}catch{}msg.textContent=/email not confirmed/i.test(raw)?"Почта ещё не подтверждена. Открой ссылку из письма или нажми «Отправить письмо подтверждения повторно».":raw||"Не удалось выполнить вход.";btn.disabled=false;btn.textContent=authMode==="signup"?"Создать аккаунт":"Войти"}};
}
function renderShell(root){const tabs=["Главная","История","Друзья","Магазин","Профиль","Настройки"],icons=["⌂","◷","♧","🛍","◉","⚙"];root.innerHTML=`<div class="screen"><div class="top"><div class="user"><div class="avatar">${avatarMarkup()}</div><div><b>${esc(state.profile.username)}</b></div></div><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav">${tabs.map((t,i)=>`<button class="${state.tab===t?"active":""}" data-tab="${t}"><span class="ni">${icons[i]}</span>${t}</button>`).join("")}</nav>`;root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});wireContent()}
function content(){if(state.tab==="История")return matchHistory();if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
function home(){return '<section class="card hero home-hero"><div class="home-mark">QQ</div><span class="qq-forest-hat" title="Сенная шляпа">👒</span><h2>QQCross</h2><p class="muted">Сканворды для игры одному и с друзьями</p><button class="btn primary full" id="play-toggle" aria-expanded="'+state.playMenuOpen+'">Играть в сканворд</button>'+(state.playMenuOpen?'<div class="play-options"><button class="btn full" id="practice" '+(scanwordPreparing?'disabled':'')+'>'+(scanwordPreparing?'Готовим поле…':preparedScanword?'Играть одному':'Подготовить поле')+'</button><button class="btn full" id="createParty">Играть с друзьями</button><button class="btn full chatgpt-play-option" id="playChatGPT" aria-expanded="false">Играть с ChatGPT</button></div>':'')+'</section><h3 class="section-title">Другие игры</h3><div class="qq-game-launch-grid"><button class="qq-game-launch" data-extra-game="search"><span class="qq-game-icon">⌕</span><b>Поиск слов</b><small>Найди слова в буквенном поле</small></button><button class="qq-game-launch" id="playWordle"><span class="qq-game-icon">▦</span><b>Wordle</b><small>Угадай слово из пяти букв</small></button><button class="qq-game-launch" data-extra-game="wheel"><span class="qq-game-icon">◉</span><b>Word of Wonders</b><small>Составляй слова из круга и открывай кроссворд</small></button><button class="qq-game-launch" data-extra-game="cody"><span class="qq-game-icon">✧</span><b>Кроссворды</b><small>Вопросы и секретное слово</small></button></div><h3 class="section-title">Приглашения в партии</h3><div id="matchInvites"><p class="small muted">Загрузка…</p></div><h3 class="section-title">Мои онлайн-партии</h3><div id="myOnlineMatches"><p class="small muted">Загрузка…</p></div>'}

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
function profile(){return `<h2>Профиль</h2><div class="card row qq-profile-avatar-card"><div class="avatar big">${avatarMarkup("big")}</div><div><h3>${esc(state.profile.username)}</h3><span class="muted small">Игрок QQCross</span><label class="btn qq-avatar-upload-label" for="qqAvatarInput">Загрузить свою аватарку</label><input id="qqAvatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><small class="muted small">Квадратное изображение до 8 МБ. Сохраняется на этом устройстве.</small></div></div><div class="grid2"><div class="card"><b>${state.profile.wins}</b><div class="muted small">Победы</div></div><div class="card"><b>${state.profile.games}</b><div class="muted small">Матчи</div></div><div class="card"><b>${state.profile.points}</b><div class="muted small">Очки</div></div><div class="card"><b>${state.profile.coins}</b><div class="muted small">Монеты</div></div></div><div class="card"><b>Мои предметы</b><p class="small">🔎 Лупы: ${state.profile.items.magnifier}　⏱ Часы: ${state.profile.items.clock}　🗑️ Мусорки: ${state.profile.items.trash}</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button>`}
function settings(){
  const themes=[["light","Светлая · голубая","Белый фон и мягкие голубые ячейки"],["gray","Тёмно-серый","Графитовые оттенки"],["purple","Тёмно-фиолетовый","Глубокие фиолетовые оттенки"],["burgundy","Тёмно-бордовый","Тёмные винные оттенки"]];
  const audio=window.QQAudio?.getSettings?.()||{music:true,effects:true};
  return `<h2>Настройки</h2>
    <section class="card settings-card">
      <span class="pill">Звук</span>
      <h3>Музыка и эффекты</h3>
      <label class="audio-setting"><span><b>Фоновая мелодия</b><small>Тихая спокойная мелодия во время игры</small></span><input type="checkbox" id="qqMusicToggle" ${audio.music?"checked":""}></label>
      <label class="audio-setting"><span><b>Звуки действий</b><small>Буквы, слова, правильные и неверные ответы</small></span><input type="checkbox" id="qqEffectsToggle" ${audio.effects?"checked":""}></label>
      <p class="small muted settings-note">Настройки звука сохраняются на этом устройстве. Музыка включается после первого касания экрана.</p>
    </section>
    <section class="card settings-card">
      <span class="pill">Персонализация · 👒</span>
      <h3>Цвет интерфейса</h3>
      <div class="theme-list">${themes.map(([key,name,desc])=>`<button class="theme-choice ${activeTheme===key?"selected":""}" data-theme-choice="${key}" aria-pressed="${activeTheme===key}">
        <span class="theme-swatch theme-swatch-${key}"></span>
        <span class="theme-copy"><b>${name}</b></span>
        <span class="theme-check">${activeTheme===key?"✓":""}</span>
      </button>`).join("")}</div>
    </section>
    <section class="card settings-card qq-ambience-card">
      <span class="pill">Атмосфера</span>
      <h3>Сезонное оформление</h3>
      <div class="ambience-list">
        <button class="ambience-choice ${activeAmbience==="forest"?"selected":""}" data-ambience-choice="forest"><span class="ambience-preview forest-preview">❄</span><b>Зимний лес</b><small>Тихий снег и тёмные силуэты деревьев</small></button>
        <button class="ambience-choice ${activeAmbience==="sakura"?"selected":""}" data-ambience-choice="sakura"><span class="ambience-preview sakura-preview">🌸</span><b>Сакура</b><small>Нежные лепестки и спокойные оттенки</small></button>
        <button class="ambience-choice ${activeAmbience==="none"?"selected":""}" data-ambience-choice="none"><span class="ambience-preview none-preview">○</span><b>Без оформления</b><small>Чистый фон без анимации</small></button>
      </div>
    </section>`;
}
function wireContent(){rootMatchHistoryBindings();const wordleButton=$("#playWordle");if(wordleButton)wordleButton.onclick=()=>{state.screen="wordle";render()};document.querySelectorAll("[data-extra-game]").forEach(b=>b.onclick=()=>{state.extraMode=b.dataset.extraGame;state.screen="extra";render()});const toggle=$("#play-toggle");if(toggle)toggle.onclick=()=>{state.playMenuOpen=!state.playMenuOpen;render()};const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);refreshPracticeButton();const gpt=$("#playChatGPT");if(gpt)gpt.onclick=()=>startChatGPTGame(gpt);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const sf=$("#searchFriends");if(sf)sf.onclick=searchFriends;const fi=$("#friendName");if(fi)fi.addEventListener("keydown",e=>{if(e.key==="Enter")searchFriends()});if($("#friendsList"))loadSocialData();if($("#matchInvites"))loadMatchInbox();document.querySelectorAll(".buy").forEach(b=>b.onclick=async()=>{
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
});const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();if(supabaseClient&&socialChannel){await supabaseClient.removeChannel(socialChannel);socialChannel=null}if(supabaseClient&&onlineChannel){await supabaseClient.removeChannel(onlineChannel);onlineChannel=null;onlineChannelId=null}localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Оформление изменено")});const music=$("#qqMusicToggle"),effects=$("#qqEffectsToggle");if(music)music.onchange=()=>window.QQAudio?.setMusic(music.checked);if(effects)effects.onchange=()=>window.QQAudio?.setEffects(effects.checked);const avatarInput=$("#qqAvatarInput");if(avatarInput)avatarInput.onchange=()=>saveAvatarFile(avatarInput.files?.[0]);document.querySelectorAll("[data-ambience-choice]").forEach(b=>b.onclick=()=>{applyAmbience(b.dataset.ambienceChoice);render();toast("Атмосфера изменена")})}
function renderLobby(root){
 if(state.pendingMatchId){
  root.innerHTML='<div class="screen"><div class="top"><button class="btn" id="back">← Назад</button><button class="btn danger" id="deletePendingMatch">Удалить бой</button></div><h2>Ожидание игроков</h2><div id="partyStatus" class="card">Загружаем…</div><div class="grid2"><button class="btn" id="refreshParty">Обновить</button><button class="btn primary" id="startOnlineMatch">Начать партию</button></div></div>';
  $("#back").onclick=()=>{clearInterval(partyRefreshTimer);state.pendingMatchId=null;render()};$("#deletePendingMatch").onclick=async()=>{const id=state.pendingMatchId;if(!id||!confirm("Удалить эту дружескую партию? Она исчезнет у всех участников."))return;const b=$("#deletePendingMatch");b.disabled=true;b.textContent="Удаляем…";try{const {data,error}=await supabaseClient.rpc("delete_qqcross_match",{target_match_id:id});if(error)throw error;clearInterval(partyRefreshTimer);state.pendingMatchId=null;state.screen="";render();await loadMatchInbox();toast(data==="deleted"?"Бой удалён у всех":"Бой уже удалён")}catch(e){toast(e.message||"Не удалось удалить бой");b.disabled=false;b.textContent="Удалить бой"}};$("#refreshParty").onclick=refreshPartyLobby;$("#startOnlineMatch").onclick=startOnlineMatch;clearInterval(partyRefreshTimer);partyRefreshTimer=setInterval(refreshPartyLobby,5000);refreshPartyLobby();return;
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
  if(!window.QQCROSS_DICTIONARY?.length)await preloadScanwordDictionary();
  if(!preparedScanword)await prepareNextScanword();
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
  if(matches)matches.innerHTML=mr.data?.length?mr.data.map(x=>'<div class="card"><b>Партия от '+esc(x.host_username)+'</b><p class="small muted">'+(x.status==="waiting"?"Ожидает запуска":x.status==="finished"?"Завершена":"Идёт партия")+'</p><div class="grid2"><button class="btn primary open-online-match" data-id="'+x.match_id+'">Открыть</button><button class="btn delete-online-match" data-id="'+x.match_id+'">Удалить бой</button></div></div>').join(""):'<p class="small muted">Пока нет онлайн-партий.</p>';
  document.querySelectorAll(".match-accept").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:true});if(error)throw error;await loadMatchInbox();toast("Приглашение принято")}catch(e){toast(e.message||"Ошибка");b.disabled=false}});
  document.querySelectorAll(".match-reject").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:false});if(error)throw error;await loadMatchInbox()}catch(e){toast(e.message||"Ошибка");b.disabled=false}});
  document.querySelectorAll(".open-online-match").forEach(b=>b.onclick=()=>openOnlineMatch(b.dataset.id));
  document.querySelectorAll(".delete-online-match").forEach(b=>b.onclick=async()=>{
   const id=b.dataset.id;
   if(!confirm("Удалить эту дружескую партию? Если ты её создал — она исчезнет у всех. Если ты участник — только из твоего списка."))return;
   b.disabled=true;
   try{
    const {data,error}=await supabaseClient.rpc("delete_qqcross_match",{target_match_id:id});
    if(error)throw error;
    await loadMatchInbox();
    toast(data==="deleted"?"Партия удалена":data==="left"?"Партия убрана из твоего списка":"Партия уже не найдена");
   }catch(e){toast(e.message||"Не удалось удалить партию");b.disabled=false}
  });
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
 onlineChannelId=id;onlineChannel=supabaseClient.channel("qqcross-match-"+id)
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
  state.pendingMoves.push({k,l:letter});window.QQAudio?.play("letter");delete state.feedback[k];
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
  if(correct)window.QQAudio?.play("correct");if(incorrect)window.QQAudio?.play("wrong");const newlyCompleted=correct?checkWords():[];
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
    window.QQAudio?.play("correct");
    state.filled[k]=l;state.owners[k]=state.turn;
    state.letters.splice(state.selectedLetter,1);
    if(letterBag.length)state.letters.push(drawLetters(1)[0]);
    state.playerRacks[state.turn]=state.letters;
    state.selectedLetter=-1;state.selectedCell=null;state.wrong=null;
    state.playerScores[state.turn]++;state.scores++;state.playerRacks[state.turn]=state.letters;
    checkWords();ensureWordLetter(state.turn);renderGame(root);
  }else{
    window.QQAudio?.play("wrong");
    state.wrong=k;renderGame(root);
    setTimeout(()=>{state.wrong=null;const el=document.querySelector('[data-cell="'+k+'"]');if(el)el.classList.remove("wrong")},500);
  }
}
function checkWords(){
  const newlyCompleted=[];
  puzzle.words.forEach(w=>{
    if(!state.completed.has(w.id)&&w.cells.every(c=>state.filled[c.join(",")]===expected[c.join(",")])){
      state.completed.add(w.id);newlyCompleted.push(w);window.QQAudio?.play("word");state.playerScores[state.turn]+=5;state.scores+=5;toast("Слово собрано! +5");
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
async function loadCloudProfile(userId,generation=null){
  const {data,error}=await supabaseClient.from("profiles").select("id,username,avatar,coins,wins,games,points").eq("id",userId).single();
  if(error)throw error;
  const {data:inventory,error:inventoryError}=await supabaseClient.from("inventory").select("item_type,quantity").eq("user_id",userId);
  let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch{}
  const items=defaultItems();
  if(inventoryError){
    console.warn("QQCross inventory:",inventoryError);
    if(saved&&saved.id===userId&&saved.items&&typeof saved.items==="object"){
      Object.keys(items).forEach(key=>{const value=saved.items[key];if(Number.isInteger(value)&&value>=0)items[key]=value});
    }
  }else{
    (inventory||[]).forEach(row=>{if(Object.prototype.hasOwnProperty.call(items,row.item_type))items[row.item_type]=row.quantity});
  }
  if(generation!==null&&generation!==authGeneration)return;
  state.profile={id:data.id,username:data.username,avatar:data.avatar||0,coins:data.coins||0,wins:data.wins||0,games:data.games||0,points:data.points||0,items,friends:saved&&saved.id===data.id&&Array.isArray(saved.friends)?saved.friends:[]};
  authRestoreError="";
  save();watchSocialUpdates();
}

function renderAuthRestore(root){
  root.innerHTML='<div class="screen register-screen"><div class="splash register-splash"><div class="logo">QQ</div><h1>QQCross</h1><p class="muted">Не удалось загрузить данные аккаунта</p></div><div class="card register-card"><h2>Аккаунт не потерян</h2><p class="small muted">Сохранённая сессия найдена, но QQCross пока не смог получить профиль с сервера. Не создавай новый аккаунт и не очищай данные сайта — попробуй загрузить профиль ещё раз.</p><p class="small muted" id="authRestoreMessage">${esc(authRestoreError)}</p><button class="btn primary full" id="retryAuthRestore">Повторить загрузку</button></div></div>';
  const button=$("#retryAuthRestore");
  if(button)button.onclick=()=>{button.disabled=true;button.textContent="Проверяем…";authRestoreError="";initAuth()};
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

let authRestoreError="";
let authGeneration=0;
async function initAuth(){
  const generation=++authGeneration;
  if(!supabaseClient){
    authRestoreError="Сервис авторизации пока не загрузился. Проверь интернет и повтори попытку.";
    render();
    return;
  }
  authRestoreError="";
  const authHashParams=new URLSearchParams((location.hash||"").replace(/^#/,""));
  authRecoveryMode=authHashParams.get("type")==="recovery";
  authNotice=readAuthRedirectError();
  let timer;
  const authTask=(async()=>{
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;
    if(generation!==authGeneration)return;
    if(data.session){
      await loadCloudProfile(data.session.user.id,generation);
      if(generation===authGeneration)authNotice="";
    }else if(generation===authGeneration){
      state.profile=null;
    }
  })();
  authTask.catch(()=>{});
  try{
    await Promise.race([
      authTask,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Сервер не ответил за 6 секунд")),6000)})
    ]);
  }catch(e){
    if(generation===authGeneration){
      console.error("QQCross auth:",e);
      authRestoreError="Не удалось получить профиль с сервера. Сессия не удалена. Проверь соединение и нажми «Повторить загрузку».";
    }
  }finally{
    clearTimeout(timer);
    if(generation===authGeneration)render();
  }
  authTask.then(()=>{
    if(generation===authGeneration){
      authRestoreError="";
      render();
    }
  }).catch(e=>{
    if(generation===authGeneration){
      console.error("QQCross auth:",e);
      authRestoreError="Не удалось восстановить профиль: "+(e?.message||"ошибка сервера")+". Сессия сохранена — попробуй ещё раз.";
      render();
    }
  });
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
  return compactScanwordClue(value);
}
const SCANWORD_IMAGE_KEYS=new Set(["airplane","apple","ball","banana","bear","bee","bicycle","boat","book","bus","butterfly","car","carrot","cat","clock","cloud","crocodile","cucumber","cup","dog","dolphin","fish","fox","giraffe","grapes","guitar","hedgehog","house","kangaroo","key","lemon","lion","octopus","orange","owl","parrot","penguin","snail","spider","strawberry","sun","sunflower","tiger","tomato","whale","zebra"]);
function normalizeScanwordEntry(item){
  if(!item||typeof item!=="object")return null;
  const answer=String(item.answer||item.word||"").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
  const imageKey=SCANWORD_IMAGE_KEYS.has(String(item.imageKey||""))?String(item.imageKey):null;
  const rawClue=imageKey?"Что изображено на картинке?":String(item.emoji||item.flag||item.clue||item.question||item.clueShort||"").trim();
  const clue=compactScanwordClue(rawClue);
  const clueShort=imageKey?"Что изображено?":compactScanwordClue(item.clueShort||item.shortClue||clue);
  if(answer.length<1||answer.length>12||!clue)return null;
  return {answer,clue,clueShort,imageKey,key:answer.length===1?"letter:"+answer+":"+clue:answer,emoji:/[\u{1F1E6}-\u{1F1FF}\p{Extended_Pictographic}]/u.test(clue),logic:!!item.logic};
}
function buildScanword(entries,attemptLimit=16){
  const N=15,TOTAL=N*N;
  const normalized=entries.map(normalizeScanwordEntry).filter(Boolean);
  // Prefer meaningful, reasoning-oriented clues; keep emoji country clues in the same pool.
  const quality=entry=>{
    const words=entry.clue.split(/\s+/).filter(Boolean).length;
    let score=entry.logic?18:0;
    // Preserve the three distinct picture clues required in every puzzle.
    if(entry.imageKey)score+=1000;
    if(words>=6)score+=5;else if(words<=3&&!entry.emoji)score-=7;
    if(entry.clue.length>=42&&entry.clue.length<=150)score+=4;
    if(/сколько будет|чему равно|вычисли|посчитай/i.test(entry.clue))score-=30;
    // Prefer a precise definition over a fill-in-the-blank variant when the
    // same answer has both; the latter often makes neighboring clues alike.
    if(entry.clue.includes("…")||entry.clue.includes("..."))score-=35;
    // Single-letter answers are reserved for the final gap-repair pass only.
    if(entry.answer.length===1)score-=100;
    return score;
  };
  // Keep only the strongest clue for each answer. This prevents the same
  // word from entering the candidate pool with several near-duplicate prompts.
  const bestByAnswer=new Map();
  normalized.forEach(entry=>{
    const previous=bestByAnswer.get(entry.answer);
    if(!previous||quality(entry)>quality(previous))bestByAnswer.set(entry.answer,entry);
  });
  normalized.splice(0,normalized.length,...bestByAnswer.values());
  normalized.sort((a,b)=>quality(b)-quality(a));
  const byLength=new Map();
  normalized.forEach(entry=>{
    if(entry.answer.length<1)return;
    let positions=byLength.get(entry.answer.length);
    if(!positions){positions=Array.from({length:entry.answer.length},()=>new Map());byLength.set(entry.answer.length,positions)}
    for(let p=0;p<entry.answer.length;p++){
      const letter=entry.answer[p],bucket=positions[p].get(letter)||[];
      bucket.push(entry);positions[p].set(letter,bucket);
    }
  });
  const dirs=[{name:"right",dy:0,dx:1,arrow:"→"},{name:"left",dy:0,dx:-1,arrow:"←"},{name:"down",dy:1,dx:0,arrow:"↓"},{name:"up",dy:-1,dx:0,arrow:"↑"}];
  let bestCoverage=0,bestImageCount=-1,bestSingleCount=Infinity,best=null;
  const buildAttempt=()=>{
    const occupied=new Map(),clueAt=new Map(),used=new Set(),usedImages=new Set(),words=[],frontier=new Set();
    const addFrontier=(y,x)=>{
      for(const dir of dirs)for(let step=1;step<=12;step++){
        const ay=y-dir.dy*step,ax=x-dir.dx*step;
        if(ay<0||ax<0||ay>=N||ax>=N)break;
        const key=ay+","+ax;
        if(!occupied.has(key))frontier.add(key);
      }
    };
    const addWord=(entry,y,x,dirIndex,id,allowSeed=false,allowSingleFallback=false)=>{
      const dir=dirs[dirIndex],key=y+","+x,at=clueAt.get(key)||[];
      if(!entry||(!allowSingleFallback&&entry.answer.length===1)||used.has(entry.key)||(entry.imageKey&&(usedImages.has(entry.imageKey)||usedImages.size>=3))||at.length>=4||at.some(w=>w.dir===dir.name)||at.some(w=>w.imageKey)||((entry.imageKey)&&at.length>0)||occupied.has(key))return false;
      const cells=[];
      for(let k=1;k<=entry.answer.length;k++){
        const yy=y+dir.dy*k,xx=x+dir.dx*k;
        if(yy<0||xx<0||yy>=N||xx>=N)return false;
        const cellKey=yy+","+xx,old=occupied.get(cellKey);
        if(clueAt.has(cellKey)||(old!==undefined&&old!==entry.answer[k-1]))return false;
        cells.push([yy,xx]);
      }
      const crosses=cells.filter(cell=>occupied.has(cell.join(","))).length;
      if(words.length&&!crosses&&!allowSeed&&!(entry.answer.length===1&&at.length>0))return false;
      cells.forEach((cell,k)=>occupied.set(cell.join(","),entry.answer[k]));
      const word={id,answer:entry.answer,sourceAnswer:entry.answer,clue:entry.clue,clueShort:entry.clueShort,isEmoji:entry.emoji,imageKey:entry.imageKey||null,dir:dir.name,dirIndex,cells,clueCell:[y,x]};
      at.push(word);clueAt.set(key,at);frontier.add(key);
      cells.forEach(cell=>addFrontier(cell[0],cell[1]));
      used.add(entry.key);if(entry.imageKey)usedImages.add(entry.imageKey);words.push(word);
      return true;
    };
    // Two crossing seed words create the first connected component.
    const firstPool=normalized.filter(e=>e.answer.length>=5&&e.answer.length<=12);
    if(!firstPool.length)return null;
    // All five distinct picture clues must be inserted; selecting only one
    // image as the seed and hoping for four others produced repeated/missing art.
    const pictureSeeds=firstPool.filter(e=>e.imageKey);
    if(pictureSeeds.length<3)return null;
    const first=pictureSeeds[Math.floor(Math.random()*pictureSeeds.length)];
    const firstY=7,firstX=Math.floor((N-first.answer.length)/2);
    if(!addWord(first,firstY,firstX,0,"w0",true))return null;
    const seedChoices=[];
    for(let cross=0;cross<first.answer.length;cross++){
      const x=firstX+cross+1,letter=first.answer[cross];
      for(const e of normalized){
        if(e.answer===first.answer||e.answer.length<3)continue;
        for(let p=0;p<Math.min(7,e.answer.length);p++){
          if(e.answer[p]===letter&&firstY-p-1+e.answer.length<N)seedChoices.push({entry:e,x,y:firstY-p-1});
        }
      }
    }
    if(!seedChoices.length)return null;
    let seeded=false;
    seedChoices.sort((a,b)=>(Number(!!b.entry.imageKey)-Number(!!a.entry.imageKey))+(Math.random()-.5));
    for(const choice of seedChoices.slice(0,120)){
      if(addWord(choice.entry,choice.y,choice.x,2,"w1",true)){seeded=true;break}
    }
    if(!seeded)return null;
    for(let round=0;round<280&&occupied.size+clueAt.size<TOTAL;round++){
      const options=[];
      for(const clueKey of frontier){
        const [y,x]=clueKey.split(",").map(Number),at=clueAt.get(clueKey)||[];
        if(occupied.has(clueKey)||at.length>=4||at.some(w=>w.imageKey))continue;
        for(let di=0;di<4;di++){
          const dir=dirs[di];
          if(at.some(w=>w.dir===dir.name))continue;
          const max=dir.dy>0?N-1-y:dir.dy<0?y:dir.dx>0?N-1-x:x;
          for(let length=2;length<=Math.min(12,max);length++){
            const positions=byLength.get(length);if(!positions)continue;
            const possible=new Set();let availableCrosses=0;
            for(let p=0;p<length;p++){
              const yy=y+dir.dy*(p+1),xx=x+dir.dx*(p+1),old=occupied.get(yy+","+xx);
              if(old===undefined)continue;
              availableCrosses++;
              for(const entry of positions[p].get(old)||[])possible.add(entry);
            }
            if(!availableCrosses)continue;
            for(const entry of possible){
              if(used.has(entry.key)||(entry.imageKey&&(usedImages.has(entry.imageKey)||usedImages.size>=3||at.length>0)))continue;
              let valid=true,newCells=0,crosses=0;
              for(let p=0;p<length;p++){
                const yy=y+dir.dy*(p+1),xx=x+dir.dx*(p+1),cellKey=yy+","+xx,old=occupied.get(cellKey);
                if(clueAt.has(cellKey)||(old!==undefined&&old!==entry.answer[p])){valid=false;break}
                if(old===undefined)newCells++;else crosses++;
              }
              if(valid&&crosses)options.push({entry,y,x,di,score:newCells*8+crosses*8+Math.min(crosses,3)*2+length*.1+(entry.imageKey?1000:0)+Math.random()*3});
            }
          }
        }
      }
      if(!options.length)break;
      options.sort((a,b)=>b.score-a.score);
      const pool=options.slice(0,Math.min(18,options.length));
      const pick=pool[Math.floor(Math.random()*pool.length)];
      if(!addWord(pick.entry,pick.y,pick.x,pick.di,"w"+words.length))break;
    }
    // Repair residual gaps only with words that genuinely cross existing letters.
    // This keeps every added word in the same connected scanword component.
    let closing=true;
    while(closing&&occupied.size+clueAt.size<TOTAL){
      closing=false;
      const remaining=TOTAL-occupied.size-clueAt.size;
      const anchors=[];
      clueAt.forEach((list,key)=>{const [y,x]=key.split(",").map(Number);anchors.push({y,x,existing:true,list})});
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){
        const key=y+","+x;
        if(occupied.has(key)||clueAt.has(key))continue;
        const adjacent=[[y-1,x],[y+1,x],[y,x-1],[y,x+1]].some(([yy,xx])=>yy>=0&&xx>=0&&yy<N&&xx<N&&occupied.has(yy+","+xx));
        if(adjacent)anchors.push({y,x,existing:false,list:[]});
      }
      for(const anchor of anchors){
        if(closing)break;
        for(let di=0;di<4&&!closing;di++){
          const dir=dirs[di];
          if(anchor.list.some(w=>w.dir===dir.name))continue;
          const max=Math.min(12,dir.dy>0?N-1-anchor.y:dir.dy<0?anchor.y:dir.dx>0?N-1-anchor.x:anchor.x);
          for(let length=max;length>=1;length--){
            const cells=[];let valid=true,crosses=0;
            for(let k=1;k<=length;k++){
              const yy=anchor.y+dir.dy*k,xx=anchor.x+dir.dx*k,key=yy+","+xx;
              if(yy<0||xx<0||yy>=N||xx>=N||clueAt.has(key)){valid=false;break}
              if(occupied.has(key))crosses++;
              cells.push([yy,xx]);
            }
            if(!valid||(!crosses&&!(length===1&&anchor.existing)))continue;
            const positions=byLength.get(length);if(!positions)continue;
            const possible=new Set();
            cells.forEach((cell,k)=>{
              const old=occupied.get(cell.join(","));
              if(old!==undefined)for(const entry of positions[k].get(old)||[])possible.add(entry);
            });
            if(length===1&&!crosses&&anchor.existing){for(const bucket of positions[0].values())for(const entry of bucket)possible.add(entry)}
            const pool=[...possible].filter(entry=>!used.has(entry.key)&&cells.every((cell,k)=>{
              const old=occupied.get(cell.join(","));
              return old===undefined||old===entry.answer[k];
            }));
            if(!pool.length)continue;
            pool.sort((a,b)=>Number(!!b.imageKey)-Number(!!a.imageKey));
            const entry=pool[0];
            // A one-cell answer is allowed only here, after every longer fit has failed.
            if(addWord(entry,anchor.y,anchor.x,di,"w"+words.length,false,length===1)){closing=true;break}
          }
        }
      }
    }
    const coverage=occupied.size+clueAt.size;
    return {coverage,occupied,clueAt,words,used};
  };
  // Randomized restarts avoid the dead ends of a single greedy fill.
  for(let attempt=0;attempt<attemptLimit;attempt++){
    const result=buildAttempt();
    const imageCount=result?.words.filter(w=>w.imageKey).length||0;
    const singleCount=result?.words.filter(w=>w.answer.length===1).length||0;
    const better=result&&(imageCount>bestImageCount||(imageCount===bestImageCount&&result.coverage>bestCoverage)||(imageCount===bestImageCount&&result.coverage===bestCoverage&&singleCount<bestSingleCount));
    if(better){bestImageCount=imageCount;bestCoverage=result.coverage;bestSingleCount=singleCount;best=result;}
  }
  // If greedy placement leaves a single isolated gap, shift a crossing clue one cell
  // backward. The old final letter must be shared by another answer, so no occupied
  // cell is lost; the replacement answer is looked up by its matching suffix.
  if(best&&bestCoverage<TOTAL){
    let repaired=true;
    while(repaired&&best.coverage<TOTAL){
      repaired=false;
      const owners=new Map();
      best.words.forEach((word,index)=>word.cells.forEach(cell=>{
        const key=cell.join(","),set=owners.get(key)||new Set();
        set.add(index);owners.set(key,set);
      }));
      for(let gy=0;gy<N&&!repaired;gy++)for(let gx=0;gx<N&&!repaired;gx++){
        const gapKey=gy+","+gx;
        if(best.occupied.has(gapKey)||best.clueAt.has(gapKey))continue;
        for(let di=0;di<dirs.length&&!repaired;di++){
          const dir=dirs[di],ay=gy+dir.dy,ax=gx+dir.dx;
          if(ay<0||ax<0||ay>=N||ax>=N)continue;
          const anchorKey=ay+","+ax,at=best.clueAt.get(anchorKey)||[];
          if(at.length!==1)continue;
          const word=at[0],length=word.answer.length;
          if(word.imageKey||word.dirIndex!==di||length<2)continue;
          const lastKey=word.cells[length-1].join(",");
          if((owners.get(lastKey)?.size||0)<2)continue;
          if(!word.cells.slice(0,-1).some(cell=>(owners.get(cell.join(","))?.size||0)>1))continue;
          const candidates=byLength.get(length)?.[1]?.get(word.answer[0])||[];
          const replacement=candidates.find(entry=>
            !entry.imageKey&&
            !best.used.has(entry.key)&&
            entry.answer.slice(1)===word.answer.slice(0,-1)
          );
          if(!replacement)continue;
          const oldAnswer=word.answer;
          best.used.delete(oldAnswer);
          best.used.add(replacement.key);
          word.answer=replacement.answer;
          word.sourceAnswer=replacement.answer;
          word.clue=replacement.clue;
          word.clueShort=replacement.clueShort;
          word.isEmoji=replacement.emoji;
          word.imageKey=replacement.imageKey||null;
          word.clueCell=[gy,gx];
          word.cells=[[ay,ax],...word.cells.slice(0,-1)];
          best.occupied.set(anchorKey,replacement.answer[0]);
          best.clueAt.delete(anchorKey);
          best.clueAt.set(gapKey,[word]);
          best.coverage=best.occupied.size+best.clueAt.size;
          repaired=true;
          bestCoverage=best.coverage;
        }
      }
    }
  }
  if(!best||bestCoverage!==TOTAL||bestImageCount!==3)throw new Error("Не удалось собрать полностью заполненный сканворд с тремя разными картинками (лучший результат: "+bestCoverage+"/225, картинок: "+Math.max(0,bestImageCount)+"/3). Повтори генерацию.");
  const clueKeys=new Set(best.clueAt.keys()),occupied=best.occupied;
  for(const key of clueKeys)if(occupied.has(key))throw new Error("Вопрос и ответ наложились в клетке "+key);
  if(occupied.size+clueKeys.size!==TOTAL)throw new Error("Проверка заполнения не пройдена");
  return {id:"scanword-"+Date.now(),title:"Сканворд",w:N,h:N,words:best.words,used:new Set(occupied.keys()),clueKeys,coverage:1};
}
function clonePreparedScanword(source){
  return {id:"scanword-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:"Сканворд",w:source.w,h:source.h,words:source.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(source.used instanceof Set?source.used:[...(source.used||[])]),clueKeys:new Set(source.clueKeys instanceof Set?source.clueKeys:[...(source.clueKeys||[])]),coverage:source.coverage};
}
function takePackedScanword(){
  if(!scanwordPuzzlePack.length)return null;
  if(!scanwordPackOrder.length){
    scanwordPackOrder=Array.from({length:scanwordPuzzlePack.length},(_,i)=>i);
    for(let i=scanwordPackOrder.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [scanwordPackOrder[i],scanwordPackOrder[j]]=[scanwordPackOrder[j],scanwordPackOrder[i]];
    }
  }
  return clonePreparedScanword(scanwordPuzzlePack[scanwordPackOrder.pop()]);
}
function refreshPracticeButton(){
  const button=$("#practice");
  if(!button)return;
  button.disabled=scanwordPreparing;
  button.textContent=scanwordPreparing?"Готовим поле…":preparedScanword?"Играть одному":"Повторить подготовку";
}
function prepareNextScanword(){
  if(preparedScanword)return Promise.resolve(preparedScanword);
  if(scanwordPreparePromise)return scanwordPreparePromise;
  const dictionary=getScanwordDictionary();
  if(!dictionary.length)return Promise.resolve(null);
  scanwordPreparing=true;
  refreshPracticeButton();
  scanwordPreparePromise=new Promise(resolve=>{
    setTimeout(()=>{
      try{preparedScanword=takePackedScanword()||buildScanword(dictionary)}
      catch(error){console.warn("QQCross: фоновая подготовка сканворда:",error);preparedScanword=null}
      finally{
        scanwordPreparing=false;
        scanwordPreparePromise=null;
        refreshPracticeButton();
        resolve(preparedScanword);
      }
    },40);
  });
  return scanwordPreparePromise;
}
function makeRandomPuzzle(){
  Object.keys(expected).forEach(k=>delete expected[k]);
  const built=preparedScanword?clonePreparedScanword(preparedScanword):buildScanword(getScanwordDictionary());
  preparedScanword=null;
  if(!built){puzzle=null;letterBag=[];prepareNextScanword();return false}
  puzzle=built;
  puzzle.words.forEach(w=>w.cells.forEach((c,i)=>{
    const key=c.join(","),letter=w.answer[i];
    if(expected[key]!==undefined&&expected[key]!==letter)throw new Error("Конфликт букв в ответах");
    expected[key]=letter;
  }));
  letterBag=Object.values(expected);
  for(let i=letterBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letterBag[i],letterBag[j]]=[letterBag[j],letterBag[i]]}
  prepareNextScanword();
  return true;
}
function loadPuzzle(){return makeRandomPuzzle()}


async function startChatGPTGame(button){
  if(!supabaseClient){toast("Не удалось подключиться к серверу игры.");return}
  if(button){button.disabled=true;button.textContent="Подключаем ChatGPT…"}
  try{
    const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session){
      const {error}=await supabaseClient.auth.signInAnonymously();
      if(error)throw error;
    }
    await begin(2,true);
  }catch(error){
    console.error("QQCross ChatGPT sign-in:",error);
    toast(error.message||"Не удалось подготовить защищённую сессию для ChatGPT.");
  }finally{
    if(button){button.disabled=false;button.textContent="Играть с ChatGPT"}
  }
}
async function runChatGPTTurn(root,turnKey){
  if(!state.aiMatch||state.turn!==1||state.screen!=="game")return;
  try{
    const words=puzzle.words.filter(w=>!state.completed.has(w.id)&&!w.imageKey).map(w=>({id:String(w.id),clue:String(w.clue||w.clueShort||""),length:w.cells.length}));
    const {data,error}=await supabaseClient.functions.invoke("qqcross-ai-turn",{
      body:{rack:[...(state.playerRacks[1]||[])],words,completed:[...(state.completed||[])]}
    });
    if(error){let message=error.message||"Не удалось связаться с сервером ChatGPT.";try{const payload=await error.context?.json();if(payload?.error)message=payload.error}catch{}throw new Error(message)}
    if(!data||data.error)throw new Error(data?.error||"Сервер не вернул ход ChatGPT.");
    if(state.screen!=="game"||!state.aiMatch||state.turn!==1||String(state.round||1)+":1"!==turnKey)return;
    const word=puzzle.words.find(w=>String(w.id)===String(data.wordId));
    const answer=String(data.answer||"").toUpperCase().replace(/Ё/g,"Е");
    if(word&&answer){
      const actual=word.cells.map(([y,x])=>String(expected[y+","+x]||"")).join("").toUpperCase().replace(/Ё/g,"Е");
      if(answer===actual){
        const rack=state.playerRacks[1]||[];
        const used=[];
        word.cells.forEach(([y,x],i)=>{
          const key=y+","+x;
          if(state.filled[key])return;
          const letter=actual[i];
          const index=rack.findIndex((value,j)=>!used.includes(j)&&String(value).toUpperCase().replace(/Ё/g,"Е")===letter);
          if(index>=0){used.push(index);state.pendingMoves.push({k:key,l:rack[index]})}
        });
        used.sort((x,y)=>y-x).forEach(index=>rack.splice(index,1));
        state.playerRacks[1]=rack;state.letters=rack;
      }
    }
    state.aiThinkingTurn=null;
    state.aiError="";
    await finishTurn(root);
  }catch(error){
    console.error("QQCross ChatGPT turn:",error);
    if(state.screen!=="game"||state.turn!==1)return;
    state.aiThinkingTurn=null;
    state.aiError=error.message||"Не удалось получить ход ChatGPT.";
    renderGame(root);
  }
}

async function begin(size=1,chatGPT=false){
  const qqDebugTiming=new URLSearchParams(location.search).has("debugTiming");
  const qqStartTime=performance.now();
  let qqGenerationMs=0;
  const playButton=$("#practice");
  if(playButton){playButton.disabled=true;playButton.textContent="Собираем сканворд…"}
  try{
    if(!Array.isArray(window.QQCROSS_DICTIONARY)||!window.QQCROSS_DICTIONARY.length){
      await preloadScanwordDictionary();
    }
    if(!Array.isArray(window.QQCROSS_DICTIONARY)||!window.QQCROSS_DICTIONARY.length){
      throw new Error("Не загрузился словарь сканворда. Проверь интернет и нажми «Играть одному» ещё раз.");
    }
    if(!preparedScanword)await prepareNextScanword();
    if(!preparedScanword)throw new Error("Не удалось подготовить сканворд. Нажми «Повторить подготовку».");
    let loaded=false,lastError=null;
    for(let attempt=0;attempt<2&&!loaded;attempt++){
      try{loaded=!!loadPuzzle()}catch(error){lastError=error;console.error("QQCross: puzzle start failed",error)}
    }
    qqGenerationMs=performance.now()-qqStartTime;
    if(!loaded)throw lastError||new Error("Не удалось собрать полностью заполненное поле 15×15. Попробуй ещё раз.");
    state.screen="game";state.partySize=size;state.aiMatch=!!chatGPT;state.aiThinkingTurn=null;state.aiError="";state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;
    state.onlineMatchId=null;state.onlinePlayers=[];state.onlineVersion=0;state.onlineFinished=false;state.completed=new Set();state.rewardSubmitted=false;state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=90;state.turnDeadlineAt=Date.now()+90000;
    state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(7));state.letters=state.playerRacks[0];ensureWordLetter(0);state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";state.rackNewIndices=state.partySize===1?[0,1,2,3,4,5,6]:[];state.wordFlashKeys=new Set();state.pendingMoves=[];state.matchId="match-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
    pushGameHistoryEntry();render();if(qqDebugTiming)window.__qqcrossTiming={generationMs:Math.round(qqGenerationMs),totalMs:Math.round(performance.now()-qqStartTime)};if(state.rackNewIndices.length){clearTimeout(state.rackAnimationTimer);state.rackAnimationTimer=setTimeout(()=>{state.rackNewIndices=[];if(state.screen==="game")render()},520)}
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
  const aiTurn=!!state.aiMatch&&state.turn===1;
  const onlineIsMyTurn=(!state.onlineMatchId||state.onlinePlayers[state.turn]?.id===state.profile?.id)&&!aiTurn;
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map();puzzle.words.forEach(w=>{const key=w.clueCell.join(","),list=clueAt.get(key)||[];list.push(w);clueAt.set(key,list)});
  const activeWord=puzzle.words.find(w=>w.id===state.selectedWord&&!state.completed?.has(w.id))||puzzle.words.find(w=>!state.completed?.has(w.id))||puzzle.words[0];
  state.selectedWord=activeWord?.id||"";
  const activeWordCells=new Set((activeWord?.cells||[]).map(c=>c.join(",")));
  const wordEnds=new Map();
  puzzle.words.forEach(w=>{const last=w.cells[w.cells.length-1];if(!last)return;const k=last.join(",");const dirs=wordEnds.get(k)||[];dirs.push(w.dir);wordEnds.set(k,dirs)});
  const cells=[];
  for(let y=0;y<puzzle.h;y++)for(let x=0;x<puzzle.w;x++){
    const key=y+","+x,wordsAt=clueAt.get(key),position=' style="grid-column:'+(x+1)+';grid-row:'+(y+1)+'"';
    if(wordsAt){
      const arrows=wordsAt.map(w=>'<span class="scan-arrow scan-arrow-'+w.dir+'">'+({right:"→",left:"←",down:"↓",up:"↑"}[w.dir])+'</span>').join("");
      const displayWord=wordsAt.find(w=>w.id===activeWord?.id)||wordsAt.find(w=>!state.completed?.has(w.id))||wordsAt[0];
      const single=displayWord&&!displayWord.imageKey?fitScanwordClue(displayWord.clueShort||displayWord.clue):"";
      const fullClueTitle=wordsAt.map((w,i)=>"Вопрос "+(i+1)+": "+w.clue).join(" | ");
      const picture=wordsAt.length===1&&wordsAt[0].imageKey?'<img class="scan-clue-image" src="./assets/scanword/'+esc(wordsAt[0].imageKey)+'.svg" alt="'+esc(wordsAt[0].answer)+'" loading="eager" decoding="async">':'<span class="scan-clue-text">'+esc(single)+'</span>';
      const clueTitle=wordsAt.length===1&&wordsAt[0].imageKey?"Что изображено на картинке?":fullClueTitle;
      cells.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+(wordsAt.some(w=>w.id===activeWord?.id)?' scan-clue-active':'')+' '+(wordsAt.length>1?"scan-clue-multi":"")+(wordsAt.length===1&&wordsAt[0].isEmoji?' scan-clue-emoji':'')+(wordsAt.length===1&&wordsAt[0].imageKey?' scan-clue-picture':'')+'" data-clue-cell="'+key+'" title="'+esc(clueTitle)+'" aria-label="'+esc(clueTitle)+'"'+position+'>'+picture+arrows+label+'</button>');
    }else if(expected[key]!==undefined){
      const value=state.filled[key]||pending[key]||"";
      const hint=state.hints?.[key]||"";
      const wordFlash=state.wordFlashKeys?.has(key);
      const endClass=(wordEnds.get(key)||[]).map(dir=>"answer-end-"+dir).join(" ");
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(hint?" hinted-cell":"")+(state.feedback[key]==="wrong"?" wrong":"")+(state.feedback[key]==="correct"?" correct":"")+(wordFlash?" word-complete-flash":"")+(activeWordCells.has(key)?" active-word-cell":"")+(endClass?" "+endClass:"");
      const letterMarkup=value?'<span class="cell-letter">'+esc(value)+'</span>':hint?'<span class="hint-letter" aria-hidden="true">'+esc(hint)+'</span>':'';
      cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква в слове"'+position+'>'+letterMarkup+'</button>');
    }else cells.push('<div class="scan-cell scan-grid-cell scan-filler" aria-hidden="true"'+position+'></div>');
  }
  const names=Array.from({length:state.partySize},(_,i)=>state.onlineMatchId?(state.onlinePlayers[i]?.username||("Игрок "+(i+1))):(i===0?"Ты":state.aiMatch?"ChatGPT":"Игрок "+(i+1)));
  const scores=names.map((n,i)=>'<span class="'+(i===state.turn?'active-player':'')+'">'+esc(n)+': '+((state.playerScores||[])[i]||0)+'</span>').join("");
  const activeDirection=activeWord?({right:"вправо",left:"влево",down:"вниз",up:"вверх"}[activeWord.dir]||""):"";
  const activeLength=activeWord?.answer?.length||0;
  const questionList=puzzle.words.map((word,index)=>'<button type="button" class="scanword-question-item '+(word.id===activeWord?.id?'active':'')+(state.completed?.has(word.id)?' done':'')+'" data-word-clue="'+esc(word.id)+'"><span class="scanword-question-index">'+(index+1)+'</span><span class="scanword-question-short">'+esc(word.clueShort||word.clue)+'</span><span class="scanword-question-status">'+(state.completed?.has(word.id)?'✓':({right:'→',left:'←',down:'↓',up:'↑'}[word.dir]||''))+'</span></button>').join("");
  root.innerHTML='<div class="screen game-screen '+(aiTurn?"ai-opponent-turn":"")+'"><div class="top game-topbar"><span class="small muted">Прогресс сохраняется автоматически</span>'+(state.onlineMatchId?'<button type="button" class="btn delete-online-game" id="deleteOnlineMatch">Удалить бой</button>':'')+'</div>'+
    '<div class="score-strip">'+scores+'</div>'+(state.aiMatch?'<div class="ai-turn-status" id="aiTurnStatus">'+(aiTurn?(state.aiError?'<span>'+esc(state.aiError)+'</span> <button class="btn" id="retryAI">Повторить ход</button>':'ChatGPT выбирает вопрос и делает ход…'):'Твой ход — выбери вопрос слева.')+'</div>':'')+
    '<div class="scanword-play-area"><aside class="scanword-questions" aria-label="Вопросы сканворда"><div class="scanword-question-current"><div class="scanword-question-kicker">ТЕКУЩИЙ ВОПРОС</div><div class="scanword-question-full">'+(activeWord?(activeWord.imageKey?'Что изображено на картинке?':esc(activeWord.clue)):'Все вопросы решены')+'</div><div class="scanword-question-meta">'+(activeWord?((activeDirection?activeDirection+" · ":"")+"Ответ: "+activeLength+" "+(activeLength===1?"буква":activeLength<5?"буквы":"букв")):"Отличная работа!")+'</div></div><div class="scanword-question-list">'+questionList+'</div></aside><div class="board-wrap scanword-wrap"><div class="scanword-board">'+cells.join("")+'</div></div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+state.letters.map((l,i)=>'<button class="letter '+(state.selectedLetter===i?'selected':'')+(state.rackNewIndices?.includes(i)?' letter-enter':'')+'" data-letter="'+i+'">'+esc(l)+'</button>').join("")+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button><button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button><button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><span class="timer" id="timer">⏱ '+state.seconds+'</span></div></div></div>';
  const deleteOnlineButton=root.querySelector("#deleteOnlineMatch");
  if(deleteOnlineButton)deleteOnlineButton.onclick=async()=>{
    const id=state.onlineMatchId;if(!id)return;
    if(!confirm("Удалить дружеский бой? Если ты создал его — он исчезнет у всех. Если ты участник — ты выйдешь из него."))return;
    deleteOnlineButton.disabled=true;deleteOnlineButton.textContent="Удаляем…";
    try{
      const {data,error}=await supabaseClient.rpc("delete_qqcross_match",{target_match_id:id});if(error)throw error;
      clearInterval(state.interval);clearInterval(partyRefreshTimer);
      if(onlineChannel){await supabaseClient.removeChannel(onlineChannel);onlineChannel=null;onlineChannelId=null}
      state.onlineMatchId=null;state.matchId=null;state.onlinePlayers=[];state.onlineVersion=0;state.onlineFinished=false;state.pendingMatchId=null;
      state.screen="";state.tab="Главная";state.turn=0;state.pendingMoves=[];render();
      toast(data==="deleted"?"Дружеский бой удалён":data==="left"?"Ты вышел из дружеского боя":"Бой уже не найден");
    }catch(error){toast(error.message||"Не удалось удалить бой");deleteOnlineButton.disabled=false;deleteOnlineButton.textContent="Удалить бой"}
  };
  root.querySelectorAll("[data-word-clue]").forEach(button=>{
    button.onclick=()=>{
      const word=puzzle.words.find(item=>item.id===button.dataset.wordClue);
      if(!word)return;
      state.selectedWord=word.id;
      renderGame(root);
    };
  });
  root.querySelectorAll("[data-clue-cell]").forEach(button=>{
    button.onclick=()=>{
      const wordsAt=clueAt.get(button.dataset.clueCell)||[];
      if(!wordsAt.length)return;
      const next=wordsAt.find(word=>!state.completed?.has(word.id))||wordsAt[0];
      state.selectedWord=next.id;
      renderGame(root);
    };
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
  if(aiTurn&&state.aiError){const retry=root.querySelector("#retryAI");if(retry)retry.onclick=()=>{state.aiError="";state.aiThinkingTurn=null;renderGame(root)}}
  if(aiTurn&&!state.aiError){const turnKey=String(state.round||1)+":"+state.turn;if(state.aiThinkingTurn!==turnKey){state.aiThinkingTurn=turnKey;runChatGPTTurn(root,turnKey)}}
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
    id,status,updatedAt:Date.now(),label:state.aiMatch?"Сканворд с ChatGPT":state.partySize>1?"Партия с друзьями · "+state.partySize+" игрока":"Одиночный сканворд",aiMatch:!!state.aiMatch,
    puzzle:{id:puzzle.id,title:puzzle.title,w:puzzle.w,h:puzzle.h,words:puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c])}))},
    expected:{...expected},letterBag:[...letterBag],
    game:{
      partySize:state.partySize,aiMatch:!!state.aiMatch,filled:{...state.filled},owners:{...state.owners},feedback:{...state.feedback},hints:{...state.hints},
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
    screen:"game",matchId:match.id,partySize:g.partySize||1,aiMatch:!!g.aiMatch,aiThinkingTurn:null,aiError:"",filled:{...(g.filled||{})},owners:{...(g.owners||{})},
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
function preloadScanwordPuzzlePack(){
  if(scanwordPuzzlePack.length)return Promise.resolve(true);
  if(scanwordPackLoadPromise)return scanwordPackLoadPromise;
  scanwordPackLoadPromise=fetch("./data/scanword-puzzles.json?v=20261108-pack-v1",{cache:"no-store"})
    .then(response=>{if(!response.ok)throw new Error("Пакет сканвордов: HTTP "+response.status);return response.json()})
    .then(data=>{
      if(data?.version!==1||!Array.isArray(data.puzzles)||data.puzzles.length<20)throw new Error("Некорректный пакет сканвордов");
      const valid=data.puzzles.filter(p=>p&&p.w===15&&p.h===15&&Array.isArray(p.words)&&p.words.length>=10&&Array.isArray(p.used)&&Array.isArray(p.clueKeys)&&p.used.length+p.clueKeys.length===225);
      if(valid.length<20)throw new Error("В пакете недостаточно полных сканвордов");
      scanwordPuzzlePack=valid;
      scanwordPackOrder=[];
      return true;
    })
    .catch(error=>{console.warn("QQCross scanword pack:",error);scanwordPackLoadPromise=null;return false});
  return scanwordPackLoadPromise;
}
function preloadScanwordDictionary(){
  if(Array.isArray(window.QQCROSS_DICTIONARY)&&window.QQCROSS_DICTIONARY.length)return Promise.resolve(true);
  if(dictionaryLoadPromise)return dictionaryLoadPromise;
  dictionaryLoadPromise=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const version="20261107-picture5-v6";
      const dictionaryResponse=await fetch("./data/scanword-dictionary.json?v="+version,{signal:controller.signal,cache:"no-store"});
      if(!dictionaryResponse.ok)throw new Error("Словарь: HTTP "+dictionaryResponse.status);
      const dictionary=await dictionaryResponse.json();
      if(!Array.isArray(dictionary)||!dictionary.length)throw new Error("Некорректный словарь сканвордов");
      window.QQCROSS_DICTIONARY=dictionary;
      await preloadScanwordPuzzlePack();
      prepareNextScanword();
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
