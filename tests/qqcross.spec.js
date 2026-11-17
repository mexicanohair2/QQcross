const { test, expect } = require("@playwright/test");
async function startGuestGame(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleErrors.push(message.type() + ": " + message.text());
    }
  });
  await page.goto("/?debugTiming=1");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#play-toggle")).toBeVisible();
  await page.locator("#play-toggle").click();
  await expect(page.locator("#practice")).toBeVisible();
  await page.evaluate(() => { window.__qqStartTap = performance.now(); });
  await page.locator("#practice").click();
  try {
    await expect(page.locator(".game-screen")).toBeVisible({ timeout: 60_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      practice: (() => {
        const button = document.querySelector("#practice");
        return button ? { disabled: button.disabled, text: button.textContent } : null;
      })(),
      toast: document.querySelector(".toast")?.textContent || null,
      splash: document.querySelector(".boot-splash")?.textContent || null,
      bootError: document.querySelector(".qq-boot-error")?.textContent || null,
      appText: (document.querySelector("#app")?.innerText || "").slice(0, 1600),
      screenClasses: [...document.querySelectorAll("#app > *")].map(node => node.className)
    }));
    console.log("QQCROSS_START_FAILURE " + JSON.stringify({ state, pageErrors, consoleErrors }));
    throw error;
  }
  const startMs = await page.evaluate(() => performance.now() - window.__qqStartTap);
  return { pageErrors, startMs };
}

