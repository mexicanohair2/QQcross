const { test, expect } = require("@playwright/test");

test("migrates the legacy black theme to the current graphite palette", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("qqcross_theme_v1", "black");
    localStorage.removeItem("qqcross_appearance_mode_v1");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "graphite");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "dark");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("graphite");
});

test("migrates the legacy light theme to the light appearance mode", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("qqcross_theme_v1", "light");
    localStorage.removeItem("qqcross_appearance_mode_v1");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "burgundy");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "light");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("burgundy");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_appearance_mode_v1"))).toBe("light");
});



test("full-spectrum themes persist and the settings sections collapse correctly", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#qqSettingsGear")).toBeVisible();
  await expect(page.locator(".nav button")).toHaveCount(6);
  await expect(page.locator(".nav .qq-tab-icon")).toHaveCount(6);

  const otherGames = page.locator('[data-settings-toggle="home-games"]');
  await expect(otherGames).toHaveAttribute("aria-expanded", "true");
  const invites = page.locator('[data-settings-toggle="home-invites"]');
  await expect(invites).toHaveAttribute("aria-expanded", "false");
  await invites.click();
  await expect(page.locator("#matchInvites")).toBeVisible();
  await invites.click();
  await expect(invites).toHaveAttribute("aria-expanded", "false");

  await page.locator('.nav button[data-tab="Друзья"]').click();
  const incoming = page.locator('[data-settings-toggle="friends-incoming"]');
  const outgoing = page.locator('[data-settings-toggle="friends-outgoing"]');
  const friendList = page.locator('[data-settings-toggle="friends-list"]');
  await expect(incoming).toHaveAttribute("aria-expanded", "false");
  await expect(outgoing).toHaveAttribute("aria-expanded", "false");
  await expect(friendList).toHaveAttribute("aria-expanded", "true");
  await incoming.click();
  await expect(page.locator("#incomingFriendRequests")).toBeVisible();
  await page.locator('.nav button[data-tab="Главная"]').click();
  await expect(page.locator('[data-settings-toggle="home-invites"]')).toHaveAttribute("aria-expanded", "false");

  await page.locator("#qqSettingsGear").click();

  const themes = page.locator("[data-theme-choice]");
  await expect(themes).toHaveCount(17);
  await page.locator('[data-theme-choice="ocean"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "ocean");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("ocean");
  await page.locator('[data-theme-choice="graphite"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "graphite");

  const comfort = page.locator('[data-settings-toggle="comfort"]');
  await expect(comfort).toHaveAttribute("aria-expanded", "false");
  await comfort.click();
  await expect(page.locator("#qq-settings-body-comfort")).toBeVisible();
  const appearance = page.locator("#qqAppearanceMode");
  await appearance.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "light");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_appearance_mode_v1"))).toBe("light");
  await page.locator('[data-theme-choice="emerald"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "emerald");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain("rgb(255, 255, 255)");
  await appearance.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "dark");

  const backgrounds = page.locator('[data-settings-toggle="backgrounds"]');
  await expect(backgrounds).toHaveAttribute("aria-expanded", "false");
  await backgrounds.click();
  await expect(page.locator("#qq-settings-body-backgrounds")).toBeVisible();
  const ambience = page.locator('[data-settings-toggle="ambience"]');
  await expect(ambience).toHaveAttribute("aria-expanded", "false");
  await ambience.click();
  await expect(page.locator("#qq-settings-body-ambience")).toBeVisible();

  await page.locator('[data-ambience-choice="sakura"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-qq-ambience", "sakura");
  await expect(page.locator("[data-qq-ambience-layer]")).toBeVisible();
  expect(await page.locator("[data-qq-ambience-layer]").evaluate(el => getComputedStyle(el).pointerEvents)).toBe("none");
  expect(pageErrors).toEqual([]);
});
test("preserves an explicit appearance preference during legacy theme migration", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("qqcross_theme_v1", "light");
    localStorage.setItem("qqcross_appearance_mode_v1", "dark");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-qq-theme", "burgundy");
  await expect(page.locator("html")).toHaveAttribute("data-qq-mode", "dark");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_theme_v1"))).toBe("burgundy");
  expect(await page.evaluate(() => localStorage.getItem("qqcross_appearance_mode_v1"))).toBe("dark");
});
