import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve(__dirname, '../../reports/screenshots');

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER CONSOLE: [${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER EXCEPTION: ${err.message}`));
});

test.describe('E2E Business Workflows & Visual Captures', () => {

  test.describe('Unauthenticated workflows', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Login page loads and captures screenshot', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#authOverlay')).toBeVisible();
      await page.screenshot({ path: path.join(screenshotDir, 'login_page.png') });
      await page.fill('#authUsername', 'salesexecutive');
      await page.fill('#authPassword', 'sales123');
      await page.click('#loginBtn');
      await expect(page.locator('#appShell')).toHaveClass(/auth-visible/);
    });
  });

  test.describe('Authenticated workflows', () => {
    test('Dashboard loads correctly and captures screenshot', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#appShell')).toHaveClass(/auth-visible/);
      await expect(page.locator('.brand-badge')).toContainText('SC');
      await expect(page.locator('#avatarBtn')).toContainText('admin', { ignoreCase: true });
      await page.screenshot({ path: path.join(screenshotDir, 'dashboard.png') });
    });

    test('Create enquiry form submit workflow', async ({ page }) => {
      await page.goto('/');

      await page.click('[data-nav="enquiry-form"]');
      await expect(page.locator('.page-title h2')).toContainText('Enquiry Form');

      // ✅ CHANGED: Use a simple test name instead of "Automated E2E Test"
      const testName = `Test User`;
      await page.fill('[name="customerName"]', testName);
      await page.selectOption('[name="enquirySource"]', 'Website');
      await page.fill('[name="phone"]', '9876543210');
      await page.fill('[name="modelName"]', 'R15');
      await page.fill('[name="email"]', 'e2e@test.com');
      await page.fill('[name="remarks"]', 'Automated QA pipeline check.');

      await page.screenshot({ path: path.join(screenshotDir, 'enquiry_form.png') });

      await page.click('#salesEnquiryForm button[type="submit"]');

      await expect(page.locator('.page-title h2')).toContainText('Sales Enquiries');

      const firstRowCustomer = page.locator('tbody tr:first-child td:nth-child(2)');
      await expect(firstRowCustomer).toContainText(testName);

      await page.screenshot({ path: path.join(screenshotDir, 'enquiries_table.png') });

      // ✅ CLEANUP: Auto-delete the test record after test passes
      const response = await page.request.get('/api/enquiries');
      const data = await response.json();
      const testRecord = data.find(e => e.customerName === testName);
      if (testRecord) {
        await page.request.delete(`/api/enquiries/${testRecord.id}`);
      }
    });

    test('Create appointment booking workflow', async ({ page }) => {
      await page.goto('/');

      await page.click('[data-nav="appointments"]');
      await page.click('button:has-text("Add Appointment")');
      await expect(page.locator('.page-title h2')).toContainText('New Appointment');

      const apptName = `Appt-${Date.now()}`;
      await page.fill('[name="apptCustomer"]', apptName);
      await page.fill('[name="apptVehicle"]', 'Fascino');
      await page.fill('[name="apptDate"]', '2026-07-20');
      await page.fill('[name="apptTime"]', '14:30');

      await page.screenshot({ path: path.join(screenshotDir, 'appointment_form.png') });

      await page.click('#appointmentForm button[type="submit"]');

      await expect(page.locator('.page-title h2')).toContainText('Appointment Booking');

      const firstRowCustomer = page.locator('tbody tr:first-child td:nth-child(2)');
      await expect(firstRowCustomer).toContainText(apptName);

      await page.screenshot({ path: path.join(screenshotDir, 'appointments_table.png') });
    });

    test('Search and filter functionality', async ({ page }) => {
      await page.goto('/');
      await page.click('[data-nav="sales-enquiries"]');
      await page.fill('#globalSearch', 'R15');
      await page.press('#globalSearch', 'Enter');
      await page.screenshot({ path: path.join(screenshotDir, 'search_filter_results.png') });
    });

    test('User logout flow resets authentication state', async ({ page }) => {
      await page.goto('/');
      await page.click('#avatarBtn');
      await page.click('#logoutBtn');
      await expect(page.locator('#authOverlay')).not.toHaveClass(/hidden/);
      await expect(page.locator('#appShell')).not.toHaveClass(/auth-visible/);
      await page.screenshot({ path: path.join(screenshotDir, 'logout_screen.png') });
    });
  });

  test.describe('Role restricted access workflows', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Access restricted routes redirects to Access Denied page', async ({ page }) => {
      await page.goto('/');
      await page.fill('#authUsername', 'salesexecutive');
      await page.fill('#authPassword', 'sales123');
      await page.click('#loginBtn');
      await expect(page.locator('#appShell')).toHaveClass(/auth-visible/);
      await page.evaluate(() => {
        window.location.hash = 'admin-controls';
      });
      await expect(page.locator('#pageRoot h2')).toContainText('403 Access Restricted');
      await page.screenshot({ path: path.join(screenshotDir, 'access_denied.png') });
    });
  });

});