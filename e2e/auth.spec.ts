import { test, expect } from '@playwright/test';

// Estos tests NO deben usar autenticación
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Home Page', () => {
  test('should display home page with features', async ({ page }) => {
    await page.goto('/');
    
    // Check if page loaded
    await expect(page).toHaveTitle(/Veenzo/i);
    
    // Check for features section
    await expect(page.getByText(/Chat en Tiempo Real/i)).toBeVisible();
    await expect(page.getByText(/Gestión de Proyectos/i)).toBeVisible();
  });

  test('should have navigation button', async ({ page }) => {
    await page.goto('/');
    
    // Look for login/signup button (it's a button, not a link)
    // Use .first() since there are multiple buttons with "Comenzar"
    const button = page.getByRole('button', { name: /iniciar sesión|comenzar/i }).first();
    await expect(button).toBeVisible();
  });
});

test.describe('Auth Page', () => {
  test('should navigate to auth page', async ({ page }) => {
    await page.goto('/auth');
    
    // Should be on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should display auth form', async ({ page }) => {
    await page.goto('/auth');
    
    // Check for form elements using exact placeholders
    const emailInput = page.getByPlaceholder('tu@email.com');
    const passwordInput = page.getByPlaceholder('••••••••');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });
});

// Note: Tests that require authentication are commented out
// Uncomment and configure authentication state when needed
/*
test.describe('Authenticated User Flow', () => {
  test.use({
    storageState: 'e2e/.auth/user.json',
  });

  test('should access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
*/
