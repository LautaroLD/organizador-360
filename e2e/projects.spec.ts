import { test, expect, type Page } from '@playwright/test';

// These tests require authentication
// Configure authentication state before running
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

test.describe('Project Management (Requires Auth)', () => {
  test('should display projects list', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await waitForDashboardReady(page);
  });
});

test.describe('Kanban Board (Requires Auth)', () => {
  test('should display kanban columns', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await waitForDashboardReady(page);
    // Note: Can't test actual kanban without creating a project first
  });
});

/*
 * NOTA: Estos tests están deshabilitados porque requieren:
 * 1. Usuario autenticado
 * 2. Datos de test en la base de datos
 * 3. Configuración de storageState
 *
 * Para habilitarlos:
 * 1. Crea un script de setup que autentique un usuario
 * 2. Guarda el estado en e2e/.auth/user.json
 * 3. Crea datos de prueba (proyectos, tareas)
 * 4. Cambia test.describe.skip a test.describe
 */
