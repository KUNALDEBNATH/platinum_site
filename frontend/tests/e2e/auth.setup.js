import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/');

  // Enter admin credentials
  await page.fill('#authUsername', 'admin');
  await page.fill('#authPassword', 'admin123');
  await page.click('#loginBtn');

  // Verify dashboard loaded (shell becomes visible)
  await expect(page.locator('#appShell')).toHaveClass(/auth-visible/);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
