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

test("profile shows unified progression, a title inventory and daily streak", async ({ page }) => {
  await enterGuest(page);
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqProgressionStats")).toBeVisible();
  await expect(page.locator("#qqDailyStreak")).toBeVisible();
  await expect(page.locator("#qqTitleInventory")).toBeVisible();
  await expect(page.locator("#qqAchievements")).toBeVisible();
  await expect(page.locator(".qq-achievement").count()).resolves.toBeGreaterThanOrEqual(20);
});

test("the secret Mugiwara title unlocks after fifteen straw-hat taps", async ({ page }) => {
  await enterGuest(page);
  const hat = page.locator("[data-qq-straw-hat-trigger]").first();
  await expect(hat).toBeVisible();
  for (let i = 0; i < 15; i++) await hat.click({ force: true });
  await page.locator("[data-tab='Профиль']").click();
  await expect(page.locator("#qqTitleInventory")).toContainText("Mugiwara");
});
