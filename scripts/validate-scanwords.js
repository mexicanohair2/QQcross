const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const data = JSON.parse(fs.readFileSync("data/scanwords-1000.json", "utf8"));
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
if (!Array.isArray(dictionary) || !Array.isArray(data.puzzles) || data.version !== 6) {
  fail("Unexpected dictionary or scanword data format (expected dictionary array and template version 6)"); process.exit();
}
if (data.puzzles.length !== 1000) fail(`Expected 1000 puzzles, found ${data.puzzles.length}`);
const normalized = item => String(item?.answer || item?.word || "").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
const signatures = new Set(), topAnswers = ["Я","ЮГ","ЯК","ЩИ"], topStarts = [1,3,6,9];
for (let n=0; n<data.puzzles.length; n++) {
  const puzzle=data.puzzles[n], vertical=normalized(dictionary[puzzle.vertical]);
  if (vertical.length!==11 || !Array.isArray(puzzle.across) || puzzle.across.length!==11) {
    fail(`Puzzle ${n}: invalid 11-letter spine or row count`); continue;
  }
  const occupied=new Map(), clues=new Set(), usedAnswers=new Set();
  const add=(entry,dir,x,y,label)=>{
    const answer=normalized(entry);
    if (!answer || !["across","down"].includes(dir) || usedAnswers.has(answer)) { fail(`Puzzle ${n}: ${label} is invalid or duplicated`); return; }
    usedAnswers.add(answer);
    const clueKey=y+","+x;
    if (clues.has(clueKey) || occupied.has(clueKey)) { fail(`Puzzle ${n}: clue cell collision at ${clueKey}`); return; }
    clues.add(clueKey);
    for (let k=0;k<answer.length;k++) {
      const yy=dir==="down"?y+1+k:y, xx=dir==="down"?x+1:x+1+k;
      if (xx<0 || xx>=12 || yy<0 || yy>=12) { fail(`Puzzle ${n}: ${label} is outside the 12x12 board`); return; }
      const key=yy+","+xx, old=occupied.get(key);
      if (clues.has(key) || (old && old!==answer[k])) { fail(`Puzzle ${n}: letter conflict at ${key}`); return; }
      occupied.set(key,answer[k]);
    }
  };
  add(dictionary[puzzle.vertical],"down",0,0,"spine");
  let capacity=0;
  for (let row=0;row<11;row++) {
    const entry=dictionary[puzzle.across[row]], answer=normalized(entry);
    if (!answer || answer[0]!==vertical[row] || answer.length>7) fail(`Puzzle ${n}: row ${row+1} does not share the spine or is too long`);
    capacity+=Math.floor((10-answer.length)/3);
    add(entry,"across",0,row+1,`main row ${row+1}`);
  }
  if (capacity!==18) fail(`Puzzle ${n}: expected 18 extra slots, capacity is ${capacity}`);
  for (let j=0;j<topAnswers.length;j++)
    add(dictionary.find(item=>normalized(item)===topAnswers[j]),"across",topStarts[j],0,`top clue ${j+1}`);
  let extraCount=0;
  if (!Array.isArray(puzzle.extras) || puzzle.extras.length!==18) fail(`Puzzle ${n}: expected 18 prebuilt filler clues`);
  for (let j=0;j<(puzzle.extras||[]).length;j++) {
    const extra=puzzle.extras[j];
    add(dictionary[extra.index],extra.dir,extra.x,extra.y,`extra ${j+1}`);
    extraCount++;
  }
  if (extraCount!==18 || usedAnswers.size!==34) fail(`Puzzle ${n}: expected 34 clues, found ${usedAnswers.size}`);
  for (const key of clues) if (occupied.has(key)) fail(`Puzzle ${n}: clue cell overlaps an answer at ${key}`);
  if (occupied.size+clues.size!==133) fail(`Puzzle ${n}: expected 133 active cells, found ${occupied.size+clues.size}`);
  const signature=JSON.stringify(puzzle);
  if (signatures.has(signature)) fail(`Puzzle ${n}: duplicate layout`);
  signatures.add(signature);
}
if (!process.exitCode) console.log(`Validated ${data.puzzles.length} scanwords against ${dictionary.length} dictionary entries.`);
