import test from "node:test";
import assert from "node:assert/strict";
import {
  TEAM_WORDS,
  normalizeWord,
  revealRandomLetter,
  scoreWordGuess,
  chooseTeamBotGuess,
  wordMatchesMask
} from "../game-logic.mjs";

test("the built-in list contains only unique 4–8 letter Russian words", () => {
  assert.equal(new Set(TEAM_WORDS).size, TEAM_WORDS.length);
  assert.ok(TEAM_WORDS.length >= 100);
  for (const word of TEAM_WORDS) {
    assert.match(word, /^[а-яё]{4,8}$/);
  }
});

test("normalization treats ё and е consistently", () => {
  assert.equal(normalizeWord(" ЁЖИК "), "ежик");
});

test("letter reveal opens one previously hidden position", () => {
  const result = revealRandomLetter("арбуз", [{index:0,letter:"а"}], () => 0);
  assert.deepEqual(result, {index:1,letter:"р"});
  assert.equal(revealRandomLetter("арбуз",Array.from({length:5},(_,index)=>({index,letter:"x"}))),null);
});

test("score handles repeated letters without over-crediting", () => {
  assert.deepEqual(scoreWordGuess("банан","анана"),["miss","yellow","yellow","yellow","yellow"]);
});

test("bot guesses only words consistent with visible information", () => {
  const guess = chooseTeamBotGuess({
    length: 5,
    revealed: [{index:0,letter:"а"}],
    previous: ["арбуз"],
    words: ["арбуз","арена","автор"],
    rng: () => 0
  });
  assert.equal(guess,"арена");
  assert.equal(wordMatchesMask(guess,5,[{index:0,letter:"а"}]),true);
});

test("bot API has no answer parameter and never receives a target", () => {
  assert.equal(chooseTeamBotGuess.length,0);
  const guess = chooseTeamBotGuess({
    length: 4,
    revealed: [],
    previous: [],
    words: ["мост","домик"],
    rng: () => 0
  });
  assert.equal(guess,"мост");
});
import { TEAM_WORD_REVEAL_INTERVAL_MS } from "../game-logic.mjs";

test("Team Word reveals one letter every 60 seconds", () => {
  assert.equal(TEAM_WORD_REVEAL_INTERVAL_MS, 60_000);
});
