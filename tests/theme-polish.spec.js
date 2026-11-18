const { test, expect } = require("@playwright/test");

test("only Burgundy and Purple themes are offered and selection persists", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await page.locator("#qqSettingsGear").click();

  const themes = page.locator("[data-theme-choice]");
  await expect(themes).toHaveCount(2);
  await expect(page.locator('[data-theme-choice="burgundy"]')).toContainText("Burgundy");
  await expect(page.locator('[data-theme-choice="purple"]')).toContainText("Purple");

  await page.locator('[data-theme-choice="purple"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "purple");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("purple");

  const purpleTile = page.locator('[data-theme-choice="purple"]');
  const radius = await purpleTile.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(radius).toBeGreaterThanOrEqual(18);

  const burgundyTile = page.locator('[data-theme-choice="burgundy"]');
  await burgundyTile.scrollIntoViewIfNeeded();
  const rect = await burgundyTile.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await expect.poll(() => burgundyTile.evaluate(el => getComputedStyle(el).filter)).toContain("drop-shadow");
  await page.mouse.up();
  await burgundyTile.click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "burgundy");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("burgundy");
  expect(pageErrors).toEqual([]);
});
