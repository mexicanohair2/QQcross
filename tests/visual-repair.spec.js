const { test, expect } = require("@playwright/test");

async function openSettings(page) {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await page.locator("#qqSettingsGear").click();
}

test("Burgundy and Purple backgrounds are visibly distinct", async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-theme-choice="burgundy"]').click();
  const burgundy = await page.evaluate(() => ({
    base: getComputedStyle(document.documentElement).getPropertyValue("--qq-base").trim(),
    background: getComputedStyle(document.body).backgroundImage
  }));
  await page.locator('[data-theme-choice="purple"]').click();
  const purple = await page.evaluate(() => ({
    base: getComputedStyle(document.documentElement).getPropertyValue("--qq-base").trim(),
    background: getComputedStyle(document.body).backgroundImage
  }));
  expect(burgundy.base).not.toBe(purple.base);
  expect(burgundy.background).not.toBe(purple.background);
  expect(burgundy.base).toContain("#1a0a10");
  expect(purple.base).toContain("#170e20");
});

test("selected background presets change the actual page background", async ({ page }) => {
  await openSettings(page);
  const before = await page.evaluate(() => ({ color: getComputedStyle(document.documentElement).getPropertyValue("--qq-bg-a").trim(), image: getComputedStyle(document.body).backgroundImage }));
  await page.locator('[data-background-choice="ocean-shore"]').click();
  const after = await page.evaluate(() => ({
    id: document.documentElement.dataset.qqBackground,
    color: getComputedStyle(document.documentElement).getPropertyValue("--qq-bg-a").trim(),
    image: getComputedStyle(document.body).backgroundImage
  }));
  expect(after.id).toBe("ocean-shore");
  expect(after.color).not.toBe(before.color);
  expect(after.image).not.toBe(before.image);
});

test("seasonal ambience uses distinct, slow, non-dust animation layers", async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-ambience-choice="fireflies"]').click();
  const fireflies = await page.evaluate(() => {
    const style = getComputedStyle(document.body, "::before");
    return { mode: document.documentElement.dataset.qqAmbience, animation: style.animationName, opacity: Number(style.opacity) };
  });
  await page.locator('[data-ambience-choice="sakura"]').click();
  const sakura = await page.evaluate(() => {
    const style = getComputedStyle(document.body, "::before");
    return { mode: document.documentElement.dataset.qqAmbience, animation: style.animationName, image: style.backgroundImage };
  });
  expect(fireflies.mode).toBe("fireflies");
  expect(fireflies.animation).toBe("qq-ambience-fireflies");
  expect(fireflies.opacity).toBeGreaterThan(0.1);
  expect(sakura.mode).toBe("sakura");
  expect(sakura.animation).toBe("qq-ambience-petals");
  expect(sakura.image).not.toBe("");
  expect(fireflies.animation).not.toBe(sakura.animation);
});

test("scanword keeps its portrait 8-by-12 grid and uses softer readable cell styling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await page.locator("#play-toggle").click();
  await page.locator("#practice").click();
  await expect(page.locator(".scanword-board")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".scanword-board .scan-clue-text").first()).toBeAttached();
  await expect(page.locator(".scanword-board .cell").first()).toBeAttached();
  const visual = await page.evaluate(() => {
    const board = document.querySelector(".scanword-board");
    const clueText = board.querySelector(".scan-clue-text");
    const clue = clueText?.closest(".scan-clue");
    const letter = board.querySelector(".cell");
    const clueFonts = [...board.querySelectorAll(".scan-clue-text")]
      .filter(node => !node.closest(".scan-clue-emoji"))
      .map(node => parseFloat(getComputedStyle(node).fontSize));
    return {
      columns: getComputedStyle(board).gridTemplateColumns.split(" ").length,
      rows: getComputedStyle(board).gridTemplateRows.split(" ").length,
      clueFont: parseFloat(getComputedStyle(clueText).fontSize),
      minClueFont: clueFonts.length ? Math.min(...clueFonts) : 0,
      cellBackground: getComputedStyle(letter).backgroundImage,
      clueBackground: getComputedStyle(clue).backgroundImage,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  });
  expect(visual.columns).toBe(8);
  expect(visual.rows).toBe(12);
  expect(visual.clueFont).toBeGreaterThanOrEqual(8);
  expect(visual.minClueFont).toBeGreaterThanOrEqual(8);
  expect(visual.cellBackground).not.toBe(visual.clueBackground);
  expect(visual.scrollWidth).toBeLessThanOrEqual(visual.viewportWidth + 1);
});