test("loads a fully occupied 8-column by 12-row scanword with optional picture clues", async ({ page }) => {
  const { pageErrors, startMs } = await startGuestGame(page);
  const board = page.locator(".scanword-board");
  await expect(board).toBeVisible();
  await expect(page.locator(".scan-grid-cell")).toHaveCount(96);
  await expect(board.locator(".scan-empty")).toHaveCount(1);
  await expect(board.locator(".scan-empty")).toHaveAttribute("data-reserved-cell", "0,0");
  const geometry = await board.evaluate(node => {
    const count = value => {
      const text = String(value || "").trim();
      const repeated = text.match(/^repeat\\((\\d+)\\s*,/);
      return repeated ? Number(repeated[1]) : text.split(/\\s+/).filter(Boolean).length;
    };
    const rect = node.getBoundingClientRect();
    return {
      columns: count(getComputedStyle(node).gridTemplateColumns),
      rows: count(getComputedStyle(node).gridTemplateRows),
      width: rect.width,
      height: rect.height,
      ratio: rect.width / rect.height,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight
    };
  });
  expect(geometry.columns).toBe(8);
  expect(geometry.rows).toBe(12);
  expect(Math.abs(geometry.ratio - (2 / 3))).toBeLessThan(0.03);
  expect(geometry.width).toBeGreaterThanOrEqual(geometry.viewportWidth * 0.85);
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight - 190);
  const clueCells = board.locator(".scan-clue");
  await expect(clueCells).not.toHaveCount(0);
  const edges = await clueCells.evaluateAll(nodes => nodes.reduce((result, node) => {
    const [row, col] = node.dataset.clueCell.split(",").map(Number);
    if (row === 0) result.top++;
    if (col === 0 && row > 0) result.left++;
    return result;
  }, { top: 0, left: 0 }));
  expect(edges.top).toBeGreaterThanOrEqual(3);
  expect(edges.left).toBe(11);
  const arrows = await board.locator(".scan-arrow").evaluateAll(nodes => nodes.map(node =>
    [...node.classList].find(name => name.startsWith("scan-arrow-"))
  ));
  expect(arrows.length).toBeGreaterThan(0);
  expect(arrows.every(direction => ["scan-arrow-right", "scan-arrow-down"].includes(direction))).toBeTruthy();
  const pictures = board.locator(".scan-clue-picture .scan-clue-image");
  const pictureCount = await pictures.count();
  expect(pictureCount).toBeGreaterThanOrEqual(0);
  expect(pictureCount).toBeLessThanOrEqual(4);
  await expect.poll(() => pictures.evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const pictureSources = await pictures.evaluateAll(images => images.map(img => img.currentSrc || img.src));
  expect(new Set(pictureSources).size).toBe(pictureSources.length);
  await expect(board.locator(".scan-filler")).toHaveCount(0);
  await expect(board.locator(".scan-grid-cell.cell, .scan-grid-cell.scan-clue")).toHaveCount(95);
  const pageFit = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(pageFit.width).toBeLessThanOrEqual(pageFit.viewportWidth + 1);
  const internalTiming = await page.evaluate(() => window.__qqcrossTiming || null);
  expect(internalTiming).not.toBeNull();
  expect(internalTiming.totalMs).toBeLessThan(500);
  expect(pageErrors).toEqual([]);
});

test("three scanword hint levels are available and successful hints are counted", async ({ page }) => {
  await startGuestGame(page);
  await page.locator("[data-clue-cell]").first().click();
  const clueChoices = page.locator(".clue-popup-choice");
  if (await clueChoices.count()) await clueChoices.first().click();
  await expect(page.locator("[data-smart-hint='light']")).toBeVisible();
  await expect(page.locator("[data-smart-hint='medium']")).toBeVisible();
  await expect(page.locator("[data-smart-hint='strong']")).toBeVisible();
  await page.locator("[data-smart-hint='light']").click();
  await expect(page.locator("#scanwordHintMessage")).not.toBeEmpty();
  await page.locator("[data-smart-hint='medium']").click();
  await expect(page.locator("#scanwordHintMessage")).not.toBeEmpty();
  await page.locator("[data-smart-hint='strong']").click();
  await page.locator("#bulb").click();
  await expect(page.locator(".scanword-board .hinted-cell")).toHaveCount(2);
  const count = await page.evaluate(() => window.QQProgression.get().stats.hintsUsed);
  const bulbs = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  expect(count).toBe(4);
  expect(bulbs).toBe(1);
});

test("opens the question popup from a picture clue cell without a permanent question panel", async ({ page }) => {
  await startGuestGame(page);
  const pictureClue = page.locator(".scan-clue-picture").first();
  await pictureClue.click();
  const pictureChoice = page.locator(".clue-popup-choice").filter({ hasText: /изображено/i }).first();
  if (await pictureChoice.count()) await pictureChoice.click();
  await expect(page.locator(".clue-popup-text")).toHaveText("Что изображено на картинке?");
  await expect(page.locator(".scanword-question-list")).toHaveCount(0);
  await expect(page.locator(".scanword-board")).toBeVisible();
});

test("keeps clue text readable and the letter rack crisp on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuestGame(page);
  const layout = await page.evaluate(() => {
    const board = document.querySelector(".scanword-board").getBoundingClientRect();
    const tools = document.querySelector(".game-tools").getBoundingClientRect();
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    return { board, tools, viewport, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.board.left).toBeGreaterThanOrEqual(-1);
  expect(layout.board.right).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.board.width).toBeGreaterThanOrEqual(layout.viewport.width * 0.85);
  expect(Math.abs(layout.board.width / layout.board.height - (2 / 3))).toBeLessThan(0.03);
  expect(layout.tools.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  const letterStyle = await page.locator(".letter").first().evaluate(async node => {
    node.classList.add("letter-enter");
    await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {})));
    const style = getComputedStyle(node);
    return { filter: style.filter, transform: style.transform };
  });
  expect(letterStyle.filter).toBe("none");
  expect(["none","matrix(1, 0, 0, 1, 0, 0)"]).toContain(letterStyle.transform);
  const clueSizes = await page.locator(".scan-clue-text").evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
  expect(clueSizes.length).toBeGreaterThan(0);
  expect(clueSizes.every(size => size >= 6)).toBeTruthy();
});

