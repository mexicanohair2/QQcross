const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const data = JSON.parse(fs.readFileSync("data/scanwords-1000.json", "utf8"));
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
const normalized = item => String(item?.answer || item?.word || "").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
if (!Array.isArray(dictionary) || !Array.isArray(data.puzzles) || data.version !== 7 || data.width !== 13 || data.height !== 13) {
  fail("Expected dictionary array and 13x13 scanword data version 7"); process.exit();
}
if (data.puzzles.length !== 1000) fail(`Expected 1000 puzzles, found ${data.puzzles.length}`);
const signatures = new Set();
for (let n=0; n<data.puzzles.length; n++) {
  const puzzle=data.puzzles[n];
  if (!Array.isArray(puzzle.top) || puzzle.top.length!==12 || !Array.isArray(puzzle.extras) || puzzle.extras.length!==22) {
    fail(`Puzzle ${n}: expected 12 top clues and 22 additional clues`); continue;
  }
  const occupied=new Map(), clues=new Set(), answers=new Set();
  const add=(entry,dir,x,y,label)=>{
    const answer=normalized(entry);
    if (!answer || !["across","down"].includes(dir) || answers.has(answer)) { fail(`Puzzle ${n}: ${label} is invalid or duplicated`); return; }
    answers.add(answer);
    const clueKey=y+","+x;
    if (clues.has(clueKey) || occupied.has(clueKey)) { fail(`Puzzle ${n}: clue collision at ${clueKey}`); return; }
    clues.add(clueKey);
    for (let k=0;k<answer.length;k++) {
      const yy=dir==="down"?y+1+k:y, xx=dir==="down"?x+1:x+1+k;
      if (xx<0 || xx>=13 || yy<0 || yy>=13) { fail(`Puzzle ${n}: ${label} is outside the 13x13 board`); return; }
      const key=yy+","+xx, old=occupied.get(key);
      if (clues.has(key) || (old && old!==answer[k])) { fail(`Puzzle ${n}: letter conflict at ${key}`); return; }
      occupied.set(key,answer[k]);
    }
  };
  for (let x=0;x<12;x++) add(dictionary[puzzle.top[x]],"down",x,0,`top clue ${x+1}`);
  if (normalized(dictionary[puzzle.top[0]]).length!==11) fail(`Puzzle ${n}: first top answer must have 11 letters`);
  for (let x=0;x<12;x++) if (!clues.has("0,"+x)) fail(`Puzzle ${n}: top row cell ${x} is not a clue`);
  for (let j=0;j<puzzle.extras.length;j++) {
    const extra=puzzle.extras[j];
    add(dictionary[extra.index],extra.dir,extra.x,extra.y,`extra ${j+1}`);
  }
  if (answers.size!==34 || clues.size!==34) fail(`Puzzle ${n}: expected 34 clues, found ${answers.size}`);
  const signature=JSON.stringify(puzzle);
  if (signatures.has(signature)) fail(`Puzzle ${n}: duplicate layout`);
  signatures.add(signature);
}
if (!process.exitCode) console.log(`Validated ${data.puzzles.length} 13x13 scanwords: 12 top-row clues, 34 unique answers each.`);
