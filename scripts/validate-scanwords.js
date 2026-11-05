const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const data = JSON.parse(fs.readFileSync("data/scanwords-1000.json", "utf8"));
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
const normalized = item => String(item?.answer || item?.word || "").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
if (!Array.isArray(dictionary) || !Array.isArray(data.puzzles) || data.version !== 10 || data.width !== 13 || data.height !== 13) {
  fail("Expected dictionary array and 13x13 scanword data version 10"); process.exit();
}
if (data.puzzles.length < 1000) fail(`Expected at least 1000 puzzles, found ${data.puzzles.length}`);
const signatures = new Set();
let coverageSum=0,minCoverage=1,maxCoverage=0;
for (let n=0; n<data.puzzles.length; n++) {
  const puzzle=data.puzzles[n];
  if (!Array.isArray(puzzle.top) || puzzle.top.length!==12 || !Array.isArray(puzzle.extras) || puzzle.extras.length<14 || puzzle.extras.length>15) {
    fail(`Puzzle ${n}: expected 12 top clues and 14–15 additional clues`); continue;
  }
  const occupied=new Map(), clues=new Set(), answers=new Set(), words=[];
  const add=(index,dir,x,y,label,top=false)=>{
    const entry=dictionary[index],answer=normalized(entry);
    const clueX=top?x+1:x,clueY=top?0:y;
    if (!entry || !answer || !["across","down"].includes(dir) || answers.has(answer) ||
        !String(entry.emoji||entry.flag||entry.clue||entry.question||entry.clueShort||"").trim()) {
      fail(`Puzzle ${n}: ${label} is invalid or duplicated`); return;
    }
    answers.add(answer);
    const clueKey=clueY+","+clueX;
    if (clues.has(clueKey) || occupied.has(clueKey) || clueX<0 || clueX>=13 || clueY<0 || clueY>=13) {
      fail(`Puzzle ${n}: clue collision or out of bounds at ${clueKey}`); return;
    }
    clues.add(clueKey);
    const cells=[];
    for (let k=0;k<answer.length;k++) {
      const yy=dir==="down"?y+1+k:y, xx=dir==="down"?x+1:x+1+k;
      if (xx<0 || xx>=13 || yy<0 || yy>=13) { fail(`Puzzle ${n}: ${label} is outside the 13x13 board`); return; }
      const key=yy+","+xx, old=occupied.get(key);
      if (clues.has(key) || (old!==undefined && old!==answer[k])) { fail(`Puzzle ${n}: letter conflict at ${key}`); return; }
      occupied.set(key,answer[k]); cells.push(key);
    }
    words.push(cells);
  };
  for (let x=0;x<12;x++) add(puzzle.top[x],"down",x,0,`top clue ${x+1}`,true);
  if (normalized(dictionary[puzzle.top[0]]).length!==12) fail(`Puzzle ${n}: first top answer must have 12 letters`);
  for (let x=0;x<12;x++) if (!clues.has("0,"+(x+1))) fail(`Puzzle ${n}: top row cell ${x+1} is not a clue`);
  for (let j=0;j<puzzle.extras.length;j++) {
    const extra=puzzle.extras[j];
    add(extra.index,extra.dir,extra.x,extra.y,`extra ${j+1}`);
  }
  if (answers.size!==12+puzzle.extras.length || clues.size!==12+puzzle.extras.length)
    fail(`Puzzle ${n}: expected ${12+puzzle.extras.length} unique clues, found ${answers.size}`);
  const parents=words.map((_,i)=>i),find=x=>parents[x]===x?x:(parents[x]=find(parents[x]));
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[a]=b};
  const owners=new Map();
  words.forEach((cells,i)=>cells.forEach(key=>{if(!owners.has(key))owners.set(key,[]);owners.get(key).push(i)}));
  for (const ids of owners.values()) for(let j=1;j<ids.length;j++) union(ids[0],ids[j]);
  if (new Set(parents.map((_,i)=>find(i))).size!==1) fail(`Puzzle ${n}: word network is disconnected`);
  const coverage=(occupied.size+clues.size)/169;
  coverageSum+=coverage;minCoverage=Math.min(minCoverage,coverage);maxCoverage=Math.max(maxCoverage,coverage);
  const signature=JSON.stringify(puzzle);
  if (signatures.has(signature)) fail(`Puzzle ${n}: duplicate layout`);
  signatures.add(signature);
}
if (!process.exitCode) console.log(`Validated ${data.puzzles.length} connected 13x13 scanwords. Base coverage: avg ${(coverageSum/data.puzzles.length*100).toFixed(1)}%, min ${(minCoverage*100).toFixed(1)}%, max ${(maxCoverage*100).toFixed(1)}%. Runtime adds further crossing clues.`);