test("opens full text for an ordinary text clue from its cell", async ({ page }) => {
  await startGuestGame(page);
  const clue = page.locator(".scan-clue:not(.scan-clue-picture)").first();
  await clue.click();
  const firstChoice = page.locator(".clue-popup-choice").first();
  if (await firstChoice.count()) await firstChoice.click();
  await expect(page.locator(".clue-popup-text")).not.toBeEmpty();
  await expect(page.locator(".clue-popup-length")).toContainText("Ответ:");
  await expect(page.locator(".scanword-board")).toBeVisible();
});

test("keeps the landing page within the emulated device width", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("opens the Russian Wordle from the bottom of the home page and supports a five-letter guess", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#playWordle")).toBeVisible();
  await page.locator("#playWordle").click();
  await expect(page.locator(".wordle-screen")).toBeVisible();
  await expect(page.locator(".wordle-tile")).toHaveCount(30);
  await expect(page.locator(".wordle-key")).not.toHaveCount(0);
  await expect(page.locator(".wordle-message")).not.toContainText("Не удалось загрузить словарь");
  const dictionary = await page.evaluate(() => fetch("./data/wordle-words.json").then(response => response.json()));
  expect(dictionary.valid.length).toBeGreaterThanOrEqual(25000);
  expect(dictionary.valid).toContain("ТУНЕЦ");
  expect(dictionary.answers).toContain("ТУНЕЦ");
  expect(dictionary.answers.length).toBeGreaterThanOrEqual(1700);
  let greyKeyCount = 0;
  const guesses = ["ТУНЕЦ", "БЛЮДО"];
  for (const guess of guesses) {
    for (const letter of guess) await page.locator('.wordle-key[data-key="' + letter + '"]').click();
    await page.locator('.wordle-key[data-key="ENTER"]').click();
    await expect(page.locator('.wordle-key[data-key="' + guess[0] + '"]')).toHaveClass(/correct|present|absent/, { timeout: 5_000 });
    greyKeyCount = await page.locator(".wordle-key.absent").count();
    if (greyKeyCount > 0) break;
    await page.locator("#wordleNew").click();
  }
  expect(greyKeyCount).toBeGreaterThan(0);
  const greyKey = page.locator(".wordle-key.absent").first();
  await expect(greyKey).toBeEnabled();
  await expect(greyKey).toHaveAttribute("aria-label", /можно вводить/);
  const greyLetter = await greyKey.getAttribute("data-key");
  await greyKey.click();
  await expect(page.locator(".wordle-row").nth(1).locator(".wordle-tile").first()).toHaveText(greyLetter);
  await page.locator("#wordleBack").click();
  await expect(page.locator("#playWordle")).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test("Wordle supports 4, 6, 7 and 8 letter modes on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator("#playWordle").click();
  await expect(page.locator(".wordle-screen")).toBeVisible();
  for (const n of [4, 6, 7, 8]) {
    await page.locator('[data-length="' + n + '"]').click();
    await expect(page.locator(".wordle-tile")).toHaveCount(6 * n);
    await expect(page.locator(".wordle-subtitle")).toContainText(String(n));
  }
  const dimensions = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight }));
  expect(dimensions.s).toBeLessThanOrEqual(dimensions.h + 1);
});

test("opens the 100-level Russian word-search map and mobile board", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator(".qq-game-launch")).toHaveCount(4);
  await page.locator('[data-extra-game="search"]').click();
  await expect(page.locator(".qq-level-dot")).toHaveCount(100);
  await expect(page.locator('[data-level="1"]')).toBeEnabled();
  await expect(page.locator('[data-level="2"]')).toBeDisabled();
  await page.locator('[data-level="1"]').click();
  await expect(page.locator(".qq-search-grid")).toBeVisible();
  await expect(page.locator(".qq-search-cell")).toHaveCount(81);
  await expect(page.locator(".qq-word-list")).toHaveCount(0);
  const fit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight, b: document.querySelector(".qq-search-hint").getBoundingClientRect().bottom }));
  expect(fit.b).toBeLessThanOrEqual(fit.h + 1);
  expect(fit.s).toBeLessThanOrEqual(fit.h + 1);
  expect(errors).toEqual([]);
});

