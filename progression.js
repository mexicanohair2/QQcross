(function(){
"use strict";
const KEY="qqcross_progression_v1";
const DAY_MS=86400000;
const TITLE_NAMES=[
"Стажёр","Искатель","Ученик","Знаток","Игрок","Собиратель","Мыслитель","Следопыт","Путник","Мастер",
"Стратег","Хранитель","Исследователь","Картограф","Эрудит","Слововед","Лингвист","Мудрец","Ветеран","Профи",
"Штурман","Навигатор","Архивариус","Летописец","Собиратель слов","Грамотей","Знаток букв","Словесник","Головолом","Разгадчик",
"Решатель","Открывающий","Искусник","Тактик","Аналитик","Филолог","Эрудированный","Наблюдатель","Умелец","Эксперт",
"Покоритель","Мастер слов","Словесный маг","Мастер сетки","Звезда","Феномен","Талант","Виртуоз","Профессор","Гроссмейстер",
"Хронист","Хранитель букв","Хранитель слов","Искатель смысла","Мастер загадок","Мастер кроссвордов","Мастер Wordle","Путешественник","Покоритель уровней","Завсегдатай",
"Легенда","Сокровище","Светоч","Мудрец слов","Мастер мысли","Великий знаток","Гений букв","Гений слов","Гений загадок","Гений QQ",
"Титан","Колосс","Великан","Чемпион","Абсолют","Первопроходец","Непобедимый","Неутомимый","Бессменный","Несравненный",
"Вдохновитель","Создатель","Хранитель знаний","Мастер разума","Словесный титан","Мастер всех игр","Золотой ум","Серебряный ум","Алмазный ум","Миф",
"Мифический","Вечный искатель","Повелитель слов","Повелитель букв","Мастер вселенной","Великий стратег","Мастер QQCross","Король слов","Легендарный игрок","Повелитель загадок"
];
const ACHIEVEMENTS=[
{id:"scanword_1",name:"Первый сканворд",desc:"Заверши первый сканворд",stat:"scanwords",target:1},
{id:"scanword_5",name:"Пять сканвордов",desc:"Заверши 5 сканвордов",stat:"scanwords",target:5},
{id:"scanword_25",name:"Любитель сканвордов",desc:"Заверши 25 сканвордов",stat:"scanwords",target:25},
{id:"scanword_50",name:"Полсотни",desc:"Заверши 50 сканвордов",stat:"scanwords",target:50},
{id:"scanword_100",name:"Сотня",desc:"Заверши 100 сканвордов",stat:"scanwords",target:100},
{id:"wordle_1",name:"Первое слово",desc:"Победи в Wordle",stat:"wordleWins",target:1},
{id:"wordle_25",name:"Слово за словом",desc:"Угадай 25 слов в Wordle",stat:"wordleWins",target:25},
{id:"wordle_100",name:"Словарный запас",desc:"Угадай 100 слов в Wordle",stat:"wordleWins",target:100},
{id:"wow_5",name:"Колесо слов",desc:"Пройди 5 уровней Word of Wonders",stat:"wowLevels",target:5},
{id:"wow_25",name:"Путешествие продолжается",desc:"Пройди 25 уровней Word of Wonders",stat:"wowLevels",target:25},
{id:"wow_100",name:"Мастер круга",desc:"Пройди 100 уровней Word of Wonders",stat:"wowLevels",target:100},
{id:"search_5",name:"Внимательный поиск",desc:"Найди слова на 5 уровнях поиска",stat:"searchLevels",target:5},
{id:"search_25",name:"Искатель слов",desc:"Пройди 25 уровней поиска",stat:"searchLevels",target:25},
{id:"cody_5",name:"Первые группы",desc:"Реши 5 кроссвордов",stat:"codyLevels",target:5},
{id:"cody_25",name:"Знаток миров",desc:"Реши 25 кроссвордов",stat:"codyLevels",target:25},
{id:"cody_100",name:"Путешественник по мирам",desc:"Реши 100 кроссвордов",stat:"codyLevels",target:100},
{id:"daily_3",name:"Три дня подряд",desc:"Заверши оба ежедневных испытания 3 дня подряд",stat:"bestStreak",target:3},
{id:"daily_7",name:"Неделя упорства",desc:"Достигни серии 7 дней",stat:"bestStreak",target:7},
{id:"daily_14",name:"Две недели",desc:"Достигни серии 14 дней",stat:"bestStreak",target:14},
{id:"daily_30",name:"Месяц в игре",desc:"Достигни серии 30 дней",stat:"bestStreak",target:30},
{id:"daily_100",name:"Сто дней",desc:"Достигни серии 100 дней",stat:"bestStreak",target:100},
{id:"words_25",name:"Словоохотливый",desc:"Открой 25 новых слов",stat:"wordsFound",target:25},
{id:"words_100",name:"Коллекционер слов",desc:"Открой 100 новых слов",stat:"wordsFound",target:100},
{id:"groups_5",name:"Пять групп",desc:"Открой 5 групп кроссвордов",stat:"groups",target:5}
];
const fresh=()=>({version:1,stats:{scanwords:0,wordleWins:0,wowLevels:0,searchLevels:0,codyLevels:0,wordsFound:0,groups:0},daily:{days:{},currentStreak:0,bestStreak:0,lastCompletedDate:""},achievements:{},titles:["Новичок"],activeTitle:"Новичок",hatTaps:0,discoveredWords:[],rewardClaims:{},pendingRewards:{}});
let data=fresh(),cloudTimer=null,cloudClient=null,cloudUserId=null;
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function randomFor(seed){let x=seed>>>0;return function(){x=(x+0x6D2B79F5)|0;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296}}
function normalize(value){return String(value||"").toUpperCase().replace(/Ё/g,"Е").replace(/[^А-Я]/g,"")}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(_){};scheduleCloudSync()}
function loadLocal(){try{const v=JSON.parse(localStorage.getItem(KEY)||"null");if(v&&v.version===1){data={...fresh(),...v,stats:{...fresh().stats,...v.stats},daily:{...fresh().daily,...v.daily,days:v.daily?.days||{}},achievements:v.achievements||{},titles:Array.isArray(v.titles)&&v.titles.length?v.titles:["Новичок"],discoveredWords:Array.isArray(v.discoveredWords)?v.discoveredWords:[]}}}catch(_){}}
function scheduleCloudSync(){if(!cloudClient||!cloudUserId)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>syncCloud().catch(e=>console.warn("QQCross progression sync:",e)),650)}
async function syncCloud(){if(!cloudClient||!cloudUserId)return;const snapshot=JSON.parse(JSON.stringify(data));const {error}=await cloudClient.from("qqcross_player_progress").upsert({user_id:cloudUserId,progress:snapshot,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error}
function mergeProgress(remote){if(!remote||typeof remote!=="object")return;const merged={...remote,stats:{...data.stats},daily:{...data.daily,days:{...data.daily.days}},achievements:{...remote.achievements,...data.achievements},titles:[...new Set([...(remote.titles||[]),...(data.titles||[])])],discoveredWords:[...new Set([...(remote.discoveredWords||[]),...(data.discoveredWords||[])])],rewardClaims:{...(remote.rewardClaims||{}),...(data.rewardClaims||{})},pendingRewards:{...(remote.pendingRewards||{}),...(data.pendingRewards||{})},hatTaps:Math.max(Number(remote.hatTaps)||0,Number(data.hatTaps)||0),activeTitle:(data.activeTitle&&data.activeTitle!=="Новичок"?data.activeTitle:(remote.activeTitle||"Новичок"))};for(const k of Object.keys(data.stats))merged.stats[k]=Math.max(Number(remote.stats?.[k])||0,Number(data.stats[k])||0);for(const [day,record] of Object.entries(remote.daily?.days||{}))merged.daily.days[day]={...(record||{}),...(merged.daily.days[day]||{})};const localLast=data.daily.lastCompletedDate||"",remoteLast=remote.daily?.lastCompletedDate||"";if(remoteLast>localLast){merged.daily.currentStreak=Number(remote.daily.currentStreak)||0;merged.daily.lastCompletedDate=remoteLast}else{merged.daily.currentStreak=data.daily.currentStreak;merged.daily.lastCompletedDate=localLast}merged.daily.bestStreak=Math.max(Number(remote.daily?.bestStreak)||0,data.daily.bestStreak);if(!merged.titles.includes("Новичок"))merged.titles.unshift("Новичок");if(!merged.titles.includes(merged.activeTitle))merged.activeTitle="Новичок";data=merged;recalculate();saveLocalOnly()}
function saveLocalOnly(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(_){}}
function rewardFor(index){const base=2;return index<=4?Math.max(1,Math.round(base*Math.pow(1.5,index-1))):Math.min(18,Math.round(base*Math.pow(1.5,3)+(index-4)*2))}
function grantMilestoneReward(id){if(data.rewardClaims[id])return null;data.rewardClaims[id]=true;const index=ACHIEVEMENTS.findIndex(a=>a.id===id)+1,items=["magnifier","clock","trash"],item=items[(index-1)%items.length],quantity=rewardFor(index);data.pendingRewards=data.pendingRewards||{};data.pendingRewards[id]={item,quantity};return{item,quantity}}
function unlockTitle(name){if(!data.titles.includes(name))data.titles.push(name)}
function recalculate(){for(const a of ACHIEVEMENTS){const value=a.stat==="bestStreak"?data.daily.bestStreak:Number(data.stats[a.stat])||0;if(value>=a.target&&!data.achievements[a.id]){data.achievements[a.id]={unlockedAt:today(),reward:grantMilestoneReward(a.id)}}}
 const total=Object.values(data.stats).reduce((n,v)=>n+(Number(v)||0),0);const scan=data.stats.scanwords||0;const thresholds=[5,10,50,75,100];for(let i=0;i<100;i++){const threshold=i<5?thresholds[i]:100+(i-4)*5;if(scan>=threshold)unlockTitle(TITLE_NAMES[i]);}
 if(data.hatTaps>=15)unlockTitle("Mugiwara");if(!data.titles.includes("Новичок"))data.titles.unshift("Новичок");if(!data.titles.includes(data.activeTitle))data.activeTitle="Новичок";return total}
function record(stat,amount=1){if(!Object.prototype.hasOwnProperty.call(data.stats,stat))return get();const n=Math.max(1,Math.floor(Number(amount)||1));data.stats[stat]=Math.max(0,(Number(data.stats[stat])||0)+n);recalculate();save();return get()}
function recordWord(word){const w=normalize(word);if(w.length<2||data.discoveredWords.includes(w))return false;data.discoveredWords.push(w);data.stats.wordsFound++;recalculate();save();return true}
function tapHat(){data.hatTaps++;recalculate();save();return data.hatTaps}
function daily(date=today()){const seed=hash(date+"|qqcross-daily-v1");const lengths=[4,5,6,7,8];return{date,scanwordSeed:hash(date+"|scanword"),wordleSeed:hash(date+"|wordle"),wordleLength:lengths[seed%lengths.length],completed:{...(data.daily.days[date]||{})}}}
function completeDaily(type,date=today()){if(!["scanword","wordle"].includes(type))return get();const day=data.daily.days[date]||(data.daily.days[date]={});if(day[type])return get();day[type]=true;if(day.scanword&&day.wordle&&date!==data.daily.lastCompletedDate){const last=data.daily.lastCompletedDate;const yesterday=new Date(date+"T12:00:00");yesterday.setDate(yesterday.getDate()-1);const previous=yesterday.getFullYear()+"-"+String(yesterday.getMonth()+1).padStart(2,"0")+"-"+String(yesterday.getDate()).padStart(2,"0");data.daily.currentStreak=last===previous?data.daily.currentStreak+1:1;data.daily.bestStreak=Math.max(data.daily.bestStreak,data.daily.currentStreak);data.daily.lastCompletedDate=date;recalculate()}save();return get()}
function takePendingRewards(){const pending=Object.entries(data.pendingRewards||{}).map(([id,reward])=>({id,...reward}));data.pendingRewards={};save();return pending}
function requeuePendingReward(id,item,quantity){data.pendingRewards=data.pendingRewards||{};data.pendingRewards[id]={item,quantity};save()}
function setActiveTitle(name){if(!data.titles.includes(name))return false;data.activeTitle=name;save();return true}
function get(){return JSON.parse(JSON.stringify(data))}
function achievements(){return ACHIEVEMENTS.map(a=>({ ...a,value:a.stat==="bestStreak"?data.daily.bestStreak:Number(data.stats[a.stat])||0,unlocked:!!data.achievements[a.id],reward:data.achievements[a.id]?.reward||null}))}
function setCloud(client,userId){cloudClient=client;cloudUserId=userId||null;if(!client||!userId)return Promise.resolve();return client.from("qqcross_player_progress").select("progress").eq("user_id",userId).maybeSingle().then(({data:row,error})=>{if(error)throw error;if(row?.progress)mergeProgress(row.progress);else syncCloud().catch(e=>console.warn("QQCross progression sync:",e));return get()})}
loadLocal();recalculate();
window.QQProgression={get,daily,record,recordWord,tapHat,completeDaily,setActiveTitle,achievements,takePendingRewards,requeuePendingReward,setCloud,syncCloud,hash,randomFor,today,TITLE_NAMES};
})();