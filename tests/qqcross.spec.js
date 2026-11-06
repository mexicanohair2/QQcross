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
  await page.evaluate(() => { window.__qqStartTap = performance.now(); });
  await page.locator("#practice").click();
  await expect(page.locator(".game-screen")).toBeVisible({ timeout: 60_000 });
  const startMs = await page.evaluate(() => performance.now() - window.__qqStartTap);
  return { pageErrors, startMs };
}

test("loads a fully occupied 15x15 scanword with exactly five picture clues", async ({ page }) => {
  const { pageErrors, startMs } = await startGuestGame(page);
  await expect(page.locator(".scanword-board")).toBeVisible();
  await expect(page.locator(".scan-grid-cell")).toHaveCount(225);
  await expect(page.locator(".scan-clue")).not.toHaveCount(0);
  await expect(page.locator(".scan-clue-picture")).toHaveCount(5);
  await expect(page.locator(".scan-clue-image")).toHaveCount(5);
  await expect.poll(() => page.locator(".scan-clue-image").evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const pictureSources = await page.locator(".scan-clue-image").evaluateAll(images => images.map(img => new URL(img.src).pathname.split("/").pop()).sort());
  expect(pictureSources).toEqual(["apple.svg", "banana.svg", "cucumber.svg", "lemon.svg", "tomato.svg"]);
  console.log("QQCross game tap-to-board: " + Math.round(startMs) + " ms");
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