test("opens the 100-level Word of Wonders map and joins the wheel letters by dragging", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="wheel"]').click();
  await expect(page.locator(".qq-level-dot")).toHaveCount(100);
  await page.locator('[data-level="1"]').click();
  await expect(page.locator("#qqWheel")).toBeVisible();
  const count = await page.locator("#qqWheelBoard").getAttribute("data-word-count");
  await expect(page.locator("#qqWheelProgress")).toContainText("/ " + count);
  const letters = page.locator(".qq-wheel-letter");
  const target = await page.locator("#qqWowClues .qq-wow-clue").first().getAttribute("data-wow-clue");
  const available = await letters.allTextContents();
  const used = new Set();
  const indexes = [...target].map(char => {
    const index = available.findIndex((letter, i) => letter === char && !used.has(i));
    used.add(index);
    return index;
  });
  expect(indexes.every(index => index >= 0)).toBeTruthy();
  await page.evaluate((path) => {
    const wheel = document.querySelector("#qqWheel");
    const buttons = [...wheel.querySelectorAll(".qq-wheel-letter")];
    const points = path.map(index => {
      const rect = buttons[index].getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    const send = (target, type, point) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 77, pointerType: "touch", isPrimary: true,
      clientX: point.x, clientY: point.y, buttons: type === "pointerup" ? 0 : 1
    }));
    send(buttons[path[0]], "pointerdown", points[0]);
    for (let i = 1; i < points.length; i++) send(wheel, "pointermove", points[i]);
    send(wheel, "pointerup", points[points.length - 1]);
  }, indexes);
  await expect(page.locator("#qqWheelProgress")).toContainText("Найдено: 1 / " + count);
  const fit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight, b: document.querySelector("#qqWheelBoard").getBoundingClientRect(), c: document.querySelector(".qq-wow-controls").getBoundingClientRect() }));
  expect(fit.b.width).toBeGreaterThan(250);
  expect(fit.c.bottom).toBeLessThanOrEqual(fit.h + 1);
  expect(fit.s).toBeLessThanOrEqual(fit.h + 1);
  expect(errors).toEqual([]);
});
test("difficulty grows through level 100 in Word of Wonders and word search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("qqcross.wow.unlocked.v1", "100");
    localStorage.setItem("qqcross.search.unlocked.v1", "100");
  });
  await page.reload();
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();

  await page.locator('[data-extra-game="wheel"]').click();
  await page.locator('[data-level="20"]').click();
  await expect(page.locator("#qqWheelBoard")).toHaveAttribute("data-grid-size", "18");
  await expect(page.locator("#qqWheelProgress")).toHaveText(/Найдено: 0 \/ 1[2-4]/);
  await page.locator(".qq-extra-top [data-exit]").click();
  await page.locator('[data-level="100"]').click();
  await expect(page.locator("#qqWheelBoard")).toHaveAttribute("data-grid-size", "18");
  await expect(page.locator("#qqWheelProgress")).toHaveText(/Найдено: 0 \/ 1[4-6]/);
  const wowFit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight, bottom: document.querySelector("#qqWheelBoard").getBoundingClientRect().bottom }));
  expect(wowFit.bottom).toBeLessThanOrEqual(wowFit.h + 1);
  expect(wowFit.s).toBeLessThanOrEqual(wowFit.h + 1);

  await page.locator(".qq-extra-top [data-exit]").click();
  await page.locator(".qq-extra-top [data-exit]").click();
  await page.locator('[data-extra-game="search"]').click();
  await page.locator('[data-level="20"]').click();
  await expect(page.locator(".qq-search-cell")).toHaveCount(324);
  await expect(page.locator("#qqProgress")).toHaveText(/Найдено: 0 \/ 1[2-4]/);
  await page.locator(".qq-extra-top [data-exit]").click();
  await page.locator('[data-level="100"]').click();
  await expect(page.locator(".qq-search-cell")).toHaveCount(324);
  await expect(page.locator("#qqProgress")).toHaveText(/Найдено: 0 \/ 1[4-6]/);
  const searchFit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight, bottom: document.querySelector("#qqSearchGrid").getBoundingClientRect().bottom }));
  expect(searchFit.bottom).toBeLessThanOrEqual(searchFit.h + 1);
  expect(searchFit.s).toBeLessThanOrEqual(searchFit.h + 1);
});

