import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should load in mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should load
    await expect(page).toHaveTitle(/Veenzo/i);
  });

  test('should load in tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Page should load and display content
    await expect(page).toHaveTitle(/Veenzo/i);
  });

  test('should load in desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // Page should load
    await expect(page).toHaveTitle(/Veenzo/i);
  });
});

test.describe('Settings & Subscription (Requires Auth)', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    // Use main role to get the page heading (not sidebar)
    await expect(page.getByRole('main').getByRole('heading', { name: /configuración/i })).toBeVisible();
  });

  test('should display subscription page', async ({ page }) => {
    await page.goto('/settings/subscription');
    await expect(page.getByRole('heading', { name: /suscripción/i })).toBeVisible();
  });
});

/*
 * NOTA: Tests de Settings y Subscription deshabilitados
 * 
 * Para habilitarlos:
 * - Configura autenticación
 * - Configura storageState
 * - Verifica que las rutas y selectores coincidan con tu UI
 */
