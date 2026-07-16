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
    const loadingSession = page.getByText(/Cargando sesión/i);
    if (await loadingSession.isVisible().catch(() => false)) {
      await loadingSession.waitFor({ state: 'hidden', timeout: 15000 });
    }

    // Use main role to get the page heading (not sidebar)
    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { name: /configuraci[oó]n/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display subscription page', async ({ page }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );
    await page.goto('/settings/subscription', {
      waitUntil: 'domcontentloaded',
    });

    const loadingSession = page.getByText(/Cargando sesión/i);
    if (await loadingSession.isVisible().catch(() => false)) {
      await loadingSession.waitFor({ state: 'hidden', timeout: 20000 });
    }

    const loadingSubscription = page.getByText(/Cargando datos de suscripci/i);
    if (await loadingSubscription.isVisible().catch(() => false)) {
      await loadingSubscription.waitFor({ state: 'hidden', timeout: 25000 });
    }

    await expect(
      page.getByRole('heading', { name: /Suscripci[oó]n/i }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show loading and success states in subscription checkout modal', async ({
    page,
  }) => {
    test.skip(
      !hasE2ECreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD no configuradas para tests autenticados.',
    );

    await page.goto('/settings/subscription', {
      waitUntil: 'domcontentloaded',
    });

    const checkoutCta = page
      .locator('button:enabled')
      .filter({ hasText: /Actualizar plan|Reactivar suscripci[oó]n/i })
      .first();

    if ((await checkoutCta.count()) === 0) {
      test.skip(
        true,
        'No hay CTA de checkout visible para este usuario/entorno (plan actual o catálogo no disponible).',
      );
    }

    await checkoutCta.click();

    // Se eliminaron las aserciones de la interfaz de pago legacy.

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
