const { test, expect } = require("@playwright/test");

async function enterGuest(page) {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15000 });
  await page.locator("#guestPlay").click();
}

test("daily challenges expose one stable scanword and a seeded 4–8 letter Wordle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterGuest(page);
  const daily = page.locator("[data-qq-daily-open]");
  await expect(daily).toBeVisible();
  const dayBefore = await daily.getAttribute("data-daily-date");
  await daily.click();
  await expect(page.locator(".qq-daily-screen")).toBeVisible();
  await expect(page.locator("[data-daily-game='scanword']")).toBeVisible();
  await expect(page.locator("[data-daily-game='wordle']")).toBeVisible();
  await page.locator("[data-daily-game='wordle']").click();
  await expect(page.locator(".wordle-screen")).toBeVisible();
  const length = await page.locator(".wordle-screen").getAttribute("data-daily-length");
  expect([4, 5, 6, 7, 8]).toContain(Number(length));
  await page.locator("#wordleBack").click();
  await expect(page.locator(".qq-daily-screen")).toBeVisible();
  await page.reload();
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("[data-qq-daily-open]")).toHaveAttribute("data-daily-date", dayBefore);
});

test("profile lists the full 100-title catalogue with locked progress and hides the secret title", async ({ page }) => {
  await enterGuest(page);
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqTitleInventory")).toContainText("0 / 100");
  await expect(page.locator(".qq-title-chip")).toHaveCount(101);
  await expect(page.locator(".qq-title-chip.is-locked").first()).toContainText("0 / 5 сканвордов");
  await expect(page.locator(".qq-title-chip.is-secret")).toContainText("Секретный титул");
  await expect(page.locator(".qq-title-chip.is-secret")).not.toContainText("Mugiwara");
});

test("hint milestones are tracked and unlock profile achievements", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    p.record("hintsUsed", 50);
    return {
      count: p.get().stats.hintsUsed,
      milestones: p.achievements().filter(a => a.id.startsWith("hint_")).map(a => ({ id: a.id, unlocked: a.unlocked }))
    };
  });
  expect(result.count).toBe(50);
  expect(result.milestones).toEqual([
    { id: "hint_10", unlocked: true },
    { id: "hint_50", unlocked: true },
    { id: "hint_100", unlocked: false }
  ]);
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqProgressionStats")).toContainText("Подсказки");
  await expect(page.locator("#qqAchievements")).toContainText("Умный игрок");
});

test("profile shows unified progression, a title inventory and daily streak", async ({ page }) => {
  await enterGuest(page);
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqProgressionStats")).toBeVisible();
  await expect(page.locator("#qqDailyStreak")).toBeVisible();
  await expect(page.locator("#qqTitleInventory")).toBeVisible();
  await expect(page.locator("#qqAchievements")).toBeVisible();
  expect(await page.locator(".qq-achievement").count()).toBeGreaterThanOrEqual(20);
});

test("the secret Mugiwara title unlocks after fifteen straw-hat taps", async ({ page }) => {
  await enterGuest(page);
  const hat = page.locator("[data-qq-straw-hat-trigger]").first();
  await expect(hat).toBeVisible();
  for (let i = 0; i < 15; i++) await hat.click({ force: true });
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqTitleInventory")).toContainText("Mugiwara");
});


test("daily challenges are deterministic and streaks count only complete days once", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    const first = p.daily("2040-03-01");
    const repeated = p.daily("2040-03-01");
    const second = p.daily("2040-03-02");
    p.completeDaily("scanword", first.date);
    const afterOne = p.get().daily.currentStreak;
    p.completeDaily("scanword", first.date);
    p.completeDaily("wordle", first.date);
    const afterFirstDay = p.get().daily.currentStreak;
    p.completeDaily("wordle", second.date);
    p.completeDaily("scanword", second.date);
    const afterSecondDay = p.get().daily.currentStreak;
    return {
      stable: first.scanwordSeed === repeated.scanwordSeed &&
        first.wordleSeed === repeated.wordleSeed &&
        first.wordleLength === repeated.wordleLength,
      validLength: [4, 5, 6, 7, 8].includes(first.wordleLength),
      afterOne,
      afterFirstDay,
      afterSecondDay,
      best: p.get().daily.bestStreak
    };
  });
  expect(result.stable).toBe(true);
  expect(result.validLength).toBe(true);
  expect(result.afterOne).toBe(0);
  expect(result.afterFirstDay).toBe(1);
  expect(result.afterSecondDay).toBe(2);
  expect(result.best).toBe(2);
});

