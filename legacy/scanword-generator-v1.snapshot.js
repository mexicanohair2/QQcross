/*
 * ARCHIVAL SNAPSHOT — QQCross legacy generator as present on main before
 * draft PR #30. This was the 6×12 greedy generator embedded in app.js.
 *
 * It is intentionally not imported, executed, or included in the production
 * module-worker bundle. It references legacy app.js helpers and therefore is
 * not a standalone module. Keep this file for rollback/diff review until the
 * replacement is merged and accepted. The live main branch remains unchanged.
 *
 * Source branch: main
 * Captured for draft PR #30 on 2026-11-14.
 */

function buildScanword(entries){
  const W=6,H=12,TOTAL=W*H;
  const blockedClue=/монарх|древнегреч|древнерим|средневек|полис|философ|экзистенц|солипс|акциденц|регент|гильди|дук[aа]т|скипетр|суверенитет|референдум|капилляр|фарватер|эпитет|рокировк|предпринимател|бизнесмен|в каком году|кто первым|кто основал|основатель/i;
  const normalized=entries.map(normalizeScanwordEntry).filter(entry=>entry&&!blockedClue.test(entry.clue));
  // Prefer meaningful, reasoning-oriented clues; keep emoji country clues in the same pool.
  const quality=entry=>{
    const words=entry.clue.split(/\s+/).filter(Boolean).length;
    let score=entry.logic?18:0;
    // Preserve five distinct picture clues in every puzzle.
    if(entry.imageKey)score+=1000;
    if(words>=3&&words<=8)score+=8;else if(words>11)score-=6;else if(words<=2&&!entry.emoji)score-=8;
    if(entry.clue.length>=20&&entry.clue.length<=85)score+=5;else if(entry.clue.length>110)score-=7;
    if(/сколько будет|чему равно|вычисли|посчитай/i.test(entry.clue))score-=30;
    if(/кто первым|первым стал|стал бизнесменом|предпринимател|дата основания|в каком году|историческ(ая|ий) личност|кто основал|первый суд|первым начал/i.test(entry.clue))score-=55;
    // Prefer a precise definition over a fill-in-the-blank variant when the
    // same answer has both; the latter often makes neighboring clues alike.
    if(entry.clue.includes("…")||entry.clue.includes("..."))score-=35;
    // Single-letter answers are reserved for the final gap-repair pass only.
    if(entry.answer.length===1)score-=100;
    // Keep everyday vocabulary ahead of encyclopedic and specialist terms.
    if(entry.answer.length<=8)score+=7;else if(entry.answer.length>=10)score-=14;
    if(/историческ|дисциплин|административн|публикац|последовательн|многогранник|показатель степени|философ|религиоз|правовед|политолог|палеонт|геологическ|посредничеств|противореч|предпочтительн|родственных родов|государств востока|историческ(ая|ий) роман|на протяжении поколений/i.test(entry.clue))score-=90;
    if(/^(АРХЕОГРАФИЯ|ВИЛАЯТ|АЙВЕНГО|ФУГА|АНТИНОМИЯ|ПРЕАМБУЛА|ГЕРАЛЬДИКА|ФАВОРИТИЗМ|РЕПАТРИАЦИЯ|ДИАСПОРА|ШАМАНИЗМ)$/i.test(entry.answer))score-=150;
    return score;
  };
  // Keep only the strongest clue for each answer. This prevents the same
  // word from entering the candidate pool with several near-duplicate prompts.
  const bestByAnswer=new Map();
  normalized.forEach(entry=>{
    const previous=bestByAnswer.get(entry.answer);
    if(!previous||quality(entry)>quality(previous))bestByAnswer.set(entry.answer,entry);
  });
  normalized.splice(0,normalized.length,...bestByAnswer.values());
  normalized.sort((a,b)=>quality(b)-quality(a));
  const byLength=new Map();
  normalized.forEach(entry=>{
    if(entry.answer.length<1)return;
    let positions=byLength.get(entry.answer.length);
    if(!positions){positions=Array.from({length:entry.answer.length},()=>new Map());byLength.set(entry.answer.length,positions)}
    for(let p=0;p<entry.answer.length;p++){
      const letter=entry.answer[p],bucket=positions[p].get(letter)||[];
      bucket.push(entry);positions[p].set(letter,bucket);
    }
  });
  const dirs=[{name:"right",dy:0,dx:1,arrow:"→"},{name:"down",dy:1,dx:0,arrow:"↓"}];
  let bestCoverage=0,bestImageCount=-1,bestLogicCount=-1,bestSingleCount=Infinity,bestDangling=Infinity,bestBorderScore=-1,bestTopCount=0,bestLeftCount=0,bestRowSpread=0,bestColumnSpread=0,bestRank=null,best=null,bestOrphanCount=Infinity;
  const buildAttempt=()=>{
    const reservedKeys=new Set(["0,0"]);
    const occupied=new Map(),clueAt=new Map(),used=new Set(),usedImages=new Set(),words=[],frontier=new Set();
    const addFrontier=(y,x)=>{
      for(const dir of dirs)for(let step=1;step<=12;step++){
        const ay=y-dir.dy*step,ax=x-dir.dx*step;
        if(ay<0||ax<0||ay>=H||ax>=W)break;
        const key=ay+","+ax;
        if(!reservedKeys.has(key)&&!occupied.has(key))frontier.add(key);
      }
    };
    for(let x=1;x<W;x++){const key="0,"+x;clueAt.set(key,[]);frontier.add(key)}
    for(let y=1;y<H;y++){const key=y+",0";clueAt.set(key,[]);frontier.add(key)}
    const addWord=(entry,y,x,dirIndex,id,allowSeed=false,allowSingleFallback=false)=>{
      const dir=dirs[dirIndex],key=y+","+x,at=clueAt.get(key)||[];
      const borderDirection=y===0&&x>0?"down":x===0&&y>0?"right":null;
      if(borderDirection&&dir.name!==borderDirection)return false;
      if(y<0||x<0||y>=H||x>=W||reservedKeys.has(key)||!entry||(!allowSingleFallback&&entry.answer.length===1)||used.has(entry.key)||(entry.imageKey&&(usedImages.has(entry.imageKey)||usedImages.size>=5))||at.length>=4||at.some(w=>w.dir===dir.name)||((entry.imageKey)&&at.length>0)||occupied.has(key))return false;
      const cells=[];
      const endY=y+dir.dy*(entry.answer.length+1),endX=x+dir.dx*(entry.answer.length+1);
      if(endY<0||endX<0||endY>=H||endX>=W||reservedKeys.has(endY+","+endX)||occupied.has(endY+","+endX))return false;
      const terminalKey=endY+","+endX;
      for(let k=1;k<=entry.answer.length;k++){
        const yy=y+dir.dy*k,xx=x+dir.dx*k;
        if(yy<0||xx<0||yy>=H||xx>=W)return false;
        const cellKey=yy+","+xx,old=occupied.get(cellKey);
        if(reservedKeys.has(cellKey)||clueAt.has(cellKey)||(old!==undefined&&old!==entry.answer[k-1]))return false;
        cells.push([yy,xx]);
      }
      // Protect ordinary placements from sealed holes. The deliberate third corner
      // seed has a pre-validated crossing and may bypass this local heuristic.
      if(allowSeed!=="edge"){
      // Do not place a word if it seals an empty square on all four sides.
        // Such a square can never become a letter or a playable clue later.
        const futureLetters=new Set(cells.map(cell=>cell.join(",")));
        const futureClues=new Set([key,terminalKey]);
        const affected=new Set();
        for(const [yy,xx] of [[y,x],[endY,endX],...cells]){
          for(const [dy,dx] of [[-1,0],[1,0],[0,-1],[0,1]]){
            const ny=yy+dy,nx=xx+dx;
            if(ny>=0&&nx>=0&&ny<H&&nx<W)affected.add(ny+","+nx);
          }
        }
        for(const emptyKey of affected){
          if(futureLetters.has(emptyKey)||futureClues.has(emptyKey)||occupied.has(emptyKey)||clueAt.has(emptyKey)||reservedKeys.has(emptyKey))continue;
          const [ey,ex]=emptyKey.split(",").map(Number);
          const neighbors=[[ey-1,ex],[ey+1,ex],[ey,ex-1],[ey,ex+1]].filter(([ny,nx])=>ny>=0&&nx>=0&&ny<H&&nx<W);
          if(neighbors.length&&neighbors.every(([ny,nx])=>{
            const neighborKey=ny+","+nx;
            return occupied.has(neighborKey)||clueAt.has(neighborKey)||futureLetters.has(neighborKey)||futureClues.has(neighborKey);
          }))return false;
        }
  
      }
      const crosses=cells.filter(cell=>occupied.has(cell.join(","))).length;
      const touchesConnectedLayout=words.some(word=>{
         const [wy,wx]=word.clueCell;
         if(wy===y&&wx===x)return true;
         if(Math.abs(wy-y)+Math.abs(wx-x)===1)return true;
         if(word.cells.some(([cy,cx])=>Math.abs(cy-y)+Math.abs(cx-x)===1))return true;
         if(cells.some(([cy,cx])=>Math.abs(cy-wy)+Math.abs(cx-wx)===1))return true;
         return cells.some(([cy,cx])=>word.cells.some(([ey,ex])=>cy===ey&&cx===ex));
       });
       if(words.length&&!touchesConnectedLayout)return false;
      cells.forEach((cell,k)=>occupied.set(cell.join(","),entry.answer[k]));
      const word={id,answer:entry.answer,sourceAnswer:entry.answer,clue:entry.clue,clueShort:entry.clueShort,isEmoji:entry.emoji,logic:!!entry.logic,imageKey:entry.imageKey||null,dir:dir.name,dirIndex,cells,clueCell:[y,x]};
      at.push(word);clueAt.set(key,at);
      if(!clueAt.has(terminalKey))clueAt.set(terminalKey,[]);
      frontier.add(key);frontier.add(terminalKey);
      cells.forEach(cell=>addFrontier(cell[0],cell[1]));
      addFrontier(endY,endX);
      used.add(entry.key);if(entry.imageKey)usedImages.add(entry.imageKey);words.push(word);
      return true;
    };
    // Two crossing seed words create the first connected component.
    // 6×12 layout: begin with a vertical picture clue from the top edge,
    // then cross it with a short horizontal answer from the left edge.
    // This keeps the narrow portrait grid playable instead of forcing a
    // wide-board seed that cannot fit into six columns.
    const firstPool=normalized.filter(e=>e.answer.length>=5&&e.answer.length<=H-2);
    if(!firstPool.length)return null;
    const pictureSeeds=firstPool.filter(e=>e.imageKey);
    if(pictureSeeds.length<5)return null;
    const first=pictureSeeds[Math.floor(Math.random()*pictureSeeds.length)];
    const firstY=0,firstX=2;
    if(!addWord(first,firstY,firstX,1,"w0",true))return null;
    const sideSeeds=normalized.filter(entry=>
      !entry.imageKey&&entry.answer.length>=2&&entry.answer.length<=W-2&&
      entry.answer[1]===first.answer[0]&&entry.answer!==first.answer
    );
    let seeded=false;
    for(const entry of sideSeeds){
      if(addWord(entry,1,0,0,"w"+words.length,"edge")){seeded=true;break}
    }
    if(!seeded)return null;
    for(let round=0;round<520&&occupied.size+clueAt.size+reservedKeys.size<TOTAL;round++){
      // Keep only the best 18 candidates while scanning. Sorting the full
      // candidate array on every greedy round was the dominant CPU cost.
      const options=[];
      const addOption=option=>{
        let index=options.findIndex(current=>current.score<option.score);
        if(index<0){if(options.length<18)options.push(option);return}
        options.splice(index,0,option);
        if(options.length>18)options.pop();
      };
      for(const clueKey of frontier){
        const [y,x]=clueKey.split(",").map(Number),at=clueAt.get(clueKey)||[];
        if(occupied.has(clueKey)||at.length>=4 )continue;
        for(let di=0;di<dirs.length;di++){
          const dir=dirs[di];
          if(at.some(w=>w.dir===dir.name))continue;
          const max=dir.dy>0?H-1-y:dir.dy<0?y:dir.dx>0?W-1-x:x;
          for(let length=2;length<=Math.min(12,max);length++){
            const positions=byLength.get(length);if(!positions)continue;
            const possible=new Set();let availableCrosses=0;
            for(let p=0;p<length;p++){
              const yy=y+dir.dy*(p+1),xx=x+dir.dx*(p+1),old=occupied.get(yy+","+xx);
              if(old===undefined)continue;
              availableCrosses++;
              for(const entry of positions[p].get(old)||[])possible.add(entry);
            }
            if(!availableCrosses)continue;
            for(const entry of possible){
              if(used.has(entry.key)||(entry.imageKey&&(usedImages.has(entry.imageKey)||usedImages.size>=5||at.length>0)))continue;
              let valid=true,newCells=0,crosses=0;
              for(let p=0;p<length;p++){
                const yy=y+dir.dy*(p+1),xx=x+dir.dx*(p+1),cellKey=yy+","+xx,old=occupied.get(cellKey);
                if(clueAt.has(cellKey)||(old!==undefined&&old!==entry.answer[p])){valid=false;break}
                if(old===undefined)newCells++;else crosses++;
              }
              const terminalY=y+dir.dy*(length+1),terminalX=x+dir.dx*(length+1);
              const terminalBlocked=terminalY<0||terminalX<0||terminalY>=H||terminalX>=W||occupied.has(terminalY+","+terminalX);
              if(valid&&crosses&&!terminalBlocked)addOption({entry,y,x,di,score:crosses*16-newCells*2+Math.min(crosses,4)*4+length*.1+(entry.imageKey?1000:0)+(entry.logic?10:0)+Math.random()*3});
            }
          }
        }
      }
      if(!options.length)break;
      const pick=options[Math.floor(Math.random()*options.length)];
      if(!addWord(pick.entry,pick.y,pick.x,pick.di,"w"+words.length))break;
    }
    // Fill terminal question cells before opening new branches. Work newest-first
    // so each answer is immediately followed by a real playable question.
    let closing=true;
    while(closing&&occupied.size+clueAt.size+reservedKeys.size<TOTAL){
      closing=false;
      const anchors=[];
      const emptyQuestions=[...clueAt.entries()].filter(([,list])=>!list.length).map(([key,list])=>{
        const [y,x]=key.split(",").map(Number);
        let routes=0;
        for(const testDir of dirs){
          const max=Math.min(12,testDir.dy>0?H-1-y:testDir.dy<0?y:testDir.dx>0?W-1-x:x);
          let route=false;
          for(let length=2;length<=max&&!route;length++){
            let clear=true;
            for(let k=1;k<=length;k++){
              const yy=y+testDir.dy*k,xx=x+testDir.dx*k,key2=yy+","+xx;
              if(occupied.has(key2)||clueAt.has(key2)){clear=false;break}
            }
            const end=(y+testDir.dy*(length+1))+","+(x+testDir.dx*(length+1));
            if(clear&&!occupied.has(end))route=true;
          }
          if(route)routes++;
        }
        return {y,x,existing:true,list,routes};
      });
      if(emptyQuestions.length){
        // Close the most constrained open endpoint first. If it cannot be
        // closed immediately, keep growing connected crossings elsewhere so
        // a later word can reach that endpoint instead of abandoning the grid.
        emptyQuestions.sort((a,b)=>a.routes-b.routes);
        anchors.push(...emptyQuestions);
      }
      [...clueAt.entries()].reverse().forEach(([key,list])=>{
        if(!list.length)return;
        const [y,x]=key.split(",").map(Number);
        anchors.push({y,x,existing:true,list});
      });
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const key=y+","+x;
        if(reservedKeys.has(key)||occupied.has(key)||clueAt.has(key))continue;
        const adjacent=[[y-1,x],[y+1,x],[y,x-1],[y,x+1]].some(([yy,xx])=>yy>=0&&xx>=0&&yy<H&&xx<W&&(occupied.has(yy+","+xx)||clueAt.has(yy+","+xx)));
        if(adjacent)anchors.push({y,x,existing:false,list:[]});
      }
      anchorLoop: for(const anchor of anchors){
        for(let di=0;di<dirs.length;di++){
          const dir=dirs[di];
          if(anchor.list.some(w=>w.dir===dir.name))continue;
          const max=Math.min(12,dir.dy>0?H-1-anchor.y:dir.dy<0?anchor.y:dir.dx>0?W-1-anchor.x:anchor.x);
          const allowSingleFallback=false;
          const minLength=2;
          const lengths=Array.from({length:Math.max(0,max-minLength+1)},(_,index)=>max-index);
          lengths.sort((a,b)=>{
            const aKey=(anchor.y+dir.dy*(a+1))+","+(anchor.x+dir.dx*(a+1));
            const bKey=(anchor.y+dir.dy*(b+1))+","+(anchor.x+dir.dx*(b+1));
            const aCloses=clueAt.has(aKey),bCloses=clueAt.has(bKey);
            return Number(bCloses)-Number(aCloses)||b-a;
          });
          for(const length of lengths){
            const cells=[];let valid=true,crosses=0;
            for(let k=1;k<=length;k++){
              const yy=anchor.y+dir.dy*k,xx=anchor.x+dir.dx*k,key=yy+","+xx;
              if(yy<0||xx<0||yy>=H||xx>=W||clueAt.has(key)){valid=false;break}
              if(occupied.has(key))crosses++;
              cells.push([yy,xx]);
            }
            const attachedQuestionStart=(anchor.existing&&anchor.list.length===0)||!anchor.existing;
            const terminalY=anchor.y+dir.dy*(length+1),terminalX=anchor.x+dir.dx*(length+1);
            const closesExistingQuestion=clueAt.has(terminalY+","+terminalX);
            if(!valid||(!crosses&&!attachedQuestionStart&&!closesExistingQuestion&&!(length===1&&anchor.existing)))continue;
            const positions=byLength.get(length);if(!positions)continue;
            const possible=new Set();
            if(crosses){
              cells.forEach((cell,k)=>{
                const old=occupied.get(cell.join(","));
                if(old!==undefined)for(const entry of positions[k].get(old)||[])possible.add(entry);
              });
            }else{
              normalized.filter(entry=>entry.answer.length===length).slice(0,length===1?32:80).forEach(entry=>possible.add(entry));
            }
            const pool=[...possible].filter(entry=>!used.has(entry.key)&&
              (!entry.imageKey||(!usedImages.has(entry.imageKey)&&usedImages.size<3&&anchor.list.length===0))&&
              cells.every((cell,k)=>{
                const old=occupied.get(cell.join(","));
                return old===undefined||old===entry.answer[k];
              }));
            if(!pool.length)continue;
            pool.sort((a,b)=>Number(!!b.imageKey)-Number(!!a.imageKey)||Number(!!b.logic)-Number(!!a.logic));
            const entry=pool[0];
            if(addWord(entry,anchor.y,anchor.x,di,"w"+words.length,false,length===1&&allowSingleFallback)){
              closing=true;
              break anchorLoop;
            }
          }
        }
      }
    }
    const coverage=occupied.size+clueAt.size+reservedKeys.size,dangling=[...clueAt.values()].filter(list=>!list.length).length;
    return {coverage,dangling,occupied,clueAt,words,reservedKeys};
  };
  // Randomized restarts avoid the dead ends of a single greedy fill.
  // Retry substantially more often, but stop immediately once a fully valid
  // grid is found with at most one unavoidable single-letter fallback.
  // The previous fixed eight greedy restarts reproducibly left a one-cell hole.
  for(let attempt=0;attempt<256;attempt++){
    const result=buildAttempt();
    const imageCount=result?.words.filter(w=>w.imageKey).length||0;
    const logicCount=new Set((result?.words||[]).filter(w=>w.logic).map(w=>w.clueCell.join(","))).size;
    const singleCount=result?.words.filter(w=>w.answer.length===1).length||0;
    // Rank only clue cells that actually start or terminate an answer. The
    // old count included empty placeholders and could accept a broken border.
    const linkedClueKeys=new Set();
    for(const word of result?.words||[]){
      linkedClueKeys.add(word.clueCell.join(","));
      const dir=dirs.find(item=>item.name===word.dir),last=word.cells[word.cells.length-1];
      linkedClueKeys.add((last[0]+dir.dy)+","+(last[1]+dir.dx));
    }
    const clueCoordinates=[...linkedClueKeys].map(key=>key.split(",").map(Number));
    const topCount=clueCoordinates.filter(([y,x])=>y===0&&x!==0).length;
    const leftCount=clueCoordinates.filter(([y,x])=>x===0&&y!==0).length;
    const borderScore=Math.min(topCount,W-1)+Math.min(leftCount,H-1);
    const incomingKeys=new Set();
    for(const word of result?.words||[]){
      const delta=dirs.find(item=>item.name===word.dir),last=word.cells[word.cells.length-1];
      incomingKeys.add((last[0]+delta.dy)+","+(last[1]+delta.dx));
    }
    const orphanCount=[...(result?.clueAt||new Map())].filter(([key,list])=>!list.length&&!incomingKeys.has(key)).length;
    const occupiedRows=new Set(clueCoordinates.map(([y])=>y));
    const occupiedColumns=new Set(clueCoordinates.map(([,x])=>x));
    const rowSpread=occupiedRows.size,columnSpread=occupiedColumns.size;
    const quadrants=new Set(clueCoordinates.map(([y,x])=>(y<H/2?"top":"bottom")+"-"+(x<W/2?"left":"right")));
    const rowCounts=Array(H).fill(0),columnCounts=Array(W).fill(0);
    clueCoordinates.forEach(([y,x])=>{rowCounts[y]++;columnCounts[x]++});
    const rowImbalance=rowCounts.reduce((sum,count)=>sum+Math.max(0,count-3)*3+Math.max(0,1-count)*2,0);
    const columnImbalance=columnCounts.reduce((sum,count)=>sum+Math.max(0,count-4)*3+Math.max(0,1-count)*2,0);
    const spreadScore=rowSpread*100+columnSpread*100+quadrants.size*35-rowImbalance-columnImbalance;
    const rank=[imageCount,result?.coverage||0,borderScore,result?.words?.length||0,logicCount,-orphanCount,spreadScore,-(result?.dangling||999),-singleCount];
    const better=!!result&&(!bestRank||rank.some((value,index)=>value!==bestRank[index]&&rank.slice(0,index).every((prior,j)=>prior===bestRank[j])&&value>bestRank[index]));
    if(better){bestRank=rank;bestImageCount=imageCount;bestLogicCount=logicCount;bestCoverage=result.coverage;bestDangling=result.dangling;bestSingleCount=singleCount;bestBorderScore=borderScore;bestTopCount=topCount;bestLeftCount=leftCount;bestRowSpread=rowSpread;bestColumnSpread=columnSpread;bestOrphanCount=orphanCount;best=result;}
    if(bestCoverage===TOTAL&&bestImageCount===5&&bestSingleCount<=1&&bestTopCount>=3&&bestLeftCount>=3&&bestOrphanCount<=10&&bestLogicCount>=2)break;
  }
  if(best){
    // A narrow 6×12 board may leave a small number of structurally unusable
    // squares. Mark them as intentional dark blocks instead of exposing
    // accidental blank holes or inventing one-letter answers.
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const key=y+","+x;
      if(!best.reservedKeys.has(key)&&!best.occupied.has(key)&&!best.clueAt.has(key))best.reservedKeys.add(key);
    }
    best.coverage=best.occupied.size+best.clueAt.size+best.reservedKeys.size;
  }
  if(!best||best.coverage!==TOTAL||bestImageCount!==5){const holes=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const key=y+","+x;if(!best?.reservedKeys.has(key)&&!best?.occupied.has(key)&&!best?.clueAt.has(key))holes.push(key)}const openEnds=[...(best?.clueAt||new Map())].filter(([,list])=>!list.length).map(([key])=>key);const overlaps=[...(best?.occupied.keys()||[])].filter(key=>best?.clueAt.has(key));const outside=[...(best?.occupied.keys()||[]),...(best?.clueAt.keys()||[])].filter(key=>{const [y,x]=key.split(",").map(Number);return y<0||x<0||y>=H||x>=W});const debugGrid=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{const key=y+","+x;return best?.clueAt.has(key)?"?":best?.occupied.get(key)||"."}).join("")).join("/");throw new Error("Не удалось собрать поле 6×12 (6 столбцов × 12 строк) с вопросом после каждого ответа (заполнение: "+bestCoverage+"/"+TOTAL+", буквы: "+(best?.occupied.size||0)+", вопросы: "+(best?.clueAt.size||0)+", пересечения: "+overlaps.join(" ")+", вне поля: "+outside.join(" ")+", пустые клетки: "+holes.join(" ")+", незаполненные вопросы: "+openEnds.join(" ")+", сетка: "+debugGrid+"). Повтори генерацию.")}
  // Keep every cell purposeful: unlinked border placeholders become dark
  // crossword blocks rather than blank, unclickable question tiles.
  const incomingFinal=new Set();
  for(const word of best.words){
    const dir=dirs.find(item=>item.name===word.dir),last=word.cells[word.cells.length-1];
    incomingFinal.add((last[0]+dir.dy)+","+(last[1]+dir.dx));
  }
  for(const [key,list] of [...best.clueAt.entries()]){
    if(!list.length&&!incomingFinal.has(key)){
      best.clueAt.delete(key);
      best.reservedKeys.add(key);
    }
  }
  const clueKeys=new Set(best.clueAt.keys()),occupied=best.occupied,reservedKeys=new Set(best.reservedKeys);
  for(const word of best.words){
    const dir=dirs.find(item=>item.name===word.dir),last=word.cells[word.cells.length-1];
    const terminal=(last[0]+dir.dy)+","+(last[1]+dir.dx);
    if(!clueKeys.has(terminal))throw new Error("Ответ "+word.answer+" не заканчивается новой ячейкой вопроса");
  }
  for(const key of clueKeys)if(occupied.has(key))throw new Error("Вопрос и ответ наложились в клетке "+key);
  if(occupied.size+clueKeys.size+reservedKeys.size!==TOTAL)throw new Error("Проверка заполнения или пустого угла не пройдена");
  assertValidScanwordLayout(best,W,H,TOTAL);
  return {id:"scanword-"+Date.now(),title:"Сканворд",w:W,h:H,words:best.words,used:new Set(occupied.keys()),clueKeys,reservedKeys,coverage:1};
}
function clonePreparedScanword(source){
  return {id:"scanword-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:"Сканворд",w:source.w,h:source.h,words:source.words.map(w=>({...w,cells:w.cells.map(c=>[...c]),clueCell:[...w.clueCell]})),used:new Set(source.used),clueKeys:new Set(source.clueKeys),reservedKeys:new Set(source.reservedKeys||[]),coverage:source.coverage};
}
function refreshPracticeButton(){
  const button=$("#practice");
  if(!button)return;
  button.disabled=scanwordPreparing;
  button.textContent=scanwordPreparing?"Готовим поле…":preparedScanword?"Играть одному":"Повторить подготовку";
}
