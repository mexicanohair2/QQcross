import { loadDrawingModel, predictDrawing } from "./draw-model.mjs";

import {
  DRAW_WORDS,
  normalizeDrawWord,
  recognizeDrawing,
  appendOrderedEvent,
  replayDrawingEvents
} from "./draw-logic.mjs";

const CONFIG = window.QQ_CONFIG;
const AVATARS = ["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const $ = (selector) => document.querySelector(selector);
const appRoot = $("#app");
const state = {
  profile:null,playerProfiles:{},playerProfileUpdatedAt:{},guest:false,roomId:null,room:null,roomCode:null,
  channel:null,pollTimer:null,eventTimer:null,busy:false,
  color:"#29202b",thickness:5,eraser:false,
  drawEvents:[],lastServerSequence:0,nextSequence:1,drawRound:null,
  drawQueue:[],sendingDraw:false,drawBlocked:false,activeStrokeId:null,
  activeStrokePoint:null,activeStrokeStyle:null,lastMoveAt:0,
  solo:null,soloTimer:null,botTimer:null,screen:"home"
};

const supabase = window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{
      auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
    })
  : null;

function esc(value){
  return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function avatar(index){
  const n=Number(index);
  return AVATARS[Number.isInteger(n)?Math.max(0,Math.min(9,n)):0];
}
function toast(message){
  let node=$(".toast");
  if(!node){node=document.createElement("div");node.className="toast";document.body.append(node);}
  node.textContent=message;
  clearTimeout(node._timer);
  node._timer=setTimeout(()=>node.remove(),2600);
}
function friendlyError(error){
  const message=String(error?.message||error||"");
  const known={
    AUTH_REQUIRED:"Войди в аккаунт QQCross.",
    VERIFIED_ACCOUNT_REQUIRED:"Для сетевой игры подтверди почту аккаунта QQCross.",
    PROFILE_REQUIRED:"Профиль QQCross не найден. Открой основной QQCross и восстанови профиль.",
    NEED_TWO_PLAYERS:"Для сетевого раунда нужны минимум два реальных игрока.",
    ROOM_FULL:"В комнате больше нет свободных мест.",
    ROOM_NOT_FOUND:"Комната не найдена или уже закрыта.",
    NOT_A_ROOM_MEMBER:"Ты больше не участник этой комнаты.",
    ARTIST_ONLY:"Рисовать может только выбранный сервером художник.",
    ARTIST_CANNOT_GUESS:"Художник не может угадывать собственное слово.",
    WORD_NOT_IN_CHOICES:"Выбери одно из предложенных слов."
  };
  for(const [key,value] of Object.entries(known)) if(message.includes(key)) return value;
  return message||"Не удалось выполнить действие. Проверь интернет и повтори.";
}
function rpc(name,args){
  if(!supabase) return Promise.reject(new Error("Supabase не загрузился."));
  return supabase.rpc(name,args).then(({data,error})=>{
    if(error) throw error;
    return data;
  });
}
function requireNetworkProfile(){
  if(!supabase||!state.profile||state.guest||!state.profile.id){
    toast("Сетевые комнаты доступны после входа в подтверждённый аккаунт QQCross.");
    return false;
  }
  return true;
}
async function loadProfile(userId){
  const {data,error}=await supabase.from("profiles").select("id,username,avatar,avatar_url,active_frame,active_title,wins,games,points").eq("id",userId).single();
  if(error) throw error;
  if(!data) throw new Error("Профиль QQCross не найден.");
  state.profile={...data,avatar:Number(data.avatar)||0};
  state.playerProfiles[String(data.id)]=state.profile;
  state.playerProfileUpdatedAt[String(data.id)]=Date.now();
  state.guest=false;
}
async function loadPartyProfiles(ids=[]){
  if(!state.playerProfiles)state.playerProfiles={};
  const unique=[...new Set((ids||[]).map(id=>String(id||"")).filter(Boolean))];
  if(state.profile?.id)state.playerProfiles[String(state.profile.id)]=state.profile;
  const missing=unique.filter(id=>!state.playerProfiles[id]||Date.now()-(state.playerProfileUpdatedAt[id]||0)>60000);
  if(!missing.length||!supabase)return;
  try{
    const {data,error}=await supabase.from("profiles").select("id,username,avatar,avatar_url,active_frame,active_title,wins,games,points").in("id",missing);
    if(error)throw error;
    (data||[]).forEach(profile=>{const id=String(profile.id);state.playerProfiles[id]=profile;state.playerProfileUpdatedAt[id]=Date.now()});
  }catch(error){console.warn("QQ Draw player profiles:",error)}
}
function playerCard(player={},options={}){
  const profile=state.playerProfiles[String(player.user_id||player.id||"")]||{};
  const merged={...player,...profile,username:profile.username||player.nickname||player.username,avatar_url:profile.avatar_url||player.avatar_url};
  if(window.QQIdentity?.cardMarkup)return window.QQIdentity.cardMarkup(merged,{size:options.size||"sm",compact:!!options.compact,clickable:false,score:options.score===undefined?player.score:options.score});
  return '<span class="avatar">'+avatar(player.avatar)+'</span><b>'+esc(player.nickname||player.username||"Игрок")+'</b>';
}
function stopWatch(){
  clearInterval(state.pollTimer);clearInterval(state.eventTimer);
  state.pollTimer=null;state.eventTimer=null;
  if(state.channel){supabase?.removeChannel(state.channel);state.channel=null;}
  document.removeEventListener("visibilitychange",onVisible);
}
function stopSolo(){
  clearInterval(state.soloTimer);clearTimeout(state.botTimer);
  state.soloTimer=null;state.botTimer=null;state.solo=null;
}
function render(){
  if(state.room){
    if(state.room.status==="waiting") renderLobby();
    else if(state.room.status==="choosing") renderChoosing();
    else renderOnlineGame();
    return;
  }
  if(state.solo){
    if(state.solo.mode==="setup") renderSoloSetup();
    else renderSoloGame();
    return;
  }
  renderHome();
}
function renderHome(){
  const account=state.profile
    ? (window.QQIdentity?.cardMarkup?window.QQIdentity.cardMarkup(state.profile,{size:"md",compact:true}):'<div class="profile"><span class="avatar">'+avatar(state.profile.avatar)+'</span><span class="profile-copy"><b>'+esc(state.profile.username)+'</b><small>Профиль QQCross</small></span></div>')
    : state.guest
      ? '<div class="profile"><span class="avatar">🙂</span><span class="profile-copy"><b>Гостевой режим</b><small>Только одиночная игра</small></span></div>'
      : '<div class="profile"><span class="avatar">👤</span><span class="profile-copy"><b>Не выполнен вход</b><small>Сетевые комнаты закрыты</small></span></div>';
  appRoot.innerHTML=
    '<section class="screen">'+
      '<header class="topbar"><div class="brand"><span class="logo">QQ</span><span>QQ DRAW</span></div>'+account+'</header>'+
      '<section class="hero card"><div class="small">РИСУЙ · УГАДЫВАЙ · ПЕРЕДАВАЙ ХОД</div><h1>Покажи слово рисунком</h1><p>Цифровой холст, общие догадки и очередность художников — всё синхронизируется между устройствами.</p>'+
        '<div class="btnrow"><button class="btn primary full" id="botDraw">Угадывать рисунок бота</button><button class="btn full" id="drawForBots">Рисовать для ботов</button></div></section>'+
      '<section class="card stack"><h2>Игра с друзьями</h2><p class="small muted">Используются авторизация, профили, ники, аватары и серверные комнаты QQCross. В мультиплеере допускаются только реальные подтверждённые аккаунты.</p>'+
        (state.profile?
          '<button class="btn primary full" id="createRoom">Создать комнату</button>'+
          '<p class="small muted">Присоединяйся к приглашениям от друзей через лобби QQCross. Ввод кодов не требуется.</p>'+
          '<button class="btn ghost full" id="signOut">Выйти из аккаунта</button>'
          :
          '<form id="loginForm" class="stack"><label class="label" for="email">Почта аккаунта QQCross</label><input class="field" id="email" type="email" autocomplete="email" required placeholder="name@example.com"><label class="label" for="password">Пароль</label><input class="field" id="password" type="password" autocomplete="current-password" required><button class="btn primary full" type="submit">Войти через QQCross</button><p class="small muted">Новый аккаунт здесь не создаётся. Используй существующий QQCross.</p></form>'+
          '<button class="btn full" id="guestMode">Одиночная игра без аккаунта</button>'+
          '<a class="link small" href="'+CONFIG.qqCrossUrl+'" target="_blank" rel="noopener">Открыть основной QQCross</a>'
        )+
      '</section>'+
      '<p class="small muted" style="text-align:center">Боты существуют только внутри локальной одиночной игры и не могут войти в сетевые комнаты.</p>'+
    '</section>';
  $("#botDraw").onclick=startBotArtistSolo;
  $("#drawForBots").onclick=()=>{state.solo={mode:"setup"};render();};
  $("#guestMode")?.addEventListener("click",()=>{state.guest=true;state.profile=null;startBotArtistSolo();});
  $("#loginForm")?.addEventListener("submit",signIn);
  $("#createRoom")?.addEventListener("click",createRoom);

  $("#signOut")?.addEventListener("click",signOut);
}
const requestedRoomCode = (() => {
  try { return (new URLSearchParams(location.search).get("room") || "").trim().toUpperCase(); }
  catch { return ""; }
})();
const requestedRoomId = (() => {
  try { return (new URLSearchParams(location.search).get("room_id") || "").trim(); }
  catch { return ""; }
})();
async function signIn(event){
  event.preventDefault();
  if(!supabase)return toast("Сервис авторизации не загрузился.");
  const button=event.currentTarget.querySelector("button[type=submit]");
  button.disabled=true;button.textContent="Входим…";
  try{
    const {data,error}=await supabase.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
    if(error)throw error;
    await loadProfile(data.user.id);
    if(requestedRoomId) {
      state.roomId=requestedRoomId;
      localStorage.setItem("qq-draw-room",state.roomId);
      await openRoom();
    } else if(requestedRoomCode) {
      const joined = await joinRoomByCode(requestedRoomCode);
      if(!joined) render();
    } else { toast("Вход через QQCross выполнен."); render(); }
  }catch(error){toast(friendlyError(error));}
  finally{button.disabled=false;button.textContent="Войти через QQCross";}
}
async function signOut(){
  stopWatch();stopSolo();
  try{const {error}=await supabase.auth.signOut();if(error)throw error;}
  catch(error){toast(friendlyError(error));return;}
  state.profile=null;state.guest=false;state.room=null;state.roomId=null;
  localStorage.removeItem("qq-draw-room");
  renderHome();
}
async function createRoom(){
  if(!requireNetworkProfile())return;
  const button=$("#createRoom");button.disabled=true;
  try{
    const data=await rpc("qq_party_create_room",{p_game:"crocodile",p_nickname:state.profile.username,p_player_limit:CONFIG.maxPlayers,p_public_state:{}});
    state.roomId=data.room_id;state.roomCode=data.code;
    localStorage.setItem("qq-draw-room",state.roomId);
    await openRoom();
  }catch(error){toast(friendlyError(error));button.disabled=false;}
}
function clearRoomInviteParam(){
  try{
    const url=new URL(location.href);
    if(!url.searchParams.has("room"))return;
    url.searchParams.delete("room");
    const query=url.searchParams.toString();
    history.replaceState(history.state,"",url.pathname+(query?"?"+query:"")+url.hash);
  }catch(error){console.warn("Invite URL cleanup:",error);}
}
async function joinRoomByCode(code){
  if(!requireNetworkProfile())return false;
  if(!/^[A-Z0-9]{6}$/.test(code)){clearRoomInviteParam();toast("Код приглашения должен содержать шесть символов.");return false;}
  try{
    const data=await rpc("qq_party_join_room",{p_code:code,p_nickname:state.profile.username});
    state.roomId=data.room_id;state.roomCode=data.code;
    localStorage.setItem("qq-draw-room",state.roomId);
    clearRoomInviteParam();
    await openRoom();
    return true;
  }catch(error){clearRoomInviteParam();toast(friendlyError(error));return false;}
}
async function joinRoom(event){
  event.preventDefault();if(!requireNetworkProfile())return;
  const button=event.currentTarget.querySelector("button[type=submit]");button.disabled=true;
  try{await joinRoomByCode($("#roomCode").value.trim().toUpperCase());}
  finally{button.disabled=false;}
}
async function openRoom(){
  stopWatch();
  const id=state.roomId||localStorage.getItem("qq-draw-room");
  if(!id)return;
  state.roomId=id;
  try{
    await refreshRoom(false);
    await syncDrawHistory();
    restorePendingDrawQueue();
    state.channel=supabase.channel("qq-draw-room-"+id)
      .on("postgres_changes",{event:"*",schema:"public",table:"qq_party_rooms",filter:"id=eq."+id},()=>refreshRoom())
      .on("postgres_changes",{event:"*",schema:"public",table:"qq_party_players",filter:"room_id=eq."+id},()=>refreshRoom())
      .on("postgres_changes",{event:"*",schema:"public",table:"qq_party_events",filter:"room_id=eq."+id},()=>refreshRoom())
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"qq_party_draw_events",filter:"room_id=eq."+id},()=>syncDrawHistory())
      .subscribe((status)=>{
        if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("QQ Draw Realtime:",status);
      });
    state.pollTimer=setInterval(()=>refreshRoom(),2200);
    state.eventTimer=setInterval(()=>syncDrawHistory(),1200);
    document.addEventListener("visibilitychange",onVisible);
  }catch(error){
    localStorage.removeItem("qq-draw-room");state.room=null;state.roomId=null;
    renderHome();toast(friendlyError(error));
  }
}
function onVisible(){if(document.visibilityState==="visible"&&state.roomId){refreshRoom();syncDrawHistory();}}
async function refreshRoom(showErrors=true){
  if(!state.roomId||!supabase)return;
  try{
    const data=await rpc("qq_party_get_room",{p_room_id:state.roomId});
    await loadPartyProfiles((data.players||[]).map(player=>player.user_id));
    const previousRound=state.room?.round_no;
    if(previousRound!==undefined&&previousRound!==data.round_no){
      removeDrawOutbox(state.roomId,previousRound);
      state.drawRound=data.round_no;state.drawEvents=[];state.lastServerSequence=0;state.nextSequence=1;
      state.drawQueue=[];state.drawBlocked=false;state.activeStrokeId=null;
      state.activeStrokePoint=null;state.activeStrokeStyle=null;
    }
    const changed=JSON.stringify(data)!==JSON.stringify(state.room);
    state.room=data;state.roomCode=data.code;
    if(data.status!=="playing"&&state.drawQueue.length){
      state.drawQueue=[];state.drawBlocked=false;state.activeStrokeId=null;
      state.activeStrokePoint=null;state.activeStrokeStyle=null;
      removeDrawOutbox(state.roomId,data.round_no);
    }
    if(changed)render();
    if(data.status!=="waiting")await syncDrawHistory();
  }catch(error){if(showErrors)console.warn("QQ Draw room refresh:",error);}
}
function isHost(){return Boolean(state.profile&&state.room?.host_id===state.profile.id);}
function isArtist(){return Boolean(state.profile&&state.room?.public_state?.artist_id===state.profile.id);}
function renderPlayers(players=[]){
  return players.map((p)=>'<div class="player qq-party-player"><div class="grow">'+playerCard(p,{size:"sm",score:p.score})+'</div><small>'+(String(p.user_id)===String(state.room?.host_id)?"Создатель комнаты":"Участник")+'</small></div>').join("");
}
function renderLobby(){
  const players=state.room.players||[];
  appRoot.innerHTML=
    '<section class="screen"><header class="topbar"><div class="brand"><span class="logo">QQ</span><span>QQ DRAW · ЛОББИ</span></div>'+(window.QQIdentity?.cardMarkup?window.QQIdentity.cardMarkup(state.profile||{},{size:"md",compact:true}):"")+'</header>'+
    '<section class="card"><b>Лобби QQCross</b><p class="small muted">Приглашай друзей из списка QQCross ниже. Принятые приглашения появятся здесь автоматически.</p></section>'+
    '<section class="card stack"><div class="game-meta"><b>Реальные участники</b><span>'+players.length+'/'+state.room.player_limit+'</span></div><div class="player-grid">'+renderPlayers(players)+'</div>'+
    '<div class="notice">'+(isHost()?"После входа друга можно начать раунд. Художник будет выбран сервером случайно.":"Ожидаем начала раунда от создателя.")+'</div>'+
    (isHost()?'<button class="btn primary full" id="startRound" '+(players.length<2?"disabled":"")+'>'+(state.busy?"Запуск…":"Начать рисование")+'</button>':"")+
    '<button class="btn ghost full" id="leaveRoom">Выйти из комнаты</button></section>'+
    '<section class="card stack"><h3>Пригласить друзей QQCross</h3><div id="roomFriends"><p class="small muted">Загружаем список друзей…</p></div></section></section>';

  $("#startRound")?.addEventListener("click",startOnlineRound);
  $("#leaveRoom").onclick=leaveRoom;
  loadRoomFriends();
}
async function loadRoomFriends(){
  const root=$("#roomFriends");if(!root||!state.roomId)return;
  try{
    const friends=await rpc("qq_party_list_friends",{p_room_id:state.roomId});
    if(!friends?.length){root.innerHTML='<p class="small muted">Добавь друзей в QQCross — здесь появится список для приглашения.</p>';return;}
    await loadPartyProfiles(friends.map(friend=>friend.user_id));
    root.innerHTML=friends.map(friend=>{
      const disabled=friend.in_room||friend.already_invited;
      const label=friend.in_room?"Уже в лобби":friend.already_invited?"Приглашение отправлено":"Пригласить";
      return '<div class="room-friend-row"><span class="grow">'+playerCard({...friend,user_id:friend.user_id},{size:"sm"})+'</span><button class="btn '+(disabled?"":"primary")+' room-friend-invite" data-id="'+esc(friend.user_id)+'" '+(disabled?"disabled":"")+'>'+label+'</button></div>';
    }).join("");
    root.querySelectorAll(".room-friend-invite:not(:disabled)").forEach(button=>button.addEventListener("click",async()=>{
      button.disabled=true;button.textContent="Отправляем…";
      try{
        const result=await rpc("qq_party_invite_friend",{p_room_id:state.roomId,p_friend_id:button.dataset.id});
        button.textContent=result.already_pending?"Уже приглашён":"Приглашение отправлено";
        toast(result.already_pending?"Приглашение уже отправлено.":"Приглашение отправлено другу QQCross.");
      }catch(error){button.disabled=false;button.textContent="Пригласить";toast(friendlyError(error));}
    }));
  }catch(error){root.innerHTML='<p class="small muted">Не удалось загрузить друзей: '+esc(friendlyError(error))+'</p>';}
}
async function copyCode(){
  try{await navigator.clipboard.writeText(state.roomCode||state.room?.code||"");toast("Код комнаты скопирован.");}
  catch{toast("Код комнаты: "+(state.roomCode||state.room?.code||""));}
}
async function startOnlineRound(){
  if(!isHost()||state.busy)return;
  state.busy=true;
  try{await rpc("qq_party_start_crocodile",{p_room_id:state.roomId,p_word:""});await refreshRoom();}
  catch(error){toast(friendlyError(error));}
  finally{state.busy=false;}
}
async function leaveRoom(){
  if(!state.roomId)return;
  try{await rpc("qq_party_leave_room",{p_room_id:state.roomId});}
  catch(error){console.warn("QQ Draw leave:",error);}
  removeDrawOutbox(state.roomId,state.room?.round_no);
  stopWatch();
  state.room=null;state.roomId=null;state.roomCode=null;state.drawEvents=[];state.drawQueue=[];
  state.activeStrokeId=null;state.activeStrokePoint=null;state.activeStrokeStyle=null;
  localStorage.removeItem("qq-draw-room");
  renderHome();
}
function renderChoosing(){
  const artist=state.room.public_state?.artist_id===state.profile?.id;
  const choices=state.room.private?.choices||[];
  appRoot.innerHTML=
    '<section class="screen"><header class="topbar"><div class="brand"><span class="logo">QQ</span><span>QQ DRAW</span></div><button class="btn ghost" id="leaveRoom">Выйти</button></header>'+
    '<div class="qq-score-strip">'+renderPlayers(state.room.players||[])+'</div>'+
    '<section class="card stack"><h2>'+(artist?"Выбери слово для рисунка":"Художник выбирает слово")+'</h2><p class="small muted">'+(artist?"Слово увидишь только ты. Можно обновить варианты сколько угодно раз.":"Остальные участники не увидят слово, пока раунд не закончится.")+'</p>'+
    (artist?'<div class="choice-grid">'+choices.map((word,i)=>'<button class="btn choice wordChoice" data-word="'+esc(word)+'">'+esc(word)+'</button>').join("")+'</div><button class="btn full" id="refreshChoices">Другие слова</button>':'<div class="notice">Ожидаем подтверждения слова художником…</div>')+
    '<div class="game-meta"><span>Раунд '+esc(state.room.round_no)+'</span><span>'+esc(state.room.players?.length||0)+' игроков</span></div></section></section>';
  $("#leaveRoom").onclick=leaveRoom;
  appRoot.querySelectorAll(".wordChoice").forEach((b)=>b.onclick=()=>confirmWord(b.dataset.word));
  $("#refreshChoices")?.addEventListener("click",refreshChoices);
}
async function refreshChoices(){
  try{await rpc("qq_party_refresh_croc_choices",{p_room_id:state.roomId});await refreshRoom();}
  catch(error){toast(friendlyError(error));}
}
async function confirmWord(word){
  if(state.busy)return;state.busy=true;
  try{await rpc("qq_party_confirm_croc_word",{p_room_id:state.roomId,p_word:word});await refreshRoom();}
  catch(error){toast(friendlyError(error));}
  finally{state.busy=false;}
}
function historyMarkup(guesses=[]){
  if(!guesses.length)return '<div class="small muted" style="text-align:center">Пока нет догадок. Отправить первую может любой игрок, кроме художника.</div>';
  return guesses.slice(-30).reverse().map((g)=>
    '<div class="guess-row"><div class="grow">'+playerCard({...g,user_id:g.user_id||state.room?.players?.find(player=>player.nickname===g.nickname)?.user_id},{size:"sm",compact:true})+'</div><span>'+(g.correct?'<strong class="success">'+esc(g.word)+'</strong>':esc(g.word))+'</span></div>'
  ).join("");
}
function drawToolsMarkup(enabled = isArtist() && state.room?.status === "playing"){
  if(!enabled)return "";
  return '<div class="tools">'+
    '<button class="tool-btn '+(!state.eraser?"active":"")+'" id="brush">Кисть</button>'+
    '<button class="tool-btn '+(state.eraser?"active":"")+'" id="eraser">Ластик</button>'+
    '<input class="color-input" id="colorPicker" aria-label="Цвет кисти" type="color" value="'+state.color+'">'+
    '<label class="small muted" for="thickness">Толщина</label><input class="thickness" id="thickness" type="range" min="1" max="32" value="'+state.thickness+'">'+
    '<button class="tool-btn" id="undo">↶</button><button class="tool-btn" id="clear">Очистить</button></div>';
}
function renderOnlineGame(){
  const room=state.room;
  const guesses=room.public_state?.guesses||[];
  const playersWithScore=(room.players||[]).map(player=>({...player,score:guesses.filter(guess=>String(guess.user_id)===String(player.user_id)&&guess.correct).length}));
  const artist=isArtist();
  const finished=room.status==="finished";
  const winner=(guesses||[]).find((g)=>g.correct);
  const topMessage=finished
    ? '<div class="result"><h2 class="success">Слово угадано!</h2><p>'+playerCard({...winner,user_id:winner?.user_id||room.players?.find(player=>player.nickname===winner?.nickname)?.user_id},{size:"md"})+'</p><p>Ответ: <strong>'+esc(room.public_state?.solution||"")+'</strong></p></div>'
    : '<div class="game-meta"><span>'+(artist?"Ты художник — рисуй слово":"Угадывай рисунок")+'</span><span>Раунд '+esc(room.round_no)+'</span></div>';
  appRoot.innerHTML=
    '<section class="screen"><header class="topbar"><div class="brand"><span class="logo">QQ</span><span>QQ DRAW</span></div><button class="btn ghost" id="leaveRoom">Выйти</button></header>'+
    '<section class="card stack">'+topMessage+
      '<div class="qq-score-strip">'+renderPlayers(playersWithScore)+'</div>'+
      '<div class="canvas-wrap"><canvas id="drawCanvas" aria-label="Игровой холст"></canvas><span class="canvas-label">'+(artist?"Твой холст": "Рисунок художника")+'</span></div>'+
      drawToolsMarkup(artist&&!finished)+
      (artist&&!finished?'<div class="notice">Секретное слово: <strong>'+esc(room.private?.word||"")+'</strong>. Рисуй, не пиши буквы.</div>':'')+
    '</section>'+
    '<section class="card stack"><div class="game-meta"><b>История догадок</b><span>'+guesses.length+'</span></div><div class="guess-history">'+historyMarkup(guesses)+'</div>'+
      (!finished&&!artist?'<form id="guessForm" class="guess-form"><input class="field" id="guessInput" maxlength="30" autocomplete="off" placeholder="Что нарисовано?" required><button class="btn primary" type="submit">Отправить</button></form>':"")+
      (finished?(String(room.public_state?.solved_by)===String(state.profile?.id)?'<button class="btn primary full" id="nextRound">Теперь ты художник</button>':'<div class="notice">Следующий художник — игрок, который угадал слово. Ожидаем его действия.</div>'):"")+
    '</section></section>';
  $("#leaveRoom").onclick=leaveRoom;
  $("#guessForm")?.addEventListener("submit",submitOnlineGuess);
  $("#brush")?.addEventListener("click",()=>{state.eraser=false;render();});
  $("#eraser")?.addEventListener("click",()=>{state.eraser=true;render();});
  $("#colorPicker")?.addEventListener("input",(e)=>{state.color=e.target.value;});
  $("#thickness")?.addEventListener("input",(e)=>{state.thickness=Number(e.target.value);});
  $("#undo")?.addEventListener("click",undoDrawing);
  $("#clear")?.addEventListener("click",clearDrawing);
  $("#nextRound")?.addEventListener("click",startNextRound);
  setupCanvas();
}
async function submitOnlineGuess(event){
  event.preventDefault();
  const input=$("#guessInput");const word=normalizeDrawWord(input.value);
  if(!word||word.length>30)return;
  const button=event.currentTarget.querySelector("button");button.disabled=true;
  try{await rpc("qq_party_croc_guess",{p_room_id:state.roomId,p_word:word});input.value="";await refreshRoom();}
  catch(error){toast(friendlyError(error));}
  finally{button.disabled=false;}
}
async function startNextRound(){
  try{await rpc("qq_party_next_croc_round",{p_room_id:state.roomId,p_word:""});await refreshRoom();}
  catch(error){toast(friendlyError(error));}
}
function getCanvas(){
  return $("#drawCanvas");
}
function setupCanvas(){
  const canvas=getCanvas();if(!canvas)return;
  const bounds=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);
  const width=Math.max(1,Math.round(bounds.width*dpr)),height=Math.max(1,Math.round(bounds.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  renderCanvas();
  if(state.solo?.mode==="bot_draws"){drawBotSketch(state.solo.word);state.solo.drawn=true;}
  if(isArtist()||(state.solo?.mode==="user_draws"))attachDrawing(canvas);
}
function context(){
  const canvas=getCanvas();if(!canvas)return null;
  const ctx=canvas.getContext("2d");if(!ctx)return null;
  ctx.fillStyle="#f7f4f1";ctx.fillRect(0,0,canvas.width,canvas.height);
  return {ctx,canvas};
}
function renderCanvas(){
  const result=context();if(!result)return;
  const ctx=result.ctx,canvas=result.canvas;
  const strokes=replayDrawingEvents(state.drawEvents);
  ctx.lineCap="round";ctx.lineJoin="round";
  for(const stroke of strokes){
    if(!stroke.points.length)continue;
    ctx.beginPath();ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.thickness*(canvas.width/Math.max(1,canvas.clientWidth));
    ctx.moveTo(stroke.points[0].x*canvas.width,stroke.points[0].y*canvas.height);
    for(let i=1;i<stroke.points.length;i++)ctx.lineTo(stroke.points[i].x*canvas.width,stroke.points[i].y*canvas.height);
    if(stroke.points.length===1){ctx.lineTo(stroke.points[0].x*canvas.width+0.2,stroke.points[0].y*canvas.height+0.2);}
    ctx.stroke();
  }
}
function drawLocalSegment(from,to,style){
  const canvas=getCanvas();if(!canvas)return;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  const sx=canvas.width/Math.max(1,canvas.clientWidth);
  const sy=canvas.height/Math.max(1,canvas.clientHeight);
  ctx.save();
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.strokeStyle=style.color;
  ctx.lineWidth=style.thickness*sx;
  ctx.beginPath();
  ctx.moveTo(from.x*canvas.width,from.y*canvas.height);
  ctx.lineTo(to.x*canvas.width,to.y*canvas.height);
  if(from.x===to.x&&from.y===to.y){
    ctx.lineTo(to.x*canvas.width+0.2*sx,to.y*canvas.height+0.2*sy);
  }
  ctx.stroke();
  ctx.restore();
}
function canvasPoint(event,canvas){
  const rect=canvas.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
}
function localCanDraw(){
  return Boolean((state.solo?.mode==="user_draws"&&state.solo.status==="playing")||(!state.solo&&state.room?.status==="playing"&&isArtist()));
}
function attachDrawing(canvas){
  if(canvas.dataset.bound==="1")return;
  canvas.dataset.bound="1";
  canvas.addEventListener("pointerdown",(event)=>{
    if(!localCanDraw()||state.drawBlocked)return;
    event.preventDefault();canvas.setPointerCapture?.(event.pointerId);
    const point=canvasPoint(event,canvas);
    const strokeId=state.nextSequence;
    state.activeStrokeId=strokeId;
    state.lastMoveAt=0;
    sendDrawEvent("begin",point,strokeId);
  });
  canvas.addEventListener("pointermove",(event)=>{
    if(state.activeStrokeId===null||!localCanDraw())return;
    event.preventDefault();
    const now=performance.now();
    if(now-state.lastMoveAt<55)return;
    state.lastMoveAt=now;
    sendDrawEvent("move",canvasPoint(event,canvas),state.activeStrokeId);
  });
  const finish=(event)=>{
    if(state.activeStrokeId===null)return;
    if(event.cancelable)event.preventDefault();
    const strokeId=state.activeStrokeId;state.activeStrokeId=null;
    sendDrawEvent("end",canvasPoint(event,canvas),strokeId);
  };
  canvas.addEventListener("pointerup",finish);
  canvas.addEventListener("pointercancel",finish);
}
function currentRoundId(){
  return state.room?state.room.id+":"+state.room.round_no:"solo:"+String(state.solo?.round||1);
}
function sendDrawEvent(type,point,strokeId){
  const sequence=state.nextSequence++;
  const userId=state.profile?.id||"solo-player";
  if(type==="begin"){
    state.activeStrokeStyle={
      color:state.eraser?"#f7f4f1":state.color,
      thickness:Math.max(1,Math.min(32,Number(state.thickness)||5))
    };
  }
  const style=state.activeStrokeStyle||{
    color:state.eraser?"#f7f4f1":state.color,
    thickness:Math.max(1,Math.min(32,Number(state.thickness)||5))
  };
  const payload={
    roundId:currentRoundId(),playerId:userId,type,sequence,strokeId,
    x:Number(point.x.toFixed(5)),y:Number(point.y.toFixed(5)),
    color:style.color,thickness:style.thickness
  };
  const event={roundId:payload.roundId,playerId:userId,type,sequence,strokeId,payload};
  state.drawEvents.push(event);
  const from=type==="begin"?point:(state.activeStrokePoint||point);
  drawLocalSegment(from,point,style);
  state.activeStrokePoint=type==="end"?null:point;
  if(type==="end")state.activeStrokeStyle=null;
  if(!state.room)return;
  state.drawQueue.push(payload);
  persistDrawQueue();
  drainDrawQueue();
}
function drawOutboxKey(roomId,roundNo){
  return "qq-draw-outbox:"+String(roomId)+":"+String(roundNo);
}
function removeDrawOutbox(roomId,roundNo){
  try{localStorage.removeItem(drawOutboxKey(roomId,roundNo));}
  catch(error){console.warn("QQ Draw outbox cleanup:",error);}
}
function persistDrawQueue(){
  if(!state.roomId||!state.room?.round_no)return;
  try{
    const key=drawOutboxKey(state.roomId,state.room.round_no);
    if(state.drawQueue.length)localStorage.setItem(key,JSON.stringify(state.drawQueue));
    else localStorage.removeItem(key);
  }catch(error){console.warn("QQ Draw outbox save:",error);}
}
function restorePendingDrawQueue(){
  if(!state.roomId||!state.room)return;
  const roundNo=state.room.round_no;
  if(state.room.status!=="playing"||!isArtist()){
    removeDrawOutbox(state.roomId,roundNo);
    return;
  }
  let stored=[];
  try{stored=JSON.parse(localStorage.getItem(drawOutboxKey(state.roomId,roundNo))||"[]");}
  catch{stored=[];}
  if(!Array.isArray(stored)){removeDrawOutbox(state.roomId,roundNo);return;}
  const roundId=currentRoundId();
  state.drawQueue=stored.filter((payload)=>
    payload&&payload.roundId===roundId&&payload.playerId===state.profile.id&&
    ["begin","move","end"].includes(payload.type)&&
    Number.isSafeInteger(Number(payload.sequence))&&Number(payload.sequence)>0
  ).sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  for(const payload of state.drawQueue){
    const sequence=Number(payload.sequence);
    if(!state.drawEvents.some((item)=>Number(item.sequence)===sequence)){
      state.drawEvents.push({
        roundId:payload.roundId,playerId:payload.playerId,type:payload.type,
        sequence,strokeId:Number(payload.strokeId),payload
      });
    }
    state.nextSequence=Math.max(state.nextSequence,sequence+1);
  }
  state.drawEvents.sort((a,b)=>Number(a.sequence)-Number(b.sequence));
  persistDrawQueue();
  if(state.drawQueue.length){
    state.drawBlocked=false;
    renderCanvas();
    drainDrawQueue();
  }
}
async function drainDrawQueue(){
  if(state.sendingDraw||state.drawBlocked||!state.roomId)return;
  if(!state.room||state.room.status!=="playing"||!isArtist()){
    state.drawQueue=[];persistDrawQueue();return;
  }
  state.sendingDraw=true;
  try{
    while(state.drawQueue.length){
      const payload=state.drawQueue[0];
      const sendingRoomId=state.roomId;
      const sendingRoundId=payload.roundId;
      if(sendingRoundId!==currentRoundId()){
        if(state.drawQueue[0]===payload)state.drawQueue.shift();
        persistDrawQueue();
        continue;
      }
      await rpc("qq_party_add_stroke",{p_room_id:sendingRoomId,p_stroke:payload});
      if(state.roomId===sendingRoomId&&currentRoundId()===sendingRoundId){
        if(state.drawQueue[0]===payload)state.drawQueue.shift();
        state.lastServerSequence=Math.max(state.lastServerSequence,Number(payload.sequence));
        persistDrawQueue();
      }
    }
  }catch(error){
    state.drawBlocked=true;
    persistDrawQueue();
    toast("Штрих сохранён на этом устройстве и будет повторён после восстановления связи: "+friendlyError(error));
  }finally{state.sendingDraw=false;}
}
async function syncDrawHistory(){
  if(!state.roomId||!state.room||state.room.game!=="crocodile")return;
  try{
    let more=true;
    let canvasChanged=false;
    while(more){
      const data=await rpc("qq_party_get_draw_events",{p_room_id:state.roomId,p_after_sequence:state.lastServerSequence});
      if(Number(data.round_no)!==Number(state.room.round_no)){
        state.drawRound=data.round_no;state.drawEvents=[];state.lastServerSequence=0;state.nextSequence=1;
        state.activeStrokeId=null;state.activeStrokePoint=null;state.activeStrokeStyle=null;
        canvasChanged=true;more=true;continue;
      }
      const events=Array.isArray(data.events)?data.events:[];
      for(const item of events){
        const event={
          roundId:item.roundId,playerId:item.playerId,type:item.type,
          sequence:Number(item.sequence),
          strokeId:item.strokeId===null?null:Number(item.strokeId),
          payload:item.payload||{}
        };
        const result=appendOrderedEvent(state.drawEvents,event);
        if(result.duplicate&&!result.accepted)throw new Error("DRAW_SEQUENCE_CONFLICT");
        if(!result.accepted&&!result.duplicate){
          if(result.reason==="SEQUENCE_GAP")throw new Error("DRAW_SEQUENCE_GAP");
          if(result.reason==="SEQUENCE_CONFLICT")throw new Error("DRAW_SEQUENCE_CONFLICT");
        }
        if(result.accepted&&!result.duplicate){
          state.drawEvents=result.events;
          canvasChanged=true;
        }
        state.lastServerSequence=Math.max(state.lastServerSequence,Number(event.sequence));
      }
      state.nextSequence=Math.max(state.nextSequence,state.lastServerSequence+1);
      more=Boolean(data.has_more);
      if(!events.length)more=false;
    }
    if(state.room.status==="playing"&&isArtist()){
      state.drawBlocked=false;
      if(state.drawQueue.length)drainDrawQueue();
    }else if(state.drawQueue.length){
      state.drawQueue=[];persistDrawQueue();
    }
    if(canvasChanged)renderCanvas();
  }catch(error){
    if(String(error?.message||"").includes("DRAW_SEQUENCE_GAP"))console.warn("QQ Draw cursor gap; request full replay on next poll.");
    else console.warn("QQ Draw event recovery:",error);
  }
}
async function clearDrawing(){
  if(state.sendingDraw||state.drawQueue.length)return toast("Дождись сохранения текущих штрихов.");
  if(state.room){
    try{const data=await rpc("qq_party_clear_canvas",{p_room_id:state.roomId});state.lastServerSequence=Number(data.sequence)-1;await syncDrawHistory();}
    catch(error){toast(friendlyError(error));}
  }else{
    const sequence=state.nextSequence++;
    state.drawEvents.push({type:"clear",sequence,strokeId:null,payload:{}});
    renderCanvas();
  }
}
async function undoDrawing(){
  if(state.sendingDraw||state.drawQueue.length)return toast("Дождись сохранения текущих штрихов.");
  const strokes=replayDrawingEvents(state.drawEvents);
  const last=strokes[strokes.length-1];if(!last)return toast("Пока нечего отменять.");
  if(state.room){
    try{const data=await rpc("qq_party_undo_canvas",{p_room_id:state.roomId,p_stroke_id:last.id});state.lastServerSequence=Number(data.sequence)-1;await syncDrawHistory();}
    catch(error){toast(friendlyError(error));}
  }else{
    const sequence=state.nextSequence++;
    state.drawEvents.push({type:"undo",sequence,strokeId:last.id,payload:{strokeId:last.id}});
    renderCanvas();
  }
}
async function finishSoloGuess(event){
  event.preventDefault();const input=$("#guessInput");const guess=normalizeDrawWord(input.value);
  if(!guess)return;
  const solo=state.solo;if(!solo||solo.mode!=="bot_draws")return;
  solo.guesses.push({word:guess,nickname:state.profile?.username||"Ты",avatar:state.profile?.avatar||0,correct:guess===normalizeDrawWord(solo.word)});
  if(solo.guesses[solo.guesses.length-1].correct){solo.status="finished";clearTimeout(state.botTimer);}
  input.value="";renderSoloGame();
}
function startBotArtistSolo(){
  stopWatch();stopSolo();
  const sketches=["арбуз","солнце","рыба","кошка","машина","пицца","велосипед","домино"];
  const word=sketches[Math.floor(Math.random()*sketches.length)];
  state.room=null;state.roomId=null;state.screen="solo";
  state.drawEvents=[];state.lastServerSequence=0;state.nextSequence=1;
  state.activeStrokeId=null;state.activeStrokePoint=null;state.activeStrokeStyle=null;
  state.solo={mode:"bot_draws",word,guesses:[],status:"playing",drawn:false,round:1};
  render();
}
function renderSoloSetup(){
  appRoot.innerHTML=
    '<section class="screen"><header class="topbar"><div class="brand"><span class="logo">QQ</span><span>ОДИНОЧНАЯ ИГРА</span></div><button class="btn ghost" id="soloBack">Назад</button></header>'+
    '<section class="card stack"><h2>Ты художник</h2><p class="small muted">Напиши слово, которое будут угадывать два простых бота. Они не получают твой ответ и пробуют случайные варианты с задержкой.</p>'+
    '<form id="soloSetupForm" class="stack"><label class="label" for="soloWord">Секретное слово</label><input class="field" id="soloWord" maxlength="20" minlength="4" autocomplete="off" placeholder="Например, велосипед" required><button class="btn primary full" type="submit">Начать рисовать</button></form></section></section>';
  $("#soloBack").onclick=()=>{state.solo=null;renderHome();};
  $("#soloSetupForm").onsubmit=(e)=>{
    e.preventDefault();const word=normalizeDrawWord($("#soloWord").value);
    if(!/^[а-яё]{4,20}$/.test(word))return toast("Введи одно русское слово длиной от 4 до 20 букв.");
    startUserArtistSolo(word);
  };
}
function startUserArtistSolo(word){
  stopSolo();stopWatch();state.room=null;state.roomId=null;state.drawEvents=[];state.lastServerSequence=0;state.nextSequence=1;state.activeStrokeId=null;
  state.activeStrokeId=null;state.activeStrokePoint=null;state.activeStrokeStyle=null;
  state.solo={mode:"user_draws",word,guesses:[],status:"playing",round:1,botStatus:"Загружаем модель распознавания…"};
  const session=state.solo;
  scheduleBotGuess();render();
  loadDrawingModel().then(()=>{
    if(state.solo!==session||session.status!=="playing")return;
    session.botStatus="Нейросеть готова. Рисуй, боты будут угадывать.";
    const node=$("#botStatus");if(node)node.textContent=session.botStatus;
  }).catch(()=>{
    if(state.solo!==session||session.status!=="playing")return;
    session.botStatus="Используется локальный резервный распознаватель.";
    const node=$("#botStatus");if(node)node.textContent=session.botStatus;
  });
}
function scheduleBotGuess(){
  clearTimeout(state.botTimer);
  const solo=state.solo;if(!solo||solo.mode!=="user_draws"||solo.status!=="playing")return;
  const wait=9000+Math.floor(Math.random()*11000);
  state.botTimer=setTimeout(async()=>{
    const current=state.solo;if(!current||current.status!=="playing")return;
    const used=new Set(current.guesses.map((g)=>normalizeDrawWord(g.word)));
    const eventCount=state.drawEvents.length;
    const strokes=replayDrawingEvents(state.drawEvents);
    let predictions=[];
    try{predictions=await predictDrawing(strokes);}
    catch(error){console.warn("QQ Draw model prediction:",error);}
    if(state.solo!==current||current.status!=="playing")return;
    if(state.drawEvents.length!==eventCount){scheduleBotGuess();return;}
    const ranked=[...predictions,...recognizeDrawing(strokes)].filter((item,index,all)=>all.findIndex(other=>normalizeDrawWord(other.word)===normalizeDrawWord(item.word))===index).sort((left,right)=>right.confidence-left.confidence);
    const recognized=ranked.find((item)=>!used.has(normalizeDrawWord(item.word)));
    if(!recognized){
      current.botStatus=state.drawEvents.length?"Пока не распознали рисунок. Попробуй сделать контуры понятнее и добавить характерные детали.":"Боты ждут, пока на холсте появится рисунок.";
      renderSoloGame();
      if(current.status==="playing")scheduleBotGuess();
      return;
    }
    const guess=recognized.word;
    current.botStatus="Боты анализируют рисунок.";
    const correct=normalizeDrawWord(guess)===normalizeDrawWord(current.word);
    current.guesses.push({word:guess,nickname:Math.random()<.5?"Бот Соня":"Бот Макс",avatar:Math.random()<.5?4:1,correct,confidence:recognized.confidence});
    if(correct)current.status="finished";
    renderSoloGame();
    if(current.status==="playing")scheduleBotGuess();
  },wait);
}
function renderSoloGame(){
  const solo=state.solo;if(!solo)return;
  const botArtist=solo.mode==="bot_draws";
  const guesses=solo.guesses||[];
  const finished=solo.status==="finished";
  appRoot.innerHTML=
    '<section class="screen"><header class="topbar"><div class="brand"><span class="logo">QQ</span><span>ОДИНОЧНАЯ ИГРА</span></div>'+(window.QQIdentity?.cardMarkup&&state.profile?window.QQIdentity.cardMarkup(state.profile,{size:"sm",compact:true}):"")+'<button class="btn ghost" id="soloExit">В меню</button></header>'+
    '<section class="card stack"><div class="game-meta"><span>'+(botArtist?"Бот рисует":"Ты рисуешь")+'</span><span>'+guesses.length+' догадок</span></div>'+
      '<div class="canvas-wrap"><canvas id="drawCanvas" aria-label="Одиночный холст"></canvas><span class="canvas-label">'+(botArtist?"Рисунок бота":"Твой рисунок")+'</span></div>'+
      (botArtist&&!finished?'<form id="guessForm" class="guess-form"><input class="field" id="guessInput" maxlength="30" autocomplete="off" placeholder="Что нарисовано?" required><button class="btn primary" type="submit">Угадать</button></form>':"")+
      (!botArtist?'<div class="tools"><button class="tool-btn '+(!state.eraser?"active":"")+'" id="brush">Кисть</button><button class="tool-btn '+(state.eraser?"active":"")+'" id="eraser">Ластик</button><input class="color-input" id="colorPicker" type="color" value="'+state.color+'"><label class="small muted" for="thickness">Толщина</label><input class="thickness" id="thickness" type="range" min="1" max="32" value="'+state.thickness+'"><button class="tool-btn" id="undo">↶</button><button class="tool-btn" id="clear">Очистить</button></div>':"")+
      (finished?'<div class="result"><h2 class="success">Слово угадано!</h2><p>Ответ: <strong>'+esc(solo.word)+'</strong></p><button class="btn primary full" id="again">Ещё раунд</button></div>':"")+
      (!botArtist?'<div class="notice">Секретное слово: <strong>'+esc(solo.word)+'</strong>. Боты анализируют рисунок и не получают ответ напрямую. <span id="botStatus">'+esc(solo.botStatus||"Рисуй крупно и добавляй характерные детали.")+'</span></div>':"")+
    '</section>'+
    '<section class="card stack"><div class="game-meta"><b>История догадок</b><span>'+guesses.length+'</span></div><div class="guess-history">'+historyMarkup(guesses)+'</div></section></section>';
  $("#soloExit").onclick=()=>{stopSolo();state.drawEvents=[];renderHome();};
  $("#guessForm")?.addEventListener("submit",finishSoloGuess);
  $("#brush")?.addEventListener("click",()=>{state.eraser=false;renderSoloGame();setupCanvas();});
  $("#eraser")?.addEventListener("click",()=>{state.eraser=true;renderSoloGame();setupCanvas();});
  $("#colorPicker")?.addEventListener("input",(e)=>{state.color=e.target.value;});
  $("#thickness")?.addEventListener("input",(e)=>{state.thickness=Number(e.target.value);});
  $("#undo")?.addEventListener("click",undoDrawing);
  $("#clear")?.addEventListener("click",clearDrawing);
  $("#again")?.addEventListener("click",()=>botArtist?startBotArtistSolo():startUserArtistSolo(solo.word));
  setupCanvas();
}
function drawBotSketch(word){
  const result=context();if(!result)return;
  const ctx=result.ctx,w=result.canvas.width,h=result.canvas.height;
  const scale=w/Math.max(1,result.canvas.clientWidth);
  ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#39303b";ctx.lineWidth=4*scale;
  const oval=(x,y,rx,ry)=>{ctx.beginPath();ctx.ellipse(x*w,y*h,rx*w,ry*h,0,0,Math.PI*2);ctx.stroke();};
  const line=(points)=>{ctx.beginPath();ctx.moveTo(points[0][0]*w,points[0][1]*h);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0]*w,points[i][1]*h);ctx.stroke();};
  const fill=(x,y,r)=>{ctx.beginPath();ctx.arc(x*w,y*h,r*w,0,Math.PI*2);ctx.fillStyle="#d9d0d4";ctx.fill();ctx.stroke();};
  switch(normalizeDrawWord(word)){
    case "арбуз": oval(.5,.52,.29,.2);line([[.35,.38],[.39,.49],[.4,.61],[.36,.7]]);line([[.5,.32],[.49,.44],[.51,.56],[.5,.71]]);line([[.63,.36],[.61,.48],[.62,.62],[.65,.68]]);break;
    case "солнце": oval(.5,.49,.13,.13);for(let i=0;i<12;i++){const a=i*Math.PI/6;line([[.5+Math.cos(a)*.18,.49+Math.sin(a)*.18],[.5+Math.cos(a)*.29,.49+Math.sin(a)*.29]]);}break;
    case "рыба": oval(.48,.5,.25,.13);line([[.23,.5],[.08,.37],[.08,.63],[.23,.5]]);fill(.62,.47,.012);line([[.43,.38],[.52,.25],[.58,.38]]);break;
    case "кошка": fill(.5,.5,.16);line([[.38,.38],[.35,.2],[.47,.31]]);line([[.53,.31],[.65,.2],[.62,.39]]);fill(.45,.48,.012);fill(.55,.48,.012);line([[.48,.55],[.5,.58],[.52,.55]]);break;
    case "машина": line([[.17,.58],[.22,.43],[.65,.43],[.82,.58],[.85,.7],[.15,.7],[.17,.58]]);oval(.3,.72,.07,.07);oval(.7,.72,.07,.07);line([[.32,.44],[.43,.3],[.61,.3],[.7,.44]]);break;
    case "пицца": line([[.5,.18],[.22,.76],[.8,.76],[.5,.18]]);oval(.46,.56,.04,.04);oval(.58,.67,.035,.035);oval(.43,.7,.03,.03);break;
    case "велосипед": oval(.29,.65,.13,.13);oval(.72,.65,.13,.13);line([[.29,.65],[.47,.4],[.58,.65],[.29,.65],[.72,.65],[.58,.65],[.72,.4]]);break;
    case "домино": line([[.3,.23],[.68,.23],[.68,.78],[.3,.78],[.3,.23]]);line([[.3,.5],[.68,.5]]);fill(.42,.39,.018);fill(.56,.62,.018);fill(.44,.68,.018);break;
    default: oval(.5,.49,.2,.2);line([[.3,.49],[.7,.49]]);line([[.5,.29],[.5,.69]]);fill(.45,.45,.014);fill(.56,.55,.014);line([[.39,.6],[.62,.37]]);break;
  }
}
function restoreKeyboard(){
  document.addEventListener("keydown",(event)=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(state.solo?.mode==="bot_draws"){
      const input=$("#guessInput");if(!input||document.activeElement===input)return;
      if(event.key==="Enter"){finishSoloGuess({preventDefault(){}});return;}
    }
  });
}
async function restore(){
  if(supabase){
    try{
      const {data,error}=await supabase.auth.getSession();if(error)throw error;
      if(data.session?.user?.id)await loadProfile(data.session.user.id);
      if(state.profile&&requestedRoomId){state.roomId=requestedRoomId;localStorage.setItem("qq-draw-room",state.roomId);await openRoom();}
      else if(state.profile&&requestedRoomCode)await joinRoomByCode(requestedRoomCode);
      else {
        const saved=localStorage.getItem("qq-draw-room");
        if(saved&&state.profile){state.roomId=saved;await openRoom();}
      }
    }catch(error){console.warn("QQ Draw auth restore:",error);toast(friendlyError(error));}
  }
  render();restoreKeyboard();
}
restore();