test("discovered words are normalized and counted only once", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    const first = p.recordWord("ёлка");
    const duplicate = p.recordWord("ЕЛКА");
    const snapshot = p.get();
    return {
      first,
      duplicate,
      count: snapshot.stats.wordsFound,
      words: snapshot.discoveredWords
    };
  });
  expect(result.first).toBe(true);
  expect(result.duplicate).toBe(false);
  expect(result.count).toBe(1);
  expect(result.words).toContain("ЕЛКА");
});


test("one hundred distinct progression titles unlock from the first scanword milestone", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    const names = p.TITLE_NAMES;
    p.record("scanwords", 5);
    return {
      total: names.length,
      unique: new Set(names).size,
      firstUnlocked: p.get().titles.includes(names[0]),
      defaultTitle: p.get().activeTitle
    };
  });
  expect(result.total).toBe(100);
  expect(result.unique).toBe(100);
  expect(result.firstUnlocked).toBe(true);
  expect(result.defaultTitle).toBe("Новичок");
});


test("the secret straw-hat counter works across different game screens", async ({ page }) => {
  await enterGuest(page);
  for (let i = 0; i < 5; i++) {
    await page.locator("[data-qq-straw-hat-trigger]").first().click({ force: true });
  }
  await page.locator("#playWordle").click();
  const wordleHat = page.locator(".wordle-screen [data-qq-straw-hat-trigger]");
  await expect(wordleHat).toBeVisible();
  for (let i = 0; i < 5; i++) await wordleHat.click({ force: true });
  await page.locator("#wordleBack").click();
  await page.locator('[data-extra-game="search"]').click();
  const extraHat = page.locator(".qq-extra-screen .qq-straw-hat");
  await expect(extraHat).toBeVisible();
  for (let i = 0; i < 5; i++) await extraHat.click({ force: true });
  const unlocked = await page.evaluate(() => window.QQProgression.get().titles.includes("Mugiwara"));
  expect(unlocked).toBe(true);
});


test("unique level completions cannot be farmed by replaying the same level", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    const first = p.recordUnique("wowLevels", "wow:1");
    const replay = p.recordUnique("wowLevels", "wow:1");
    const next = p.recordUnique("wowLevels", "wow:2");
    return { first, replay, next, count: p.get().stats.wowLevels };
  });
  expect(result.first).toBe(true);
  expect(result.replay).toBe(false);
  expect(result.next).toBe(true);
  expect(result.count).toBe(2);
});

test("double-tapping a discovered word opens its encyclopedia entry", async ({ page }) => {
  await enterGuest(page);
  await page.evaluate(() => {
    const word = document.createElement("button");
    word.type = "button";
    word.dataset.qqWord = "ЁЛКА";
    word.textContent = "ЁЛКА";
    document.querySelector("#app").append(word);
    word.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await expect(page.locator("#encyclopediaInput")).toHaveValue("ЁЛКА");
});

test("accessibility preferences and abstract-background opt-out survive reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("qqcross_font_size", "large");
    localStorage.setItem("qqcross_reduce_motion", "true");
    localStorage.setItem("qqcross_abstract_enabled", "false");
    localStorage.setItem("qqcross_background_v1", "amethyst-waves");
  });
  await page.reload();
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15000 });
  const preferences = await page.evaluate(() => ({
    fontSize: document.documentElement.dataset.qqFontSize,
    reduceMotion: document.documentElement.dataset.qqReduceMotion,
    background: document.documentElement.dataset.qqBackground
  }));
  expect(preferences).toEqual({
    fontSize: "large",
    reduceMotion: "true",
    background: "misty-forest"
  });
});

