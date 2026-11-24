const { test, expect } = require("@playwright/test");

test("Quantum-AI restores the prompt and refreshes the balance after a failed turn", async ({ page }) => {
  let balanceCalls = 0;
  await page.route("https://quantum-ai-chat-api.qq-ai-cloud.workers.dev/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/health") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (url.pathname === "/api/balance") {
      balanceCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          quota: { used: 0, reserved: 0, remaining: 10000, limit: 10000, resetsAt: "2026-11-24T00:00:00Z" }
        })
      });
    }
    if (url.pathname === "/api/chat") {
      return route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ error: "Модель не ответила за 30 сек. Нейроны за неудачный запрос не списаны." })
      });
    }
    return route.fulfill({ status: 404, body: "Not found" });
  });

  await page.goto("/");
  await page.evaluate(() => {
    document.body.innerHTML = '<main id="quantum-ai-test"></main>';
    const root = document.querySelector("#quantum-ai-test");
    root.innerHTML = window.QQQuantumAI.markup();

    const user = {
      id: "8b90b6c7-1e36-4fd5-8a6c-123456789012",
      email: "test@example.com",
      email_confirmed_at: "2026-11-22T00:00:00Z"
    };
    const session = { access_token: "test-session-token", user };
    const supabase = {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        }
      }
    };
    window.QQQuantumAI.bind({ supabase, userId: user.id });
  });

  await expect(page.locator("#qqQuantumStatus")).toHaveText("В сети");
  await expect(page.locator(".qq-quantum-quota-note")).toContainText("временно резервируются");
  await page.locator("#qqQuantumPrompt").fill("Напиши сочинение на тему как я провёл лето.");
  await page.locator("#qqQuantumSend").click();

  await expect(page.locator("#qqQuantumError")).toBeVisible();
  await expect(page.locator("#qqQuantumError")).toContainText("Нейроны за неудачный запрос не списаны");
  await expect(page.locator("#qqQuantumPrompt")).toHaveValue("Напиши сочинение на тему как я провёл лето.");
  await expect(page.locator("#qqQuantumStatus")).toHaveText("В сети");
  await expect(page.locator("#qqQuantumQuota")).toContainText("10 000 / 10 000");
  expect(balanceCalls).toBe(2);
  await expect(page.locator(".qq-quantum-message.is-user")).toHaveCount(0);
});
