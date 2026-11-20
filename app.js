/* QQCross full-spectrum dark palette system. */
const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const NAMES=["Котик","Енот","Собачка","Лев","Тигр","Скунс","Клоун","Змея","Красный дракон","Оранжевый дракон"];
const $=s=>document.querySelector(s);
const STORE_KEY="qqcross_profile_v2";
const THEME_KEY="qqcross_theme_v1";
const MATCHES_KEY="qqcross_local_matches_v1";
const THEME_PRESETS=[
 ["burgundy","Тёмная вишня","Глубокий вишнёвый"],["crimson","Гранат","Насыщенный рубиновый"],["ember","Терракота","Тёплая медь"],
 ["amber","Янтарь","Золотистый янтарь"],["olive","Олива","Тёмный оливковый"],["forest","Хвойный лес","Глубокий зелёный"],
 ["emerald","Изумруд","Холодный изумрудный"],["teal","Бирюза","Зелёно-бирюзовый"],["lagoon","Лагуна","Сине-бирюзовый"],
 ["ocean","Океан","Глубокий морской"],["sapphire","Сапфир","Насыщенный синий"],["indigo","Индиго","Сине-фиолетовый"],
 ["purple","Слива","Мягкий сливовый"],["violet","Аметист","Выразительный фиолетовый"],["plum","Тёмная слива","Пурпурный"],
 ["orchid","Орхидея","Глубокий ягодный"],["graphite","Графит","Серебристо-графитовый"]
];
const THEME_IDS=new Set(THEME_PRESETS.map(([id])=>id));
let activeTheme=(()=>{try{
 const saved=localStorage.getItem(THEME_KEY);
 if(saved==="light"&&localStorage.getItem("qqcross_appearance_mode_v1")===null)localStorage.setItem("qqcross_appearance_mode_v1","light");
 const migrated=saved==="black"?"graphite":saved==="dark"?"purple":saved==="light"?"burgundy":saved;
 const theme=THEME_IDS.has(migrated)?migrated:"burgundy";
 if(saved&&saved!==theme)localStorage.setItem(THEME_KEY,theme);
 return theme;
}catch{return "burgundy"}})();
function applyTheme(theme=activeTheme){
 const root=document.documentElement,previousTheme=root.dataset.qqTheme;
 activeTheme=THEME_IDS.has(theme)?theme:"burgundy";
 const appearance=localStorage.getItem("qqcross_appearance_mode_v1")==="light"?"light":"dark";
 root.dataset.qqTheme=activeTheme;root.dataset.qqMode=appearance;root.style.colorScheme=appearance;
 try{localStorage.setItem(THEME_KEY,activeTheme)}catch{}
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta){const base=getComputedStyle(root).getPropertyValue("--qq-base").trim();meta.setAttribute("content",appearance==="light"?"#f1f7fb":(base||"#190910"))}
 const reduceMotion=root.dataset.qqReduceMotion==="true"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
 if(previousTheme&&previousTheme!==activeTheme&&!reduceMotion){
  root.classList.remove("qq-theme-transition");void root.offsetWidth;root.classList.add("qq-theme-transition");
  window.clearTimeout(root._qqThemeTransitionTimer);
  root._qqThemeTransitionTimer=window.setTimeout(()=>root.classList.remove("qq-theme-transition"),520);
 }
}
applyTheme(activeTheme);
const BACKGROUNDS=[["misty-forest","Туманный лес","nature"],["sakura-dawn","Монохромная сакура","nature"],["starry-night","Звёздная ночь","nature"],["autumn-grove","Осенняя роща","nature"],["winter-pines","Зимние ели","nature"],["mountain-lake","Горное озеро","nature"],["ocean-shore","Морской берег","nature"],["spring-rain","Весенний дождь","nature"],["golden-dusk","Золотые сумерки","nature"],["coral-sunset","Коралловый закат","nature"],["desert-dawn","Рассвет в пустыне","nature"],["waterfall","Тихий водопад","nature"],["blue-orbits","Синие орбиты","abstract"],["mint-mist","Мятный туман","abstract"],["peach-light","Персиковый свет","abstract"],["lagoon-glow","Бирюзовая лагуна","abstract"],["warm-amber","Тёплый янтарь","abstract"],["ink-night","Чернильная ночь","abstract"],["rose-quartz","Розовый кварц","abstract"],["watercolor","Акварель","abstract"]];
const BACKGROUND_KEY="qqcross_background_v1";
let abstractEnabled=true;
let activeBackground=(()=>{try{const v=localStorage.getItem(BACKGROUND_KEY);return BACKGROUNDS.some(x=>x[0]===v)?v:"misty-forest"}catch{return "misty-forest"}})();
function applyBackground(value=activeBackground){const candidate=BACKGROUNDS.some(x=>x[0]===value)?value:"misty-forest";activeBackground=!abstractEnabled&&BACKGROUNDS.find(x=>x[0]===candidate)?.[2]==="abstract"?"misty-forest":candidate;document.documentElement.dataset.qqBackground=activeBackground;try{localStorage.setItem(BACKGROUND_KEY,activeBackground)}catch{}}
applyBackground();
const AMBIENCE_KEY="qqcross_ambience_v1";
let activeAmbience=(()=>{try{const v=localStorage.getItem(AMBIENCE_KEY);return ["forest","sakura","autumn","rain","fireflies","stars","fog","none"].includes(v)?v:"forest"}catch{return "forest"}})();
function applyAmbience(value=activeAmbience){
  activeAmbience=["forest","sakura","autumn","rain","fireflies","stars","fog","none"].includes(value)?value:"forest";
  document.documentElement.dataset.qqAmbience=activeAmbience;
  try{localStorage.setItem(AMBIENCE_KEY,activeAmbience)}catch{}
}
applyAmbience();
// Restore accessibility preferences on every launch, not only after changing the controls.
document.documentElement.dataset.qqFontSize=localStorage.getItem("qqcross_font_size")||"normal";
document.documentElement.dataset.qqReduceMotion=localStorage.getItem("qqcross_reduce_motion")==="true"?"true":"false";
function avatarStorageKey(){return "qqcross_avatar_image_"+String(state.profile?.id||"guest");}
function getAvatarImage(){try{const v=localStorage.getItem(avatarStorageKey());return v&&/^data:image\/(webp|png|jpeg);base64,/.test(v)?v:"";}catch{return "";}}
function currentPlayerProfile(){
 const progress=window.QQProgression?.get?.()||{};
 const image=state.profile?.avatarUrl||state.profile?.avatar_url||getAvatarImage();
 let frame=state.profile?.frameId||state.profile?.frame_id||"classic";
 try{frame=localStorage.getItem("qqcross_frame_"+String(state.profile?.id||"guest"))||frame}catch{}
 return {...(state.profile||{}),avatarUrl:image,avatar_url:image,frameId:frame,frame_id:frame,activeTitle:progress.activeTitle||state.profile?.activeTitle||state.profile?.active_title||"Новичок",active_title:progress.activeTitle||state.profile?.activeTitle||state.profile?.active_title||"Новичок"};
}
function syncQQCrossPlayerProfile(){
 if(!state.profile)return;
 window.QQCrossPlayerProfile=currentPlayerProfile();
}
function avatarMarkup(size=""){
 const player=currentPlayerProfile();
 if(window.QQPlayerUI?.renderAvatar)return window.QQPlayerUI.renderAvatar(player,size==="big"?"lg":size==="small"?"sm":"md");
 const image=getAvatarImage();
 return image?'<img class="qq-avatar-image '+size+'" src="'+image+'" alt="Моя аватарка">':(AVATARS[state.profile?.avatar]||"🐱");
}
function playerCardMarkup(player,score,meta,compact=false){
 const p={...player,username:player.username||player.nickname||"Игрок"};
 if(window.QQPlayerUI?.renderCard)return window.QQPlayerUI.renderCard(p,{score,meta,compact,size:compact?"sm":"md"});
 return '<div class="qq-player-card"><span class="avatar">'+(AVATARS[p.avatar]||"🐱")+'</span><span class="qq-player-copy"><b>'+esc(p.username)+'</b><small class="qq-player-title">Новичок</small></span>'+(score!==undefined?'<strong>'+esc(score)+'</strong>':"")+'</div>';
}
async function hydratePublicProfiles(players=[]){
 const rows=Array.isArray(players)?players:[];
 const ids=[...new Set(rows.map(p=>p.id||p.user_id).filter(Boolean))];
 if(!ids.length||!supabaseClient)return rows;
 let profiles=[];
 try{
  const result=await supabaseClient.from("profiles").select("id,username,avatar,avatar_url,frame_id,active_title,wins,games,points").in("id",ids);
  if(result.error)throw result.error;
  profiles=result.data||[];
 }catch(error){
  try{const result=await supabaseClient.from("profiles").select("id,username,avatar,wins,games,points").in("id",ids);if(!result.error)profiles=result.data||[]}catch{}
 }
 const byId=new Map(profiles.map(p=>[String(p.id),p]));
 return rows.map(row=>({...row,...(byId.get(String(row.id||row.user_id))||{}),id:row.id||row.user_id,username:row.username||row.nickname||byId.get(String(row.id||row.user_id))?.username}));
}
function showPlayerProfile(player){
 const id=player?.id||player?.user_id;
 const draw=async()=>{
  let p={...player};
  if(id&&supabaseClient){
   try{const q=await supabaseClient.from("profiles").select("id,username,avatar,avatar_url,frame_id,active_title,wins,games,points,created_at").eq("id",id).maybeSingle();if(q.error)throw q.error;if(q.data)p={...p,...q.data}}
   catch{try{const q=await supabaseClient.from("profiles").select("id,username,avatar,wins,games,points,created_at").eq("id",id).maybeSingle();if(q.data)p={...p,...q.data}}catch{}}
  }
  const games=Number(p.games)||0,wins=Number(p.wins)||0,rate=games?Math.round(wins/games*100):0;
  const modal=document.createElement("div");modal.className="qq-profile-modal-backdrop";
  modal.innerHTML='<section class="qq-profile-modal" role="dialog" aria-modal="true" aria-label="Профиль игрока"><button class="btn full" type="button" data-profile-close>Закрыть</button><div class="qq-profile-identity">'+(window.QQPlayerUI?.renderAvatar?window.QQPlayerUI.renderAvatar(p,"lg"):'<span class="avatar big">'+(AVATARS[p.avatar]||"🐱")+'</span>')+'<span class="qq-player-copy"><b>'+esc(p.username||p.nickname||"Игрок")+'</b><small class="qq-player-title">'+esc(p.active_title||"Новичок")+'</small></span></div><div class="qq-profile-stats"><div class="qq-profile-stat"><b>'+games+'</b><small>Матчей</small></div><div class="qq-profile-stat"><b>'+wins+'</b><small>Побед</small></div><div class="qq-profile-stat"><b>'+Math.max(0,games-wins)+'</b><small>Поражений</small></div><div class="qq-profile-stat"><b>'+rate+'%</b><small>Побед</small></div><div class="qq-profile-stat"><b>'+Number(p.points||0)+'</b><small>Очков</small></div></div></section>';
  modal.querySelector("[data-profile-close]").onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};document.body.append(modal);
 };
 draw();
}
async function saveAvatarFile(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast("Выбери изображение PNG, JPG или WebP.");return}
 if(file.size>8*1024*1024){toast("Изображение должно быть меньше 8 МБ.");return}
 const reader=new FileReader();
 reader.onload=()=>{
  const image=new Image();
  image.onload=async()=>{
   const side=256,canvas=document.createElement("canvas");canvas.width=side;canvas.height=side;
   const ctx=canvas.getContext("2d"),crop=Math.min(image.width,image.height),sx=(image.width-crop)/2,sy=(image.height-crop)/2;
   ctx.drawImage(image,sx,sy,crop,crop,0,0,side,side);
   try{
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.82));
    if(!blob)throw new Error("Не удалось обработать изображение");
    const localData=canvas.toDataURL("image/webp",.82);
    localStorage.setItem(avatarStorageKey(),localData);
    state.profile.avatarUrl=localData;state.profile.avatar_url=localData;
    let cloudSaved=false;
    if(supabaseClient&&state.profile?.id&&!String(state.profile.id).startsWith("local-")){
     try{
      const path=String(state.profile.id)+"/avatar.webp";
      const upload=await supabaseClient.storage.from("qqcross-avatars").upload(path,blob,{upsert:true,contentType:"image/webp",cacheControl:"3600"});
      if(upload.error)throw upload.error;
      const publicUrl=supabaseClient.storage.from("qqcross-avatars").getPublicUrl(path).data?.publicUrl;
      if(publicUrl){
       const update=await supabaseClient.from("profiles").update({avatar_url:publicUrl}).eq("id",state.profile.id);
       if(update.error)throw update.error;
       state.profile.avatarUrl=publicUrl;state.profile.avatar_url=publicUrl;cloudSaved=true;
      }
     }catch(error){console.warn("QQCross avatar cloud sync:",error)}
    }
    save();render();toast(cloudSaved?"Аватарка синхронизирована между устройствами.":"Аватарка сохранена на этом устройстве. Облачная синхронизация появится после настройки профиля.");
   }catch(error){toast(error.message||"Не удалось сохранить изображение. Попробуй файл поменьше.")}
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
const state={profile:null,tab:"Главная",screen:"",dailyMode:false,dailyScanwordDate:null,progressRecorded:false,selectedAvatar:0,selectedLetter:-1,selectedCell:null,selectedWord:"w1",letters:[],scores:0,turn:0,seconds:60,interval:null,filled:{},wrong:null,feedback:{},hints:{},loupeActive:false,completed:new Set(),partySize:2,inviteName:"",invite:null,playMenuOpen:false,aiMatch:false,aiThinkingTurn:null,aiError:"",matchInvites:[],myOnlineMatches:[],selectedInviteIds:[],pendingMatchId:null,partyRoomCode:null,partyRoomId:null,onlineMatchId:null,onlinePlayers:[],onlineVersion:0,onlineFinished:false,rewardSubmitted:false};
let puzzle=null;
const expected={};
let letterBag=[];
let scanwordCandidateCache=null;
let preparedScanword=null;
let scanwordPreparing=false;
let scanwordPreparePromise=null;
let draggingLetter=false;
let suppressCellClick=false;
let lastMatchPersistAt=0;


