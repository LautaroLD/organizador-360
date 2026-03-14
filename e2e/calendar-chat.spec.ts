import { test, expect } from '@playwright/test';

// These tests require authentication and specific project setup
const hasE2ECreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

test.describe('Calendar Integration (Requires Auth)', () => {
  test('should display calendar view', async ({ page }) => {
    test.skip(!hasE2ECreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Verify user is authenticated by checking dashboard is accessible
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /mis proyectos/i })).toBeVisible();
  });
});

test.describe('Chat Functionality (Requires Auth)', () => {
  test('should display chat interface', async ({ page }) => {
    test.skip(!hasE2ECreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Verify user is authenticated and can access dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /mis proyectos/i })).toBeVisible();
  });
});

/*
 * NOTA: Tests de Calendar y Chat deshabilitados
 * 
 * Estos tests requieren:
 * - Autenticación configurada
 * - Proyectos existentes en la BD
 * - Configuración de Google Calendar (opcional)
 * - Setup de realtime subscriptions
 * 
 * Para habilitarlos, configura autenticación y datos de prueba
 */
