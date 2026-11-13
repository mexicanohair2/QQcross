const fs = require("node:fs");
const { performance } = require("node:perf_hooks");

async function main() {
  const { generateTopology } = await import("../scanword-engine/src/topology-builder.js");
  const { deriveWordSlots } = await import("../scanword-engine/src/topology.js");
  const { prepareDictionary, normalizeAnswer, findCandidates, buildIndexes } = await import("../scanword-engine/src/dictionary.js");
  const { solveSlotsCsp } = await import("../scanword-engine/src/csp.js");
  const { assembleScanword } = await import("../scanword-engine/src/assembler.js");
  const { validateScanword } = await import("../scanword-engine/src/validator.js");
  const raw = JSON.parse(fs.readFileSync("data/scanword-dictionary.json", "utf8"));
  const prepared = prepareDictionary(raw);
  const topologyResult = generateTopology({seed:122086,includeSpecialEleven:true,maxAttempts:96});
  if (!topologyResult.ok) throw new Error("No special topology: "+topologyResult.reason);
  const topology = topologyResult.topology;
  const borderSlots = topology.slots.filter(slot => slot.axis === "horizontal" && slot.endpoints.some(p => p.col === 0));
  const indexes = buildIndexes(prepared.variants);
  const answers = [...new Set(prepared.variants.filter(entry=>entry.answer.length===11).map(entry=>entry.answer))];
  const candidates = answers.map(answer => {
    const unavailable = [];
    for (let row=1; row<=11; row++) {
      const slot = borderSlots.find(item => item.endpoints.some(p=>p.row===row&&p.col===0));
      if (!slot) { unavailable.push({row,reason:"NO_LEFT_BORDER_SLOT"}); continue; }
      const letter = answer[row-1];
      const options = slot.directionOptions.find(option=>option.clueCell.row===row&&option.clueCell.col===0);
      const count = options ? findCandidates(indexes,slot.length,[{position:0,letter}]).filter(x=>x.answer!==answer).length : 0;
      if (!count) unavailable.push({row,letter,length:slot.length,reason:"NO_STARTING_WORD"});
    }
    return {answer,unavailable};
  }).filter(item=>item.unavailable.length===0);
  const results=[];
  for (let index=0; index<candidates.length; index++) {
    const candidate=candidates[index];
    const dictionary=raw.filter(item=>normalizeAnswer(item.answer).length!==11||normalizeAnswer(item.answer)===candidate.answer);
    const started=performance.now();
    const solved=solveSlotsCsp(topology.slots,dictionary,{
      seed:70001+index,requiredImageCount:5,minimumLogicClueCells:3,
      requireEveryClueStarts:false,maxNodes:120000,maxTimeMs:600
    });
    let valid=null, validationErrors=null;
    if(solved.ok){
      const assembled=assembleScanword({seed:70001+index,words:solved.words,questions:solved.questions});
      if(assembled.ok){
        const validation=validateScanword(assembled.scanword,raw,{
          requiredImageCount:5,minimumLogicClueCells:3,
          requireLeftBorderClues:true,requireTopAnchor:true,requireConnected:true
        });
        valid=validation.valid;
        validationErrors=validation.errors.slice(0,6);
      } else validationErrors=assembled.errors.slice(0,6);
    }
    results.push({
      answer:candidate.answer,ok:solved.ok,valid,reason:solved.reason??null,
      nodes:solved.nodes,deepest:solved.deepest,
      elapsedMs:Math.round(performance.now()-started),
      lastDeadEnd:solved.lastDeadEnd??null,
      validationErrors,
      answers:solved.words?.length??0
    });
    if(valid) break;
  }
  console.log(JSON.stringify({
    topologySeed:122086,topologySlots:topology.slots.length,
    borderSlots:borderSlots.map(slot=>({row:slot.endpoints.find(p=>p.col===0).row,length:slot.length})),
    elevenCandidates:answers.length,compatibleCandidates:candidates.length,
    successful:results.filter(x=>x.valid),results
  },null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
