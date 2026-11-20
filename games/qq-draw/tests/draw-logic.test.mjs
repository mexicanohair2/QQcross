import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAW_WORDS,
  normalizeDrawWord,
  chooseLocalBotGuess,
  appendOrderedEvent,
  replayDrawingEvents,
  recognizeDrawing
} from "../draw-logic.mjs";

test("draw word bank contains unique Russian words from 4 to 20 letters",()=>{
  assert.equal(new Set(DRAW_WORDS).size,DRAW_WORDS.length);
  assert.ok(DRAW_WORDS.length>=100);
  for(const word of DRAW_WORDS)assert.match(word,/^[а-яё]{4,20}$/);
});

test("word normalization handles spaces and ё",()=>{
  assert.equal(normalizeDrawWord(" ЁЖИК "),"ежик");
});

test("local bot receives no secret word and does not repeat guesses",()=>{
  assert.equal(chooseLocalBotGuess.length,0);
  const guess=chooseLocalBotGuess({words:["арбуз","банан","груша"],previous:["арбуз"],rng:()=>0});
  assert.equal(guess,"банан");
});

test("ordered events reject gaps and duplicate conflicts",()=>{
  const first={sequence:1,type:"begin",payload:{x:0.1,y:0.2}};
  const second={sequence:2,type:"move",payload:{x:0.2,y:0.3}};
  const one=appendOrderedEvent([],first);
  assert.equal(one.accepted,true);
  assert.equal(appendOrderedEvent(one.events,second).accepted,true);
  assert.equal(appendOrderedEvent(one.events,{sequence:3,type:"end",payload:{}}).reason,"SEQUENCE_GAP");
  assert.equal(appendOrderedEvent(one.events,{sequence:1,type:"move",payload:{}}).reason,"SEQUENCE_CONFLICT");
});

test("duplicate event comparison ignores JSON object key ordering",()=>{
  const first={sequence:1,type:"begin",payload:{x:0.1,y:0.2}};
  const event={payload:{y:0.2,x:0.1},type:"begin",sequence:1};
  const result=appendOrderedEvent([first],event);
  assert.equal(result.accepted,true);
  assert.equal(result.duplicate,true);
});

test("drawing replay supports begin, move, undo and clear",()=>{
  const events=[
    {sequence:1,type:"begin",strokeId:1,payload:{x:0.1,y:0.2,color:"#222222",thickness:4}},
    {sequence:2,type:"move",strokeId:1,payload:{x:0.3,y:0.4}},
    {sequence:3,type:"end",strokeId:1,payload:{x:0.4,y:0.5}},
    {sequence:4,type:"begin",strokeId:4,payload:{x:0.5,y:0.6,color:"#ff0000",thickness:6}},
    {sequence:5,type:"undo",strokeId:4,payload:{strokeId:4}}
  ];
  const strokes=replayDrawingEvents(events);
  assert.equal(strokes.length,1);
  assert.equal(strokes[0].id,1);
  assert.deepEqual(strokes[0].points,[{x:0.1,y:0.2},{x:0.3,y:0.4},{x:0.4,y:0.5}]);
  assert.equal(replayDrawingEvents([...events,{sequence:6,type:"clear",payload:{}}]).length,0);
});

test("offline drawing recognizer identifies a sun from a circle and radial strokes",()=>{
  const circle={points:Array.from({length:33},(_,i)=>({x:.5+Math.cos(i/32*Math.PI*2)*.18,y:.5+Math.sin(i/32*Math.PI*2)*.18}))};
  const rays=Array.from({length:6},(_,i)=>{
    const a=i*Math.PI/3;
    return {points:[{x:.5,y:.5},{x:.5+Math.cos(a)*.32,y:.5+Math.sin(a)*.32}]};
  });
  const guesses=recognizeDrawing([circle,...rays]);
  assert.equal(guesses[0]?.word,"солнце");
  assert.ok(guesses[0]?.confidence>=.68);
});

test("offline drawing recognizer returns no guess for an empty canvas",()=>{
  assert.deepEqual(recognizeDrawing([]),[]);
});

import { mapQuickDrawPredictions } from "../draw-model.mjs";

test("QuickDraw model output maps supported classes to Russian guesses and filters unknown classes",()=>{
  const mapped=mapQuickDrawPredictions([0.7,0.2,0.1],["cat","unknown category","sun"],3);
  assert.equal(mapped[0].word,"кошка");
  assert.equal(mapped.length,2);
  assert.ok(mapped[0].confidence>mapped[1].confidence);
});
