import {
  TEAM_WORDS,
  TEAM_WORD_REVEAL_INTERVAL_MS,
  normalizeWord,
  revealRandomLetter,
  scoreWordGuess,
  chooseTeamBotGuess
} from "./game-logic.mjs";

const CONFIG = window.QQ_CONFIG;
const AVATARS = ["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const $ = (selector) => document.querySelector(selector);
const app = $("#app");
const state = {
  profile: null,
  guest: false,
  screen: "home",
  roomId: null,
  room: null,
  channel: null,
  pollTimer: null,
  input: "",
  busy: false,
  solo: null,
  soloTimer: null,
  botTimer: null
};

const supabase = window.supabase?.createClient
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
  : null;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}
function avatar(index) {
  return AVATARS[Number.isInteger(Number(index)) ? Math.max(0,Math.min(9,Number(index))) : 0];
}
function toast(message) {
  let node = $(".toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "toast";
    document.body.append(node);
  }
  node.textContent = message;
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.remove(), 2400);
}
function friendlyError(error) {
  const message = String(error?.message || error || "");
  const known = {
    AUTH_REQUIRED: "Сначала войди в аккаунт QQCross.",
    VERIFIED_ACCOUNT_REQUIRED: "Для сетевой игры подтверди почту аккаунта QQCross.",
    PROFILE_REQUIRED: "Профиль QQCross не найден. Открой основной QQCross и восстанови профиль.",
    NEED_TWO_PLAYERS: "Для командного раунда нужны минимум два реальных игрока.",
    ROOM_FULL: "В комнате больше нет свободных мест.",
    ROOM_NOT_FOUND: "Комната не найдена или уже закрыта.",
    NOT_A_ROOM_MEMBER: "Тебя больше нет в этой комнате.",
    INVALID_WORD_LENGTH: "В слове должно быть ровно указанное число букв.",
    DUPLICATE_GUESS: "Это слово уже есть в общей истории."
  };
  for (const [key, value] of Object.entries(known)) if (message.includes(key)) return value;
  return message || "Не удалось выполнить действие. Проверь подключение.";
}
function requireNetworkProfile() {
  if (!supabase || !state.profile || state.guest || !state.profile.id) {
    toast("Сетевые комнаты доступны после входа в подтверждённый аккаунт QQCross.");
    return false;
  }
  return true;
}
async function loadProfile(userId) {
  if (!supabase) throw new Error("Supabase SDK не загрузился.");
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,avatar")
    .eq("id", userId)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Профиль QQCross не найден.");
  state.profile = { id: data.id, username: data.username, avatar: Number(data.avatar) || 0 };
  state.guest = false;
}
function stopRoomWatch() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
  if (state.channel) {
    supabase?.removeChannel(state.channel);
    state.channel = null;
  }
}
function stopSolo() {
  clearInterval(state.soloTimer);
  clearTimeout(state.botTimer);
  state.soloTimer = null;
  state.botTimer = null;
  state.solo = null;
}
function render() {
  if (state.room) {
    if (state.room.status === "waiting") renderLobby();
    else renderOnlineGame();
    return;
  }
  if (state.solo) {
    renderSoloGame();
    return;
  }
  if (!state.profile && !state.guest) {
    renderHome();
    return;
  }
  renderHome();
}
function renderHome() {
  const user = state.profile
    ? '<div class="profile"><span class="avatar">'+avatar(state.profile.avatar)+'</span><span class="profile-copy"><b>'+esc(state.profile.username)+'</b><small>Профиль QQCross</small></span></div>'
    : state.guest
      ? '<div class="profile"><span class="avatar">🙂</span><span class="profile-copy"><b>Гостевой режим</b><small>Только одиночная игра</small></span></div>'
      : '<div class="profile"><span class="avatar">👤</span><span class="profile-copy"><b>Не выполнен вход</b><small>Сетевые комнаты закрыты</small></span></div>';
  app.innerHTML = `
    <section class="screen">
      <header class="topbar">
        <div class="brand"><span class="logo">QQ</span><span>TEAM WORD</span></div>
        ${user}
      </header>
      <section class="hero card">
        <div class="small">КОМАНДНАЯ ИГРА QQCROSS</div>
        <h1>Одно слово. Одна команда.</h1>
        <p>Все участники угадывают общий ответ, видят одни и те же буквы и историю попыток.</p>
        <div class="btnrow">
          <button class="btn primary full" id="soloStart">Играть одному с ботами</button>
        </div>
      </section>
      <section class="card stack">
        <h2>Игра с друзьями</h2>
        <p class="small muted">Комнаты, профили, ники и аватары используют общий Supabase QQCross. В сетевой игре участвуют только подтверждённые аккаунты.</p>
        ${state.profile ? `
          <button class="btn primary full" id="createRoom">Создать комнату</button>
          <form id="joinForm" class="stack">
            <label class="label" for="roomCode">Код комнаты друга</label>
            <input class="field" id="roomCode" inputmode="text" maxlength="6" autocomplete="off" placeholder="Например, A7K2Q9">
            <button class="btn full" type="submit">Войти в комнату</button>
          </form>
          <button class="btn ghost full" id="signOut">Выйти из аккаунта</button>
        ` : `
          <form id="loginForm" class="stack">
            <label class="label" for="email">Почта аккаунта QQCross</label>
            <input class="field" id="email" type="email" autocomplete="email" required placeholder="name@example.com">
            <label class="label" for="password">Пароль</label>
            <input class="field" id="password" type="password" autocomplete="current-password" required>
            <button class="btn primary full" type="submit">Войти через QQCross</button>
            <p class="small muted">Новый аккаунт создаётся в основном QQCross. Здесь используется та же система авторизации, а не отдельная регистрация.</p>
          </form>
          <button class="btn full" id="guestSolo">Продолжить без аккаунта · только одиночная</button>
          <a class="link small" href="${CONFIG.qqCrossUrl}" target="_blank" rel="noopener">Открыть основной QQCross</a>
        `}
      </section>
      <p class="small muted" style="text-align:center">Боты работают только локально в одиночной игре. Они не создают сетевые аккаунты и не занимают места в комнатах.</p>
    </section>`;
  $("#soloStart")?.addEventListener("click", startSolo);
  $("#guestSolo")?.addEventListener("click", () => { state.guest = true; state.profile = null; startSolo(); });
  $("#loginForm")?.addEventListener("submit", signIn);
  $("#signOut")?.addEventListener("click", signOut);
  $("#createRoom")?.addEventListener("click", createRoom);
  $("#joinForm")?.addEventListener("submit", joinRoom);
}
const requestedRoomCode = (() => {
  try { return (new URLSearchParams(location.search).get("room") || "").trim().toUpperCase(); }
  catch { return ""; }
})();

