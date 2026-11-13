import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { deriveWordSlots, validateTopology } from "../scanword-engine/src/topology.js";

const pattern = [
  ".#..#..#",
  "#......#",
  "#.....#.",
  "#....#..",
  "#...#...",
  "#......#",
  "#.....#.",
  "#....#..",
  "#...#..#",
  "#.....#.",
  "#.....##",
  "#...#..#"
];
const grid = createEmptyGrid();
for(let row=0;row<12;row++){
  for(let col=0;col<8;col++){
    if(row===0&&col===0)continue;
    const question=pattern[row][col]==="#";
    grid[row][col].type=question?"question":"letter";
    grid[row][col].letter=question?null:"А";
  }
}
const topology=validateTopology(grid,{requireConnected:true});
const normal=deriveWordSlots(grid,{allowSpecialElevenBoundary:false});
const special=deriveWordSlots(grid,{allowSpecialElevenBoundary:true});
const histogram=slots=>Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(n=>[
  String(n),slots.filter(slot=>slot.length===n).length
]));
const result={
  valid:topology.valid,
  errors:topology.errors,
  metrics:topology.metrics,
  normalSlots:normal.slots.length,
  specialSlots:special.slots.length,
  normalLengths:histogram(normal.slots),
  specialLengths:histogram(special.slots),
  pattern
};
console.log(JSON.stringify(result,null,2));
if(!topology.valid||normal.errors.length||normal.slots.length<18)process.exitCode=1;
