import { createEmptyGrid } from "../scanword-engine/src/grid.js";
import { deriveWordSlots, validateTopology } from "../scanword-engine/src/topology.js";
import { getTopologyScaffolds } from "../scanword-engine/src/topology-builder.js";

const pattern = getTopologyScaffolds()[0];
const grid = createEmptyGrid();
for(let row=0;row<12;row++){
  for(let col=0;col<8;col++){
    if(row===0&&col===0)continue;
    const question=pattern[row][col]==="#";
    grid[row][col].type=question?"question":"letter";
    grid[row][col].letter=question?null:"А";
  }
}
const options={requireConnected:true,allowRightEdgeBoundary:true};
const topology=validateTopology(grid,options);
const normal=deriveWordSlots(grid,{...options,allowSpecialElevenBoundary:false});
const special=deriveWordSlots(grid,{...options,allowSpecialElevenBoundary:true});
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
if(!topology.valid||normal.errors.length||normal.slots.length<20||normal.slots.filter(slot=>slot.length===2).length>6||normal.slots.filter(slot=>slot.special==='RIGHT_EDGE_BOUNDARY').length!==12||grid.some(row=>row[7].type!=='letter'))process.exitCode=1;