test("opens the rebuilt Cody-style crossword with a real secret column, level map and letter keyboard", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="cody"]').click();
  await expect(page.locator(".qq-cody-world")).toBeVisible();
  await expect(page.locator(".qq-cody-group")).toHaveCount(50);
  await page.locator('[data-group="0"]').click();
  await expect(page.locator(".qq-cody-level")).toHaveCount(2);
  await page.locator('[data-level="0"]').click();
  await expect(page.locator(".qq-cody-play-layout")).toBeVisible();
  await expect(page.locator(".qq-cody-cell.secret")).toHaveCount(await page.locator(".qq-cody-secret span").count(), { timeout: 5_000 });
  expect(await page.locator(".qq-cody-secret span").count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator(".qq-cody-key-row button[data-letter]")).toHaveCount(32);
  await expect(page.locator(".qq-cody-row-clue-text")).toHaveCount(await page.locator(".qq-cody-secret span").count());
  await expect(page.locator(".qq-cody-row")).toHaveCount(await page.locator(".qq-cody-secret span").count());
  expect(await page.locator(".qq-cody-row").count()).toBeGreaterThanOrEqual(9);
  await expect(page.locator("#qqCodyLoupe")).toContainText("Лупа");
  await expect(page.locator("#qqCodyHint")).toContainText("Подсказка");
  await expect(page.locator("input")).toHaveCount(0);
  await page.locator('.qq-cody-key-row button[data-letter="А"]').click();
  await expect(page.locator(".qq-cody-cell.filled")).toHaveText("А");
  await page.locator('.qq-cody-key-row button[data-action="delete"]').click();
  await expect(page.locator(".qq-cody-cell.filled")).toHaveCount(0);
  await page.locator("#qqCodyLoupe").click();
  await expect(page.locator(".qq-cody-cell.filled")).toHaveCount(1);
  const bulbsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  await page.locator("#qqCodyHint").click();
  await expect(page.locator(".qq-cody-cell.filled")).toHaveCount(2);
  const bulbsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  expect(bulbsAfter).toBe(bulbsBefore - 1);
  await page.locator("#qqCodyBack").click();
  await expect(page.locator(".qq-cody-level")).toHaveCount(2);
  await page.locator("#qqCodyBack").click();
  await expect(page.locator(".qq-cody-group")).toHaveCount(50);
  expect(errors).toEqual([]);
});


test("the shared 100,000-word Russian lexicon keeps clean Wordle and scanword entries", async ({ page }) => {
  await page.goto("/");
  const [lexicon, wordle, scanwords, common] = await Promise.all([
    page.evaluate(() => fetch("./data/russian-words-100000.json").then(r => r.json())),
    page.evaluate(() => fetch("./data/wordle-words.json").then(r => r.json())),
    page.evaluate(() => fetch("./data/scanword-dictionary.json").then(r => r.json())),
    page.evaluate(() => fetch("./data/russian-words-common-25000.json").then(r => r.json()))
  ]);
  const master = new Set(lexicon.words);
  expect(lexicon.language).toBe("ru");
  expect(lexicon.count).toBe(100000);
  expect(lexicon.words).toHaveLength(100000);
  expect(master.size).toBe(100000);
  expect(lexicon.words.every(word => /^[А-Я]{2,18}$/.test(word))).toBe(true);
  expect(common.language).toBe("ru");
  expect(common.count).toBe(25000);
  expect(common.words).toHaveLength(25000);
  expect(new Set(common.words).size).toBe(25000);
  expect(common.words.every(word => /^[А-Я]{3,18}$/.test(word))).toBe(true);
  const normalize = value => String(value || "").toUpperCase().replace(/Ё/g, "Е").replace(/[^А-Я]/g, "");
  const blocked = new Set(["БЛЯДЬ","БЛЯТЬ","ЕБАТЬ","ЕБАЛО","ХУЙНЯ","ПИЗДА","ГОВНО","МУДАК","ДЕРЬМО","ПИЗДЕЦ","НАХУЙ","СУКА","МРАЗЬ"]);
  const cleanWord = word => /^[А-Я]{2,18}$/.test(word) && !blocked.has(word) && !/(.)\1\1/.test(word);
  expect(wordle.valid.map(normalize).filter(cleanWord).every(word => master.has(word))).toBe(true);
  expect(scanwords.map(entry => normalize(entry.answer)).filter(cleanWord).every(word => master.has(word))).toBe(true);
});


