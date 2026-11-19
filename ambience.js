/* QQCross Sakura ambience: separate, irregular monochrome petals on Canvas 2D. */
(()=>{
 "use strict";
 const root=document.documentElement;
 let canvas=null,ctx=null,raf=0,last=0,particles=[],width=0,height=0,dpr=1,resizeObserver=null;
 const palette=["#fbfaf6","#e9e9e5","#d9dcda","#ffffff","#c9ced0","#eef0ed"];
 const reduced=()=>root.dataset.qqReduceMotion==="true"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||document.hidden;
 const random=(min,max)=>min+Math.random()*(max-min);
 function createPetal(initial=false){
  const depth=random(.55,1.32),length=random(9,18)*depth;
  return{
   x:random(-28,width+28),
   y:initial?random(-height,height):random(-height*.2,-18),
   length,width:length*random(.42,.7),depth,
   rotation:random(-Math.PI,Math.PI),
   spin:random(-.85,.85),
   fall:random(17,39)*depth,
   drift:random(-12,12),
   sway:random(8,25),
   phase:random(0,Math.PI*2),
   phaseSpeed:random(.45,1.2),
   color:palette[Math.floor(random(0,palette.length))],
   opacity:random(.34,.78),
   fold:random(.25,.72),
   flip:random(.58,1.22)
  };
 }
 function resize(){
  if(!canvas||!ctx)return;
  const box=canvas.getBoundingClientRect();
  width=Math.max(1,box.width);height=Math.max(1,box.height);
  dpr=Math.min(window.devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.max(18,Math.min(38,Math.round(width*height/47000)));
  while(particles.length<count)particles.push(createPetal(true));
  if(particles.length>count)particles.length=count;
 }
 function drawPetal(p,time){
  const l=p.length,w=p.width;
  const fold=Math.sin(time*p.phaseSpeed+p.phase)*p.fold;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(p.rotation);
  ctx.scale(1,Math.max(.2,Math.abs(Math.cos(time*.72+p.phase))*p.flip));
  ctx.globalAlpha=p.opacity;
  const gradient=ctx.createLinearGradient(-l*.32,-w,l*.42,w);
  gradient.addColorStop(0,"rgba(255,255,255,.96)");
  gradient.addColorStop(.48,p.color);
  gradient.addColorStop(1,"rgba(113,121,124,.58)");
  ctx.fillStyle=gradient;
  ctx.strokeStyle="rgba(255,255,255,.42)";
  ctx.lineWidth=.65;
  ctx.beginPath();
  ctx.moveTo(-l*.48,0);
  ctx.bezierCurveTo(-l*.32,-w*.88,l*.38,-w*1.04,l*.5,-w*.18);
  ctx.quadraticCurveTo(l*.57,-w*.055,l*.43,0);
  ctx.quadraticCurveTo(l*.57,w*.055,l*.5,w*.18);
  ctx.bezierCurveTo(l*.38,w*1.04,-l*.32,w*.88,-l*.48,0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-l*.34,0);
  ctx.quadraticCurveTo(l*.035,fold*w*.2,l*.37,-w*.035);
  ctx.strokeStyle="rgba(111,119,122,.38)";
  ctx.lineWidth=.48;
  ctx.stroke();
  ctx.restore();
 }
 function frame(now){
  raf=0;
  if(!canvas||!ctx||reduced())return;
  const delta=Math.min(.04,(now-last)/1000||.016);
  last=now;
  const time=now/1000;
  ctx.clearRect(0,0,width,height);
  const wind=Math.sin(time*.12)*10+Math.sin(time*.043)*7;
  for(let i=0;i<particles.length;i++){
   const petal=particles[i];
   petal.y+=petal.fall*delta;
   petal.x+=(petal.drift+wind*.34+Math.sin(time*petal.phaseSpeed+petal.phase)*petal.sway)*delta;
   petal.rotation+=petal.spin*delta;
   if(petal.y>height+36||petal.x<-76||petal.x>width+76)particles[i]=createPetal(false);
   drawPetal(petal,time);
  }
  raf=requestAnimationFrame(frame);
 }
 function stop(){
  if(raf)cancelAnimationFrame(raf);
  raf=0;
  if(ctx)ctx.clearRect(0,0,width,height);
 }
 function remove(){
  stop();
  if(resizeObserver){resizeObserver.disconnect();resizeObserver=null;}
  else window.removeEventListener("resize",resize);
  if(canvas){canvas.remove();canvas=null;ctx=null;}
  particles=[];
 }
 function start(){
  if(canvas||reduced())return;
  canvas=document.createElement("canvas");
  canvas.className="qq-ambience-canvas";
  canvas.dataset.qqAmbienceLayer="true";
  canvas.setAttribute("aria-hidden","true");
  document.body.appendChild(canvas);
  ctx=canvas.getContext("2d",{alpha:true,desynchronized:true});
  if(!ctx){remove();return;}
  resize();
  if("ResizeObserver"in window){
   resizeObserver=new ResizeObserver(resize);
   resizeObserver.observe(document.documentElement);
  }else window.addEventListener("resize",resize,{passive:true});
  last=performance.now();
  raf=requestAnimationFrame(frame);
 }
 function synchronize(){
  if(root.dataset.qqAmbience==="sakura"&&!reduced())start();
  else remove();
 }
 const observer=new MutationObserver(synchronize);
 observer.observe(root,{attributes:true,attributeFilter:["data-qq-ambience","data-qq-reduce-motion"]});
 document.addEventListener("visibilitychange",synchronize,{passive:true});
 window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",synchronize);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",synchronize,{once:true});
 else synchronize();
})();