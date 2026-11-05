const fs = require("node:fs");
const dictionary = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
const data = JSON.parse(fs.readFileSync("data/scanwords-1000.json", "utf8"));
const fail = message => { console.error("SCANWORD DATA ERROR:", message); process.exitCode = 1; };
if (!Array.isArray(dictionary) || !Array.isArray(data.puzzles) || data.version !== 5) {
  fail("Unexpected dictionary or scanword data format (expected dictionary array and template version 5)"); process.exit();
}
if (data.puzzles.length !== 1000) fail(`Expected 1000 puzzles, found ${data.puzzles.length}`);
const normalized = item => String(item?.answer || item?.word || "").toLocaleUpperCase("ru-RU").replace(/Ё/g,"Е").replace(/[^А-ЯA-Z]/g,"");
const signatures = new Set();
for (let n=0; n<data.puzzles.length; n++) {
  const puzzle = data.puzzles[n], vertical = normalized(dictionary[puzzle.vertical]);
  if (vertical.length !== 11 || !Array.isArray(puzzle.across) || puzzle.across.length !== 11) {
    fail(`Puzzle ${n}: invalid 11-letter spine or row count`); continue;
  }
  const occupied = new Map(), clues = new Set();
  const add = (entry, dir, x, y, label) => {
    const answer = normalized(entry);
    if (!answer || !["across","down"].includes(dir)) { fail(`Puzzle ${n}: ${label} is invalid`); return; }
    const clueKey = y+","+x;
    if (clues.has(clueKey) || occupied.has(clueKey)) fail(`Puzzle ${n}: clue cell collision at ${clueKey}`);
    clues.add(clueKey);
    for (let k=0; k<answer.length; k++) {
      const yy = dir==="down" ? y+1+k : y;
      const xx = dir==="down" ? x : x+1+k;
      if (xx<0 || xx>=12 || yy<0 || yy>=12) { fail(`Puzzle ${n}: ${label} is outside the 12x12 board`); return; }
      const key=yy+","+xx, old=occupied.get(key);
      if (old && old!==answer[k]) fail(`Puzzle ${n}: letter conflict at ${key}`);
      occupied.set(key,answer[k]);
    }
  };
  add(dictionary[puzzle.vertical],"down",0,0,"spine");
  for (let row=0; row<11; row++) {
    const entry=dictionary[puzzle.across[row]], answer=normalized(entry);
    if (!answer || answer[0]!==vertical[row] || answer.length>10 || answer.length===9) fail(`Puzzle ${n}: row ${row+1} does not share the spine letter or leaves a single cell`);
    add(entry,"across",1,row+1,`main row ${row+1}`);
  }
  for (let j=0; j<(puzzle.extras||[]).length; j++) {
    const extra=puzzle.extras[j];
    add(dictionary[extra.index],extra.dir,extra.x,extra.y,`extra ${j}`);
  }
  for (const key of clues) if (occupied.has(key)) fail(`Puzzle ${n}: clue cell overlaps an answer at ${key}`);
  const signature=JSON.stringify(puzzle);
  if(signatures.has(signature)) fail(`Puzzle ${n}: duplicate layout`);
  signatures.add(signature);
}
if (!process.exitCode) console.log(`Validated ${data.puzzles.length} scanwords against ${dictionary.length} dictionary entries.`);
