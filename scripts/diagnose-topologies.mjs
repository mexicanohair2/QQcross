const { getTopologyScaffolds, generateTopology } = await import("../scanword-engine/src/topology-builder.js");
const { createEmptyGrid } = await import("../scanword-engine/src/grid.js");
const { validateTopology, deriveWordSlots } = await import("../scanword-engine/src/topology.js");

function roleGrid(rows) {
  const grid = createEmptyGrid();
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      if (row === 0 && col === 0) continue;
      const cell = grid[row][col];
      cell.type = rows[row][col] === "#" ? "question" : "letter";
      cell.letter = cell.type === "letter" ? "А" : null;
    }
  }
  return grid;
}
function metrics(rows) {
  const grid = roleGrid(rows);
  const validation = validateTopology(grid, { requireConnected: true });
  const derived = deriveWordSlots(grid);
  const counts = Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(n => [
    String(n), derived.slots.filter(slot => slot.length === n).length
  ]));
  return {
    valid: validation.valid,
    errors: validation.errors.slice(0, 5),
    pattern: rows.join("/"),
    questionCells: validation.metrics.questionCells,
    letterCells: validation.metrics.letterCells,
    slots: derived.slots.length,
    lengths: counts,
    shortSlots: counts["2"],
    minLength: Math.min(...derived.slots.map(slot => slot.length)),
    topQuestions: rows[0].slice(1).split("").filter(x => x === "#").length
  };
}

const targetPattern = [
  ".#...###",
  "#...#...",
  "#...#...",
  "#...#...",
  "#......#",
  "#....##.",
  "#...#...",
  "#...#...",
  "#......#",
  "#....##.",
  "#.....#.",
  "#......#"
];
const targetMetrics = metrics(targetPattern);
const scaffoldResults = getTopologyScaffolds().map((rows,index)=>({index,...metrics(rows)}));
const randomResults = [];
for(let seed=1;seed<=48;seed++){
  const result=generateTopology({seed,includeSpecialEleven:false,maxAttempts:128});
  if(result.ok)randomResults.push({seed,...metrics(result.topology.pattern)});
}
console.log(JSON.stringify({
  target:{rows:targetPattern,...targetMetrics},\n  scaffolds:scaffoldResults,
  randomSample:randomResults,
  averages:{
    scaffoldShorts:scaffoldResults.reduce((sum,x)=>sum+x.shortSlots,0)/scaffoldResults.length,
    randomShorts:randomResults.reduce((sum,x)=>sum+x.shortSlots,0)/randomResults.length,
    scaffoldValid:scaffoldResults.filter(x=>x.valid).length,
    randomValid:randomResults.filter(x=>x.valid).length
  }
},null,2));
