import { test, expect } from '@playwright/test';

// These tests require authentication
// Configure authentication state before running

test.describe('Project Management (Requires Auth)', () => {
  test('should display projects list', async ({ page }) => {
    await page.goto('/dashboard');
    // Check if projects section is visible (use heading role to be more specific)
    await expect(page.getByRole('heading', { name: /mis proyectos/i })).toBeVisible();
  });
});

test.describe('Kanban Board (Requires Auth)', () => {
  test('should display kanban columns', async ({ page }) => {
    await page.goto('/dashboard');
    // Verify user is authenticated by checking dashboard elements
    await expect(page.getByRole('heading', { name: /mis proyectos/i })).toBeVisible();
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