test("unclaimed achievement rewards stay queued until explicitly acknowledged", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    p.record("scanwords", 5);
    const before = p.peekPendingRewards();
    const stillPending = p.peekPendingRewards();
    const acknowledged = p.ackPendingReward(before[0].id);
    const after = p.peekPendingRewards();
    return {
      countBefore: before.length,
      stillPending: stillPending.length,
      acknowledged,
      countAfter: after.length,
      removed: !after.some(item => item.id === before[0].id)
    };
  });
  expect(result.countBefore).toBeGreaterThan(0);
  expect(result.stillPending).toBe(result.countBefore);
  expect(result.acknowledged).toBe(true);
  expect(result.countAfter).toBe(result.countBefore - 1);
  expect(result.removed).toBe(true);
});

test("double-tapping a discovered word works with touch pointer events", async ({ page }) => {
  await enterGuest(page);
  await page.evaluate(() => {
    const word = document.createElement("button");
    word.type = "button";
    word.dataset.qqWord = "ТУНЕЦ";
    word.textContent = "ТУНЕЦ";
    document.querySelector("#app").append(word);
    const tap = () => word.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7
    }));
    tap();
    tap();
  });
  await expect(page.locator("#encyclopediaInput")).toHaveValue("ТУНЕЦ");
});

test("late completion of an older daily challenge cannot rewind the current streak", async ({ page }) => {
  await enterGuest(page);
  const result = await page.evaluate(() => {
    const p = window.QQProgression;
    p.completeDaily("scanword", "2041-06-03");
    p.completeDaily("wordle", "2041-06-03");
    p.completeDaily("scanword", "2041-06-02");
    p.completeDaily("wordle", "2041-06-02");
    const afterLateDay = p.get().daily;
    p.completeDaily("scanword", "2041-06-04");
    p.completeDaily("wordle", "2041-06-04");
    const afterNextDay = p.get().daily;
    return {
      lastAfterLate: afterLateDay.lastCompletedDate,
      streakAfterLate: afterLateDay.currentStreak,
      lastAfterNext: afterNextDay.lastCompletedDate,
      streakAfterNext: afterNextDay.currentStreak
    };
  });
  expect(result.lastAfterLate).toBe("2041-06-03");
  expect(result.streakAfterLate).toBe(1);
  expect(result.lastAfterNext).toBe("2041-06-04");
  expect(result.streakAfterNext).toBe(2);
});

test("profile displays match losses and win percentage", async ({ page }) => {
  await enterGuest(page);
  await page.getByRole("button", { name: /Профиль/ }).click();
  await expect(page.locator("#qqProgressionStats")).toContainText("поражения: 0");
  await expect(page.locator("#qqProgressionStats")).toContainText("процент побед: 0%");
});

test("encyclopedia falls back to a fuller Wiktionary definition and preserves stress", async ({ page }) => {
  await enterGuest(page);
  await page.route("https://ru.wikipedia.org/w/api.php**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("list") === "search") {
      return route.fulfill({ json: { query: { search: [{ title: "Тунец" }] } } });
    }
    return route.fulfill({ json: { query: { pages: [{
      title: "Тунец",
      extract: "Тунец — крупная морская рыба.",
      fullurl: "https://ru.wikipedia.org/wiki/Тунец",
      links: []
    }] } } });
  });
  await page.route("https://ru.wiktionary.org/w/api.php**", async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("list") === "search") {
      return route.fulfill({ json: { query: { search: [{ title: "тунец" }] } } });
    }
    return route.fulfill({ json: { query: { pages: [{
      title: "тунец",
      extract: "Туне́ц — род морских рыб семейства скумбриевых. Эти рыбы обитают в тёплых морях и имеют большое значение для промысла.",
      fullurl: "https://ru.wiktionary.org/wiki/тунец",
      links: []
    }] } } });
  });
  const result = await page.evaluate(() => window.QQEncyclopedia.search("ТУНЕЦ"));
  expect(result.article.sourceLabel).toBe("Викисловаре");
  expect(result.article.sentences).toHaveLength(2);
  expect(result.stress).toBe("Туне́ц");
});


test("exact common-word spelling is never replaced by a nearby word", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(() => window.QQEncyclopedia.suggest("ЗМЕЯ"));
  expect(result).toEqual({ word: "ЗМЕЯ", distance: 0 });
});
