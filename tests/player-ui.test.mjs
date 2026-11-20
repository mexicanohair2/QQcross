import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("shared player UI exposes the QQCross frame catalog", async () => {
  const source = await readFile(new URL("../player-ui.js", import.meta.url), "utf8");
  const context = { window: {}, localStorage: { getItem: () => null } };
  vm.runInNewContext(source, context);
  const ui = context.window.QQPlayerUI;
  assert.ok(ui);
  assert.deepEqual(Array.from(ui.frames, frame => frame.id), ["classic","amethyst","royal","sakura","obsidian"]);
  assert.match(ui.renderAvatar({ avatar: 2, frame_id: "amethyst" }), /qq-frame-amethyst/);
  assert.match(ui.renderCard({ username: "Player_1", active_title: "Знаток" }, { score: 42 }), /Знаток/);
  assert.match(ui.renderCard({ username: "Player_1" }, { score: 42 }), /42/);
  assert.match(ui.renderProfile({ username: "Player_1", points: 125 }), /Очки: 125/);
});

test("shared player UI escapes player-provided text", async () => {
  const source = await readFile(new URL("../player-ui.js", import.meta.url), "utf8");
  const context = { window: {}, localStorage: { getItem: () => null } };
  vm.runInNewContext(source, context);
  const card = context.window.QQPlayerUI.renderCard({ username: "<img src=x>", active_title: "<script>" });
  assert.doesNotMatch(card, /<img src=x>/);
  assert.doesNotMatch(card, /<script>/);
  assert.match(card, /&lt;img/);
});
