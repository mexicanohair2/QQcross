const { test, expect } = require("@playwright/test");

async function startGuestGame(page) {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#play-toggle")).toBeVisible();
  await page.locator("#play-toggle").click();
  await expect(page.locator("#practice")).toBeVisible();
  await page.locator("#practice").click();
  await expect(page.locator(".game-screen")).toBeVisible({ timeout: 60_000 });
  return pageErrors;
}

test("loads a fully occupied 15x15 scanword with exactly five picture clues", async ({ page }) => {
  const pageErrors = await startGuestGame(page);
  await expect(page.locator(".scanword-board")).toBeVisible();
  await expect(page.locator(".scan-grid-cell")).toHaveCount(225);
  await expect(page.locator(".scan-clue")).not.toHaveCount(0);
  await expect(page.locator(".scan-clue-picture")).toHaveCount(5);
  await expect(page.locator(".scan-clue-image")).toHaveCount(5);
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
