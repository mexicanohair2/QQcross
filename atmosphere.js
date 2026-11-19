(function(){
"use strict";
const root=document.documentElement,layer=document.createElement("div");
layer.className="qq-atmosphere-layer";layer.setAttribute("aria-hidden","true");
function attach(){if(document.body&&!layer.isConnected)document.body.appendChild(layer);}
attach();document.addEventListener("DOMContentLoaded",attach,{once:true});
const svg={
 snow:'<svg viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M16 2v28M3.9 9.5l24.2 13M3.9 22.5l24.2-13"/><path d="m12 5 4 3 4-3m-8 22 4-3 4 3M5 14l5-.2 1-5m16 13-5 .2-1 5M5 18l5 .2 1 5m16-13-5-.2-1-5"/></g></svg>',
 leaf:'<svg viewBox="0 0 40 40"><path d="M34 4C17 4 6 10 5 23c-.5 7 5 12 12 11C30 33 35 18 34 4Z" fill="currentColor" stroke="#ffffff66" stroke-width="1"/><path d="M7 33C15 24 22 17 33 5M17 24l-1-9m7 2 6-1m-13 12-7-2" fill="none" stroke="#fff9" stroke-width="1.2" stroke-linecap="round"/></svg>',
 petal:'<svg viewBox="0 0 32 40"><path d="M16 2C5 8 1 19 8 30c4 6 12 7 16 1C32 20 26 8 16 2Z" fill="currentColor" stroke="#ffffff66" stroke-width="1"/><path d="M16 5c1 11 1 21 0 30" fill="none" stroke="#fff8" stroke-width="1"/></svg>',
 rain:'<svg viewBox="0 0 12 30"><path d="M6 1C6 1 1 13 1 18a5 5 0 0 0 10 0C11 13 6 1 6 1Z" fill="currentColor" opacity=".75"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="M12 1.5 14.4 9.6 22.5 12l-8.1 2.4L12 22.5l-2.4-8.1L1.5 12l8.1-2.4Z" fill="currentColor"/></svg>',
 glow:'<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="5" fill="currentColor"/><circle cx="15" cy="15" r="10" fill="none" stroke="currentColor" opacity=".35"/></svg>',
 fog:'<svg viewBox="0 0 80 32"><path d="M4 9c10-8 20 5 30-1s20-5 27 1 12 3 15 0M2 19c12-7 20 4 31 0s19-4 27 1 14 2 18-1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55"/></svg>'
};
function makeParticle(type){
 const el=document.createElement("span");el.className="qq-atmo-particle qq-atmo-"+type;el.innerHTML=svg[type];
 const size=type==="snow"?10+Math.random()*17:type==="leaf"?18+Math.random()*22:type==="petal"?12+Math.random()*18:type==="rain"?5+Math.random()*6:type==="fog"?60+Math.random()*100:7+Math.random()*13;
 const duration=type==="snow"?9+Math.random()*13:type==="leaf"?12+Math.random()*15:type==="petal"?10+Math.random()*14:type==="rain"?1.1+Math.random()*.8:type==="fog"?22+Math.random()*18:8+Math.random()*12;
 el.style.left=Math.random()*100+"%";el.style.width=size+"px";el.style.height=(type==="fog"?size*.4:type==="rain"?size*2.5:size)+"px";
 el.style.setProperty("--drift",(Math.random()*160-80)+"px");el.style.setProperty("--spin",(Math.random()*900-450)+"deg");el.style.setProperty("--sway",(Math.random()*2-1)*30+"px");
 if(type==="glow"||type==="star"){el.style.top=Math.random()*88+"%";el.style.animationName=type==="glow"?"qqAtmoGlow":"qqAtmoTwinkle";el.style.animationDuration=(6+Math.random()*9)+"s";el.style.setProperty("--float-x",(Math.random()*34-17)+"px");}else if(type==="fog"){el.style.top=(8+Math.random()*70)+"%";} 
 el.style.animationDuration=el.style.animationDuration||duration+"s";el.style.animationDelay=(-Math.random()*duration)+"s";el.style.opacity=String(type==="fog"?.12:.28+Math.random()*.55);return el;
}
let last="";
function render(){const mode=root.dataset.qqAmbience||"none";if(mode===last)return;last=mode;layer.replaceChildren();if(mode==="none")return;
 const cfg={forest:["snow",68],sakura:["petal",42],autumn:["leaf",38],rain:["rain",48],fireflies:["glow",22],stars:["star",34],fog:["fog",9]}[mode];if(!cfg)return;
 for(let i=0;i<cfg[1];i++)layer.appendChild(makeParticle(cfg[0]));
}
new MutationObserver(render).observe(root,{attributes:true,attributeFilter:["data-qq-ambience"]});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();