async function signIn(event) {
  event.preventDefault();
  if (!supabase) return toast("Не загрузился Supabase. Обнови страницу.");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Входим…";
  try {
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile(data.user.id);
    if (requestedRoomCode) {
      const joined = await joinRoomByCode(requestedRoomCode);
      if (!joined) render();
    } else {
      toast("Вход выполнен через QQCross.");
      render();
    }
  } catch (error) {
    toast(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "Войти через QQCross";
  }
}
async function signOut() {
  try {
    stopRoomWatch();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    state.profile = null;
    state.guest = false;
    localStorage.removeItem("qq-team-word-room");
    render();
  } catch (error) { toast(friendlyError(error)); }
}
async function rpc(name, args) {
  if (!supabase) throw new Error("Сервис QQCross недоступен.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}
async function createRoom() {
  if (!requireNetworkProfile()) return;
  const button = $("#createRoom");
  button.disabled = true;
  try {
    const result = await rpc("qq_party_create_room", {
      p_game: "team_word",
      p_nickname: state.profile.username,
      p_player_limit: CONFIG.maxPlayers,
      p_public_state: {}
    });
    state.roomId = result.room_id;
    state.roomCode = result.code;
    localStorage.setItem("qq-team-word-room", state.roomId);
    await openRoom();
  } catch (error) {
    toast(friendlyError(error));
    button.disabled = false;
  }
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
async function joinRoomByCode(code) {
  if (!requireNetworkProfile()) return false;
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    clearRoomInviteParam();
    toast("Код приглашения должен содержать шесть символов.");
    return false;
  }
  try {
    const result = await rpc("qq_party_join_room", {
      p_code: code,
      p_nickname: state.profile.username
    });
    state.roomId = result.room_id;
    state.roomCode = result.code;
    localStorage.setItem("qq-team-word-room", state.roomId);
    clearRoomInviteParam();
    await openRoom();
    return true;
  } catch (error) {
    clearRoomInviteParam();
    toast(friendlyError(error));
    return false;
  }
}
async function joinRoom(event) {
  event.preventDefault();
  if (!requireNetworkProfile()) return;
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await joinRoomByCode($("#roomCode").value.trim().toUpperCase());
  } finally { button.disabled = false; }
}
async function openRoom() {
  stopRoomWatch();
  const id = state.roomId || localStorage.getItem("qq-team-word-room");
  if (!id) return;
  state.roomId = id;
  try {
    await refreshRoom(false);
    state.channel = supabase.channel("qq-team-word-" + id)
      .on("postgres_changes", { event:"*", schema:"public", table:"qq_party_rooms", filter:"id=eq."+id }, () => refreshRoom())
      .on("postgres_changes", { event:"*", schema:"public", table:"qq_party_players", filter:"room_id=eq."+id }, () => refreshRoom())
      .on("postgres_changes", { event:"*", schema:"public", table:"qq_party_events", filter:"room_id=eq."+id }, () => refreshRoom())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Team Word Realtime:", status);
        }
      });
    state.pollTimer = setInterval(() => refreshRoom(), 1000);
    document.addEventListener("visibilitychange", onVisibility);
  } catch (error) {
    localStorage.removeItem("qq-team-word-room");
    state.roomId = null;
    state.room = null;
    renderHome();
    toast(friendlyError(error));
  }
}
function onVisibility() {
  if (document.visibilityState === "visible" && state.roomId) refreshRoom();
}
async function refreshRoom(showErrors = true) {
  if (!state.roomId || !supabase) return;
  try {
    const data = await rpc("qq_party_get_room", { p_room_id: state.roomId });
    const changed = JSON.stringify(data) !== JSON.stringify(state.room);
    state.room = data;
    state.roomCode = data.code;
    if (changed) render();
    if (data.status === "playing") {
      const deadline = data.public_state?.next_reveal_at;
      const node = $("#nextReveal");
      if (node && deadline) {
        const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
        node.textContent = "Новая буква через " + seconds + " сек.";
      }
    }
  } catch (error) {
    if (showErrors) console.warn("Team Word room refresh:", error);
  }
}
function isHost() {
  return Boolean(state.profile && state.room?.host_id === state.profile.id);
}
async function startOnlineRound() {
  if (!isHost() || state.busy) return;
  state.busy = true;
  try {
    await rpc("qq_party_start_team_word", {
      p_room_id: state.roomId,
      p_words: [],
      p_length: 0
    });
    await refreshRoom();
  } catch (error) { toast(friendlyError(error)); }
  finally { state.busy = false; }
}
async function leaveRoom() {
  if (!state.roomId) return;
  try { await rpc("qq_party_leave_room", { p_room_id: state.roomId }); }
  catch (error) { console.warn("Leave room:", error); }
  stopRoomWatch();
  document.removeEventListener("visibilitychange", onVisibility);
  state.room = null;
  state.roomId = null;
  state.roomCode = null;
  state.input = "";
  localStorage.removeItem("qq-team-word-room");
  renderHome();
}
async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(state.roomCode || state.room?.code || "");
    toast("Код комнаты скопирован.");
  } catch {
    toast("Код комнаты: " + (state.roomCode || state.room?.code || ""));
  }
}
function renderPlayers(players = []) {
  return players.map((player) => `
    <div class="player">
      <span class="avatar">${avatar(player.avatar)}</span>
      <span style="min-width:0"><b>${esc(player.nickname)}</b><small>${Number(player.seat) === 1 ? "Создатель комнаты" : "Участник"}</small></span>
    </div>`).join("");
}
function renderLobby() {
  const players = state.room.players || [];
  const host = isHost();
  app.innerHTML = `
    <section class="screen">
      <header class="topbar">
        <div class="brand"><span class="logo">QQ</span><span>TEAM WORD · ЛОББИ</span></div>
        <div class="profile"><span class="avatar">${avatar(state.profile?.avatar)}</span><span class="profile-copy"><b>${esc(state.profile?.username)}</b><small>Подключён к QQCross</small></span></div>
      </header>
      <section class="card">
        <div class="small muted" style="text-align:center">КОД ДЛЯ ДРУЗЕЙ</div>
        <div class="room-code">${esc(state.room.code)}</div>
        <button class="btn full" id="copyCode">Скопировать код приглашения</button>
        <p class="small muted" style="text-align:center;margin:10px 0 0">Отправь код друзьям. Они войдут в ту же комнату через свои аккаунты QQCross.</p>
      </section>
      <section class="card stack">
        <div class="game-meta"><b>Участники</b><span>${players.length}/${state.room.player_limit}</span></div>
        <div class="player-grid">${renderPlayers(players)}</div>
        <div class="notice">${host ? "Когда присоединится хотя бы один друг, можно начать общий раунд." : "Ожидаем, пока создатель начнёт игру."}</div>
        ${host ? '<button class="btn primary full" id="startRound" '+(players.length<2?"disabled":"")+'>'+(state.busy?"Запуск…":"Начать раунд")+'</button>' : ""}
        <button class="btn ghost full" id="leaveRoom">Выйти из комнаты</button>
      </section>
      <section class="card stack">
        <h3>Пригласить друзей QQCross</h3>
        <div id="roomFriends"><p class="small muted">Загружаем список друзей…</p></div>
      </section>
    </section>`;
  $("#copyCode").onclick = copyRoomCode;
  $("#startRound")?.addEventListener("click", startOnlineRound);
  loadRoomFriends();
  $("#leaveRoom").onclick = leaveRoom;
}
async function loadRoomFriends() {
  const root = $("#roomFriends");
  if (!root || !state.roomId) return;
  try {
    const friends = await rpc("qq_party_list_friends", { p_room_id: state.roomId });
    if (!friends?.length) {
      root.innerHTML = '<p class="small muted">Добавь друзей в QQCross — здесь появится список для приглашения.</p>';
      return;
    }
    root.innerHTML = friends.map(friend => {
      const disabled = friend.in_room || friend.already_invited;
      const label = friend.in_room ? "Уже в комнате" : friend.already_invited ? "Приглашение отправлено" : "Пригласить";
      return '<div class="room-friend-row"><span class="avatar">'+avatar(friend.avatar)+'</span><span class="room-friend-name">'+esc(friend.username)+'</span><button class="btn '+(disabled?'':'primary')+' room-friend-invite" data-id="'+esc(friend.user_id)+'" '+(disabled?'disabled':'')+'>'+label+'</button></div>';
    }).join("");
    root.querySelectorAll(".room-friend-invite:not(:disabled)").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Отправляем…";
        try {
          const result = await rpc("qq_party_invite_friend", {
            p_room_id: state.roomId,
            p_friend_id: button.dataset.id
          });
          button.textContent = result.already_pending ? "Уже приглашён" : "Приглашение отправлено";
          toast(result.already_pending ? "Приглашение уже отправлено." : "Приглашение отправлено другу QQCross.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Пригласить";
          toast(friendlyError(error));
        }
      });
    });
  } catch (error) {
    root.innerHTML = '<p class="small muted">Не удалось загрузить друзей: '+esc(friendlyError(error))+'</p>';
  }
}
function renderHistory(guesses = []) {
  if (!guesses.length) return '<p class="small muted" style="text-align:center">Пока нет попыток. Первое слово может отправить любой игрок.</p>';
  return guesses.slice().reverse().map((guess) => {
    const letters = normalizeWord(guess.word).split("");
    const feedback = Array.isArray(guess.feedback) ? guess.feedback : [];
    return `
      <div class="guess-row">
        <div class="guess-player">
          <span class="avatar">${avatar(guess.avatar)}</span>
          <b>${esc(guess.nickname || "Игрок")}</b>
        </div>
        <div class="guess-cells">
          ${letters.map((letter,index) => '<span class="guess-cell '+esc(feedback[index]||"miss")+'">'+esc(letter.toUpperCase())+'</span>').join("")}
        </div>
      </div>`;
  }).join("");
}
function renderKeyboard(length) {
  const rows = ["ЙЦУКЕНГШЩЗХ","ФЫВАПРОЛДЖЭ","ЯЧСМИТЬБЮЁ"];
  return rows.map((row) => '<div class="key-row">'+Array.from(row).map((letter) =>
    '<button class="key" type="button" data-key="'+letter+'">'+letter+'</button>'
  ).join("")+'</div>').join("")
    + '<div class="key-row"><button class="key action" type="button" data-key="backspace">⌫</button><button class="key action" type="button" data-key="enter">ОТПРАВИТЬ</button></div>';
}
function typeOnlineKey(key) {
  const length = Number(state.room?.public_state?.length || 0);
  if (key === "backspace") state.input = state.input.slice(0,-1);
  else if (key === "enter") { submitOnlineGuess(); return; }
  else if (/^[А-ЯЁ]$/.test(key) && state.input.length < length) state.input += key.toLowerCase();
  render();
}
async function submitOnlineGuess() {
  if (state.busy || state.room?.status !== "playing") return;
  const guess = normalizeWord(state.input);
  const length = Number(state.room.public_state?.length || 0);
  if (guess.length !== length) return toast("Нужно ввести ровно "+length+" букв.");
  state.busy = true;
  try {
    await rpc("qq_party_team_guess", { p_room_id: state.roomId, p_word: guess });
    state.input = "";
    await refreshRoom();
  } catch (error) { toast(friendlyError(error)); }
  finally { state.busy = false; render(); }
}
function renderOnlineGame() {
  const room = state.room;
  const publicState = room.public_state || {};
  const length = Number(publicState.length || 0);
  const revealed = Array.isArray(publicState.revealed) ? publicState.revealed : [];
  const open = new Map(revealed.map((item) => [Number(item.index), normalizeWord(item.letter).toUpperCase()]));
  const guesses = Array.isArray(publicState.guesses) ? publicState.guesses : [];
  const finished = room.status === "finished";
  const next = publicState.next_reveal_at ? Math.max(0,Math.ceil((new Date(publicState.next_reveal_at).getTime()-Date.now())/1000)) : 0;
  app.innerHTML = `
    <section class="screen">
      <header class="topbar">
        <div class="brand"><span class="logo">QQ</span><span>TEAM WORD</span></div>
        <button class="btn ghost" id="leaveRoom">Выйти</button>
      </header>
      <section class="card stack">
        <div class="game-meta"><span>Общее слово · ${length} букв</span><span id="nextReveal">${finished ? "Раунд завершён" : "Новая буква через "+next+" сек."}</span></div>
        <div class="word-slots">${Array.from({length},(_,index)=>'<div class="word-slot '+(open.has(index)?"open":"")+'">'+(open.get(index)||"")+'</div>').join("")}</div>
        ${finished ? '<div class="result"><h2 class="success">Слово отгадано!</h2><p class="muted">Ответ: <b>'+esc(publicState.solution||"")+'</b></p><p class="small muted">Победитель: место '+esc(publicState.winner_seat ?? "—")+'</p></div>' : '<p class="small muted" style="text-align:center;margin:0">Все игроки угадывают одновременно. Сервер открывает одну новую букву каждые 60 секунд.</p>'}
      </section>
      <section class="card stack" style="min-height:0">
        <div class="game-meta"><b>Общая история</b><span>${guesses.length} попыток</span></div>
        <div class="guess-history" id="guessHistory">${renderHistory(guesses)}</div>
      </section>
      ${finished ? (isHost() ? '<button class="btn primary full" id="nextRound">Новое слово</button>' : '<div class="notice">Ожидаем новый раунд от создателя комнаты.</div>') : `
        <section class="card stack">
          <div class="word-slots" style="min-height:42px">${Array.from({length},(_,index)=>'<div class="word-slot" style="height:42px;font-size:19px">'+esc(state.input[index]?.toUpperCase()||"")+'</div>').join("")}</div>
          <div class="keyboard">${renderKeyboard(length)}</div>
        </section>`}
      <button class="btn ghost full" id="leaveRoomBottom">Вернуться в меню</button>
    </section>`;
  app.querySelectorAll("[data-key]").forEach((button) => button.addEventListener("click", () => typeOnlineKey(button.dataset.key)));
  $("#leaveRoom").onclick = leaveRoom;
  $("#leaveRoomBottom").onclick = leaveRoom;
  $("#nextRound")?.addEventListener("click", startOnlineRound);
}
function startSolo() {
  stopRoomWatch();
  stopSolo();
  const word = TEAM_WORDS[Math.floor(Math.random()*TEAM_WORDS.length)];
  state.solo = {
    word,
    guesses: [],
    revealed: [],
    input: "",
    startedAt: Date.now(),
    nextRevealAt: Date.now()+TEAM_WORD_REVEAL_INTERVAL_MS,
    status: "playing"
  };
  state.room = null;
  state.roomId = null;
  state.screen = "solo";
  state.soloTimer = setInterval(soloTick, 500);
  scheduleBotGuess();
  render();
}
function soloTick() {
  const solo = state.solo;
  if (!solo || solo.status !== "playing") return;
  const now = Date.now();
  if (solo.revealed.length < solo.word.length && now >= solo.nextRevealAt) {
    const next = revealRandomLetter(solo.word,solo.revealed);
    if (next) solo.revealed.push(next);
    solo.nextRevealAt += TEAM_WORD_REVEAL_INTERVAL_MS;
    render();
    return;
  }
  const node = $("#soloTimer");
  if (node) {
    const seconds = Math.max(0, Math.ceil((solo.nextRevealAt - now) / 1000));
    node.textContent = "Буква через " + seconds + " сек.";
  }
}
function scheduleBotGuess() {
  clearTimeout(state.botTimer);
  const solo = state.solo;
  if (!solo || solo.status !== "playing") return;
  const delay = 26000 + Math.floor(Math.random()*19000);
  state.botTimer = setTimeout(() => {
    const current = state.solo;
    if (!current || current.status !== "playing") return;
    const guess = chooseTeamBotGuess({
      length: current.word.length,
      revealed: current.revealed,
      previous: current.guesses,
      words: TEAM_WORDS
    });
    if (guess) {
      const correct = normalizeWord(guess) === normalizeWord(current.word);
      current.guesses.push({
        word: guess,
        nickname: Math.random() < .5 ? "Бот Соня" : "Бот Макс",
        avatar: Math.random() < .5 ? 4 : 1,
        feedback: scoreWordGuess(guess,current.word),
        correct
      });
      if (correct) current.status = "finished";
    }
    render();
    if (current.status === "playing") scheduleBotGuess();
  },delay);
}
function submitSoloGuess() {
  const solo = state.solo;
  if (!solo || solo.status !== "playing") return;
  const guess = normalizeWord(solo.input);
  if (guess.length !== solo.word.length) return toast("Нужно ввести ровно "+solo.word.length+" букв.");
  if (solo.guesses.some((item) => normalizeWord(item.word) === guess)) return toast("Это слово уже пробовали.");
  const correct = guess === normalizeWord(solo.word);
  solo.guesses.push({
    word: guess,
    nickname: state.profile?.username || "Ты",
    avatar: state.profile?.avatar || 0,
    feedback: scoreWordGuess(guess,solo.word),
    correct
  });
  solo.input = "";
  if (correct) {
    solo.status = "finished";
    clearTimeout(state.botTimer);
  }
  render();
}
function renderSoloGame() {
  const solo = state.solo;
  const open = new Map(solo.revealed.map((item)=>[item.index,normalizeWord(item.letter).toUpperCase()]));
  const next = Math.max(0,Math.ceil((solo.nextRevealAt-Date.now())/1000));
  app.innerHTML = `
    <section class="screen">
      <header class="topbar">
        <div class="brand"><span class="logo">QQ</span><span>ОДИНОЧНАЯ ИГРА</span></div>
        <button class="btn ghost" id="soloExit">Выйти</button>
      </header>
      <section class="card stack">
        <div class="game-meta"><span>Общее слово · ${solo.word.length} букв</span><span id="soloTimer">${solo.status==="playing"?"Буква через "+next+" сек.":"Раунд завершён"}</span></div>
        <div class="word-slots">${Array.from({length:solo.word.length},(_,index)=>'<div class="word-slot '+(open.has(index)?"open":"")+'">'+(open.get(index)||"")+'</div>').join("")}</div>
        <p class="small muted" style="text-align:center;margin:0">Боты думают медленно и иногда ошибаются. Они видят только открытые буквы и историю попыток.</p>
      </section>
      <section class="card stack" style="min-height:0">
        <div class="game-meta"><b>Командная история</b><span>${solo.guesses.length} попыток</span></div>
        <div class="guess-history">${renderHistory(solo.guesses)}</div>
      </section>
      ${solo.status==="finished" ? '<div class="result"><h2 class="success">Слово отгадано</h2><p>Ответ: <b>'+esc(solo.word)+'</b></p></div><button class="btn primary full" id="soloAgain">Сыграть ещё раз</button>' : `
        <section class="card stack">
          <div class="word-slots" style="min-height:42px">${Array.from({length:solo.word.length},(_,index)=>'<div class="word-slot" style="height:42px;font-size:19px">'+esc(solo.input[index]?.toUpperCase()||"")+'</div>').join("")}</div>
          <div class="keyboard">${renderKeyboard(solo.word.length)}</div>
        </section>`}
      <button class="btn ghost full" id="soloHome">В меню</button>
    </section>`;
  app.querySelectorAll("[data-key]").forEach((button)=>button.addEventListener("click",()=>{
    const key = button.dataset.key;
    if (key==="backspace") solo.input=solo.input.slice(0,-1);
    else if (key==="enter") { submitSoloGuess(); return; }
    else if (/^[А-ЯЁ]$/.test(key) && solo.input.length<solo.word.length) solo.input+=key.toLowerCase();
    render();
  }));
  $("#soloExit").onclick = () => { stopSolo(); state.guest=false; renderHome(); };
  $("#soloHome").onclick = () => { stopSolo(); renderHome(); };
  $("#soloAgain")?.addEventListener("click",startSolo);
}
function restoreLocalMode() {
  document.addEventListener("keydown",(event)=>{
    if (!state.solo && state.room?.status!=="playing") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key==="Backspace") { event.preventDefault(); typeOnlineKey("backspace"); }
    else if (event.key==="Enter") { event.preventDefault(); state.solo ? submitSoloGuess() : submitOnlineGuess(); }
    else if (/^[а-яё]$/i.test(event.key)) {
      if (state.solo) {
        if (state.solo.input.length<state.solo.word.length) state.solo.input+=event.key.toLowerCase();
        render();
      } else typeOnlineKey(event.key.toLocaleUpperCase("ru-RU"));
    }
  });
}
async function restore() {
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session?.user?.id) await loadProfile(data.session.user.id);
      if (state.profile && requestedRoomCode) {
        await joinRoomByCode(requestedRoomCode);
      } else {
        const savedRoom = localStorage.getItem("qq-team-word-room");
        if (savedRoom && state.profile) {
          state.roomId = savedRoom;
          await openRoom();
        }
      }
    } catch (error) {
      console.warn("Team Word auth restore:",error);
      toast(friendlyError(error));
    }
  }
  render();
  restoreLocalMode();
}
restore();