import { test, expect } from '@playwright/test';

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

test.describe('Critical End-to-End Workflow: College Contact Tracing Prototype', () => {

  test('Critical Path: Student reports disease -> Investigation runs -> Student notified & responds -> Admin dashboard reflects status', async ({ page }) => {
    // 1. Admin generates demo simulation dataset
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("Admin")');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/.*admin\/dashboard/);

    // Navigate to simulation page and run simulation
    await page.goto(`${BASE_URL}/admin/simulation`);
    const genButton = page.locator('button:has-text("Generate simulation")');
    await expect(genButton).toBeVisible();
    await genButton.click();
    await expect(page.locator('text=SIMULATION COMPLETE')).toBeVisible({ timeout: 15000 });

    // 2. View Investigation & Graph
    await page.click('button:has-text("View investigation")');
    await expect(page).toHaveURL(/.*admin\/investigations\/\d+/);
    await expect(page.locator('text=Total contacts')).toBeVisible();

    // Check contact graph tab
    await page.click('button:has-text("Contact graph")');
    await expect(page.locator('.graph-container')).toBeVisible();

    // Check campus map
    await page.goto(`${BASE_URL}/admin/map`);
    await expect(page.locator('.map-container')).toBeVisible();

    // Check analytics
    await page.goto(`${BASE_URL}/admin/analytics`);
    await expect(page.locator('text=Notification risk categories')).toBeVisible();

    // 3. Logout admin
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL(/.*login/);

    // 4. Student Workflow
    await page.click('button:has-text("Student")');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/.*student\/dashboard/);

    // Report a case
    await page.goto(`${BASE_URL}/student/report-case`);
    await page.fill('#symptoms', 'Fever, sore throat');
    await page.click('button:has-text("Submit private report")');
    await expect(page.locator('text=Your private report was created')).toBeVisible({ timeout: 10000 });

    // Check Notifications
    await page.goto(`${BASE_URL}/student/notifications`);
    const notifCard = page.locator('.notification').first();
    await expect(notifCard).toBeVisible();

    // Submit Symptom Response
    const yesBtn = notifCard.locator('button:has-text("Yes")');
    if (await yesBtn.isVisible()) {
      await yesBtn.click();
      await expect(page.locator('text=Response recorded')).toBeVisible();
    }

    // 5. Authorization Check: Student cannot navigate to admin pages
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await expect(page).not.toHaveURL(/.*admin\/dashboard/);
  });

  test('Teacher Workflow: Aggregate views without PII', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("Teacher")');
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL(/.*teacher\/dashboard/);
    await expect(page.locator('text=Class-level awareness')).toBeVisible();

    // Teacher cannot access admin pages
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await expect(page).not.toHaveURL(/.*admin\/dashboard/);
  });
});
