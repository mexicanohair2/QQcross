/* QQCross shared player identity: one avatar, frame, nickname and title everywhere. */
(function(){
 "use strict";
 const AVATARS=["🐱","🦝","🐶","🦁","🐯","🦨","🤡","🐍","🐉","🐲"];
 const FRAMES=[
  {id:"classic",name:"Классика",cost:0,description:"Аккуратная серебристая окантовка",tier:"Базовая"},
  {id:"amethyst",name:"Аметист",cost:350,description:"Тёмный металл и фиолетовый камень",tier:"Редкая"},
  {id:"royal",name:"Королевская",cost:550,description:"Бордовый бархат и тёплое золото",tier:"Эпическая"},
  {id:"sakura",name:"Сакура",cost:300,description:"Мягкие розово-лиловые лепестки",tier:"Редкая"},
  {id:"obsidian",name:"Обсидиан",cost:450,description:"Графитовый металл с винным акцентом",tier:"Эпическая"}
 ];
 const byId=Object.fromEntries(FRAMES.map(x=>[x.id,x]));
 function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function avatar(index){const n=Number(index);return AVATARS[Number.isInteger(n)?Math.max(0,Math.min(AVATARS.length-1,n)):0];}
 function frameId(player){const id=String(player?.frame_id||player?.frameId||"classic");return byId[id]?id:"classic";}
 function imageFor(player){
  if(player?.avatar_url||player?.avatarUrl)return String(player.avatar_url||player.avatarUrl);
  const id=player?.id||player?.user_id;
  if(id){try{const local=localStorage.getItem("qqcross_avatar_image_"+String(id));if(local&&/^data:image\/(webp|png|jpeg);base64,/.test(local))return local;}catch{}}
  return "";
 }
 function renderAvatar(player={},size="md"){
  const image=imageFor(player),frame=frameId(player),fallback=avatar(player.avatar);
  const inside=image?'<img src="'+esc(image)+'" alt="" loading="lazy" decoding="async">':'<span class="qq-avatar-fallback" aria-hidden="true">'+fallback+'</span>';
  return '<span class="qq-avatar-frame qq-frame-'+frame+' qq-avatar-'+size+'" data-frame="'+frame+'"><span class="qq-avatar-core">'+inside+'</span></span>';
 }
 function renderCard(player={},options={}){
  const name=esc(player.username||player.nickname||"Игрок");
  const title=esc(player.active_title||player.activeTitle||player.title||"Новичок");
  const score=options.score!==undefined?'<strong class="qq-player-score">'+esc(options.score)+'</strong>':"";
  const meta=options.meta?'<small class="qq-player-meta">'+esc(options.meta)+'</small>':"";
  return '<div class="qq-player-card '+(options.compact?"is-compact":"")+(options.active?" is-active":"")+'" data-player-id="'+esc(player.id||player.user_id||"")+'">'+renderAvatar(player,options.size||"md")+'<span class="qq-player-copy"><b>'+name+'</b><small class="qq-player-title">'+title+'</small>'+meta+'</span>'+score+'</div>';
 }
 function renderProfile(player={},size="lg"){
  const points=player.points!==undefined&&player.points!==null?'<small class="qq-player-points">Очки: '+esc(Number(player.points)||0)+'</small>':"";
  return '<div class="qq-profile-identity">'+renderAvatar(player,size)+'<span class="qq-player-copy"><b>'+esc(player.username||"Игрок")+'</b><small class="qq-player-title">'+esc(player.active_title||player.activeTitle||"Новичок")+'</small>'+points+'</span></div>';
 }
 window.QQPlayerUI={avatars:AVATARS,frames:FRAMES,escape:esc,avatar,frameId,imageFor,renderAvatar,renderCard,renderProfile};
})();