test("all four themes apply globally and persist across games", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();

  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await expect(page.locator('.nav [data-tab="Настройки"]')).toHaveCount(0);
  await page.locator("#qqSettingsGear").click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await expect(page.locator("[data-theme-choice]")).toHaveCount(4);
  await expect(page.locator("[data-mode-choice]")).toHaveCount(0);

  const root = page.locator("html");
  for (const theme of ["burgundy", "purple", "dark", "light"]) {
    await page.locator('[data-theme-choice="' + theme + '"]').click();
    await expect(root).toHaveAttribute("data-qq-theme", theme);
    await expect(page.locator('[data-theme-choice="' + theme + '"]')).toHaveClass(/selected/);
    const tokens = await page.evaluate(() => ({
      accent: getComputedStyle(document.documentElement).getPropertyValue("--qq-theme-accent").trim(),
      page: getComputedStyle(document.documentElement).getPropertyValue("--qq-theme-page").trim(),
      card: getComputedStyle(document.documentElement).getPropertyValue("--qq-theme-card").trim(),
      text: getComputedStyle(document.documentElement).getPropertyValue("--qq-theme-text").trim(),
      scheme: getComputedStyle(document.documentElement).colorScheme
    }));
    expect(tokens.accent).not.toBe("");
    expect(tokens.page).not.toBe("");
    expect(tokens.card).not.toBe("");
    expect(tokens.text).not.toBe("");
    expect(tokens.scheme).toBe(theme === "light" ? "light" : "dark");
  }

  const saved = await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"));
  expect(saved).toBe("light");

  await page.locator('[data-theme-choice="purple"]').click();
  await page.locator('[data-tab="Главная"]').click();
  await page.locator('[data-extra-game="search"]').click();
  await page.locator('[data-level="1"]').click();
  await expect(page.locator(".qq-search-cell")).toHaveCount(81);
  const cellStyle = await page.locator(".qq-search-cell").first().evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    color: getComputedStyle(el).color
  }));
  expect(cellStyle.background).not.toBe("none");
  expect(cellStyle.color).not.toBe("rgb(255, 255, 255)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "purple");
});


test("word search shows a question for every target and the bulb marks a starting letter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="search"]').click();
  await page.locator('[data-level="1"]').click();
  await expect(page.locator("#qqSearchClues .qq-search-word")).not.toHaveCount(0);
  await expect(page.locator("#qqSearchClues")).not.toContainText("Что изображено");
  const targets = Number((await page.locator("#qqProgress").textContent()).split("/").pop().trim());
  await expect(page.locator("#qqSearchClues .qq-search-word")).toHaveCount(targets);
  const bulbsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  await page.locator("#qqSearchBulb").click();
  await expect(page.locator(".qq-search-cell.qq-search-hinted")).toHaveCount(1);
  const bulbsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  expect(bulbsAfter).toBe(bulbsBefore - 1);
  const fit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight }));
  expect(fit.s).toBeLessThanOrEqual(fit.h + 1);
});

