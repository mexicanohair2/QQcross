import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("../assets/player-identity.js", import.meta.url), "utf8");
const context = { window: {}, document: { currentScript: { src: "https://example.test/assets/player-identity.js" } },
  location: { href: "https://example.test/" }, URL, localStorage: { getItem: () => null } };
vm.runInNewContext(source, context);
const ui = context.window.QQIdentity;

test("shared identity exposes all five branded frames", () => {
  assert.deepEqual(Array.from(ui.frames, frame => frame.id), ["standard", "ruby", "amethyst", "royal", "astral"]);
  for (const id of ui.frameIds) {
    const markup = ui.avatarMarkup({ avatar: 0, active_frame: id }, { size: "md" });
    assert.match(markup, new RegExp("qq-player-frame--" + id));
  }
});

test("identity card includes nickname, equipped title, avatar frame and score", () => {
  const markup = ui.cardMarkup({ id: "00000000-0000-4000-8000-000000000001", username: "Player", active_title: "Знаток", active_frame: "ruby" }, { score: 125, clickable: true });
  assert.match(markup, /Player/);
  assert.match(markup, /Знаток/);
  assert.match(markup, /qq-player-frame--ruby/);
  assert.match(markup, /125/);
  assert.match(markup, /data-player-profile=/);
});

test("guest and bot IDs cannot open cloud player profiles", () => {
  assert.equal(ui.isProfileId("guest-1"), false);
  assert.equal(ui.isProfileId("bot"), false);
  assert.equal(ui.isProfileId("00000000-0000-4000-8000-000000000001"), true);
});

test("all frame ornaments exist and contain SVG", async () => {
  for (const id of ui.frameIds) {
    const svg = await readFile(new URL("../assets/avatar-frames/" + id + ".svg", import.meta.url), "utf8");
    assert.match(svg, /<svg[\s>]/);
  }
});

test("reproducible migration matches app RPC names and the avatars bucket", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261121071947_qqcross_player_identity_frames.sql", import.meta.url), "utf8");
  for (const name of ["get_qqcross_player_profile", "purchase_qqcross_frame", "equip_qqcross_frame"]) assert.ok(sql.includes(name));
  assert.match(sql, /values\('avatars','avatars',true/);
  assert.match(sql, /active_frame/);
  assert.match(sql, /owned_frames/);
  assert.match(sql, /profiles_avatar_url_qqcross_check/);
  assert.match(sql, /profiles_owned_frames_qqcross_check/);
  assert.match(sql, /profiles_active_title_qqcross_check/);
  assert.doesNotMatch(sql, /qqcross-avatars/);
});


test("cloud profile hydration never replaces a saved custom avatar with an empty RPC value", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /state\.profile\.avatar_url=identity\.avatar_url\|\|state\.profile\.avatar_url\|\|""/);
});


test("score-strip theme colors only apply to direct score labels, not nested avatar spans", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.score-strip > span\{/);
  assert.match(css, /html\[data-qq-theme\] \.score-strip > span\{/);
  assert.doesNotMatch(css, /\.score-strip span\{/);
});
