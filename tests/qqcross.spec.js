const { test, expect } = require("@playwright/test");

async function startGuestGame(page) {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?debugTiming=1");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#play-toggle")).toBeVisible();
  await page.locator("#play-toggle").click();
  await expect(page.locator("#practice")).toBeVisible();
  await page.evaluate(() => { window.__qqStartTap = performance.now(); });
  await page.locator("#practice").click();
  await expect(page.locator(".game-screen")).toBeVisible({ timeout: 60_000 });
  const startMs = await page.evaluate(() => performance.now() - window.__qqStartTap);
  return { pageErrors, startMs };
}

test("loads a fully occupied 15x15 scanword with three distinct picture clues", async ({ page }) => {
  const { pageErrors, startMs } = await startGuestGame(page);
  await expect(page.locator(".scanword-board")).toBeVisible();
  await expect(page.locator(".scan-grid-cell")).toHaveCount(225);
  await expect(page.locator(".scan-clue")).not.toHaveCount(0);
  await expect(page.locator(".scan-filler")).toHaveCount(0);
  await expect(page.locator(".scan-grid-cell.cell, .scan-grid-cell.scan-clue")).toHaveCount(225);
  await expect(page.locator(".scan-clue-picture")).toHaveCount(3);
  await expect(page.locator(".scan-clue-image")).toHaveCount(3);
  await expect.poll(() => page.locator(".scan-clue-image").evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const pictureSources = await page.locator(".scan-clue-image").evaluateAll(images => images.map(img => new URL(img.src).pathname.split("/").pop()).sort());
  expect(new Set(pictureSources).size).toBe(3);
  expect(pictureSources.every(source => source.endsWith(".svg"))).toBe(true);
  const internalTiming = await page.evaluate(() => window.__qqcrossTiming || null);
  console.log("QQCross game tap-to-board: " + Math.round(startMs) + " ms; generator: " + JSON.stringify(internalTiming));
  expect(internalTiming).not.toBeNull();
  expect(internalTiming.totalMs).toBeLessThan(500);
  expect(pageErrors, "The app should not throw uncaught JavaScript errors").toEqual([]);
});

test("opens a picture clue and displays the image question", async ({ page }) => {
  await startGuestGame(page);
  await page.locator(".scan-clue-picture").first().click();
  await expect(page.locator(".clue-popup-backdrop")).toBeVisible();
  await expect(page.locator(".clue-popup-text")).toHaveText("Что изображено на картинке?");
  await page.getByRole("button", { name: "Понятно" }).click();
  await expect(page.locator(".clue-popup-backdrop")).toHaveCount(0);
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
  for (let attempt = 0; attempt < 8 && greyKeyCount === 0; attempt++) {
    for (const letter of ["Т","У","Н","Е","Ц"]) {
      await page.locator('.wordle-key[data-key="' + letter + '"]').click();
    }
    await page.locator('.wordle-key[data-key="ENTER"]').click();
    await expect(page.locator(".wordle-tile.correct, .wordle-tile.present, .wordle-tile.absent")).toHaveCount(5, { timeout: 5_000 });
    greyKeyCount = await page.locator(".wordle-key.absent").count();
    if (greyKeyCount === 0 && attempt < 7) await page.locator("#wordleNew").click();
  }
  expect(greyKeyCount).toBeGreaterThan(0);
  const greyKey = page.locator(".wordle-key.absent").first();
  await expect(greyKey).toBeEnabled();
  await expect(greyKey).toHaveAttribute("aria-disabled", "false");
  await expect(greyKey).toHaveAttribute("aria-label", /можно вводить/);
  const greyLetter = await greyKey.getAttribute("data-key");
  await greyKey.click();
  await expect(page.locator(".wordle-row").nth(1).locator(".wordle-tile").first()).toHaveText(greyLetter);
  await page.locator("#wordleBack").click();
  await expect(page.locator("#playWordle")).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test("opens the classic Russian word-search game", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator(".qq-game-launch")).toHaveCount(4);
  await page.locator('[data-extra-game="search"]').click();
  await expect(page.locator(".qq-search-grid")).toBeVisible();
  await expect(page.locator(".qq-search-cell")).toHaveCount(121);
  await expect(page.locator(".qq-word-list span").first()).toBeVisible();
  await expect(page.locator(".qq-extra-screen")).toContainText("Поиск слов");
  expect(errors).toEqual([]);
});

test("opens the letter-wheel crossword game and accepts letter selection", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="wheel"]').click();
  await expect(page.locator("#qqWheel")).toBeVisible();
  await expect(page.locator(".qq-wheel-letter").first()).toBeVisible();
  await page.locator(".qq-wheel-letter").first().click();
  await expect(page.locator("#qqWheelAnswer")).not.toBeEmpty();
  await page.locator("#qqWheelClear").click();
  await expect(page.locator("#qqWheelAnswer")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("opens the rebuilt Cody-style crossword with a real secret column, level map and letter keyboard", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator('[data-extra-game="cody"]').click();
  await expect(page.locator(".qq-cody-world")).toBeVisible();
  await expect(page.locator(".qq-cody-group")).toHaveCount(20);
  await page.locator('[data-group="0"]').click();
  await expect(page.locator(".qq-cody-level")).toHaveCount(5);
  await page.locator('[data-level="0"]').click();
  await expect(page.locator(".qq-cody-board")).toBeVisible();
  await expect(page.locator(".qq-cody-cell.secret")).toHaveCount(4, { timeout: 5_000 });
  await expect(page.locator(".qq-cody-secret span")).toHaveCount(4);
  await expect(page.locator(".qq-cody-key-row button[data-letter]")).toHaveCount(32);
  await expect(page.locator(".qq-cody-question")).toBeVisible();
  await expect(page.locator("#qqCodyLoupe")).toContainText("Лупа");
  await expect(page.locator("#qqCodyHint")).toContainText("Подсказка");
  await expect(page.locator("input")).toHaveCount(0);
  await page.locator('.qq-cody-key-row button[data-letter="А"]').click();
  await expect(page.locator(".qq-cody-cell.cursor")).toHaveText("А");
  await page.locator('.qq-cody-key-row button[data-action="delete"]').click();
  await expect(page.locator(".qq-cody-cell.cursor")).not.toHaveText("А");
  await page.locator("#qqCodyLoupe").click();
  await expect(page.locator(".qq-cody-cell.filled")).toHaveCount(1);
  await page.locator("#qqCodyBack").click();
  await expect(page.locator(".qq-cody-level")).toHaveCount(5);
  await page.locator("#qqCodyBack").click();
  await expect(page.locator(".qq-cody-group")).toHaveCount(20);
  expect(errors).toEqual([]);
});


test("the shared 50,000-word Russian lexicon includes every existing Wordle guess and scanword answer", async ({ page }) => {
  await page.goto("/");
  const [lexicon, wordle, scanwords] = await Promise.all([
    page.evaluate(() => fetch("./data/russian-words-50000.json").then(r => r.json())),
    page.evaluate(() => fetch("./data/wordle-words.json").then(r => r.json())),
    page.evaluate(() => fetch("./data/scanword-dictionary.json").then(r => r.json()))
  ]);
  const master = new Set(lexicon.words);
  expect(lexicon.language).toBe("ru");
  expect(lexicon.count).toBe(50000);
  expect(lexicon.words).toHaveLength(50000);
  expect(master.size).toBe(50000);
  expect(lexicon.words.every(word => /^[А-Я]{2,18}$/.test(word))).toBe(true);
  expect(wordle.valid.every(word => master.has(word))).toBe(true);
  expect(scanwords.filter(entry => String(entry.answer).length >= 2).every(entry => master.has(String(entry.answer).toUpperCase().replace(/Ё/g, "Е")))).toBe(true);
});
