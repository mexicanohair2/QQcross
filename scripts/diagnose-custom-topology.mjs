import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { deriveWordSlots, validateTopology } from "../scanword-engine/src/topology.js";

const marks = [
  [1,6],
  [2,5],
  [3,7],
  [4,4],[4,6],
  [5,5],
  [6,6],
  [7,6],[7,7],
  [8,4],[8,5],
  [9,5],
  [10,6],
  [11,4],[11,7]
];
const grid = createEmptyGrid();
for(let row=0;row<12;row++){
  for(let col=0;col<8;col++){
    if(row===0&&col===0)continue;
    const question=(row===0&&[1,4,7].includes(col))
      ||(col===0&&row>0)
      ||marks.some(([r,c])=>r===row&&c===col);
    grid[row][col].type=question?"question":"letter";
    grid[row][col].letter=question?null:"А";
  }
}
const topology=validateTopology(grid,{requireConnected:true});
const derived=deriveWordSlots(grid);
const lengths=Object.fromEntries([2,3,4,5,6,7,8,9,10,11].map(n=>[
  String(n),derived.slots.filter(slot=>slot.length===n).length
]));
const result={
  valid:topology.valid,
  errors:topology.errors,
  metrics:topology.metrics,
  slots:derived.slots.length,
  lengths,
  pattern:grid.map(row=>row.map(cell=>cell.type==="question"?"#":cell.type==="corner"?".":"·").join("")),
  slotDetails:derived.slots.map(slot=>({id:slot.id,length:slot.length,axis:slot.axis,from:slot.endpoints[0],to:slot.endpoints[1]}))
};
console.log(JSON.stringify(result,null,2));
if(!topology.valid)process.exitCode=1;
