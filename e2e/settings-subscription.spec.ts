import { test, expect } from '@playwright/test';
const hasE2ECreds = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

test.describe('Responsive Design', () => {
  test('should load in mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Page should load
    await expect(page).toHaveTitle(/Veenzo/i);
  });

  test('should load in tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Page should load and display content
    await expect(page).toHaveTitle(/Veenzo/i);
  });

  test('should load in desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Page should load
    await expect(page).toHaveTitle(/Veenzo/i);
  });
});

test.describe('Settings & Subscription (Requires Auth)', () => {
  test('should display settings page', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    // Use main role to get the page heading (not sidebar)
    await expect(
      page.getByRole('main').getByRole('heading', { name: /configuración/i }),
    ).toBeVisible();
  });

  test('should display subscription page', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await page.goto('/settings/subscription', {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: 'Planes y Suscripción', exact: true }),
    ).toBeVisible();
  });

  test('should show loading and success states in subscription checkout modal', async ({
    page,
  }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );

    await page.route('**/api/checkout/mercadopago', async (route) => {
      await page.waitForTimeout(1200);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'preapproval_e2e_mock',
          status: 'authorized',
        }),
      });
    });

    await page.route('**/api/mercadopago/sync-preapproval**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/settings/subscription', {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('button', { name: 'Actualizar plan' }).first().click();

    await expect(
      page.getByText('Completa tu pago con Card Payment Brick'),
    ).toBeVisible();
    await page.getByTestId('mp-mock-submit').click();

    await expect(page.getByText('Confirmando pago...')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Pago confirmado' }),
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: /Checkout/i })).toBeHidden({
      timeout: 7000,
    });
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
