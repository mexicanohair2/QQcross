const { test, expect } = require("@playwright/test");

async function startGuestGame(page) {
  page.on("pageerror", error => { throw error; });
  await page.goto("/?debugTiming=1");
  await expect(page).toHaveTitle(/QQCross/);
  await expect(page.locator("#guestPlay")).toBeVisible({ timeout: 15_000 });
  await page.locator("#guestPlay").click();
  await expect(page.locator("#play-toggle")).toBeVisible();
  await page.locator("#play-toggle").click();
  await expect(page.locator("#practice")).toBeVisible();
  await page.locator("#practice").click();
  await expect(page.locator(".game-screen")).toBeVisible({ timeout: 60_000 });
}

test("Kross contract: canonical 8×12 board has no clue in the rightmost column and uses 95% × 85% of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGuestGame(page);
  const board = page.locator(".scanword-board");
  await expect(board).toBeVisible();
  await expect(board.locator(".scan-grid-cell")).toHaveCount(96);
  const details = await board.evaluate(node => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const trackCount = value => String(value).trim().split(/\s+/).length;
    const clues = [...node.querySelectorAll(".scan-clue")].map(clue => {
      const [row, col] = clue.dataset.clueCell.split(",").map(Number);
      return { row, col, content: !!clue.querySelector(".scan-clue-text, .scan-clue-image") };
    });
    return {
      columns: trackCount(style.gridTemplateColumns),
      rows: trackCount(style.gridTemplateRows),
      rightmostClues: clues.filter(clue => clue.col === 7),
      rightmostLetters: node.querySelectorAll('.scan-grid-cell.cell[data-cell$=",7"]').length,
      emptyCount: node.querySelectorAll(".scan-empty").length,
      fillerCount: node.querySelectorAll(".scan-filler").length,
      invalidClues: clues.filter(clue => !clue.content),
      board: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      page: { width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }
    };
  });
  expect(details.columns).toBe(8);
  expect(details.rows).toBe(12);
  expect(details.rightmostClues).toEqual([]);
  const topAnchorColumns = await board.locator('.scan-clue[data-clue-cell^="0,"]').evaluateAll(nodes =>
    nodes.map(node => Number(node.dataset.clueCell.split(",")[1])).sort((a, b) => a - b)
  );
  expect(topAnchorColumns).toHaveLength(2);
  expect(topAnchorColumns[0]).toBe(1);
  expect([4, 5]).toContain(topAnchorColumns[1]);
  expect(details.rightmostLetters).toBe(12);
  expect(details.emptyCount).toBe(1);
  expect(details.fillerCount).toBe(0);
  expect(details.invalidClues).toEqual([]);
  expect(details.board.width).toBeGreaterThanOrEqual(details.viewport.width * 0.95);
  expect(details.board.height).toBeGreaterThanOrEqual(details.viewport.height * 0.85);
  expect(details.board.left).toBeGreaterThanOrEqual(-1);
  expect(details.board.right).toBeLessThanOrEqual(details.viewport.width + 1);
  expect(details.page.width).toBeLessThanOrEqual(details.viewport.width + 1);
  expect(details.page.height).toBeLessThanOrEqual(details.viewport.height + 1);
  const cellRoles = await board.locator(".scan-grid-cell").evaluateAll(nodes => nodes.map(node =>
    node.classList.contains("scan-clue") || node.classList.contains("scan-boundary") ? "question"
      : node.classList.contains("cell") ? "letter"
        : node.classList.contains("scan-empty") ? "corner"
          : "invalid"
  ));
  expect(cellRoles.filter(role => role === "invalid")).toEqual([]);
  expect(cellRoles).toHaveLength(96);
});

test("Kross save/restore keeps the 8×12 board, clue keys and right-edge answers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { pageErrors } = await startGuestGame(page);
  const saved = await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("qqcross_profile_v2") || "null");
    const all = JSON.parse(localStorage.getItem("qqcross_local_matches_v1") || "{}");
    const match = profile ? all[profile.id]?.[0] : null;
    return match ? {
      width: match.puzzle?.w,
      height: match.puzzle?.h,
      clueKeys: match.puzzle?.clueKeys,
      reservedKeys: match.puzzle?.reservedKeys,
      rightEdges: match.puzzle?.words?.filter(word => word.special === "RIGHT_EDGE_BOUNDARY").map(word => word.clueCell?.[0]),
      answersHaveClues: match.puzzle?.words?.every(word => !!word.clue?.trim() && Array.isArray(word.clueCell) && Array.isArray(word.cells))
    } : null;
  });
  expect(saved).not.toBeNull();
  expect(saved.width).toBe(8);
  expect(saved.height).toBe(12);
  expect(saved.clueKeys).toContain("0,1");
  expect(saved.reservedKeys).toEqual(["0,0"]);
  expect(saved.rightEdges).toEqual(Array.from({ length: 12 }, (_, row) => row));
  expect(saved.answersHaveClues).toBeTruthy();

  await page.evaluate(() => history.back());
  await expect(page.locator(".resume-match").first()).toBeVisible();
  await page.locator(".resume-match").first().click();
  await expect(page.locator(".game-screen")).toBeVisible();
  const board = page.locator(".scanword-board");
  await expect(board.locator(".scan-grid-cell")).toHaveCount(96);
  await expect(board.locator('.scan-clue[data-clue-cell$=",7"]')).toHaveCount(0);
  await expect(board.locator('.scan-grid-cell.cell[data-cell$=",7"]')).toHaveCount(12);
  expect(pageErrors).toEqual([]);
});
