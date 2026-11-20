const { test, expect } = require("@playwright/test");

async function openSettings(page) {
  await page.goto("/");
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await page.locator("#qqSettingsGear").click();
  for (const section of ["backgrounds", "ambience"]) {
    const toggle = page.locator('[data-settings-toggle="' + section + '"]');
    if (await toggle.count() && await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  }
}

test("Burgundy and Purple backgrounds are visibly distinct", async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-theme-choice="burgundy"]').click();
  const burgundy = await page.evaluate(() => ({
    base: getComputedStyle(document.documentElement).getPropertyValue("--qq-base").trim(),
    background: getComputedStyle(document.body).backgroundImage,
    atmosphericTint: getComputedStyle(document.body, "::after").backgroundImage,
    atmosphericOpacity: Number(getComputedStyle(document.body, "::after").opacity)
  }));
  await page.locator('[data-theme-choice="purple"]').click();
  const purple = await page.evaluate(() => ({
    base: getComputedStyle(document.documentElement).getPropertyValue("--qq-base").trim(),
    background: getComputedStyle(document.body).backgroundImage
  }));
  expect(burgundy.base).not.toBe(purple.base);
  expect(burgundy.background).not.toBe(purple.background);
  expect(burgundy.base).toContain("#210710");
  expect(burgundy.atmosphericTint).not.toBe("none");
  expect(burgundy.atmosphericTint).toContain("rgba(130, 25, 57");
  expect(burgundy.atmosphericOpacity).toBe(1);
  await expect(page.locator('[data-theme-choice="burgundy"]')).toContainText("Тёмная вишня");
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

test("all seasonal ambience modes render their own natural Canvas particles", async ({ page }) => {
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    window.__qqCanvasOps = {};
    for (const method of ["bezierCurveTo", "quadraticCurveTo", "lineTo", "arc", "ellipse", "fill", "stroke"]) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, method);
      if (!descriptor || typeof descriptor.value !== "function" || !descriptor.writable) continue;
      Object.defineProperty(proto, method, {
        ...descriptor,
        value: function (...args) {
          window.__qqCanvasOps[method] = (window.__qqCanvasOps[method] || 0) + 1;
          return descriptor.value.apply(this, args);
        }
      });
    }
  });
  await openSettings(page);
  await page.locator('[data-ambience-choice="none"]').click();
  await expect(page.locator("[data-qq-ambience-layer]")).toHaveCount(0);
  await page.locator('[data-ambience-choice="sakura"]').click();
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();

  const modes = [
    ["sakura", "bezierCurveTo"],
    ["autumn", "lineTo"],
    ["forest", "lineTo"],
    ["rain", "quadraticCurveTo"],
    ["fireflies", "arc"],
    ["stars", "quadraticCurveTo"],
    ["fog", "ellipse"]
  ];
  for (const [mode, operation] of modes) {
    await page.evaluate(() => { window.__qqCanvasOps = {}; });
    await page.locator('[data-ambience-choice="' + mode + '"]').click();
    const canvas = page.locator("[data-qq-ambience-layer]");
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(90);
    const state = await page.evaluate(operation => {
      const node = document.querySelector("[data-qq-ambience-layer]");
      return {
        mode: document.documentElement.dataset.qqAmbience,
        tag: node?.tagName,
        pointerEvents: node ? getComputedStyle(node).pointerEvents : "missing",
        zIndex: node ? getComputedStyle(node).zIndex : "missing",
        appZIndex: getComputedStyle(document.querySelector("#app")).zIndex,
        width: node?.width || 0,
        height: node?.height || 0,
        operationCount: window.__qqCanvasOps[operation] || 0,
        legacyDisplay: getComputedStyle(document.body, "::before").display
      };
    }, operation);
    expect(state.mode).toBe(mode);
    expect(state.tag).toBe("CANVAS");
    expect(state.pointerEvents).toBe("none");
    expect(state.zIndex).toBe("1");
    expect(state.appZIndex).toBe("2");
    expect(state.width).toBeGreaterThan(0);
    expect(state.height).toBeGreaterThan(0);
    expect(state.operationCount, mode + " should draw its own particle geometry").toBeGreaterThan(0);
    expect(state.legacyDisplay).toBe("none");
  }

  await page.locator('[data-ambience-choice="sakura"]').click();
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-qq-ambience-layer]")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();

  await page.locator("html").evaluate(node => { node.dataset.qqReduceMotion = "true"; });
  await expect(page.locator("[data-qq-ambience-layer]")).toHaveCount(0);
  await page.locator("html").evaluate(node => { node.dataset.qqReduceMotion = "false"; });
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();
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
