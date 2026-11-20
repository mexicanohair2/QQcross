/* QQCross ambience engine: natural canvas particles for every selectable effect. */
(()=>{
 "use strict";
 const root=document.documentElement;
 const TYPES=["forest","sakura","autumn","rain","fireflies","stars","fog"];
 let canvas=null,ctx=null,raf=0,last=0,width=1,height=1,dpr=1,particles=[],observer=null,activeType=null;
 const rand=(a,b)=>a+Math.random()*(b-a);
 const reduced=()=>root.dataset.qqReduceMotion==="true"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||document.hidden;
 const palettes={
  sakura:["#f3b6ca","#e99bb7","#f7c8d6","#d982a4","#f0a9c0","#f8d7df"],
  autumn:["#b85c32","#d77b35","#e3a34c","#a9472d","#c96b2e","#e6b45f"]
 };
 function make(type,initial=false){
  const depth=rand(.55,1.35);
  const p={type,x:rand(-30,width+30),y:initial?rand(-height,height):rand(-height*.25,-15),depth,phase:rand(0,Math.PI*2),rotation:rand(-Math.PI,Math.PI),spin:rand(-1.1,1.1),opacity:rand(.35,.82),drift:rand(-22,22),sway:rand(7,27),age:0};
  if(type==="sakura"){p.length=rand(12,23)*depth;p.width=p.length*rand(.48,.72);p.fall=rand(18,43)*depth;p.color=palettes.sakura[Math.floor(rand(0,palettes.sakura.length))];p.fold=rand(.45,.9);p.flip=rand(.65,1.25)}
  else if(type==="autumn"){p.size=rand(10,19)*depth;p.fall=rand(16,35)*depth;p.color=palettes.autumn[Math.floor(rand(0,palettes.autumn.length))];p.spin=rand(-1.5,1.5)}
  else if(type==="rain"){p.length=rand(10,27)*depth;p.fall=rand(430,760)*depth;p.drift=rand(-85,-30);p.opacity=rand(.16,.42);p.width=rand(.55,1.15)}
  else if(type==="forest"){p.size=rand(3.5,7.5)*depth;p.fall=rand(22,58)*depth;p.drift=rand(-8,8);p.opacity=rand(.55,.9)}
  else if(type==="fireflies"){p.size=rand(2,4.5)*depth;p.fall=rand(-4,4);p.opacity=rand(.35,.8);p.glow=rand(7,16);p.sway=rand(8,24);p.phaseSpeed=rand(.5,1.4)}
  else if(type==="stars"){p.size=rand(1.1,2.8)*depth;p.fall=rand(-1,1);p.opacity=rand(.25,.85);p.glow=rand(2,7);p.phaseSpeed=rand(.5,2)}
  else if(type==="fog"){p.rx=rand(85,190);p.ry=rand(25,75);p.fall=rand(-2,2);p.drift=rand(-7,7);p.opacity=rand(.035,.105);p.hue=Math.random()<.5?"rgba(202,190,211,":"rgba(173,190,199,"}
  return p;
 }
 function countFor(type){
  const area=width*height;
  if(type==="sakura")return Math.max(58,Math.min(105,Math.round(area/9500)));
  if(type==="autumn")return Math.max(34,Math.min(65,Math.round(area/16000)));
  if(type==="rain")return Math.max(95,Math.min(180,Math.round(width/3.3)));
  if(type==="forest")return Math.max(55,Math.min(105,Math.round(area/11500)));
  if(type==="fireflies")return Math.max(18,Math.min(32,Math.round(area/35000)));
  if(type==="stars")return Math.max(55,Math.min(100,Math.round(area/12000)));
  return Math.max(12,Math.min(22,Math.round(area/50000)));
 }
 function resize(){
  if(!canvas||!ctx)return;
  const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);
  dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const type=root.dataset.qqAmbience,n=countFor(type);
  while(particles.length<n)particles.push(make(type,true));
  if(particles.length>n)particles.length=n;
 }
 function drawSakura(p,t){
  const l=p.length,w=p.width,fold=Math.sin(t*1.2+p.phase)*p.fold;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
  ctx.scale(1,Math.max(.24,Math.abs(Math.cos(t*.9+p.phase))*p.flip));
  ctx.globalAlpha=p.opacity;
  const g=ctx.createLinearGradient(-l*.42,-w,l*.5,w);
  g.addColorStop(0,"#f9dce5");g.addColorStop(.35,p.color);g.addColorStop(.78,"#df8eaa");g.addColorStop(1,"#b96687");
  ctx.fillStyle=g;ctx.strokeStyle="rgba(255,239,245,.7)";ctx.lineWidth=.65;
  ctx.beginPath();ctx.moveTo(-l*.5,0);
  ctx.bezierCurveTo(-l*.4,-w*.86,l*.12,-w*1.05,l*.42,-w*.42);
  ctx.quadraticCurveTo(l*.62,-w*.12,l*.5,0);
  ctx.quadraticCurveTo(l*.62,w*.12,l*.42,w*.42);
  ctx.bezierCurveTo(l*.12,w*1.05,-l*.4,w*.86,-l*.5,0);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-l*.39,0);ctx.quadraticCurveTo(-l*.03,fold*w*.3,l*.42,0);
  ctx.strokeStyle="rgba(143,55,88,.7)";ctx.lineWidth=.75;ctx.stroke();
  for(let i=1;i<=3;i++){
   const x=-l*.16+i*l*.13;
   ctx.beginPath();ctx.moveTo(x,0);ctx.quadraticCurveTo(x+l*.06,-w*.28,x+l*.13,-w*.48);
   ctx.moveTo(x,0);ctx.quadraticCurveTo(x+l*.06,w*.28,x+l*.13,w*.48);ctx.lineWidth=.42;ctx.strokeStyle="rgba(255,231,239,.62)";ctx.stroke();
  }
  ctx.restore();
 }
 function drawLeaf(p,t){
  const s=p.size;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.scale(1,Math.max(.45,Math.abs(Math.cos(t*.8+p.phase))*.85));
  ctx.globalAlpha=p.opacity;ctx.fillStyle=p.color;ctx.strokeStyle="rgba(255,218,160,.55)";ctx.lineWidth=.7;
  ctx.beginPath();ctx.moveTo(0,s*.46);
  ctx.quadraticCurveTo(-s*.16,s*.08,-s*.52,s*.04);ctx.lineTo(-s*.34,-s*.12);ctx.lineTo(-s*.55,-s*.38);ctx.lineTo(-s*.19,-s*.32);ctx.lineTo(-s*.1,-s*.65);ctx.lineTo(s*.02,-s*.38);ctx.lineTo(s*.35,-s*.58);ctx.lineTo(s*.28,-s*.2);ctx.lineTo(s*.58,-s*.16);ctx.lineTo(s*.27,s*.12);ctx.quadraticCurveTo(s*.12,s*.32,0,s*.46);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,s*.4);ctx.lineTo(0,-s*.48);ctx.moveTo(0,0);ctx.lineTo(-s*.34,-s*.25);ctx.moveTo(0,-s*.12);ctx.lineTo(s*.3,-s*.38);ctx.moveTo(0,s*.14);ctx.lineTo(s*.28,-s*.02);ctx.strokeStyle="rgba(89,45,25,.62)";ctx.lineWidth=.65;ctx.stroke();ctx.restore();
 }
 function drawSnow(p,t){
  const r=p.size;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.globalAlpha=p.opacity;ctx.strokeStyle="rgba(225,239,247,.9)";ctx.lineWidth=Math.max(.8,r*.22);ctx.lineCap="round";
  for(let a=0;a<6;a++){ctx.save();ctx.rotate(a*Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-r*2.2);ctx.moveTo(0,-r*1.35);ctx.lineTo(-r*.52,-r*1.82);ctx.moveTo(0,-r*1.35);ctx.lineTo(r*.52,-r*1.82);ctx.stroke();ctx.restore()}
  ctx.restore();
 }
 function drawRain(p){
  const x=p.x,y=p.y,tailX=x+p.drift*.035,tailY=y+p.length,r=p.width*1.9;
  ctx.save();ctx.globalAlpha=p.opacity;
  const g=ctx.createLinearGradient(x,y,tailX,tailY);g.addColorStop(0,"rgba(192,218,232,0)");g.addColorStop(.42,"rgba(192,218,232,.62)");g.addColorStop(1,"rgba(218,235,244,.82)");
  ctx.strokeStyle=g;ctx.lineWidth=p.width;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tailX,tailY-r*1.2);ctx.stroke();
  ctx.fillStyle="rgba(204,226,239,.72)";ctx.beginPath();ctx.moveTo(tailX,tailY-r*2.1);ctx.quadraticCurveTo(tailX+r*1.05,tailY-r*.55,tailX,tailY+r*.35);ctx.quadraticCurveTo(tailX-r*1.05,tailY-r*.55,tailX,tailY-r*2.1);ctx.fill();
  ctx.strokeStyle="rgba(242,249,252,.48)";ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(tailX-r*.18,tailY-r*1.15);ctx.quadraticCurveTo(tailX-r*.55,tailY-r*.5,tailX-r*.28,tailY-r*.15);ctx.stroke();
  ctx.restore();
 }
 function drawGlow(p,t,star=false){
  const pulse=.45+.55*(.5+.5*Math.sin(t*p.phaseSpeed+p.phase));
  ctx.save();ctx.globalAlpha=p.opacity*pulse;ctx.shadowBlur=p.glow*(star?1.2:1.8);ctx.shadowColor=star?"#e8e2ff":"#e9e7a8";ctx.fillStyle=star?"#f5efff":"#f4edaa";
  if(star){const r=p.size;ctx.translate(p.x,p.y);ctx.rotate(p.phase);ctx.beginPath();ctx.moveTo(0,-r*2.3);ctx.quadraticCurveTo(r*.35,-r*.35,r*2.3,0);ctx.quadraticCurveTo(r*.35,r*.35,0,r*2.3);ctx.quadraticCurveTo(-r*.35,r*.35,-r*2.3,0);ctx.quadraticCurveTo(-r*.35,-r*.35,0,-r*2.3);ctx.fill()}
  else{ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}
  ctx.restore();
 }
 function drawFog(p,t){
  ctx.save();ctx.globalAlpha=p.opacity;ctx.filter="blur(18px)";const g=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,p.rx);g.addColorStop(0,p.hue+"0.8)");g.addColorStop(1,p.hue+"0)");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 function frame(now){
  raf=0;if(!canvas||!ctx||reduced())return;
  const dt=Math.min(.04,(now-last)/1000||.016);last=now;const t=now/1000,type=root.dataset.qqAmbience;ctx.clearRect(0,0,width,height);
  const wind=Math.sin(t*.13)*12+Math.sin(t*.047)*8;
  for(let i=0;i<particles.length;i++){
   const p=particles[i];p.age+=dt;
   if(type==="sakura"||type==="autumn"||type==="forest"||type==="rain"){
    p.y+=p.fall*dt;p.x+=(p.drift+wind*.3+Math.sin(t*.8+p.phase)*p.sway)*dt;p.rotation+=p.spin*dt;
    if(p.y>height+45||p.x<-100||p.x>width+100){particles[i]=make(type);continue}
   }else if(type==="fireflies"||type==="stars"){
    p.x+=(p.drift+Math.sin(t*p.phaseSpeed+p.phase)*p.sway)*dt;p.y+=Math.sin(t*.45+p.phase)*p.fall*dt;
    if(p.x<-20)p.x=width+20;if(p.x>width+20)p.x=-20;
   }else{
    p.x+=(p.drift+Math.sin(t*.16+p.phase)*p.sway*.12)*dt;p.y+=p.fall*dt;
    if(p.x<-p.rx||p.x>width+p.rx||p.y< -p.ry||p.y>height+p.ry){particles[i]=make(type,true);particles[i].y=rand(0,height)}
   }
   if(type==="sakura")drawSakura(p,t);
   else if(type==="autumn")drawLeaf(p,t);
   else if(type==="forest")drawSnow(p,t);
   else if(type==="rain")drawRain(p);
   else if(type==="fireflies")drawGlow(p,t,false);
   else if(type==="stars")drawGlow(p,t,true);
   else if(type==="fog")drawFog(p,t);
  }
  raf=requestAnimationFrame(frame);
 }
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;if(ctx)ctx.clearRect(0,0,width,height)}
 function remove(){stop();if(observer){observer.disconnect();observer=null}else window.removeEventListener("resize",resize);if(canvas){canvas.remove();canvas=null;ctx=null}particles=[];activeType=null}
 function start(){
  if(reduced())return;
  if(!canvas){
   activeType=root.dataset.qqAmbience;
   canvas=document.createElement("canvas");canvas.className="qq-ambience-canvas";canvas.setAttribute("aria-hidden","true");document.body.appendChild(canvas);
   ctx=canvas.getContext("2d",{alpha:true,desynchronized:true});if(!ctx){remove();return}
   resize();if("ResizeObserver"in window){observer=new ResizeObserver(resize);observer.observe(document.documentElement)}else window.addEventListener("resize",resize,{passive:true});
  }
  /* A hidden tab can let the animation frame exit. Re-arm it when the tab becomes visible. */
  if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}
 }
 function sync(){const type=root.dataset.qqAmbience;if(TYPES.includes(type)&&!reduced()){if(canvas&&activeType!==type)remove();start()}else remove()}
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:["data-qq-ambience","data-qq-reduce-motion"]});
 document.addEventListener("visibilitychange",sync,{passive:true});
 window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",sync);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();