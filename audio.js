(function(){
"use strict";
const KEY="qqcross_audio_v1";
const defaults={music:true,effects:true};
let prefs={...defaults};
try{const saved=JSON.parse(localStorage.getItem(KEY)||"{}");prefs={music:saved.music!==false,effects:saved.effects!==false};}catch(_){}
let ctx=null,musicTimer=null,noteIndex=0;
const melody=[261.63,329.63,392.00,329.63,293.66,349.23,440.00,349.23,246.94,329.63,392.00,329.63,220.00,293.66,369.99,293.66];
function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){}}
function audioContext(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;if(!ctx)ctx=new C();if(ctx.state==="suspended")ctx.resume().catch(()=>{});return ctx;}
function tone(freq,duration,volume,type,delay=0){
 const c=audioContext();if(!c)return;
 const start=c.currentTime+delay,osc=c.createOscillator(),gain=c.createGain();
 osc.type=type||"sine";osc.frequency.setValueAtTime(freq,start);
 gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),start+.025);
 gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
 osc.connect(gain);gain.connect(c.destination);osc.start(start);osc.stop(start+duration+.02);
}
function musicTick(){
 if(!prefs.music||document.hidden)return;
 const note=melody[noteIndex%melody.length],c=audioContext();if(!c)return;
 tone(note,.95,.045,"sine");
 if(noteIndex%4===0)tone(note/2,1.35,.024,"sine",.02);
 noteIndex++;
}
function startMusic(){if(!prefs.music||musicTimer!==null)return;musicTick();musicTimer=setInterval(musicTick,1050);}
function stopMusic(){if(musicTimer!==null){clearInterval(musicTimer);musicTimer=null;}}
function unlock(){audioContext();if(prefs.music)startMusic();}
function play(kind){
 if(!prefs.effects)return;
 const sounds={
  letter:[[660,.07,.025],[880,.08,.014]],
  word:[[523.25,.13,.026],[659.25,.13,.026],[783.99,.2,.03]],
  correct:[[659.25,.11,.027],[880,.16,.03]],
  good:[[659.25,.11,.027],[880,.16,.03]],
  win:[[523.25,.13,.026],[659.25,.13,.026],[783.99,.2,.03],[1046.5,.22,.026]],
  hint:[[220,.14,.026],[174.61,.19,.022]],
  wrong:[[220,.14,.026],[174.61,.19,.022]],
  select:[[740,.055,.014]]
 };
 const seq=sounds[kind];if(!seq)return;
 seq.forEach((n,i)=>tone(n[0],n[1],n[2],"sine",i*.075));
}
function setMusic(value){prefs.music=!!value;save();if(prefs.music){audioContext();startMusic();}else stopMusic();}
function setEffects(value){prefs.effects=!!value;save();}
document.addEventListener("pointerdown",unlock,{passive:true});
document.addEventListener("keydown",unlock);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopMusic();else if(prefs.music)startMusic();});
window.QQAudio={play,setMusic,setEffects,getSettings:()=>({...prefs}),unlock};
})();