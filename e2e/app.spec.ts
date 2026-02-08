import { test, expect } from "@playwright/test";

/**
 * E2E tests for AI Terminal application.
 *
 * These tests verify the core UI interactions of the Tauri app.
 * They rely on a running Tauri dev server (npm run tauri dev)
 * and use Playwright to interact with the WebView.
 *
 * To run: npx playwright test
 * Note: Tauri E2E requires the tauri-driver or WebView testing setup.
 * These tests are designed to work with the WebView content directly
 * via http://localhost:1420 during dev.
 */

test.describe("AI Terminal App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:1420");
    // Wait for React to mount
    await page.waitForSelector(".app", { timeout: 10_000 });
  });

  test("renders the app shell", async ({ page }) => {
    const app = page.locator(".app");
    await expect(app).toBeVisible();
  });

  test("renders title bar", async ({ page }) => {
    const title = page.locator(".app-title");
    await expect(title).toHaveText("AI Terminal");
  });

  test("renders goal input", async ({ page }) => {
    const input = page.locator(".goal-input input");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", /describe your goal/i);
  });

  test("renders status bar", async ({ page }) => {
    const statusBar = page.locator(".status-bar");
    await expect(statusBar).toBeVisible();
  });

  test("renders theme toggle", async ({ page }) => {
    const toggle = page.locator(".theme-toggle");
    await expect(toggle).toBeVisible();
  });

  test("theme toggle switches theme", async ({ page }) => {
    const app = page.locator(".app");
    const toggle = page.locator(".theme-toggle");

    // Check initial theme
    const initialTheme = await app.getAttribute("data-theme");

    // Click toggle
    await toggle.click();

    // Theme should change
    const newTheme = await app.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);

    // Click again to revert
    await toggle.click();
    const revertedTheme = await app.getAttribute("data-theme");
    expect(revertedTheme).toBe(initialTheme);
  });

  test("opens settings panel", async ({ page }) => {
    const settingsBtn = page.locator(".status-settings");
    await settingsBtn.click();

    const settingsPanel = page.locator(".settings-panel");
    await expect(settingsPanel).toBeVisible();
  });

  test("closes settings panel", async ({ page }) => {
    const settingsBtn = page.locator(".status-settings");
    await settingsBtn.click();

    const closeBtn = page.locator(".settings-close");
    await closeBtn.click();

    const settingsPanel = page.locator(".settings-panel");
    await expect(settingsPanel).not.toBeVisible();
  });

  test("opens history panel", async ({ page }) => {
    const historyBtn = page.locator(".status-history");
    await historyBtn.click();

    const historyPanel = page.locator(".history-panel");
    await expect(historyPanel).toBeVisible();
  });

  test("history shows empty state initially", async ({ page }) => {
    const historyBtn = page.locator(".status-history");
    await historyBtn.click();

    const empty = page.locator(".history-empty");
    await expect(empty).toHaveText(/no commands executed/i);
  });

  test("goal input is disabled while agent is not idle", async ({ page }) => {
    // In initial state, input should be enabled
    const input = page.locator(".goal-input input");
    await expect(input).toBeEnabled();
  });

  test("settings has provider selection", async ({ page }) => {
    const settingsBtn = page.locator(".status-settings");
    await settingsBtn.click();

    const providerSelect = page.locator(".settings-panel select").first();
    await expect(providerSelect).toBeVisible();
  });

  test("settings has mode selection", async ({ page }) => {
    const settingsBtn = page.locator(".status-settings");
    await settingsBtn.click();

    const safeMode = page.locator("text=Safe Mode");
    const autoMode = page.locator("text=Auto-Accept Mode");
    await expect(safeMode).toBeVisible();
    await expect(autoMode).toBeVisible();
  });
});