function defaultItems(){return {magnifier:5,clock:5,trash:5,bulb:5}}
function normalizeItems(items){const normalized={...defaultItems(),...(items||{})};for(const key of Object.keys(defaultItems()))if(!Number.isInteger(normalized[key])||normalized[key]<0)normalized[key]=0;return normalized}
function save(){if(state.profile){localStorage.setItem(STORE_KEY,JSON.stringify(state.profile));syncQQCrossPlayerProfile();window.QQProgression?.syncCloud?.().catch(e=>console.warn("QQCross progression sync:",e))}}
function toast(t){const el=document.createElement("div");el.className="toast";el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2300)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){clearInterval(state.interval);const root=$("#app");if(state.profile&&authRecoveryMode){renderRecovery(root);return}if(!state.profile&&authRestoreError){renderAuthRestore(root);return}if(!state.profile){renderRegister(root);return}if(state.screen==="game"){renderGame(root);return}if(state.screen==="party-game"){renderPartyGame(root);return}if(state.screen==="party-lobby"){renderPartyLobby(root);return}if(state.screen==="lobby"){renderLobby(root);return}if(state.screen==="wordle"){renderWordle(root);return}if(state.screen==="daily"){renderDaily(root);return}if(state.screen==="extra"){if(window.QQExtraGames)window.QQExtraGames.mount(root,state.extraMode,()=>{state.screen="";render()});else{root.innerHTML='<div class="screen"><p>Не удалось загрузить дополнительные игры.</p><button class="btn" id="extraBack">Назад</button></div>';$("#extraBack").onclick=()=>{state.screen="";render()}}return}renderShell(root)}
function renderPartyLobby(root){
 const game=state.partyGame==="qq-draw"?"qq-draw":"team-word";
 const title=game==="qq-draw"?"QQ Draw":"Team Word";
 root.innerHTML='<div class="screen qq-party-lobby-screen"><div class="top"><button class="btn" id="partyLobbyBack">← Назад</button><b>'+title+' · Лобби</b><span></span></div><section class="card"><h3>Пригласи друзей</h3><p class="small muted">Выбери от одного до двух друзей. Комната создастся автоматически — вводить коды не нужно.</p><div id="partyLobbyFriends"><p class="muted small">Загружаем друзей…</p></div><button class="btn primary full" id="partyLobbyCreate">Создать лобби и пригласить</button></section></div>';
 $("#partyLobbyBack").onclick=()=>{state.screen="";render()};
 const out=$("#partyLobbyFriends");
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){out.innerHTML='<p class="muted small">Для игры с друзьями войди в аккаунт QQCross.</p>';$("#partyLobbyCreate").disabled=true;return}
 supabaseClient.rpc("list_qqcross_friends").then(async({data,error})=>{
  if(error)throw error;
  const friends=await hydratePublicProfiles(data||[]);
  if(!friends.length){out.innerHTML='<p class="muted small">Список друзей пока пуст. Сначала добавь друзей во вкладке «Друзья».</p>';$("#partyLobbyCreate").disabled=true;return}
  out.innerHTML=friends.map(p=>'<label class="qq-party-friend-option"><input type="checkbox" value="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,undefined,true)+'</label>').join("");
  out.querySelectorAll(".qq-party-friend-option input").forEach(input=>input.onchange=()=>{
   const selected=out.querySelectorAll("input:checked");
   if(selected.length>2){input.checked=false;toast("В одной комнате можно выбрать не больше двух друзей")}
  });
 }).catch(e=>{out.textContent=e.message||"Не удалось загрузить друзей";$("#partyLobbyCreate").disabled=true});
 $("#partyLobbyCreate").onclick=async()=>{
  const ids=Array.from(out.querySelectorAll("input:checked")).map(x=>x.value);
  if(ids.length<1||ids.length>2){toast("Выбери одного или двух друзей");return}
  const button=$("#partyLobbyCreate");button.disabled=true;button.textContent="Создаём лобби…";
  try{
   const {data,error}=await supabaseClient.rpc("qq_party_create_room",{p_game:game==="team-word"?"team_word":"crocodile",p_nickname:state.profile.username,p_player_limit:3,p_public_state:{}});
   if(error)throw error;
   state.partyRoomCode=data.code;state.partyRoomId=data.room_id;
   const results=await Promise.allSettled(ids.map(friendId=>supabaseClient.rpc("qq_party_invite_friend",{p_room_id:data.room_id,p_friend_id:friendId})));
   const failed=results.filter(x=>x.status==="rejected"||x.value?.error);
   state.screen="party-game";render();
   if(failed.length)toast("Лобби создано, но не все приглашения отправились");
  }catch(e){toast(e.message||"Не удалось создать лобби");button.disabled=false;button.textContent="Создать лобби и пригласить"}
 };
}
function renderPartyGame(root){
 const game=state.partyGame==="qq-draw"?"qq-draw":"team-word";
 const title=game==="qq-draw"?"QQ Draw":"Team Word";
 const path=game==="qq-draw"?"./games/qq-draw/index.html":"./games/team-word/index.html";
 root.innerHTML='<section class="qq-party-game-screen"><header class="qq-party-game-top"><button class="btn" id="partyGameBack" type="button">← Назад</button><b>'+title+'</b><span style="width:64px"></span></header><iframe class="qq-party-game-frame" id="qqPartyGameFrame" title="'+title+'" src="'+path+'?embedded=1'+(state.partyRoomCode?"&room="+encodeURIComponent(state.partyRoomCode):"")+'" loading="eager" allow="clipboard-read; clipboard-write"></iframe></section>';
 $("#partyGameBack").onclick=()=>{state.screen="";state.partyGame="";state.partyRoomCode=null;state.partyRoomId=null;render()};
}
function renderDaily(root){
 const p=window.QQProgression,d=p?.daily?.()||{date:"",wordleLength:5,completed:{}};
 const done=d.completed||{},stats=p?.get?.().daily||{},player=currentPlayerProfile();
 root.innerHTML='<div class="screen qq-daily-screen"><div class="top"><button class="btn" id="dailyBack">← Назад</button><b>Ежедневные испытания</b><span></span></div><section class="card qq-daily-player">'+(window.QQPlayerUI?.renderProfile?window.QQPlayerUI.renderProfile(player,"lg"):'<b>'+esc(player.username)+'</b>')+'<span class="qq-home-player-coins">🪙 '+Number(state.profile.coins||0)+'</span></section><section class="card qq-daily-hero"><span class="pill">ИСПЫТАНИЕ ДНЯ</span><h2>Два задания. Один день.</h2><p class="muted">Оба задания обновляются раз в сутки и остаются одинаковыми до следующего дня.</p><div class="qq-daily-streak" id="qqDailyStreak">Серия: <b>'+Number(stats.currentStreak||0)+'</b> дней · рекорд: <b>'+Number(stats.bestStreak||0)+'</b></div></section><button class="card qq-daily-task" type="button" data-daily-game="scanword"><span class="qq-daily-task-icon">▦</span><span><b>Ежедневный сканворд</b><small>Поле 8 × 12</small></span><strong>'+(done.scanword?"✓":"→")+'</strong></button><button class="card qq-daily-task" type="button" data-daily-game="wordle"><span class="qq-daily-task-icon">▥</span><span><b>Ежедневный Wordle</b><small>Слово из '+d.wordleLength+' букв · 6 попыток</small></span><strong>'+(done.wordle?"✓":"→")+'</strong></button><p class="small muted qq-daily-date">Дата испытания: '+d.date+'</p></div>';
 $("#dailyBack").onclick=()=>{state.screen="";render()};
 root.querySelector("[data-daily-game=scanword]").onclick=()=>startDailyScanword(d);
 root.querySelector("[data-daily-game=wordle]").onclick=()=>{
  window.QQWordle?.mount(root,()=>{state.screen="daily";render()},{daily:{date:d.date,length:d.wordleLength,seed:d.wordleSeed,completed:!!done.wordle},onWin:()=>{awardGameLevel("wordle",Number(String(d.date||"").replace(/-/g,""))||Math.floor(Date.now()/86400000));p?.completeDaily("wordle",d.date);applyProgressRewards();toast("Ежедневный Wordle выполнен!")}})
 };
}
async function startDailyScanword(d){
 try{
  if(!Array.isArray(window.QQCROSS_DICTIONARY)||!window.QQCROSS_DICTIONARY.length)await preloadScanwordDictionary();
  if(scanwordPreparePromise)await scanwordPreparePromise;
  const rawSeed=Number(d?.scanwordSeed);
  const seed=Number.isFinite(rawSeed)?rawSeed>>>0:Number(String(d?.date||"").replace(/-/g,""))>>>0;
  preparedScanword=await buildScanwordInWorker(getScanwordDictionary(),{seed,countSequence:false});
  if(!preparedScanword)throw new Error("Не удалось подготовить ежедневное поле");
  state.screen="";
  await begin(1,false,{date:d.date,completed:!!d.completed?.scanword});
 }catch(e){toast(e.message||"Не удалось открыть ежедневный сканворд")}
}
let progressRewardApplyPromise=null;
async function applyProgressRewards(){
 if(!state.profile)return false;
 if(progressRewardApplyPromise)return progressRewardApplyPromise;
 const rewards=window.QQProgression?.peekPendingRewards?.()||[];
 if(!rewards.length)return false;
 progressRewardApplyPromise=(async()=>{
  const cloud=!!(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-"));
  if(cloud){
   try{await window.QQProgression.syncCloud()}
   catch(error){toast("Не удалось синхронизировать награду. Она останется в ожидании и будет повторена позже.");return false}
  }
  let changed=false;
  for(const reward of rewards){
   if(cloud){
    try{
     const {data,error}=await supabaseClient.rpc("claim_qqcross_progress_reward",{p_reward_key:reward.id});
     if(error)throw error;
     const result=Array.isArray(data)?data[0]:data;
     const item=result?.item_type;
     if(item&&state.profile.items)state.profile.items[item]=Number(result.current_quantity)||0;
     window.QQProgression.ackPendingReward(reward.id);
     changed=true;
    }catch(error){
     toast("Не удалось начислить облачную награду. Она останется в ожидании и будет повторена позже.");
     break;
    }
   }else if(state.profile.items&&Object.prototype.hasOwnProperty.call(state.profile.items,reward.item)){
    state.profile.items[reward.item]+=reward.quantity;
    window.QQProgression.ackPendingReward(reward.id);
    changed=true;
   }
  }
  if(changed){save();toast("Награда за достижение добавлена в инвентарь");if(state.tab==="Профиль"&&!state.screen)render()}
  return changed;
 })().finally(()=>{progressRewardApplyPromise=null});
 return progressRewardApplyPromise;
}
function renderWordle(root){if(!window.QQWordle){root.innerHTML='<div class="screen"><p>Не удалось загрузить Wordle.</p><button class="btn" id="wordleBackFallback">Назад</button></div>';$("#wordleBackFallback").onclick=()=>{state.screen="";render()};return}window.QQWordle.mount(root,()=>{state.screen="";render()},{onWin:()=>awardGameLevel("wordle",Math.floor(Date.now()/1000))})}
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
function tabIcon(name){
 const paths={
  home:'<path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  history:'<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  friends:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  shop:'<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.03a1.7 1.7 0 0 0-1.85.42l-.06.06h-3.4l-.02-.09a1.7 1.7 0 0 0-1.35-1.35l-.09-.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 9.95 14l-.09-.02v-3.4l.09-.02a1.7 1.7 0 0 0 1.35-1.35l.02-.09h3.4l.06.06a1.7 1.7 0 0 0 1.85.42l.08-.03 1.7 2.94-.06.06A1.7 1.7 0 0 0 19.4 15Z"/>'
 };
 return '<svg class="qq-tab-icon" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.home)+'</svg>';
}
function renderShell(root){
 applyProgressRewards();
 const tabs=[["Главная","home"],["Поиск","search"],["История","history"],["Друзья","friends"],["Магазин","shop"],["Профиль","profile"]];
 root.innerHTML=`<div class="screen"><div class="top"><button class="qq-settings-gear" id="qqSettingsGear" type="button" aria-label="Настройки" title="Настройки">${tabIcon("settings")}</button><div class="user qq-header-player">${avatarMarkup()}<div><b>${esc(state.profile.username)}</b><small class="qq-active-title">${esc(window.QQProgression?.get?.().activeTitle||"Новичок")}</small></div></div><button class="qq-header-hat" type="button" data-qq-straw-hat-trigger aria-label="Сенная шляпа">👒</button><div class="coins">🪙 ${state.profile.coins}</div></div>${content()}</div><nav class="nav" aria-label="Основная навигация">${tabs.map(([t,icon])=>`<button type="button" class="${state.tab===t?"active":""}" data-tab="${t}" aria-current="${state.tab===t?"page":"false"}"><span class="ni">${tabIcon(icon)}</span><span class="nav-label">${t}</span></button>`).join("")}</nav>`;
 root.querySelector("#qqSettingsGear").onclick=()=>{state.tab="Настройки";render()};
 root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 wireContent();
}
function content(){if(state.tab==="Поиск")return encyclopedia();if(state.tab==="История")return matchHistory();if(state.tab==="Друзья")return friends();if(state.tab==="Магазин")return shop();if(state.tab==="Профиль")return profile();if(state.tab==="Настройки")return settings();return home()}
function collapsiblePanel(id,title,body,initialOpen=false){
 let open=initialOpen;
 try{const saved=localStorage.getItem("qqcross_settings_section_"+id);if(saved==="collapsed")open=false;else if(saved==="expanded")open=true}catch{}
 return '<section class="card settings-card qq-settings-section '+(open?'':'is-collapsed')+'" data-settings-section="'+id+'">'+
  '<div class="qq-settings-heading"><div><h3>'+title+'</h3></div>'+
  '<button class="qq-settings-toggle" type="button" data-settings-toggle="'+id+'" aria-expanded="'+open+'" aria-controls="qq-settings-body-'+id+'" aria-label="'+(open?'Свернуть раздел':'Развернуть раздел')+'"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'+
  '<div class="qq-settings-content" id="qq-settings-body-'+id+'" aria-hidden="'+(!open)+'" '+(open?'':'inert')+'>'+body+'</div></section>';
}
function home(){
 const daily='<section class="card qq-daily-entry"><div><span class="pill">КАЖДЫЙ ДЕНЬ</span><h3>Ежедневные испытания</h3><p class="small muted">Сканворд и Wordle · серия прохождений</p></div><button class="btn primary" type="button" data-qq-daily-open data-daily-date="'+(window.QQProgression?.daily?.().date||"")+'">Открыть</button></section>';
 const hero='<section class="card hero home-hero"><div class="home-mark">QQ</div><span class="qq-forest-hat" title="Сенная шляпа" data-qq-straw-hat-trigger>👒</span><h2>QQCross</h2><p class="muted">Сканворды для игры одному и с друзьями</p><button class="btn primary full" id="play-toggle" aria-expanded="'+state.playMenuOpen+'">Играть в сканворд</button>'+(state.playMenuOpen?'<div class="play-options"><button class="btn full" id="practice" '+(scanwordPreparing?'disabled':'')+'>'+(scanwordPreparing?'Готовим поле…':preparedScanword?'Играть одному':'Подготовить поле')+'</button><button class="btn full" id="createParty">Играть с друзьями</button><button class="btn full chatgpt-play-option" id="playChatGPT" aria-expanded="false">Играть с ChatGPT</button></div>':'')+'</section>';
 const games='<div class="qq-game-launch-grid"><button class="qq-game-launch" data-extra-game="search"><span class="qq-game-icon">⌕</span><b>Поиск слов</b><small>Найди слова в буквенном поле</small></button><button class="qq-game-launch" id="playWordle"><span class="qq-game-icon">▦</span><b>Wordle</b><small>Угадай слово из пяти букв</small></button><button class="qq-game-launch" data-extra-game="cody"><span class="qq-game-icon">✧</span><b>Кроссворды</b><small>Вопросы и секретное слово</small></button><button type="button" class="qq-game-launch" data-party-game="team-word"><span class="qq-game-icon">👥</span><b>Team Word</b><small>Вместе угадывайте одно слово</small></button><button type="button" class="qq-game-launch" data-party-game="qq-draw"><span class="qq-game-icon">🎨</span><b>QQ Draw</b><small>Рисуй и угадывай слова</small></button></div>';
 const identity='<section class="card qq-home-player">' +(window.QQPlayerUI?.renderProfile?window.QQPlayerUI.renderProfile(currentPlayerProfile(),"lg"):"<b>"+esc(state.profile.username)+"</b>") + '<span class="qq-home-player-coins">🪙 '+Number(state.profile.coins||0)+'</span></section>';
 return identity+daily+hero+
  collapsiblePanel("home-games","Другие игры",games,true)+
  collapsiblePanel("home-invites","Приглашения в партии",'<div id="matchInvites"><p class="small muted">Загрузка…</p></div>',false)+
  collapsiblePanel("home-matches","Мои онлайн-партии",'<div id="myOnlineMatches"><p class="small muted">Загрузка…</p></div>',false);
}

function friends(){return `
  <h2>Друзья</h2>
  <div class="card">
    <label class="small muted" for="friendName">Найти игрока по нику</label>
    <input class="input" id="friendName" maxlength="16" placeholder="Например, Mex">
    <button class="btn primary full" id="searchFriends">Найти игрока</button>
    <div id="friendSearchResults"></div>
  </div>
  ${collapsiblePanel("friends-incoming","Входящие заявки",'<div id="incomingFriendRequests"><p class="muted small">Загрузка…</p></div>',false)}
  ${collapsiblePanel("friends-outgoing","Отправленные заявки",'<div id="outgoingFriendRequests"><p class="muted small">Загрузка…</p></div>',false)}
  ${collapsiblePanel("friends-list","Мои друзья",'<div id="friendsList"><p class="muted small">Загрузка…</p></div>',true)}
`}

async function searchFriends(){
 const input=$("#friendName"),out=$("#friendSearchResults"),q=input?.value.trim()||"";
 if(!out)return;
 if(q.length<2){out.innerHTML='<p class="small muted">Введи хотя бы 2 символа.</p>';return}
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){out.innerHTML='<p class="small muted">Поиск доступен после входа в аккаунт.</p>';return}
 out.innerHTML='<p class="small muted">Ищем игрока…</p>';
 try{
  const {data,error}=await supabaseClient.rpc("search_qqcross_players_with_status",{search_text:q});if(error)throw error;
  if(!data?.length){out.innerHTML='<p class="small muted">Игрок не найден.</p>';return}
  const players=await hydratePublicProfiles(data);
  out.innerHTML=players.map(p=>{
   const status=p.relation_status||"none",label=status==="friends"?"Уже друзья":status==="outgoing"?"Заявка отправлена":status==="incoming"?"Есть входящая заявка":"Добавить";
   const disabled=status!=="none";
   return '<div class="card row between qq-friend-search-result"><button type="button" class="qq-profile-open qq-friend-profile-button" data-profile-id="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,undefined,true)+'</button><button class="btn '+(disabled?"":"primary")+' send-friend-request" data-username="'+esc(p.username)+'" '+(disabled?"disabled":"")+'>'+label+'</button></div>';
  }).join("");
  out.querySelectorAll("[data-profile-id]").forEach(b=>b.onclick=()=>{const p=players.find(x=>String(x.id)===String(b.dataset.profileId));if(p)showPlayerProfile(p)});
  out.querySelectorAll(".send-friend-request:not(:disabled)").forEach(b=>b.onclick=async()=>{
   b.disabled=true;b.textContent="Отправка…";
   try{const {error}=await supabaseClient.rpc("send_qqcross_friend_request",{target_username:b.dataset.username});if(error)throw error;b.textContent="Заявка отправлена";toast("Заявка отправлена");await searchFriends();await loadSocialData()}
   catch(e){toast(e.message||"Не удалось отправить заявку");b.disabled=false;b.textContent="Добавить"}
  });
 }catch(e){console.error("QQCross friend search:",e);out.innerHTML='<p class="small muted">Не удалось выполнить поиск. Проверь подключение базы данных.</p>'}
}
async function loadSocialData(){
 const incoming=$("#incomingFriendRequests"),list=$("#friendsList"),outgoing=$("#outgoingFriendRequests");
 if(!incoming||!list)return;
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){
  incoming.innerHTML='<p class="muted small">Войди в аккаунт, чтобы получать заявки.</p>';
  if(outgoing)outgoing.innerHTML='<p class="muted small">Доступно после входа в аккаунт.</p>';
  list.innerHTML='<p class="muted small">У гостевого профиля нет облачного списка друзей.</p>';return;
 }
 incoming.innerHTML='<p class="muted small">Загружаем…</p>';list.innerHTML='<p class="muted small">Загружаем…</p>';
 try{
  const calls=[supabaseClient.rpc("list_qqcross_friends"),supabaseClient.rpc("list_qqcross_incoming_friend_requests"),supabaseClient.rpc("list_qqcross_outgoing_friend_requests")];
  const [fr,ir,orq]=await Promise.all(calls);
  if(fr.error)throw fr.error;if(ir.error)throw ir.error;if(orq.error)throw orq.error;
  const publicFriends=await hydratePublicProfiles(fr.data||[]);
  const incomingPlayers=await hydratePublicProfiles((ir.data||[]).map(p=>({...p,id:p.sender_id})));
  const outgoingPlayers=await hydratePublicProfiles((orq.data||[]).map(p=>({...p,id:p.receiver_id})));
  list.innerHTML=publicFriends.length?publicFriends.map(p=>'<button type="button" class="card qq-friend-list-card qq-profile-open" data-profile-id="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,"Открыть профиль",true)+'</button>').join(""):'<p class="muted small">Пока нет друзей.</p>';
  incoming.innerHTML=incomingPlayers.length?incomingPlayers.map(p=>'<div class="card"><button type="button" class="qq-profile-open qq-friend-profile-button" data-profile-id="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,"Хочет добавить тебя в друзья",true)+'</button><div class="grid2"><button class="btn primary respond-friend" data-id="'+esc(p.request_id)+'" data-accept="true">Принять</button><button class="btn respond-friend" data-id="'+esc(p.request_id)+'" data-accept="false">Отклонить</button></div></div>').join(""):'<p class="muted small">Новых заявок нет.</p>';
  if(outgoing)outgoing.innerHTML=outgoingPlayers.length?outgoingPlayers.map(p=>'<div class="card row"><button type="button" class="qq-profile-open qq-friend-profile-button" data-profile-id="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,"Ожидает ответа",true)+'</button><span class="pill">Отправлено</span></div>').join(""):'<p class="muted small">Нет ожидающих заявок.</p>';
  [list,incoming,outgoing].filter(Boolean).forEach(root=>root.querySelectorAll("[data-profile-id]").forEach(b=>b.onclick=()=>{const id=b.dataset.profileId,p=[...publicFriends,...incomingPlayers,...outgoingPlayers].find(x=>String(x.id)===String(id));if(p)showPlayerProfile(p)}));
  incoming.querySelectorAll(".respond-friend").forEach(b=>b.onclick=async()=>{
   b.disabled=true;
   try{const {error}=await supabaseClient.rpc("respond_qqcross_friend_request",{request_id:b.dataset.id,accept_request:b.dataset.accept==="true"});if(error)throw error;toast(b.dataset.accept==="true"?"Теперь вы друзья":"Заявка отклонена");await loadSocialData()}
   catch(e){toast(e.message||"Не удалось обработать заявку");b.disabled=false}
  });
 }catch(e){
  console.error("QQCross social data:",e);
  incoming.innerHTML='<p class="muted small">Не удалось загрузить заявки. Проверь, применены ли миграции Supabase.</p>';
  if(outgoing)outgoing.innerHTML="";list.innerHTML="";
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
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"qq_party_invites",filter:"recipient_id=eq."+state.profile.id},()=>{
      if(state.tab==="Главная")loadMatchInbox();
      else toast("Тебя пригласили в Team Word или QQ Draw");
    })
    .subscribe((status)=>{
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("QQCross social realtime:",status);
    });
}
function shop(){
 const products=[["magnifier","⌕","Лупа","Проверка и подсказка"],["clock","◷","Часы","Добавить 20 секунд"],["trash","↻","Перемешать","Обновить набор букв"],["bulb","✧","Подсказка","Подсветить одну букву"]];
 const frames=window.QQPlayerUI?.frames||[];
 const owned=new Set(["classic",...(state.profile.cosmetics||[])]);
 const current=state.profile.frameId||state.profile.frame_id||"classic";
 const consumables='<h3 class="qq-shop-section-title">Игровые помощники</h3><p class="small muted qq-shop-note">5 предметов — 100 монет · 10 предметов — 200 монет.</p><div class="qq-shop-grid">'+products.map(([key,ico,name,desc])=>'<article class="qq-shop-item"><div class="qq-shop-item-head"><span class="qq-shop-icon qq-icon-'+key+'">'+ico+'</span><span class="qq-shop-item-copy"><b>'+name+'</b><small>'+desc+'</small></span></div><div class="qq-shop-stock">В наличии: <b>'+(state.profile.items[key]||0)+'</b></div><div class="qq-shop-buy"><button class="btn buy" data-item="'+key+'" data-qty="5">5 · 100 🪙</button><button class="btn primary buy" data-item="'+key+'" data-qty="10">10 · 200 🪙</button></div></article>').join("")+'</div>';
 const cosmetics='<h3 class="qq-shop-section-title">Рамки профиля</h3><p class="small muted qq-shop-note">Рамка видна рядом с ником во всех играх и списках друзей.</p><div class="qq-frame-shop-grid">'+frames.map(f=>'<article class="qq-frame-shop-card '+(current===f.id?"is-equipped":"")+'"><div class="qq-frame-preview">'+(window.QQPlayerUI?.renderAvatar?window.QQPlayerUI.renderAvatar({...currentPlayerProfile(),frameId:f.id},"lg"):"")+'</div><b>'+esc(f.name)+'</b><small>'+esc(f.description)+'</small><span class="qq-frame-tier">'+esc(f.tier)+'</span>'+(owned.has(f.id)?'<button class="btn '+(current===f.id?"":"primary")+' qq-frame-equip" data-frame="'+f.id+'" '+(current===f.id?"disabled":"")+'>'+(current===f.id?"Надета":"Надеть")+'</button>':f.id==="classic"?"":'<button class="btn primary qq-frame-buy" data-frame="'+f.id+'" data-cost="'+f.cost+'">'+f.cost+' 🪙</button>')+'</article>').join("")+'</div>';
 return '<h2>Магазин</h2><div class="qq-shop-balance">Твой баланс <b>🪙 '+Number(state.profile.coins||0)+'</b></div>'+collapsiblePanel("shop-helpers","Помощники",consumables,true)+collapsiblePanel("shop-frames","Оформление профиля",cosmetics,true);
}
function encyclopedia(){
 const p=window.QQProgression?.get?.()||{discoveredWords:[]},words=p.discoveredWords||[],history=window.QQEncyclopedia?.history?.()||[];
 return '<h2>Поиск</h2><section class="card qq-ai-search"><h3>Спросить ИИ</h3><p class="muted small">Задай вопрос и получи объяснение. Не отправляй личные данные.</p><form id="qqAiAskForm"><textarea id="qqAiAskInput" class="input" rows="3" maxlength="500" placeholder="Напиши свой вопрос…"></textarea><button class="btn primary full" type="submit">Спросить ИИ</button></form><div id="qqAiAskResult" aria-live="polite"></div></section><section class="card qq-encyclopedia-search"><p class="muted small">Ищи значение слова, исправляй опечатки и открывай связанные понятия.</p><form id="encyclopediaForm"><input id="encyclopediaInput" class="input" type="search" placeholder="Например, тунец" autocomplete="off"><button class="btn primary" type="submit">Найти</button></form><div id="encyclopediaResult" aria-live="polite"></div></section><section class="card"><h3>Мои изученные слова · '+words.length+'</h3><div class="qq-word-chips">'+(words.length?words.slice(-80).reverse().map(w=>'<button type="button" class="pill" data-encyclopedia-word="'+esc(w)+'">'+esc(w)+'</button>').join(""):'<p class="muted small">Пока нет изученных слов. Открывай слова в Wordle и других режимах двойным нажатием.</p>')+'</div></section><section class="card"><h3>Недавний поиск</h3><div class="qq-word-chips">'+(history.length?history.slice(0,12).map(w=>'<button type="button" class="pill" data-encyclopedia-word="'+esc(w)+'">'+esc(w)+'</button>').join(""):'<span class="muted small">История появится после первого поиска.</span>')+'</div></section>';
}
async function askQQCrossAI(question){
 const out=$("#qqAiAskResult"),form=$("#qqAiAskForm");
 if(!out)return;
 const prompt=String(question||"").trim();
 if(prompt.length<2||prompt.length>500){out.textContent="Введи вопрос длиной от 2 до 500 символов.";return}
 out.textContent="Отправляю вопрос ИИ…";
 const submit=form?.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Ожидай ответ…"}
 try{
  if(!supabaseClient)throw new Error("Сервер ИИ пока недоступен.");
  const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
  if(sessionError)throw sessionError;
  if(!session){const {error}=await supabaseClient.auth.signInAnonymously();if(error)throw error}
  const {data,error}=await supabaseClient.functions.invoke("qqcross-ai-turn",{body:{mode:"ask",question:prompt}});
  if(error){let message=error.message||"Не удалось связаться с ИИ.";try{const payload=await error.context?.json();if(payload?.error)message=payload.error}catch{}throw new Error(message)}
  if(!data||data.error)throw new Error(data?.error||"ИИ не вернул ответ.");
  out.replaceChildren();
  const answer=document.createElement("p");answer.className="qq-ai-answer";answer.textContent=data.answer||"Ответ не получен.";out.append(answer);
 }catch(error){
  out.textContent=error.message||"Не удалось получить ответ. Попробуй позже.";
 }finally{if(submit){submit.disabled=false;submit.textContent="Спросить ИИ"}}
}
async function lookupEncyclopediaWord(word){
 const out=$("#encyclopediaResult");if(!out)return;
 out.innerHTML='<p class="muted small">Ищу статью и проверяю написание…</p>';
 try{
  const result=await window.QQEncyclopedia.search(word);
  if(!out.isConnected)return;
  if(result.error){out.innerHTML='<p class="muted">'+esc(result.error)+'</p>';return}
  let correction=result.correction?'<p class="qq-word-correction">Возможно, ты имел в виду: <button type="button" data-encyclopedia-word="'+esc(result.correction.word)+'">'+esc(result.correction.word)+'</button></p>':'';
  if(!result.article){out.innerHTML=correction+'<p>Статью не удалось найти. Проверь написание или попробуй похожее слово.</p>';return}
  const a=result.article;
  const stress=result.stress?'<p class="qq-word-stress">Ударение по Викисловарю: <b>'+esc(result.stress)+'</b></p>':'';
  const related=(a.related||[]).map(w=>'<button type="button" class="pill" data-encyclopedia-word="'+esc(w)+'">'+esc(w)+'</button>').join("");
  out.innerHTML=correction+'<h3>'+esc(a.title)+'</h3>'+stress+'<p class="qq-encyclopedia-extract">'+esc(a.extract||"В статье нет краткого описания.")+'</p><div class="qq-related"><b>Связанные понятия</b><div class="qq-word-chips">'+(related||'<span class="muted small">Связанные понятия не найдены.</span>')+'</div></div><a class="qq-wiki-link" href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">Открыть полную статью в '+esc(a.sourceLabel||"Википедии")+' ↗</a>';
  out.querySelectorAll("[data-encyclopedia-word]").forEach(b=>b.onclick=()=>lookupEncyclopediaWord(b.dataset.encyclopediaWord));
 }catch(e){if(out.isConnected)out.innerHTML='<p class="muted">Не удалось получить статью. Проверь подключение и попробуй ещё раз.</p>'}
}
function openWordInfo(word){state.screen="";state.tab="Поиск";render();setTimeout(()=>{const input=$("#encyclopediaInput");if(input){input.value=word;lookupEncyclopediaWord(word)}},0)}
let qqWordInfoBound=false;
function bindWordInfo(){
 if(qqWordInfoBound)return;
 qqWordInfoBound=true;
 let lastTapTarget=null,lastTapAt=0,lastOpenedTarget=null,lastOpenedAt=0;
 const open=target=>{
  const now=Date.now();
  if(lastOpenedTarget===target&&now-lastOpenedAt<450)return;
  lastOpenedTarget=target;lastOpenedAt=now;
  openWordInfo(target.dataset.qqWord||target.textContent);
 };
 document.addEventListener("dblclick",e=>{
  const target=e.target.closest("[data-qq-word]");
  if(target){e.preventDefault();open(target)}
 });
 // Mobile browsers do not consistently emit dblclick for touch, so detect a
 // second tap on the same discovered word while keeping single taps inert.
 document.addEventListener("pointerup",e=>{
  if(e.pointerType!=="touch")return;
  const target=e.target.closest("[data-qq-word]");
  if(!target){lastTapTarget=null;lastTapAt=0;return;}
  const now=Date.now();
  if(target===lastTapTarget&&now-lastTapAt<=450)open(target);
  lastTapTarget=target;lastTapAt=now;
 });
}
bindWordInfo();
function profile(){
 const p=window.QQProgression?.get?.()||{stats:{},daily:{},titles:["Новичок"],activeTitle:"Новичок"};
 const matches=Number(state.profile.games)||0,wins=Number(state.profile.wins)||0,losses=Math.max(0,matches-wins),winRate=matches?Math.round(wins/matches*100):0;
 const achievements=window.QQProgression?.achievements?.()||[];
 const titleOptions=(p.titles||["Новичок"]).map(t=>'<option value="'+esc(t)+'" '+(t===p.activeTitle?"selected":"")+'>'+esc(t)+'</option>').join("");
 const catalog=window.QQProgression?.titleCatalog?.()||[];
 const unlockedCount=catalog.filter(t=>t.unlocked&&!t.secret).length;
 const titleList=catalog.map(t=>'<span class="qq-title-chip '+(t.unlocked?"is-unlocked":"is-locked")+(t.secret?" is-secret":"")+'" title="'+(t.secret&&!t.unlocked?"Секрет: нажми 15 раз на соломенную шляпу":t.unlocked?"Титул открыт":"Откроется после "+t.target+" завершённых сканвордов")+'"><b>'+esc(t.name)+'</b>'+(t.unlocked?'<small>Открыт</small>':t.secret?'<small>'+t.progress+' / '+t.target+' нажатий</small>':'<small>'+t.progress+' / '+t.target+' сканвордов</small>')+'</span>').join("");
 const achievementList=achievements.map(a=>'<div class="qq-achievement '+(a.unlocked?"unlocked":"")+'"><div><b>'+esc(a.name)+'</b><p class="small muted">'+esc(a.desc)+'</p></div><span>'+(a.unlocked?"✓":Math.min(a.value,a.target)+" / "+a.target)+'</span></div>').join("");
 return '<h2>Профиль</h2><div class="card qq-profile-avatar-card"><div class="qq-profile-identity">'+avatarMarkup("big")+'<span class="qq-player-copy"><b>'+esc(state.profile.username)+'</b><small class="qq-player-title">'+esc(p.activeTitle||"Новичок")+'</small></span></div><label class="btn qq-avatar-upload-label" for="qqAvatarInput">Изменить аватарку</label><input id="qqAvatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><small class="muted small">Изображение до 8 МБ. При доступности облачного хранилища синхронизируется между устройствами.</small></div>'+
 '<section class="card" id="qqProgressionStats"><h3>Статистика</h3><div class="grid2"><div><b>'+(p.stats.scanwords||0)+'</b><div class="muted small">Сканворды</div></div><div><b>'+(p.stats.wordleWins||0)+'</b><div class="muted small">Победы Wordle</div></div><div><b>'+(p.stats.searchLevels||0)+'</b><div class="muted small">Поиск слов</div></div><div><b>'+(p.stats.codyLevels||0)+'</b><div class="muted small">Кроссворды</div></div><div><b>'+(p.stats.wordsFound||0)+'</b><div class="muted small">Новые слова</div></div><div><b>'+(p.stats.hintsUsed||0)+'</b><div class="muted small">Подсказки</div></div></div><p id="qqDailyStreak">Текущая серия: <b>'+(p.daily.currentStreak||0)+'</b> · рекорд: <b>'+(p.daily.bestStreak||0)+'</b></p><div class="muted small">Матчи: '+matches+' · победы: '+wins+' · поражения: '+losses+' · процент побед: '+winRate+'% · очки: '+state.profile.points+' · монеты: '+state.profile.coins+'</div></section>'+
 '<section class="card" id="qqTitleInventory"><h3>Коллекция титулов · '+unlockedCount+' / 100</h3><label class="small muted" for="qqActiveTitle">Активный титул</label><select class="input" id="qqActiveTitle">'+titleOptions+'</select><div class="qq-title-list">'+titleList+'</div><p class="small muted">Секретный титул скрыт до открытия: 15 нажатий на соломенную шляпу в любой вкладке.</p></section>'+
 collapsiblePanel("profile-achievements","Достижения · "+achievements.filter(a=>a.unlocked).length+" / "+achievements.length,achievementList,false)+
 '<div class="card"><b>Мои предметы</b><p class="small">Лупы: '+state.profile.items.magnifier+'　Часы: '+state.profile.items.clock+'　Мусорки: '+state.profile.items.trash+'</p></div><button class="btn danger full" id="logout">Сбросить демо-профиль</button>';
}
function settings(){
 const themes=THEME_PRESETS,audio=window.QQAudio?.getSettings?.()||{music:true,effects:true},choices=BACKGROUNDS;
 const ambiences=[["forest","Зимний лес","Снежинки с шестью лучами и мягким падением","❄"],["sakura","Сакура","Розовые лепестки с прожилками и живым падением","✿"],["autumn","Осень","Кленовые листья с прожилками и вращением","🍁"],["rain","Дождь","Отдельные наклонные капли разной длины","🌧"],["fireflies","Светлячки","Мягкие световые точки","✦"],["stars","Звёзды","Медленное мерцание","✧"],["fog","Туман","Плавные туманные слои","☁"],["none","Без анимации","Чистый неподвижный фон","○"]];
 const section=(id,kicker,title,body,initialOpen=false)=>{
  let open=initialOpen;try{const saved=localStorage.getItem("qqcross_settings_section_"+id);if(saved==="collapsed")open=false;else if(saved==="expanded")open=true}catch{}
  return `<section class="card settings-card qq-settings-section ${open?"":"is-collapsed"}" data-settings-section="${id}">
   <div class="qq-settings-heading"><div><span class="pill">${kicker}</span><h3>${title}</h3></div><button class="qq-settings-toggle" type="button" data-settings-toggle="${id}" aria-expanded="${open}" aria-controls="qq-settings-body-${id}" aria-label="${open?"Свернуть раздел":"Развернуть раздел"}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>
   <div class="qq-settings-content" id="qq-settings-body-${id}" aria-hidden="${!open}" ${open?"":"inert"}>${body}</div></section>`;
 };
 const themeBody=`<div class="theme-list qq-theme-grid">${themes.map(([key,name,desc])=>`<button class="theme-choice ${activeTheme===key?"selected":""}" data-theme-choice="${key}" aria-pressed="${activeTheme===key}"><span class="theme-swatch theme-swatch-${key}"></span><span class="theme-copy"><b>${name}</b><small>${desc}</small></span><span class="theme-check">${activeTheme===key?"✓":""}</span></button>`).join("")}</div><p class="settings-note small muted">17 глубоких палитр полного цветового спектра. Оттенки меняют фон, панели, клетки, кнопки и акценты; выбор сохраняется автоматически.</p>`;
 const audioBody=`<label class="audio-setting"><span><b>Фоновая мелодия</b><small>Тихая спокойная мелодия во время игры</small></span><input type="checkbox" id="qqMusicToggle" ${audio.music?"checked":""}></label><label class="audio-setting"><span><b>Звуки действий</b><small>Буквы, слова, правильные и неверные ответы</small></span><input type="checkbox" id="qqEffectsToggle" ${audio.effects?"checked":""}></label>`;
 const backgroundBody=`<div class="background-grid">${choices.map(([id,name,type])=>`<button type="button" class="background-choice ${activeBackground===id?"selected":""}" data-background-choice="${id}" aria-pressed="${activeBackground===id}"><span class="background-preview" data-background-preview="${id}"></span><b>${name}</b><small>${type==="nature"?"Природа":"Абстракция"}</small></button>`).join("")}</div>`;
 const ambienceBody=`<div class="ambience-list">${ambiences.map(([key,name,desc,icon])=>`<button class="ambience-choice ${activeAmbience===key?"selected":""}" data-ambience-choice="${key}" aria-pressed="${activeAmbience===key}"><span class="ambience-preview ambience-preview-${key}">${icon}</span><b>${name}</b><small>${desc}</small></button>`).join("")}</div>`;
 const appearance=localStorage.getItem("qqcross_appearance_mode_v1")==="light"?"light":"dark";
 const comfortBody=`<label class="audio-setting"><span><b>Режим оформления</b><small>Светлый — мягкая бело-голубая основа; палитра акцентов сохраняется</small></span><select id="qqAppearanceMode" class="input"><option value="dark" ${appearance==="dark"?"selected":""}>Тёмный</option><option value="light" ${appearance==="light"?"selected":""}>Светлый</option></select></label><label class="audio-setting"><span><b>Размер текста</b><small>Можно увеличить подписи и вопросы</small></span><select id="qqFontSize" class="input"><option value="normal" ${localStorage.getItem("qqcross_font_size")!=="large"&&localStorage.getItem("qqcross_font_size")!=="small"?"selected":""}>Обычный</option><option value="large" ${localStorage.getItem("qqcross_font_size")==="large"?"selected":""}>Крупный</option><option value="small" ${localStorage.getItem("qqcross_font_size")==="small"?"selected":""}>Компактный</option></select></label><label class="audio-setting"><span><b>Уменьшить анимации</b><small>Отключает движение для более спокойного интерфейса</small></span><input type="checkbox" id="qqReduceMotion" ${localStorage.getItem("qqcross_reduce_motion")==="true"?"checked":""}></label>`;
 return `<h2>Настройки</h2>
  ${section("audio","Звук","Музыка и эффекты",audioBody,true)}
  ${section("themes","Персонализация · 17 палитр","Тема интерфейса",themeBody,true)}
  ${section("backgrounds","Фон игры · 20 вариантов","Атмосферные фоны",backgroundBody,false)}
  ${section("ambience","Атмосфера","Анимации и сезонные эффекты",ambienceBody,false)}
  ${section("comfort","Удобство","Размер текста и анимации",comfortBody,false)}`;
}

function wireContent(){rootMatchHistoryBindings();const aiForm=$("#qqAiAskForm");if(aiForm)aiForm.onsubmit=e=>{e.preventDefault();askQQCrossAI($("#qqAiAskInput")?.value||"")};const ef=$("#encyclopediaForm");if(ef)ef.onsubmit=e=>{e.preventDefault();lookupEncyclopediaWord($("#encyclopediaInput")?.value||"")};document.querySelectorAll("[data-encyclopedia-word]").forEach(b=>b.onclick=()=>lookupEncyclopediaWord(b.dataset.encyclopediaWord));document.querySelectorAll("[data-background-choice]").forEach(b=>b.onclick=()=>{applyBackground(b.dataset.backgroundChoice);render()});const abstractToggle=$("#qqAbstractToggle");if(abstractToggle)abstractToggle.onchange=()=>{abstractEnabled=abstractToggle.checked;localStorage.setItem("qqcross_abstract_enabled",String(abstractEnabled));if(!abstractEnabled&&BACKGROUNDS.find(x=>x[0]===activeBackground)?.[2]==="abstract")applyBackground("misty-forest");render()};document.querySelectorAll("[data-ambience-choice]").forEach(b=>b.onclick=()=>{applyAmbience(b.dataset.ambienceChoice);render()});const appearance=$("#qqAppearanceMode");if(appearance)appearance.onchange=()=>{const mode=appearance.value==="light"?"light":"dark";localStorage.setItem("qqcross_appearance_mode_v1",mode);document.documentElement.dataset.qqMode=mode;document.documentElement.style.colorScheme=mode;const meta=document.querySelector('meta[name="theme-color"]');if(meta){const base=getComputedStyle(document.documentElement).getPropertyValue("--qq-base").trim();meta.setAttribute("content",mode==="light"?"#f1f7fb":(base||"#190910"))}};const font=$("#qqFontSize");if(font)font.onchange=()=>{localStorage.setItem("qqcross_font_size",font.value);document.documentElement.dataset.qqFontSize=font.value};const reduce=$("#qqReduceMotion");if(reduce)reduce.onchange=()=>{localStorage.setItem("qqcross_reduce_motion",String(reduce.checked));document.documentElement.dataset.qqReduceMotion=String(reduce.checked)};document.querySelectorAll("[data-qq-daily-open]").forEach(b=>b.onclick=()=>{state.screen="daily";render()});document.querySelectorAll("[data-qq-straw-hat-trigger]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const n=window.QQProgression?.tapHat?.()||0;if(n===15){applyProgressRewards();toast("Секретный титул Mugiwara открыт!")}else if(n%5===0)toast("Соломенная шляпа: "+n+" / 15")});const activeTitle=$("#qqActiveTitle");if(activeTitle)activeTitle.onchange=async()=>{window.QQProgression?.setActiveTitle(activeTitle.value);if(supabaseClient&&state.profile?.id&&!String(state.profile.id).startsWith("local-")){const {error}=await supabaseClient.from("profiles").update({active_title:activeTitle.value}).eq("id",state.profile.id);if(error)console.warn("QQCross active title sync:",error)}state.profile.activeTitle=activeTitle.value;save();render()};const wordleButton=$("#playWordle");if(wordleButton)wordleButton.onclick=()=>{state.screen="wordle";render()};document.querySelectorAll("[data-extra-game]").forEach(b=>b.onclick=()=>{state.extraMode=b.dataset.extraGame;state.screen="extra";render()});document.querySelectorAll("[data-party-game]").forEach(b=>b.onclick=()=>{state.partyGame=b.dataset.partyGame;state.screen="party-lobby";render()});const toggle=$("#play-toggle");if(toggle)toggle.onclick=()=>{state.playMenuOpen=!state.playMenuOpen;render()};const cp=$("#createParty");if(cp)cp.onclick=()=>{state.screen="lobby";render()};const pr=$("#practice");if(pr)pr.onclick=()=>begin(1);refreshPracticeButton();const gpt=$("#playChatGPT");if(gpt)gpt.onclick=()=>startChatGPTGame(gpt);const ai=$("#acceptInvite");if(ai)ai.onclick=()=>{const size=state.invite.size;state.invite=null;begin(size)};const ri=$("#rejectInvite");if(ri)ri.onclick=()=>{state.invite=null;render();toast("Приглашение отклонено")};const sf=$("#searchFriends");if(sf)sf.onclick=searchFriends;const fi=$("#friendName");if(fi)fi.addEventListener("keydown",e=>{if(e.key==="Enter")searchFriends()});if($("#friendsList"))loadSocialData();if($("#matchInvites"))loadMatchInbox();document.querySelectorAll(".buy").forEach(b=>b.onclick=async()=>{
  const qty=+b.dataset.qty,item=b.dataset.item,cost=qty===5?100:200;
  state.profile.items=normalizeItems(state.profile.items);
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
});
document.querySelectorAll(".qq-frame-buy").forEach(b=>b.onclick=async()=>{
 const id=b.dataset.frame,cost=Number(b.dataset.cost)||0;
 if(Number(state.profile.coins||0)<cost){toast("Не хватает монет");return}
 b.disabled=true;
 try{
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
   const {data,error}=await supabaseClient.rpc("purchase_qqcross_cosmetic",{p_cosmetic_id:id});if(error)throw error;
   state.profile.coins=Number(data?.coins??state.profile.coins);state.profile.cosmetics=[...new Set([...(state.profile.cosmetics||[]),id])];
  }else{state.profile.coins-=cost;state.profile.cosmetics=[...new Set([...(state.profile.cosmetics||[]),id])]}
  save();render();toast("Рамка добавлена в коллекцию");
 }catch(error){toast(error.message||"Покупка рамки пока недоступна");b.disabled=false}
});
document.querySelectorAll(".qq-frame-equip").forEach(b=>b.onclick=async()=>{
 const id=b.dataset.frame;
 try{
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
   const {error}=await supabaseClient.from("profiles").update({frame_id:id}).eq("id",state.profile.id);if(error)throw error;
  }
  state.profile.frameId=id;state.profile.frame_id=id;
  try{localStorage.setItem("qqcross_frame_"+String(state.profile.id||"guest"),id)}catch{}
  save();render();toast("Рамка надета");
 }catch(error){toast(error.message||"Не удалось надеть рамку")}
});
const lo=$("#logout");if(lo)lo.onclick=async()=>{if(confirm("Выйти из аккаунта на этом устройстве?")){if(supabaseClient)await supabaseClient.auth.signOut();if(supabaseClient&&socialChannel){await supabaseClient.removeChannel(socialChannel);socialChannel=null}if(supabaseClient&&onlineChannel){await supabaseClient.removeChannel(onlineChannel);onlineChannel=null;onlineChannelId=null}localStorage.removeItem(STORE_KEY);state.profile=null;render()}};document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeChoice);render();toast("Тема изменена")});document.querySelectorAll("[data-settings-toggle]").forEach(button=>button.onclick=()=>{const key=button.dataset.settingsToggle,body=document.getElementById("qq-settings-body-"+key),section=button.closest("[data-settings-section]");if(!body||!section)return;const next=button.getAttribute("aria-expanded")!=="true";button.setAttribute("aria-expanded",String(next));button.setAttribute("aria-label",next?"Свернуть раздел":"Развернуть раздел");body.setAttribute("aria-hidden",String(!next));if(next)body.removeAttribute("inert");else body.setAttribute("inert","");section.classList.toggle("is-collapsed",!next);try{localStorage.setItem("qqcross_settings_section_"+key,next?"expanded":"collapsed")}catch{}});const music=$("#qqMusicToggle"),effects=$("#qqEffectsToggle");if(music)music.onchange=()=>window.QQAudio?.setMusic(music.checked);if(effects)effects.onchange=()=>window.QQAudio?.setEffects(effects.checked);const avatarInput=$("#qqAvatarInput");if(avatarInput)avatarInput.onchange=()=>saveAvatarFile(avatarInput.files?.[0]);document.querySelectorAll("[data-ambience-choice]").forEach(b=>b.onclick=()=>{applyAmbience(b.dataset.ambienceChoice);render();toast("Атмосфера изменена")})}
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
  const players=await hydratePublicProfiles(data||[]);
  out.innerHTML=players.map(p=>'<label class="friend-pick"><input type="checkbox" value="'+esc(p.id)+'">'+playerCardMarkup(p,undefined,undefined,true)+'</label>').join("");
 }catch(e){out.textContent=e.message||"Не удалось загрузить друзей"}
}
function puzzleSnapshot(){
 return {puzzle:{id:puzzle.id,title:puzzle.title,w:puzzle.w,h:puzzle.h,words:puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),clueKeys:[...(puzzle.clueKeys||[])],reservedKeys:[...(puzzle.reservedKeys||[])]},expected:{...expected},letterBag:[...letterBag]};
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
  const publicPlayers=await hydratePublicProfiles(data.players||[]);
  out.innerHTML='<b>Игроки: '+data.players.length+' / '+data.player_limit+'</b>'+publicPlayers.map(p=>playerCardMarkup(p,undefined,p.status==="accepted"?"Принял":"Ожидает",true)).join("");
  const b=$("#startOnlineMatch");if(b){b.disabled=data.host_id!==state.profile.id||data.players.filter(p=>["accepted","playing"].includes(p.status)).length<2;if(data.host_id!==state.profile.id)b.hidden=true;}
 }catch(e){out.textContent=e.message||"Ошибка"}
}
async function startOnlineMatch(){
 const b=$("#startOnlineMatch");if(b){b.disabled=true;b.textContent="Запускаем…"}
 try{
  const {data,error}=await supabaseClient.rpc("start_qqcross_match",{target_match_id:state.pendingMatchId});if(error)throw error;
  const s=data.puzzle_snapshot;puzzle={...s.puzzle,words:s.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(),clueKeys:new Set(s.puzzle.clueKeys||s.puzzle.words.map(w=>w.clueCell.join(","))),reservedKeys:new Set(s.puzzle.reservedKeys||[])};
  Object.keys(expected).forEach(k=>delete expected[k]);Object.assign(expected,s.expected);letterBag=[...(s.letterBag||[])];
  state.onlineMatchId=data.match_id;state.matchId=data.match_id;state.onlinePlayers=await hydratePublicProfiles(data.players||[]);state.onlineVersion=1;state.partySize=data.players.length;state.turn=0;
  state.filled={};state.owners={};state.feedback={};state.hints={};state.completed=new Set();state.scores=0;state.playerScores=Array(state.partySize).fill(0);state.round=1;state.seconds=90;state.turnDeadlineAt=Date.now()+90000;state.rackNeedsRefill=Array(state.partySize).fill(false);state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(5));state.pendingMoves=[];state.returning={};state.rewardSubmitted=false;
  const {data:version,error:initError}=await supabaseClient.rpc("init_qqcross_match_state",{target_match_id:state.onlineMatchId,initial_state:serializeOnlineState()});if(initError)throw initError;
  state.onlineVersion=version;clearInterval(partyRefreshTimer);state.pendingMatchId=null;state.screen="game";subscribeOnlineMatch(state.onlineMatchId);pushGameHistoryEntry();render();
 }catch(e){toast(e.message||"Не удалось начать партию");if(b){b.disabled=false;b.textContent="Начать партию"}}
}
async function loadMatchInbox(){
 const invites=$("#matchInvites"),matches=$("#myOnlineMatches");
 if(!supabaseClient||!state.profile?.id||String(state.profile.id).startsWith("local-")){
  if(invites)invites.textContent="Войди в аккаунт, чтобы получать приглашения.";
  if(matches)matches.textContent="Онлайн-игра доступна после входа.";
  return;
 }
 try{
  const [ir,mr,pr]=await Promise.all([
    supabaseClient.rpc("list_qqcross_match_invites"),
    supabaseClient.rpc("list_qqcross_my_matches"),
    supabaseClient.rpc("qq_party_list_my_invites")
  ]);
  if(ir.error)throw ir.error;
  if(mr.error)throw mr.error;
  if(pr.error)throw pr.error;

  const classicInvites=ir.data?.length?ir.data.map(x=>
    '<div class="card"><b>'+esc(x.host_username)+'</b><p class="small muted">Приглашение в сканворд · '+x.player_limit+' игрока</p><div class="grid2"><button class="btn primary match-accept" data-id="'+x.match_id+'">Принять</button><button class="btn match-reject" data-id="'+x.match_id+'">Отклонить</button></div></div>'
  ).join(""):"";

  const partyInvites=pr.data?.length?pr.data.map(x=>{
    const gameName=x.game==="team_word"?"Team Word":"QQ Draw";
    return '<div class="card qq-party-invite-card" data-invite-id="'+esc(x.invite_id)+'">'+
      '<b>'+esc(x.sender_username)+'</b>'+
      '<p class="small muted">Приглашает в '+gameName+' · '+x.player_limit+' мест</p>'+
      '<div class="grid2"><button class="btn primary party-invite-accept" data-id="'+esc(x.invite_id)+'">Принять</button><button class="btn party-invite-decline" data-id="'+esc(x.invite_id)+'">Отклонить</button></div>'+
      '</div>';
  }).join(""):"";

  if(invites){
    const combined=classicInvites+partyInvites;
    invites.innerHTML=combined||'<p class="small muted">Новых приглашений нет.</p>';
  }

  if(matches)matches.innerHTML=mr.data?.length?mr.data.map(x=>'<div class="card"><b>Партия от '+esc(x.host_username)+'</b><p class="small muted">'+(x.status==="waiting"?"Ожидает запуска":x.status==="finished"?"Завершена":"Идёт партия")+'</p><div class="grid2"><button class="btn primary open-online-match" data-id="'+x.match_id+'">Открыть</button><button class="btn delete-online-match" data-id="'+x.match_id+'">Удалить бой</button></div></div>').join(""):'<p class="small muted">Пока нет онлайн-партий.</p>';

  document.querySelectorAll(".match-accept").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{
      const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:true});
      if(error)throw error;
      await loadMatchInbox();
      toast("Приглашение принято");
    }catch(e){toast(e.message||"Ошибка");b.disabled=false}
  });
  document.querySelectorAll(".match-reject").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{
      const {error}=await supabaseClient.rpc("respond_qqcross_match_invite",{target_match_id:b.dataset.id,accept_invite:false});
      if(error)throw error;
      await loadMatchInbox();
    }catch(e){toast(e.message||"Ошибка");b.disabled=false}
  });
  document.querySelectorAll(".party-invite-accept").forEach(b=>b.onclick=async()=>{
    b.disabled=true;b.textContent="Подключаем…";
    try{
      const {data,error}=await supabaseClient.rpc("qq_party_respond_invite",{
        p_invite_id:b.dataset.id,p_accept:true
      });
      if(error)throw error;
      if(!data?.accepted||!data.code)throw new Error("Не удалось принять приглашение.");
      const isTeamWord=data.game==="team_word";
      const gameUrl=isTeamWord?"./games/team-word/index.html":"./games/qq-draw/index.html";
      state.partyGame=isTeamWord?"team-word":"qq-draw";state.partyRoomCode=data.code;state.partyRoomId=data.room_id;state.screen="party-game";render();
      toast("Ты присоединился к лобби "+(isTeamWord?"Team Word":"QQ Draw")+".");
    }catch(e){
      b.disabled=false;b.textContent="Принять";
      toast(e.message||"Не удалось принять приглашение");
    }
  });
  document.querySelectorAll(".party-invite-decline").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{
      const {error}=await supabaseClient.rpc("qq_party_respond_invite",{
        p_invite_id:b.dataset.id,p_accept:false
      });
      if(error)throw error;
      b.closest(".qq-party-invite-card")?.remove();
      if(invites&&!invites.querySelector(".card"))invites.innerHTML='<p class="small muted">Новых приглашений нет.</p>';
    }catch(e){toast(e.message||"Не удалось отклонить приглашение");b.disabled=false}
  });
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
 }catch(e){
  if(invites)invites.textContent=e.message||"Не удалось загрузить приглашения";
 }
}
async function openOnlineMatch(id){
 try{
  const {data,error}=await supabaseClient.rpc("get_qqcross_match",{target_match_id:id});if(error)throw error;
  if(data.status==="waiting"){if(data.host_id===state.profile.id){state.pendingMatchId=id;state.screen="lobby";renderLobby($("#app"))}else toast("Создатель ещё не запустил партию");return}
  if(!data.game_state)throw new Error("Состояние партии ещё не готово");
  data.players=await hydratePublicProfiles(data.players||[]);
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
 puzzle={...s.puzzle,words:s.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(),clueKeys:new Set(),reservedKeys:new Set(s.puzzle.reservedKeys||[])};
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
  if((force||data.state_version>state.onlineVersion)&&data.game_state){data.players=await hydratePublicProfiles(data.players||[]);applyOnlineMatch(data)}
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
    if(rack.length>=5)letterBag.push(rack.pop());
    rack.push(tile);
  }else{
    const otherIndex=racks.findIndex((r,i)=>i!==player&&Array.isArray(r)&&r.includes(needed));
    if(otherIndex>=0){
      const other=racks[otherIndex],neededIndex=other.indexOf(needed);
      const neededTile=other.splice(neededIndex,1)[0];
      if(rack.length>=5)other.push(rack.pop());
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
function availableRackSlots(){
  const occupied=new Set((state.pendingMoves||[]).map(move=>Number(move.rackSlot)).filter(slot=>Number.isInteger(slot)&&slot>=0&&slot<5));
  return [0,1,2,3,4].filter(slot=>!occupied.has(slot));
}
function renderRackSlots(){
  const free=availableRackSlots();
  return Array.from({length:5},(_,slot)=>{
    const index=free.indexOf(slot);
    if(index<0||index>=state.letters.length)return '<span class="letter-slot-empty" aria-hidden="true" data-empty-slot="'+slot+'"></span>';
    const letter=state.letters[index];
    return '<button class="letter '+(state.selectedLetter===index?'selected':'')+(state.rackNewIndices?.includes(index)?' letter-enter':'')+'" data-letter="'+index+'" data-rack-slot="'+slot+'">'+esc(letter)+'</button>';
  }).join("");
}
function placeAtCell(k,letterIndex,root,rackSlot){
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
  if(state.loupeActive){toast("Нажми на клетку, чтобы открыть букву");return}
  if(expected[k]===undefined||state.filled[k]||state.pendingMoves.some(m=>m.k===k)){toast("Клетка уже занята");return}
  const letter=state.letters[letterIndex];if(!letter)return;
  const slot=Number.isInteger(rackSlot)?rackSlot:availableRackSlots()[letterIndex];
  state.pendingMoves.push({k,l:letter,rackSlot:slot});
  state.feedback[k]=String(letter).toUpperCase().replace(/Ё/g,"Е")===String(expected[k]).toUpperCase().replace(/Ё/g,"Е")?"correct":"wrong";
  window.QQAudio?.play("letter");
  state.letters.splice(letterIndex,1);state.playerRacks[state.turn]=state.letters;renderGame(root);
}
async function finishTurn(root,timeout=false){
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
  const moves=state.pendingMoves||[];let correct=0,incorrect=0;const incorrectKeys=[];const correctKeys=[];state.returning=state.returning||{};
  // Rebuild the five physical rack positions before resolving moves. Correctly
  // placed letters are replaced in their own positions; wrong letters return
  // to the position they came from instead of being appended at the left/right.
  const occupiedSlots=new Set();
  moves.forEach(move=>{
    let slot=Number(move.rackSlot);
    if(!Number.isInteger(slot)||slot<0||slot>=5||occupiedSlots.has(slot)){
      slot=[0,1,2,3,4].find(candidate=>!occupiedSlots.has(candidate));
    }
    move.rackSlot=slot;
    if(Number.isInteger(slot))occupiedSlots.add(slot);
  });
  const rackPositions=Array(5).fill(null);
  const freeSlots=[0,1,2,3,4].filter(slot=>!occupiedSlots.has(slot));
  state.letters.forEach((letter,index)=>{if(index<freeSlots.length)rackPositions[freeSlots[index]]=letter});
  moves.forEach(m=>{
    if(state.filled[m.k]){rackPositions[m.rackSlot]=m.l;return}
    if(m.l===expected[m.k]){
      state.filled[m.k]=m.l;state.owners[m.k]=state.turn;state.feedback[m.k]="correct";delete state.hints[m.k];state.playerScores[state.turn]++;state.scores++;correct++;correctKeys.push(m.k);
    }else{
      state.feedback[m.k]="wrong";state.returning[m.k]=m.l;incorrectKeys.push(m.k);rackPositions[m.rackSlot]=m.l;incorrect++;
    }
  });
  const emptySlots=rackPositions.map((letter,slot)=>letter==null?slot:-1).filter(slot=>slot>=0);
  const refilled=drawLetters(emptySlots.length);
  const refilledSlots=[];
  emptySlots.forEach((slot,index)=>{if(refilled[index]!==undefined){rackPositions[slot]=refilled[index];refilledSlots.push(slot)}});
  state.letters=rackPositions.filter(letter=>letter!==null&&letter!==undefined);
  state.pendingMoves=[];state.playerRacks[state.turn]=state.letters;
  if(correct)window.QQAudio?.play("correct");if(incorrect)window.QQAudio?.play("wrong");const newlyCompleted=correct?checkWords():[];
  state.rackNewIndices=state.partySize===1?refilledSlots:[];
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
  if(state.onlineMatchId){await saveOnlineTurn(correct+newlyCompleted.length*5,!!state.onlineFinished);if(incorrect||correct){setTimeout(()=>{incorrectKeys.forEach(k=>{delete state.returning[k];delete state.feedback[k]});correctKeys.forEach(k=>delete state.feedback[k]);if(state.screen==="game")renderGame($("#app"))},1400)}return}
  if(state.partySize>1){state.turn=(state.turn+1)%state.partySize;if(state.turn===0)state.round=(state.round||1)+1;}
  else state.round=(state.round||1)+1;
  state.seconds=(state.round||1)<=1?90:60;state.turnDeadlineAt=Date.now()+state.seconds*1000;state.selectedLetter=-1;ensureWordLetter(state.turn);state.letters=state.playerRacks[state.turn];renderGame(root);
  if(incorrect||correct){setTimeout(()=>{incorrectKeys.forEach(k=>{delete state.returning[k];delete state.feedback[k]});correctKeys.forEach(k=>delete state.feedback[k]);if(state.screen==="game")renderGame(root)},1400)}

}
function refillRack(player){const rack=state.playerRacks[player]||(state.playerRacks[player]=[]);const count=Math.min(Math.max(0,5-rack.length),letterBag.length);if(!count)return [];const added=drawLetters(count);rack.push(...added);return added;}
function useItem(key){
  state.profile.items=normalizeItems(state.profile.items);
  if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return false}
  if(state.profile.items[key]<=0){toast("Предметы закончились — загляни в магазин");return false}
  state.profile.items[key]--;save();
  if(supabaseClient&&state.profile.id&&!String(state.profile.id).startsWith("local-")){
    supabaseClient.rpc("use_qqcross_item",{item_type:key}).then(({data,error})=>{
      if(error){state.profile.items[key]++;save();toast("Не удалось списать предмет: "+(error.message||"ошибка"));if(state.screen==="game")render()}
      else{state.profile.items[key]=data;save();const el=document.querySelector("#"+key);if(el){const strong=el.querySelector("strong");if(strong)strong.textContent=(key==="magnifier"?"🔎 ":key==="clock"?"⏱ ":key==="bulb"?"💡 ":"🗑️ ")+data}}
    }).catch(error=>{console.warn("QQCross inventory:",error)});
  }
  return true;
}
function awardGameLevel(game,level){
 const n=Number(level);if(!Number.isSafeInteger(n)||n<1||n>2147483647||!["scanword","search","cody","wordle"].includes(game))return Promise.resolve(false);
 const key=String(state.profile?.id||"guest")+":"+game+":"+n;
 if(supabaseClient&&state.profile?.id&&!String(state.profile.id).startsWith("local-")){
  return supabaseClient.rpc("award_qqcross_level_reward",{p_game_key:game,p_level:n}).then(({data,error})=>{
   if(error)throw error;
   if(data&&Number.isFinite(Number(data.coins)))state.profile.coins=Number(data.coins);
   save();const coins=document.querySelector(".coins");if(coins)coins.textContent="🪙 "+state.profile.coins;
   if(Number(data?.reward)>0)toast("Уровень пройден · +5 🪙");
   return Number(data?.reward)>0;
  }).catch(error=>{console.warn("QQCross level reward:",error);toast("Награда пока не начислена. Попробуем позже.");return false});
 }
 let claimed={};try{claimed=JSON.parse(localStorage.getItem("qqcross_level_rewards_local_v1")||"{}")}catch{}
 if(claimed[key])return Promise.resolve(false);
 claimed[key]=Date.now();try{localStorage.setItem("qqcross_level_rewards_local_v1",JSON.stringify(claimed))}catch{}
 state.profile.coins=(Number(state.profile.coins)||0)+5;save();
 const coins=document.querySelector(".coins");if(coins)coins.textContent="🪙 "+state.profile.coins;
 toast("Уровень пройден · +5 🪙");return Promise.resolve(true);
}
window.QQEconomy={awardLevel:awardGameLevel,useBulb:()=>useItem("bulb"),useMagnifier:()=>useItem("magnifier"),normalizeItems};
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
      state.completed.add(w.id);newlyCompleted.push(w);window.QQProgression?.recordWord?.(w.answer);window.QQAudio?.play("word");state.playerScores[state.turn]+=5;state.scores+=5;toast("Слово собрано! +5");
    }
  });
  if(state.completed.size===puzzle.words.length&&!state.progressRecorded){state.progressRecorded=true;if(!state.onlineMatchId)awardGameLevel("scanword",Number(state.matchId)||Math.floor(Date.now()/1000));window.QQProgression?.record("scanwords");if(state.dailyMode){window.QQProgression?.completeDaily("scanword",state.dailyScanwordDate||window.QQProgression.today());state.dailyMode=false;state.dailyScanwordDate=null}applyProgressRewards()}
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
  let result=await supabaseClient.from("profiles").select("id,username,avatar,coins,wins,games,points,avatar_url,frame_id,active_title").eq("id",userId).single();
  if(result.error){
    const fallback=await supabaseClient.from("profiles").select("id,username,avatar,coins,wins,games,points").eq("id",userId).single();
    if(fallback.error)throw fallback.error;
    result=fallback;
  }
  const data=result.data;
  const {data:inventory,error:inventoryError}=await supabaseClient.from("inventory").select("item_type,quantity").eq("user_id",userId);
  let cosmetics=[];
  try{const c=await supabaseClient.from("qqcross_player_cosmetics").select("cosmetic_id").eq("user_id",userId);if(!c.error)cosmetics=(c.data||[]).map(x=>x.cosmetic_id)}catch{}
  let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||"null")}catch{}
  const items=defaultItems();items.bulb=0;
  if(inventoryError){
    console.warn("QQCross inventory:",inventoryError);
    if(saved&&saved.id===userId&&saved.items&&typeof saved.items==="object")Object.keys(items).forEach(key=>{const value=saved.items[key];if(Number.isInteger(value)&&value>=0)items[key]=value});
  }else (inventory||[]).forEach(row=>{if(Object.prototype.hasOwnProperty.call(items,row.item_type))items[row.item_type]=row.quantity});
  if(generation!==null&&generation!==authGeneration)return;
  state.profile={id:data.id,username:data.username,avatar:data.avatar||0,avatarUrl:data.avatar_url||saved?.avatarUrl||"",avatar_url:data.avatar_url||saved?.avatarUrl||"",frameId:data.frame_id||saved?.frameId||"classic",frame_id:data.frame_id||saved?.frameId||"classic",activeTitle:data.active_title||"Новичок",active_title:data.active_title||"Новичок",cosmetics,coins:data.coins||0,wins:data.wins||0,games:data.games||0,points:data.points||0,items,friends:saved&&saved.id===data.id&&Array.isArray(saved.friends)?saved.friends:[]};
  authRestoreError="";
  await window.QQProgression?.setCloud?.(supabaseClient,userId);
  await applyProgressRewards();
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
function fitScanwordClue(value,answer=""){
  const clue=compactScanwordClue(value);
  const maxLength=36;
  if(clue.length<=maxLength)return clue;
  let shortened=clue.slice(0,maxLength-1);
  const lastSpace=shortened.lastIndexOf(" ");
  if(lastSpace>=22)shortened=shortened.slice(0,lastSpace);
  return shortened.replace(/[\s,;:—-]+$/,"")+"…";
}
function clonePreparedScanword(source){
  return {id:"scanword-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:"Сканворд",w:source.w,h:source.h,words:source.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(source.used),clueKeys:new Set(source.clueKeys),reservedKeys:new Set(source.reservedKeys||[]),coverage:source.coverage};
}
function refreshPracticeButton(){
  const button=$("#practice");
  if(!button)return;
  button.disabled=scanwordPreparing;
  button.textContent=scanwordPreparing?"Готовим поле…":preparedScanword?"Играть одному":"Повторить подготовку";
}
const SCANWORD_SEQUENCE_KEY="qqcross_scanword_sequence_v1";
let scanwordSequenceFallback=0;
function getNextScanwordSequenceIndex(){
  let persisted=0;
  try{
    const stored=Number(localStorage.getItem(SCANWORD_SEQUENCE_KEY));
    if(Number.isSafeInteger(stored)&&stored>0)persisted=stored;
  }catch{}
  scanwordSequenceFallback=Math.max(scanwordSequenceFallback,persisted)+1;
  return scanwordSequenceFallback;
}
function saveScanwordSequenceIndex(index){
  if(Number.isSafeInteger(index)&&index>scanwordSequenceFallback)scanwordSequenceFallback=index;
  try{localStorage.setItem(SCANWORD_SEQUENCE_KEY,String(index))}catch{}
}
function buildScanwordInWorker(entries, overrides={}){
  const seed=Number.isFinite(Number(overrides.seed))
    ? Number(overrides.seed)>>>0
    : (Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
  const countSequence=overrides.countSequence!==false;
  const sequenceIndex=Number.isSafeInteger(overrides.sequenceIndex)&&overrides.sequenceIndex>0
    ? overrides.sequenceIndex
    : countSequence?getNextScanwordSequenceIndex():null;
  const rememberSequence=()=>{
    if(countSequence&&Number.isSafeInteger(sequenceIndex)&&sequenceIndex>0)saveScanwordSequenceIndex(sequenceIndex);
  };
  const generationOptions={
    seed,
    ...(sequenceIndex===null?{}:{sequenceIndex}),
    maxTopologyAttempts:Number.isInteger(overrides.maxTopologyAttempts)?overrides.maxTopologyAttempts:16,
    maxNodes:Number.isInteger(overrides.maxNodes)?overrides.maxNodes:120000,
    maxCspTimeMs:Number.isFinite(overrides.maxCspTimeMs)?overrides.maxCspTimeMs:1200,
    topologyMutationAttempts:Number.isInteger(overrides.topologyMutationAttempts)?overrides.topologyMutationAttempts:96,
    specialElevenLetterChance:Number.isFinite(overrides.specialElevenLetterChance)?overrides.specialElevenLetterChance:0.25
  };
  const adapt=async scanword=>{
    const adapter=await import("./scanword-engine/src/legacy-adapter.js?v=20261120-edge-clue-validation-v3");
    return adapter.toLegacyPuzzle(scanword,{sequence:seed});
  };
  const runOnMainThread=async()=>{
    const engine=await import("./scanword-engine/src/generator.js");
    const result=engine.generateScanword(entries,generationOptions);
    if(!result.ok){
      const reason=result.reason?" ("+result.reason+")":"";
      throw new Error((result.message||"Не удалось создать сканворд")+reason);
    }
    const puzzle=await adapt(result.scanword);
    rememberSequence();
    return puzzle;
  };
  if(typeof Worker!=="function")return runOnMainThread();
  return new Promise((resolve,reject)=>{
    let worker=null,timer=null,settled=false;
    const cleanup=()=>{
      if(timer)clearTimeout(timer);
      if(worker)worker.terminate();
    };
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;
      cleanup();
      callback(value);
    };
    try{
      worker=new Worker(new URL("./scanword-engine/worker.js",document.baseURI),{type:"module"});
      worker.onmessage=async event=>{
        const data=event.data||{};
        if(!data.ok||!data.scanword){
          const details=data.reason?" ("+data.reason+")":"";
          finish(reject,new Error((data.error||"Новый генератор не смог собрать сканворд")+details));
          return;
        }
        if(settled)return;
        settled=true;
        cleanup();
        try{
          const puzzle=await adapt(data.scanword);
          rememberSequence();
          resolve(puzzle);
        }catch(error){reject(error)}
      };
      worker.onerror=event=>{
        const message=event?.message||"Модульный worker нового генератора завершился с ошибкой";
        finish(reject,new Error(message));
      };
      timer=setTimeout(()=>{
        finish(reject,new Error("Новый генератор превысил лимит времени. Попробуй подготовить сканворд ещё раз."));
      },16000);
      worker.postMessage({entries,options:generationOptions});
    }catch(error){
      finish(reject,error);
    }
  });
}
function prepareNextScanword(){
  if(preparedScanword)return Promise.resolve(preparedScanword);
  if(scanwordPreparePromise)return scanwordPreparePromise;
  const dictionary=getScanwordDictionary();
  if(!dictionary.length)return Promise.resolve(null);
  scanwordPreparing=true;
  refreshPracticeButton();
  scanwordPreparePromise=new Promise(resolve=>{
    setTimeout(async()=>{
      try{preparedScanword=await buildScanwordInWorker(dictionary)}
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
  const built=preparedScanword?clonePreparedScanword(preparedScanword):null;
  preparedScanword=null;
  if(!built){puzzle=null;letterBag=[];return false}
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
    const {data:preflight,error:preflightError}=await supabaseClient.functions.invoke("qqcross-ai-turn",{body:{mode:"status"}});
    if(preflightError){
      let message=preflightError.message||"Не удалось проверить подключение ChatGPT.";
      try{const payload=await preflightError.context?.json();if(payload?.error)message=payload.error}catch{}
      throw new Error(message);
    }
    if(!preflight?.ready)throw new Error("Режим ChatGPT пока не настроен на сервере.");
    await begin(2,true);
  }catch(error){
    console.error("QQCross ChatGPT sign-in:",error);
    toast(error.message||"Не удалось подготовить защищённую сессию для ChatGPT.");
  }finally{
    if(button){button.disabled=false;button.textContent="Играть с ChatGPT"}
  }
}
function chooseLocalAIMove(){
 const rack=state.playerRacks[1]||[],candidates=[];
 for(const word of puzzle.words){
  if(state.completed.has(word.id)||word.imageKey)continue;
  const missing=word.cells.map(([y,x],i)=>({k:y+","+x,letter:String(expected[y+","+x]||"").toUpperCase().replace(/Ё/g,"Е")})).filter(x=>!state.filled[x.k]);
  const used=[],moves=[];let possible=true;
  for(const cell of missing){
   const index=rack.findIndex((value,i)=>!used.includes(i)&&String(value).toUpperCase().replace(/Ё/g,"Е")===cell.letter);
   if(index<0){possible=false;break}
   used.push(index);moves.push({k:cell.k,l:rack[index]});
  }
  if(possible)candidates.push({word,moves,used,score:missing.length*10+word.cells.length*2+Math.random()});
 }
 candidates.sort((a,b)=>b.score-a.score);
 return candidates[0]||null;
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
          if(index>=0){used.push(index);state.pendingMoves.push({k:key,l:rack[index],rackSlot:index})}
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
    state.aiError=error?.message||"Не удалось получить ход от ChatGPT. Проверь соединение и повтори попытку.";
    state.aiThinkingTurn=null;
    renderGame(root);
  }
}

async function begin(size=1,chatGPT=false,dailyChallenge=null){
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
    // Background preparation can fail for a particular seed on a slower phone.
    // Retry once with a fresh bounded seed instead of leaving the player on the menu.
    for(let generationAttempt=0;generationAttempt<2&&!preparedScanword;generationAttempt++){
      await prepareNextScanword();
    }
    if(!preparedScanword)throw new Error("Не удалось подготовить сканворд после двух ограниченных попыток. Нажми «Повторить подготовку».");
    let loaded=false,lastError=null;
    for(let attempt=0;attempt<2&&!loaded;attempt++){
      try{loaded=!!loadPuzzle()}catch(error){lastError=error;console.error("QQCross: puzzle start failed",error)}
    }
    qqGenerationMs=performance.now()-qqStartTime;
    if(!loaded)throw lastError||new Error("Не удалось собрать сканворд 8×12. Попробуй ещё раз.");
    state.screen="game";state.dailyMode=!!dailyChallenge;state.dailyScanwordDate=dailyChallenge?.date||null;state.progressRecorded=!!dailyChallenge?.completed;state.partySize=size;state.aiMatch=!!chatGPT;state.aiThinkingTurn=null;state.aiError="";state.filled={};state.owners={};state.feedback={};state.hints={};state.loupeActive=false;
    state.onlineMatchId=null;state.onlinePlayers=[];state.onlineVersion=0;state.onlineFinished=false;state.completed=new Set();state.rewardSubmitted=false;state.scores=0;state.playerScores=Array(size).fill(0);state.turn=0;state.round=1;state.seconds=90;state.turnDeadlineAt=Date.now()+90000;
    state.rackNeedsRefill=Array(size).fill(false);state.playerRacks=Array.from({length:size},()=>drawLetters(5));state.letters=state.playerRacks[0];ensureWordLetter(0);state.selectedLetter=-1;state.selectedCell=null;state.selectedWord="w1";state.rackNewIndices=state.partySize===1?[0,1,2,3,4]:[];state.wordFlashKeys=new Set();state.pendingMoves=[];state.matchId="match-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
    pushGameHistoryEntry();render();if(qqDebugTiming)window.__qqcrossTiming={generationMs:Math.round(qqGenerationMs),totalMs:Math.round(performance.now()-qqStartTime)};if(state.rackNewIndices.length){clearTimeout(state.rackAnimationTimer);state.rackAnimationTimer=setTimeout(()=>{state.rackNewIndices=[];if(state.screen==="game")render()},520)}
  }catch(error){
    console.error("QQCross: single-player start failed",error);
    toast(error&&error.message?error.message:"Не удалось запустить игру. Попробуй ещё раз.");
    if(playButton){playButton.disabled=false;playButton.textContent="Играть одному"}
  }
}
function getScanwordHint(word,level){
 const clue=String(word?.clue||"").trim(),lower=clue.toLowerCase();
 if(level==="light"){
  const groups=[[/животн|звер|птиц|насеком|рыб|хищник/,"животный мир"],[/дерев|цвет|ягод|растени|куст|лист/,"растения"],[/фрукт|овощ|пищ|напит|блюд|выпеч|сладк/,"еда и напитки"],[/стран|город|река|гора|остров|столиц|океан/,"география"],[/прибор|устройств|аппарат|инструмент|механизм|машин|транспорт/,"техника и предметы"],[/величин|частиц|атом|энерг|физик|хим|математ|геометр/,"наука"],[/музык|мелод|песн|струн|ударн|нота/,"музыка"],[/професс|работник|человек|оратор|пассажир/,"люди и профессии"],[/мебел|посуда|одежд|комнат|сосуд/,"бытовые предметы"]];
  const found=groups.find(([re])=>re.test(lower));
  return "Тема ответа: "+(found?found[1]:"предмет или понятие из описания")+". В слове "+word.answer.length+" букв.";
 }
 if(level==="medium"){
  if(word.logic)return "Подсказка к загадке: выдели главное свойство в вопросе и подумай, какой предмет или понятие ему соответствует.";
  const short=String(word.clueShort||"").trim();
  if(short&&short.toLowerCase()!==clue.toLowerCase())return "Коротко: "+short;
  return "Иными словами: "+clue.replace(/[.!?]+$/,"").toLowerCase()+". Какое одно слово лучше всего это обозначает?";
 }
 return "";
}
function renderGame(root){
  clearInterval(state.interval);
  if(!puzzle||!puzzle.words.length){state.screen="";render();toast("Не удалось собрать сканворд.");return}
  persistCurrentMatch();
  if(!state.playerRacks)state.playerRacks=Array.from({length:state.partySize},()=>drawLetters(5));
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
  const untimedSolo=state.partySize===1&&!state.aiMatch&&!state.onlineMatchId;
  const onlineIsMyTurn=(!state.onlineMatchId||state.onlinePlayers[state.turn]?.id===state.profile?.id)&&!aiTurn;
  state.pendingMoves=state.pendingMoves||[];
  const pending={};state.pendingMoves.forEach(m=>pending[m.k]=m.l);
  const clueAt=new Map(),startWordsAt=new Map();puzzle.words.forEach(w=>{const key=w.clueCell.join(","),list=clueAt.get(key)||[];list.push(w);clueAt.set(key,list);const starts=startWordsAt.get(key)||[];starts.push(w);startWordsAt.set(key,starts)});
  const wordTerminals=new Map(),terminalOnly=new Set(),directionDelta={right:[0,1],left:[0,-1],down:[1,0],up:[-1,0]};
  const directionGlyph={right:"→",left:"←",down:"↓",up:"↑"};
  const directionLabels={right:"→ По горизонтали",left:"← По горизонтали",down:"↓ По вертикали",up:"↑ По вертикали"};
  puzzle.words.forEach(w=>{const last=w.cells[w.cells.length-1],delta=directionDelta[w.dir],key=(last[0]+delta[0])+","+(last[1]+delta[1]),list=wordTerminals.get(key)||[];list.push(w);wordTerminals.set(key,list)});
  for(const [key,ended] of wordTerminals)if(!(clueAt.get(key)||[]).length){clueAt.set(key,ended);terminalOnly.add(key)}
  const activeWord=puzzle.words.find(w=>w.id===state.selectedWord&&!state.completed?.has(w.id))||puzzle.words.find(w=>!state.completed?.has(w.id))||puzzle.words[0];
  state.selectedWord=activeWord?.id||"";
  const activeWordCells=new Set((activeWord?.cells||[]).map(c=>c.join(",")));
  const wordEnds=new Map();
  puzzle.words.forEach(w=>{const last=w.cells[w.cells.length-1];if(!last)return;const k=last.join(","),dirs=wordEnds.get(k)||[];dirs.push(w.dir);wordEnds.set(k,dirs)});
  const cells=[];
  for(let y=0;y<puzzle.h;y++)for(let x=0;x<puzzle.w;x++){
    const key=y+","+x,wordsAt=clueAt.get(key),position=' style="grid-column:'+(x+1)+';grid-row:'+(y+1)+'"';
    if(wordsAt){
      const displayWord=wordsAt.find(w=>w.logic&&!state.completed?.has(w.id))||wordsAt.find(w=>w.id===activeWord?.id)||wordsAt.find(w=>!state.completed?.has(w.id))||wordsAt[0];
      const pictureWord=terminalOnly.has(key)?null:(wordsAt.find(w=>w.imageKey)||null);
      const single=displayWord?(displayWord.isEmoji?(displayWord.clueShort||displayWord.clue):fitScanwordClue(displayWord.clueShort||displayWord.clue,displayWord.answer)):"";
      const fullClueTitle=wordsAt.map(w=>w.clue).join(" | ");
      const picture=pictureWord?'<img class="scan-clue-image" src="./assets/scanword/'+esc(pictureWord.imageKey)+'.svg" alt="'+esc(pictureWord.answer)+'" loading="eager" decoding="async">':'<span class="scan-clue-text" style="--clue-length:'+single.length+'">'+esc(single)+'</span>';
      const clueTitle=pictureWord&&wordsAt.length===1?"Что изображено на картинке?":fullClueTitle;
      const arrowWords=(startWordsAt.get(key)||[]).length?startWordsAt.get(key):(wordTerminals.get(key)||[]);
       const arrows=arrowWords.map(w=>'<span class="scan-arrow scan-arrow-'+w.dir+'" aria-hidden="true">'+(directionGlyph[w.dir]||"") +'</span>').join("");
      if(terminalOnly.has(key)&&!(startWordsAt.get(key)||[]).length){
        const endArrows=(wordTerminals.get(key)||[]).map(w=>'<span class="scan-terminal-arrow scan-terminal-arrow-'+esc(w.dir)+'" aria-hidden="true">'+(directionGlyph[w.dir]||"•")+'</span>').join("");
        cells.push('<div class="scan-cell scan-grid-cell scan-boundary scan-terminal" data-boundary-cell="'+key+'" data-terminal-for="'+esc((wordTerminals.get(key)||[]).join(","))+'" aria-hidden="true"'+position+'>'+endArrows+'</div>');
      }else{
        cells.push('<button type="button" class="scan-cell scan-grid-cell scan-clue '+(wordsAt.some(w=>w.id===activeWord?.id)?' scan-clue-active':'')+' '+(wordsAt.length>1?"scan-clue-multi":"")+(displayWord?.isEmoji?' scan-clue-emoji':'')+(displayWord?.logic?' scan-clue-logic':'')+(pictureWord?' scan-clue-picture':'')+(wordTerminals.has(key)?' scan-clue-terminal':'')+'" data-terminal-for="'+esc((wordTerminals.get(key)||[]).join(","))+'" data-clue-cell="'+key+'" data-clue-start-count="'+arrowWords.length+'" title="'+esc(clueTitle)+'" aria-label="'+esc(clueTitle)+'"'+position+'>'+picture+arrows+'</button>');
      }
    }else if(expected[key]!==undefined){
      const value=state.filled[key]||pending[key]||"";
      const hint=state.hints?.[key]||"";
      const wordFlash=state.wordFlashKeys?.has(key);
      const endClass=(wordEnds.get(key)||[]).map(dir=>"answer-end-"+dir).join(" ");
      const cls=(state.filled[key]?"filled":"")+(pending[key]?" pending-cell":"")+(hint?" hinted-cell":"")+(state.feedback[key]==="wrong"?" wrong":"")+(state.feedback[key]==="correct"?" correct":"")+(wordFlash?" word-complete-flash":"")+(activeWordCells.has(key)?" active-word-cell":"")+(endClass?" "+endClass:"");
      const mark=state.feedback[key]==="wrong"?"×":(state.feedback[key]==="correct"||state.filled[key]?"✓":"");
      const markMarkup=mark?'<span class="placement-mark '+(mark==="✓"?"placement-correct":"placement-wrong")+'" aria-hidden="true">'+mark+'</span>':"";
      const letterMarkup=(value?'<span class="cell-letter">'+esc(value)+'</span>':hint?'<span class="hint-letter" aria-hidden="true">'+esc(hint)+'</span>':'')+markMarkup;
      const feedbackLabel=state.feedback[key]==="correct"?"верно":state.feedback[key]==="wrong"?"неверно":state.filled[key]?"заполнено":"ещё не проверено";
      cells.push('<button type="button" class="scan-cell scan-grid-cell cell '+cls+'" data-cell="'+key+'" aria-label="Буква '+(value?esc(value)+", ":"")+feedbackLabel+'" title="'+feedbackLabel+'"'+position+'>'+letterMarkup+'</button>');
    }else if(puzzle.reservedKeys?.has(key))cells.push('<div class="scan-cell scan-grid-cell scan-empty" data-reserved-cell="'+key+'" aria-hidden="true"'+position+'></div>');
    else cells.push('<div class="scan-cell scan-grid-cell scan-filler" aria-hidden="true"'+position+'></div>');
  }
  const scorePlayers=Array.from({length:state.partySize},(_,i)=>{const online=state.onlineMatchId?state.onlinePlayers[i]:null;return online?{...online,username:online.username||online.nickname||("Игрок "+(i+1))}:i===0?currentPlayerProfile():{username:state.aiMatch?"ChatGPT":"Игрок "+(i+1),avatar:i===1?1:2,active_title:state.aiMatch?"Соперник":"Новичок"}});
  const scores=scorePlayers.map((p,i)=>playerCardMarkup(p,(state.playerScores||[])[i]||0,i===state.turn?"Ход сейчас":"Участник",true)).join("");
  root.innerHTML='<div class="screen game-screen '+(aiTurn?"ai-opponent-turn":"")+'"><div class="top game-topbar"><span class="small muted">Прогресс сохраняется автоматически</span>'+(state.onlineMatchId?'<button type="button" class="btn delete-online-game" id="deleteOnlineMatch">Удалить бой</button>':'')+'</div>'+
    '<div class="score-strip qq-score-players">'+scores+'</div>'+(state.aiMatch?'<div class="ai-turn-status" id="aiTurnStatus">'+(aiTurn?(state.aiError?'<span>'+esc(state.aiError)+'</span> <button class="btn" id="retryAI">Повторить ход</button>':'ChatGPT выбирает вопрос и делает ход…'):'Ты выбираешь буквы и делаешь ход.')+'</div>':'')+
    '<div class="board-wrap scanword-wrap"><div class="scanword-board" style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(12,minmax(0,1fr))" data-columns="'+puzzle.w+'" data-rows="'+puzzle.h+'" data-answer-count="'+puzzle.words.length+'" data-terminal-answer-count="'+Array.from(wordTerminals.values()).reduce((sum,ids)=>sum+ids.length,0)+'">'+cells.join("")+'</div></div>'+
    '<div class="game-tools"><div class="letter-area"><span class="letter-label">Буквы</span><div class="hand">'+renderRackSlots()+'</div><button class="btn primary check-turn" id="endturn">✓</button></div>'+
    '<div class="items"><button class="item" id="magnifier"><strong>🔎 '+state.profile.items.magnifier+'</strong>Лупа</button>'+(untimedSolo?'':'<button class="item" id="clock"><strong>⏱ '+state.profile.items.clock+'</strong>Часы</button>')+'<button class="item" id="trash"><strong>🗑️ '+state.profile.items.trash+'</strong>Мусорка</button><button class="item" id="bulb"><strong>💡 '+(state.profile.items.bulb||0)+'</strong>Подсказка</button>'+(untimedSolo?'':'<span class="timer" id="timer">⏱ '+state.seconds+'</span>')+'</div></div></div>';

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
  root.querySelectorAll("[data-clue-cell]").forEach(button=>{
    button.onclick=()=>{
      const wrap=root.querySelector(".board-wrap");if(!wrap)return;
      document.querySelector(".clue-popup-backdrop")?.remove();
      const wordsAt=clueAt.get(button.dataset.clueCell)||[];
      if(!wordsAt.length)return;
      const popup=document.createElement("div");popup.className="clue-popup-backdrop";
      popup.innerHTML='<div class="clue-popup"><div class="clue-popup-number">ВОПРОС В КЛЕТКЕ</div><div class="clue-popup-subtitle">Прочитай вопрос и посмотри направление ответа</div><div class="clue-popup-options"></div><button type="button" class="clue-popup-close">Закрыть</button></div>';
      const options=popup.querySelector(".clue-popup-options");
      const popupHeading=popup.querySelector(".clue-popup-number");
      const popupSubtitle=popup.querySelector(".clue-popup-subtitle");
      const close=()=>popup.remove();
      const showQuestion=word=>{
        state.selectedWord=word.id;
        popupHeading.textContent="ВОПРОС";
        popupSubtitle.textContent="Найди ответ и собери его из букв на панели";
        options.innerHTML='<div class="clue-popup-direction"></div><div class="clue-popup-text"></div><div class="clue-popup-length"></div><div class="clue-popup-help">Перетащи нужные буквы с нижней панели в пустые клетки сетки.</div>'+(wordsAt.length>1?'<button type="button" class="clue-popup-back">← К другим вопросам</button>':"");
        options.querySelector(".clue-popup-direction").textContent=directionLabels[word.dir]||"Направление не определено";
        options.querySelector(".clue-popup-text").textContent=word.imageKey?"Что изображено на картинке?":word.clue;
        const count=word.answer.length,form=count===1?"буква":count<=4?"буквы":"букв";
        options.querySelector(".clue-popup-length").textContent="Ответ: "+count+" "+form;
        options.querySelector(".clue-popup-back")?.addEventListener("click",showChoices);
      };
      const showChoices=()=>{
        if(wordsAt.length===1){showQuestion(wordsAt[0]);return}
        popupHeading.textContent="В ЭТОЙ КЛЕТКЕ НАЧИНАЮТСЯ СЛОВА";
        popupSubtitle.textContent="Выбери направление, чтобы увидеть вопрос";
        options.innerHTML="";
        [...wordsAt].sort((a,b)=>Number(!!b.logic)-Number(!!a.logic)).forEach(word=>{
          const choice=document.createElement("button");choice.type="button";choice.className="clue-popup-choice";
          const direction=document.createElement("span");direction.className="clue-popup-choice-direction";
          direction.textContent=directionLabels[word.dir]||"Направление не определено";
          const clue=document.createElement("span");clue.className="clue-popup-choice-text";
          clue.textContent=word.imageKey?"Что изображено на картинке?":word.clue;
          choice.append(direction,clue);
          choice.onclick=()=>showQuestion(word);options.append(choice);
        });
      };
      popup.querySelector(".clue-popup-close").onclick=close;
      popup.onclick=event=>{if(event.target===popup)close()};
      showChoices();document.body.append(popup);
    };
  });
  let activeDrag=null,dragGhost=null;
  const startDrag=(event,source)=>{
    if(event.button!==undefined&&event.button!==0)return;
    event.preventDefault();
    if(source.type==="rack"){
      const index=Number(source.element.dataset.letter),letter=state.letters[index];if(!letter)return;
      activeDrag={type:"rack",index,letter,rackSlot:Number(source.element.dataset.rackSlot)};
      source.element.classList.add("dragging");
    }else{
      const key=source.element.dataset.cell,move=state.pendingMoves.find(m=>m.k===key);if(!move)return;
      state.pendingMoves.splice(state.pendingMoves.indexOf(move),1);
      activeDrag={type:"pending",key,letter:move.l,rackSlot:move.rackSlot};
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
        if(expected[key]!==undefined&&!state.filled[key]&&!state.pendingMoves.some(m=>m.k===key))placeAtCell(key,drag.index,root,drag.rackSlot);
      }else if(expected[key]!==undefined&&!state.filled[key]&&!state.pendingMoves.some(m=>m.k===key)){
        if(drag.type==="pending")delete state.feedback[drag.key];
        state.pendingMoves.push({k:key,l:drag.letter,rackSlot:drag.rackSlot});
        state.feedback[key]=String(drag.letter).toUpperCase().replace(/Ё/g,"Е")===String(expected[key]).toUpperCase().replace(/Ё/g,"Е")?"correct":"wrong";
        state.playerRacks[state.turn]=state.letters;renderGame(root);
      }else{
        state.pendingMoves.push({k:drag.key,l:drag.letter,rackSlot:drag.rackSlot});
        if(drag.type==="pending")state.feedback[drag.key]=String(drag.letter).toUpperCase().replace(/Ё/g,"Е")===String(expected[drag.key]).toUpperCase().replace(/Ё/g,"Е")?"correct":"wrong";
        renderGame(root);
      }
    }else if(target?.matches(".hand")||drag.type==="pending"){
      if(drag.type==="pending"){delete state.feedback[drag.key];const insertAt=availableRackSlots().indexOf(drag.rackSlot);state.letters.splice(insertAt<0?state.letters.length:insertAt,0,drag.letter);state.playerRacks[state.turn]=state.letters;renderGame(root)}
    }else if(drag.type==="pending"){
      delete state.feedback[drag.key];const insertAt=availableRackSlots().indexOf(drag.rackSlot);state.letters.splice(insertAt<0?state.letters.length:insertAt,0,drag.letter);state.playerRacks[state.turn]=state.letters;renderGame(root);
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
      if(existing){state.pendingMoves.splice(state.pendingMoves.indexOf(existing),1);delete state.feedback[key];const insertAt=availableRackSlots().indexOf(existing.rackSlot);state.letters.splice(insertAt<0?state.letters.length:insertAt,0,existing.l);state.playerRacks[state.turn]=state.letters;renderGame(root);return}
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
  const clockButton=$("#clock");if(clockButton)clockButton.onclick=()=>{if(useItem("clock")){state.seconds+=20;renderGame(root)}};
  $("#trash").onclick=()=>{if(!useItem("trash"))return;state.playerRacks[state.turn]=[];state.letters=state.playerRacks[state.turn];refillRack(state.turn);ensureWordLetter(state.turn);renderGame(root)};
  $("#bulb").onclick=()=>{
    if(state.onlineMatchId&&state.onlinePlayers[state.turn]?.id!==state.profile?.id){toast("Сейчас ход другого игрока");return}
    const key=puzzle.words.flatMap(w=>w.cells).map(c=>c.join(",")).find(k=>!state.filled[k]&&!state.pendingMoves.some(m=>m.k===k)&&!state.hints?.[k]);
    if(!key){toast("Все доступные буквы уже подсвечены");return}
    if(!useItem("bulb"))return;
    state.hints=state.hints||{};state.hints[key]=expected[key];window.QQProgression?.record?.("hintsUsed");renderGame(root);toast("💡 Одна буква подсвечена");
  };
  if(aiTurn&&state.aiError){const retry=root.querySelector("#retryAI");if(retry)retry.onclick=()=>{state.aiError="";state.aiThinkingTurn=null;renderGame(root)}}
  if(aiTurn&&!state.aiError){const turnKey=String(state.round||1)+":"+state.turn;if(state.aiThinkingTurn!==turnKey){state.aiThinkingTurn=turnKey;runChatGPTTurn(root,turnKey)}}
  if(onlineIsMyTurn&&!untimedSolo)state.interval=setInterval(()=>{state.seconds=Math.max(0,Math.ceil(((state.turnDeadlineAt||Date.now())-Date.now())/1000));const timer=$("#timer");if(timer)timer.textContent="⏱ "+state.seconds;if(Date.now()-lastMatchPersistAt>=2000)persistCurrentMatch();if(state.seconds<=0){clearInterval(state.interval);finishTurn(root,true)}},250);
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
    puzzle:{id:puzzle.id,title:puzzle.title,w:puzzle.w,h:puzzle.h,words:puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c])})),reservedKeys:[...(puzzle.reservedKeys||[])]},
    expected:{...expected},letterBag:[...letterBag],
    game:{
      partySize:state.partySize,aiMatch:!!state.aiMatch,filled:{...state.filled},owners:{...state.owners},feedback:{...state.feedback},hints:{...state.hints},
      completed:[...(state.completed||[])],scores:state.scores,playerScores:[...(state.playerScores||[])],turn:state.turn,round:state.round,
      seconds:state.seconds,rackNeedsRefill:[...(state.rackNeedsRefill||[])],playerRacks:(state.playerRacks||[]).map(r=>[...r]),
      pendingMoves:(state.pendingMoves||[]).map(m=>({...m})),returning:{...(state.returning||{})}
    }
  };
  const matches=matchesForThisDevice().filter(m=>m.id!==id);
  matches.unshift(snapshot);saveMatchesForThisDevice(matches);lastMatchPersistAt=Date.now();
}
function pushGameHistoryEntry(){
  try{history.pushState({qqcrossGame:true},"",location.pathname+location.search+"#game-"+Date.now())}catch{}
}
function restoreLocalMatch(id){
  const match=matchesForThisDevice().find(m=>m.id===id&&m.status!=="completed");
  if(!match)return;
  puzzle={...match.puzzle,words:match.puzzle.words.map(w=>({...w,cells:w.cells.map(c=>[...c])})),used:new Set(),clueKeys:new Set(),reservedKeys:new Set(match.puzzle.reservedKeys||[])};
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

if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=20261120-native-8x12-v2",{scope:"./"}).catch(error=>console.warn("QQCross offline mode:",error)));
applyTheme(activeTheme);
let authStarted=false;
window.QQ_SUPABASE_READY=configureSupabase;
configureSupabase();
function startAuthOnce(){if(authStarted)return;authStarted=true;initAuth()}
const dictionaryReady=preloadScanwordDictionary();
Promise.race([dictionaryReady,new Promise(resolve=>setTimeout(resolve,3500))]).finally(startAuthOnce);
