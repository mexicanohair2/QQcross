(function(){
"use strict";
const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
const FRAME_CATALOG=[
 {id:"standard",name:"Классика",description:"Сдержанная рамка QQCross",price:0,accent:"Лиловый металл"},
 {id:"ruby",name:"Рубиновая",description:"Бордовый металл и гранёный рубин",price:160,accent:"Рубин"},
 {id:"amethyst",name:"Аметистовая",description:"Серебро и фиолетовые кристаллы",price:260,accent:"Аметист"},
 {id:"royal",name:"Королевская",description:"Тонкая золотая корона и эмаль",price:420,accent:"Золото"},
 {id:"astral",name:"Звёздная",description:"Орбиты и холодные серебряные искры",price:620,accent:"Серебро"}
];
const frameIds=new Set(FRAME_CATALOG.map(x=>x.id));
const scriptUrl=document.currentScript&&document.currentScript.src?document.currentScript.src:location.href;
const frameBase=new URL("./avatar-frames/",scriptUrl).href;
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function validImage(value){
 const src=String(value||"");
 if(/^https:\/\//i.test(src))return src;
 if(/^data:image\/(?:webp|png|jpeg);base64,[a-z0-9+/=]+$/i.test(src))return src;
 return "";
}
function frameId(value){return frameIds.has(value)?value:"standard";}
function avatarMarkup(player={},options={}){
 const size=["xs","sm","md","lg","xl"].includes(options.size)?options.size:"md";
 const frame=frameId(options.frame||player.active_frame||player.frame);
 const image=validImage(options.image||player.avatar_url||player.avatarImage||"");
 const index=Number(player.avatar);
 const emoji=AVATARS[Number.isInteger(index)&&index>=0&&index<AVATARS.length?index:0];
 const face=image?'<img src="'+esc(image)+'" alt="" loading="lazy" decoding="async">':esc(emoji);
 return '<span class="qq-player-avatar qq-player-avatar--'+size+' qq-player-frame--'+frame+'" aria-hidden="true"><span class="qq-player-avatar__face">'+face+'</span><img class="qq-player-avatar__ornament" src="'+esc(frameBase+frame+'.svg')+'" alt="" loading="lazy" decoding="async"></span>';
}
function cardMarkup(player={},options={}){
 const name=player.username||player.nickname||player.name||"Игрок";
 const title=player.active_title||player.title||"Новичок";
 const score=options.score===undefined||options.score===null?"":'<span class="qq-player-score">'+esc(options.scoreLabel||"Очки")+': <b>'+esc(options.score)+'</b></span>';
 const note=options.note?'<small class="qq-player-note">'+esc(options.note)+'</small>':"";
 const body=avatarMarkup(player,{size:options.size||"md",frame:options.frame,image:options.image})+
  '<span class="qq-player-identity__copy"><b class="qq-player-name">'+esc(name)+'</b><small class="qq-player-title">'+esc(title)+'</small>'+score+note+'</span>';
 const cls="qq-player-identity"+(options.compact?" qq-player-identity--compact":"")+(options.className?" "+esc(options.className):"");
 if(options.clickable&&player.id)return '<button type="button" class="'+cls+' qq-player-identity--clickable" data-player-profile="'+esc(player.id)+'" aria-label="Открыть профиль игрока '+esc(name)+'">'+body+'</button>';
 return '<span class="'+cls+'">'+body+'</span>';
}
async function openRemoteProfile(client,userId){
 if(!client||!userId)return;
 let overlay=document.querySelector(".qq-profile-dialog-backdrop");
 if(overlay)overlay.remove();
 overlay=document.createElement("div");overlay.className="qq-profile-dialog-backdrop qq-player-modal-backdrop";
 overlay.innerHTML='<section class="qq-profile-dialog" role="dialog" aria-modal="true" aria-label="Профиль игрока"><div class="qq-profile-dialog__head"><div class="qq-profile-dialog__copy" id="qqIdentityProfileContent"><p class="qq-player-dialog-empty">Загружаем профиль…</p></div><button type="button" class="qq-profile-dialog__close" aria-label="Закрыть">×</button></div></section>';
 document.body.append(overlay);
 const close=()=>overlay.remove();
 overlay.querySelector(".qq-profile-dialog__close").onclick=close;
 overlay.addEventListener("click",event=>{if(event.target===overlay)close()});
 try{
  const {data,error}=await client.rpc("get_qqcross_player_profile",{target_user_id:userId});
  if(error)throw error;
  if(!overlay.isConnected)return;
  const stats=data.stats||{},daily=data.daily||{};
  const entries=[[data.games||0,"Матчи"],[data.wins||0,"Победы"],[data.points||0,"Очки"],[stats.scanwords||0,"Сканворды"],[stats.wordleWins||0,"Победы Wordle"],[stats.searchLevels||0,"Поиск слов"],[stats.codyLevels||0,"Кроссворды"],[stats.wordsFound||0,"Открытые слова"],[daily.currentStreak||0,"Дней подряд"],[daily.bestStreak||0,"Лучшая серия"]];
  const cards=entries.map(([value,label])=>'<div class="qq-profile-stat"><b>'+esc(value)+'</b><small>'+esc(label)+'</small></div>').join("");
  const content=overlay.querySelector("#qqIdentityProfileContent");
  content.innerHTML=cardMarkup(data,{size:"lg",clickable:false})+'<p class="qq-player-modal-muted">В QQCross с '+(data.created_at?new Date(data.created_at).toLocaleDateString("ru-RU"):"неизвестной даты")+'</p><div class="qq-profile-dialog__stats">'+cards+'</div>';
 }catch(error){const content=overlay.querySelector("#qqIdentityProfileContent");if(content)content.innerHTML='<p class="qq-player-dialog-empty">'+esc(error.message||"Не удалось загрузить профиль.")+'</p>'}
}
function bindProfileClicks(client){
 if(!client||document.documentElement.dataset.qqRemoteProfileBound==="true")return;
 document.documentElement.dataset.qqRemoteProfileBound="true";
 document.addEventListener("click",event=>{
  const trigger=event.target.closest("[data-player-profile]");
  if(!trigger)return;
  const id=trigger.dataset.playerProfile;
  if(id)openRemoteProfile(client,id);
 });
}
function framePreview(player={},id="standard",size="lg"){
 return avatarMarkup(player,{frame:id,size});
}
window.QQIdentity=Object.freeze({frames:FRAME_CATALOG,frameIds:[...frameIds],frameId,avatarMarkup,cardMarkup,framePreview,escapeHtml:esc});
})();