const { test, expect } = require("@playwright/test");

async function openSettings(page) {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await page.locator("#qqSettingsGear").click();
  for (const section of ["backgrounds", "ambience"]) {
    const toggle=page.locator('[data-settings-toggle="' + section + '"]');
    if (await toggle.count() && await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  }
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

test("seasonal ambience keeps fireflies and renders Sakura as individual Canvas petals", async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-ambience-choice="fireflies"]').click();
  const fireflies=await page.evaluate(()=>{
    const style=getComputedStyle(document.body,"::before");
    return {mode:document.documentElement.dataset.qqAmbience,animation:style.animationName,opacity:Number(style.opacity)};
  });
  expect(fireflies.mode).toBe("fireflies");
  expect(fireflies.animation).toBe("qq-ambience-fireflies");
  expect(fireflies.opacity).toBeGreaterThan(.1);
  await page.locator('[data-ambience-choice="sakura"]').click();
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();
  const sakura=await page.evaluate(()=>{
    const canvas=document.querySelector("[data-qq-ambience-layer]");
    const legacy=getComputedStyle(document.body,"::before");
    return {mode:document.documentElement.dataset.qqAmbience,tag:canvas?.tagName,pointerEvents:canvas?getComputedStyle(canvas).pointerEvents:"missing",width:canvas?.width||0,height:canvas?.height||0,legacyDisplay:legacy.display,legacyImage:legacy.backgroundImage};
  });
  expect(sakura.mode).toBe("sakura");expect(sakura.tag).toBe("CANVAS");
  expect(sakura.pointerEvents).toBe("none");expect(sakura.width).toBeGreaterThan(0);expect(sakura.height).toBeGreaterThan(0);
  expect(sakura.legacyDisplay).toBe("none");expect(sakura.legacyImage).toBe("none");
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
