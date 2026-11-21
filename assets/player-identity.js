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
function framePreview(player={},id="standard",size="lg"){
 return avatarMarkup(player,{frame:id,size});
}
window.QQIdentity=Object.freeze({frames:FRAME_CATALOG,frameIds:[...frameIds],frameId,avatarMarkup,cardMarkup,framePreview,escapeHtml:esc});
})();