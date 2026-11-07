(function(){
"use strict";
const HISTORY_KEY="qqcross.encyclopedia.history.v1";
let lexiconPromise=null,wordBuckets=null;
const normalize=value=>String(value||"").toUpperCase().replace(/Ё/g,"Е").replace(/[^А-Я]/g,"");
async function loadLexicon(){
 if(!lexiconPromise)lexiconPromise=fetch("./data/russian-words-100000.json").then(r=>{if(!r.ok)throw new Error("Не удалось загрузить словарь");return r.json()}).then(data=>{if(data.language!=="ru"||!Array.isArray(data.words))throw new Error("Файл словаря повреждён");return data.words.map(normalize).filter(w=>w.length>=2)}).then(words=>{wordBuckets=new Map();for(const w of words){const k=w.length;const a=wordBuckets.get(k)||[];a.push(w);wordBuckets.set(k,a)}return words});
 return lexiconPromise;
}
function distance(a,b,limit=2){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];let min=i;for(let j=1;j<=b.length;j++){const v=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));row[j]=v;if(v<min)min=v;}if(min>limit)return limit+1;prev=row;}
 return prev[b.length];
}
async function suggest(query){
 const q=normalize(query);if(!q)return null;
 await loadLexicon();let best=null,bestDistance=3;
 for(let len=Math.max(2,q.length-2);len<=q.length+2;len++)for(const word of wordBuckets.get(len)||[]){const d=distance(q,word,2);if(d<bestDistance){best=word;bestDistance=d;if(d===1&&word[0]===q[0])return{word:best,distance:d};}}
 return bestDistance<=2?{word:best,distance:bestDistance}:null;
}
async function apiArticle(domain,query){
 const base="https://"+domain+"/w/api.php?origin=*&format=json&formatversion=2&";
 const sr=await fetch(base+"action=query&list=search&srlimit=5&srsearch="+encodeURIComponent(query),{headers:{"Accept":"application/json"}});
 if(!sr.ok)throw new Error("Справочник временно недоступен");
 const hits=(await sr.json()).query?.search||[];if(!hits.length)return null;
 const title=hits[0].title;
 const dr=await fetch(base+"action=query&prop=extracts%7Cinfo%7Clinks&exintro=1&explaintext=1&exchars=1800&inprop=url&pllimit=10&titles="+encodeURIComponent(title),{headers:{"Accept":"application/json"}});
 if(!dr.ok)throw new Error("Не удалось загрузить статью");
 const page=(await dr.json()).query?.pages?.[0];if(!page||page.missing)return null;
 const extract=String(page.extract||"").replace(/\[[0-9]+\]/g,"").replace(/\s+/g," ").trim();
 const sentences=extract.split(/(?<=[.!?])\s+(?=[А-ЯЁ0-9])/).filter(Boolean);
 return{title:page.title,extract:sentences.slice(0,4).join(" "),sentences:sentences.slice(0,4),source:domain==="ru.wiktionary.org"?"wiktionary":"wikipedia",sourceLabel:domain==="ru.wiktionary.org"?"Викисловаре":"Википедии",url:page.fullurl||"https://"+domain+"/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_")),related:(page.links||[]).map(x=>x.title).filter(Boolean).slice(0,8)};
}
function extractStress(entry){
 if(!entry?.extract)return null;
 const match=entry.extract.match(/[А-Яа-яЁё]+\u0301[А-Яа-яЁё]*/u);
 return match?match[0]:null;
}
function history(){try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(x)?x:[]}catch(_){return[]}}
function remember(word){const list=history().filter(x=>x!==word);list.unshift(word);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,20)))}catch(_){}}
async function lookupEntries(query){
 const results=await Promise.allSettled([
  apiArticle("ru.wikipedia.org",query),
  apiArticle("ru.wiktionary.org",query)
 ]);
 const entries=results.map(x=>x.status==="fulfilled"?x.value:null).filter(Boolean);
 entries.sort((a,b)=>b.sentences.length-a.sentences.length||(a.source==="wikipedia"?-1:1));
 const article=entries[0]||null;
 const wiktionary=entries.find(x=>x.source==="wiktionary")||null;
 return{article,stress:extractStress(wiktionary)};
}
async function search(query){
 const requested=String(query||"").trim(),normalized=normalize(requested);
 if(!normalized)return{error:"Введи слово на русском языке."};
 let correction=null;try{correction=await suggest(normalized)}catch(e){console.warn("QQCross dictionary:",e)}
 const candidate=correction&&correction.word!==normalized?correction.word:requested;
 let {article,stress}=await lookupEntries(candidate);
 if(!article&&candidate!==requested){const fallback=await lookupEntries(requested);article=fallback.article;stress=fallback.stress}
 if(article)remember(article.title);
 return{requested,correction:correction&&correction.word!==normalized?correction:null,article,stress,suggestions:correction?[correction.word]:[]};
}
window.QQEncyclopedia={search,history,normalize};
})();