test("Word of Wonders shows clue prompts and uses the bulb to highlight a letter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="wheel"]').click();
  await page.locator('[data-level="1"]').click();
  const total = Number((await page.locator("#qqWheelProgress").textContent()).split("/")[1].trim());
  await expect(page.locator("#qqWowClues .qq-wow-clue")).toHaveCount(total);
  await expect(page.locator("#qqWowClues")).not.toContainText("Что изображено");
  const bulbsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  await page.locator("#qqWheelBulb").click();
  await expect(page.locator(".qq-wheel-letter.qq-wheel-hinted")).toHaveCount(1);
  const bulbsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("qqcross_profile_v2")).items.bulb);
  expect(bulbsAfter).toBe(bulbsBefore - 1);
  const fit = await page.evaluate(() => ({ h: document.documentElement.clientHeight, s: document.documentElement.scrollHeight }));
  expect(fit.s).toBeLessThanOrEqual(fit.h + 1);
});

test("the redesigned shop contains the bulb item and level rewards are idempotent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-tab="Магазин"]').click();
  await expect(page.locator(".qq-shop-item")).toHaveCount(4);
  const bulb = page.locator('.qq-shop-item:has(button[data-item="bulb"])');
  await expect(bulb).toContainText("💡");
  await expect(bulb).toContainText("5 · 100");
  await expect(bulb).toContainText("10 · 200");
  await page.evaluate(async () => { await window.QQEconomy.awardLevel("search", 998); });
  await expect(page.locator(".coins")).toContainText("5");
  await page.evaluate(async () => { await window.QQEconomy.awardLevel("search", 998); });
  await expect(page.locator(".coins")).toContainText("5");
});


test("Cody crossword awards the actual one-based puzzle level", async ({ page }) => {
  const response = await page.request.get("/new-games.js");
  expect(response.ok()).toBeTruthy();
  const source = await response.text();
  expect(source).toContain('awardLevel?.("cody",Number(id.slice(1)))');
  expect(source).not.toContain('awardLevel?.("cody",Number(id.slice(1))+1)');
});


test("legacy inventory normalization adds a bulb slot and preserves existing counts", async ({ page }) => {
  await startGuestGame(page);
  const result = await page.evaluate(() => window.QQEconomy.normalizeItems({ magnifier: 3, clock: 2, trash: 1 }));
  expect(result).toEqual({ magnifier: 3, clock: 2, trash: 1, bulb: 5 });
  const preserved = await page.evaluate(() => window.QQEconomy.normalizeItems({ magnifier: 3, clock: 2, trash: 1, bulb: 7 }));
  expect(preserved.bulb).toBe(7);
  const repaired = await page.evaluate(() => window.QQEconomy.normalizeItems({ magnifier: -1, clock: "2", trash: 1 }));
  expect(repaired).toEqual({ magnifier: 0, clock: 0, trash: 1, bulb: 5 });
});


