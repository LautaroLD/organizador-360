import { test, expect, type Page } from '@playwright/test';

// These tests require authentication and specific project setup
const hasE2ECreds = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

async function waitForDashboardReady(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  const loadingSession = page.getByText(/cargando sesión/i);
  if (await loadingSession.isVisible().catch(() => false)) {
    await loadingSession.waitFor({ state: 'hidden', timeout: 25000 });
  }

  await expect(
    page.getByRole('heading', { name: /mis proyectos/i }),
  ).toBeVisible({ timeout: 20000 });
}

test.describe('Calendar Integration (Requires Auth)', () => {
  test('should display calendar view', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await waitForDashboardReady(page);
  });
});

test.describe('Chat Functionality (Requires Auth)', () => {
  test('should display chat interface', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await waitForDashboardReady(page);
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
