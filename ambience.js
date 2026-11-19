/* Sakura: individual, softly curved petals rendered on Canvas 2D. */
(()=>{
 const root=document.documentElement;let canvas=null,ctx=null,raf=0,last=0,particles=[],width=0,height=0,dpr=1,ro=null;
 const reduced=()=>root.dataset.qqReduceMotion==="true"||window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||document.hidden;
 const colors=["#f6f5f0","#e6e7e4","#d4d8d8","#ffffff","#c7cccd"];
 const rand=(a,b)=>a+Math.random()*(b-a);
 function makePetal(initial=false){
  const depth=rand(.55,1.35),length=rand(8,17)*depth;
  return{x:rand(-24,width+24),y:initial?rand(-height,height):rand(-height*.22,-16),length,width:length*rand(.48,.72),depth,angle:rand(-Math.PI,Math.PI),spin:rand(-.9,.9),speed:rand(17,39)*depth,drift:rand(-13,13),sway:rand(8,28),phase:rand(0,Math.PI*2),phaseSpeed:rand(.45,1.25),color:colors[Math.floor(rand(0,colors.length))],fold:rand(.25,.78),opacity:rand(.34,.78),flip:rand(.55,1.25)};
 }
 function resize(){
  if(!canvas)return;const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(devicePixelRatio||1,1.6);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const n=Math.max(20,Math.min(40,Math.round(width*height/42000)));
  while(particles.length<n)particles.push(makePetal(true));if(particles.length>n)particles.length=n;
 }
 function draw(p,t){
  const L=p.length,W=p.width;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.scale(1,Math.max(.22,Math.abs(Math.cos(t*.7+p.phase))*p.flip));ctx.globalAlpha=p.opacity;
  const g=ctx.createLinearGradient(-L*.3,-W,L*.35,W);g.addColorStop(0,"rgba(255,255,255,.92)");g.addColorStop(.48,p.color);g.addColorStop(1,"rgba(105,114,119,.64)");
  ctx.fillStyle=g;ctx.strokeStyle="rgba(255,255,255,.34)";ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-L*.52,0);ctx.bezierCurveTo(-L*.44,-W*.94,L*.08,-W*1.12,L*.5,-W*.1);ctx.bezierCurveTo(L*.28,W*.68,-L*.14,W*1.02,-L*.52,0);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-L*.39,0);ctx.quadraticCurveTo(L*.02,Math.sin(t+p.phase)*W*.2,L*.39,-W*.04);ctx.strokeStyle="rgba(110,119,124,.4)";ctx.lineWidth=.45;ctx.stroke();ctx.restore();
 }
 function frame(now){
  raf=0;if(!canvas||reduced())return;const dt=Math.min(.04,(now-last)/1000||.016);last=now;const t=now/1000;ctx.clearRect(0,0,width,height);
  const wind=Math.sin(t*.13)*11+Math.sin(t*.047)*8;
  for(let i=0;i<particles.length;i++){const p=particles[i];p.y+=p.speed*dt;p.x+=(p.drift+wind*.34+Math.sin(t*p.phaseSpeed+p.phase)*p.sway)*dt;p.angle+=p.spin*dt;if(p.y>height+32||p.x<-70||p.x>width+70)particles[i]=makePetal(false);draw(p,t)}
  raf=requestAnimationFrame(frame);
 }
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;if(ctx)ctx.clearRect(0,0,width,height)}
 function remove(){stop();if(ro){ro.disconnect();ro=null}if(canvas){canvas.remove();canvas=null;ctx=null}particles=[]}
 function start(){
  if(canvas||reduced())return;canvas=document.createElement("canvas");canvas.className="qq-ambience-canvas";canvas.dataset.qqAmbienceLayer="true";canvas.setAttribute("aria-hidden","true");document.body.appendChild(canvas);
  ctx=canvas.getContext("2d",{alpha:true,desynchronized:true});if(!ctx){remove();return}resize();
  if("ResizeObserver"in window){ro=new ResizeObserver(resize);ro.observe(document.documentElement)}else window.addEventListener("resize",resize,{passive:true});
  last=performance.now();raf=requestAnimationFrame(frame);
 }
 function sync(){if(root.dataset.qqAmbience==="sakura"&&!reduced())start();else remove()}
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:["data-qq-ambience","data-qq-reduce-motion"]});
 document.addEventListener("visibilitychange",sync,{passive:true});window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",sync);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();