test("portrait scanword preserves edge and central clues and fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuestGame(page);
  const board = page.locator(".scanword-board");
  await expect(board).toBeVisible({ timeout: 20_000 });
  const grid = await board.evaluate(node => {
    const count = value => {
      const text = String(value || "").trim();
      const repeated = text.match(/^repeat\\((\\d+)\\s*,/);
      return repeated ? Number(repeated[1]) : text.split(/\\s+/).filter(Boolean).length;
    };
    const rect = node.getBoundingClientRect();
    return {
      columns: count(getComputedStyle(node).gridTemplateColumns),
      rows: count(getComputedStyle(node).gridTemplateRows),
      width: rect.width,
      height: rect.height,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight
    };
  });
  expect(grid.columns).toBe(8);
  expect(grid.rows).toBe(12);
  expect(grid.width).toBeGreaterThanOrEqual(grid.viewportWidth * 0.85);
  expect(grid.width).toBeLessThanOrEqual(grid.viewportWidth);
  expect(Math.abs(grid.width / grid.height - (2 / 3))).toBeLessThan(0.03);
  expect(grid.height).toBeLessThanOrEqual(grid.viewportHeight - 190);
  await expect(board.locator(".scan-empty")).toHaveAttribute("data-reserved-cell", "0,0");
  await expect(board.locator('.scan-clue[data-clue-cell="0,1"]')).toHaveCount(1);
  await expect(board.locator('.scan-clue[data-clue-cell="1,0"]')).toHaveCount(1);
  await expect(board.locator(".scan-clue-count")).toHaveCount(0);
  const edgeCounts = await board.locator(".scan-clue").evaluateAll(nodes => nodes.reduce((counts, node) => {
    const [row, col] = node.dataset.clueCell.split(",").map(Number);
    if (row === 0) counts.top++;
    if (col === 0 && row > 0) counts.left++;
    return counts;
  }, { top: 0, left: 0 }));
  expect(edgeCounts.top).toBeGreaterThanOrEqual(3);
  expect(edgeCounts.left).toBe(11);
  const interiorClues = await board.locator(".scan-clue").evaluateAll(nodes => nodes.filter(node => {
    const [row, col] = node.dataset.clueCell.split(",").map(Number);
    return row > 0 && row < 11 && col > 0 && col < 7;
  }).length);
  expect(interiorClues).toBeGreaterThanOrEqual(5);
  const centerClues = await board.locator(".scan-clue").evaluateAll(nodes => nodes.filter(node => {
    const [row, col] = node.dataset.clueCell.split(",").map(Number);
    return row >= 3 && row <= 8 && col >= 2 && col <= 5;
  }).length);
  expect(centerClues).toBeGreaterThanOrEqual(3);
  const arrows = await board.locator(".scan-arrow").evaluateAll(nodes => nodes.map(node =>
    [...node.classList].find(name => name.startsWith("scan-arrow-"))
  ));
  expect(arrows.length).toBeGreaterThan(0);
  expect(arrows.every(direction => ["scan-arrow-right", "scan-arrow-down"].includes(direction))).toBeTruthy();
  const pageFit = await page.evaluate(() => ({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight
  }));
  expect(pageFit.width).toBeLessThanOrEqual(pageFit.viewportWidth + 1);
  expect(pageFit.height).toBeLessThanOrEqual(pageFit.viewportHeight + 1);
  await page.screenshot({ path: "test-results/scanword-reference-mobile.png", fullPage: true });
  await board.locator(".scan-clue").first().click();
  await expect(page.locator(".clue-popup")).toBeVisible();
});

test("scanword autosave avoids writing the full match snapshot on every timer tick", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?debugTiming=1");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    window.__qqMatchWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "qqcross_local_matches_v1") window.__qqMatchWrites++;
      return original.call(this, key, value);
    };
  });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#play-toggle")).toBeVisible();
  await page.locator("#play-toggle").click();
  await expect(page.locator("#practice")).toBeVisible();
  await page.locator("#practice").click();
  await expect(page.locator(".scanword-board")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => { window.__qqMatchWrites = 0; });
  await page.waitForTimeout(4500);
  const writes = await page.evaluate(() => window.__qqMatchWrites);
  expect(writes).toBeLessThanOrEqual(3);
});


test("scanword uses zero to four pictures and at least three logical questions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuestGame(page);
  const images = page.locator(".scanword-board .scan-clue-picture .scan-clue-image");
  expect(await images.count()).toBeLessThanOrEqual(4);
  await expect.poll(() => images.evaluateAll(nodes => nodes.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const logicalClues = await page.locator(".scanword-board .scan-clue-logic").count();
  expect(logicalClues).toBeGreaterThanOrEqual(3);
  const clueLayout = await page.locator(".scanword-board .scan-clue:not(.scan-clue-emoji):not(.scan-clue-picture) .scan-clue-text").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { clamp: style.webkitLineClamp, whiteSpace: style.whiteSpace, width: rect.width, height: rect.height, text: node.textContent };
  }));
  expect(clueLayout.length).toBeGreaterThan(0);
  expect(clueLayout.every(item => item.clamp === "3" && item.whiteSpace === "normal" && item.width > 0 && item.height > 0)).toBeTruthy();
  expect(clueLayout.some(item => item.text.length > 8)).toBeTruthy();
});
