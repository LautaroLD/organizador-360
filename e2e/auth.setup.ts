import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

// Credenciales de test desde variables de entorno
const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

/**
 * Script de setup para autenticación
 *
 * Este script se ejecuta una vez antes de los tests y guarda
 * el estado de autenticación para reutilizarlo en todos los tests.
 */
setup('authenticate', async ({ page }) => {
  // Validar que las credenciales estén configuradas
  setup.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'E2E_TEST_EMAIL y E2E_TEST_PASSWORD no configuradas. Se omite setup E2E de autenticación.',
  );

  // 1. Navegar a la página de login
  await page.goto('/auth', { waitUntil: 'networkidle' });

  // 2. Esperar a que el formulario esté visible
  await page.waitForSelector('form', { timeout: 15000 });

  // 3. Completar formulario de login usando placeholders
  const emailInput = page.getByPlaceholder('tu@email.com');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL!);

  const passwordInput = page.getByPlaceholder('••••••••');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(TEST_PASSWORD!);

  // 4. Hacer click en el botón de login
  const loginButton = page.getByRole('button', { name: 'Iniciar Sesión' });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });

  // Click y esperar a que las cookies de Supabase se establezcan
  const [response] = await Promise.all([
    // Esperar respuesta de autenticación de Supabase
    page.waitForResponse(
      (resp) => resp.url().includes('supabase') && resp.url().includes('token'),
      { timeout: 30000 },
    ),
    loginButton.click(),
  ]);

  // Verificar la respuesta de autenticación
  const status = response.status();

  if (status !== 200) {
    const body = await response.text();
    throw new Error(`Authentication failed with status ${status}: ${body}`);
  }

  // Verificar que la respuesta contiene access_token
  const responseBody = await response.json().catch(() => null);
  if (responseBody) {
    if (responseBody.error) {
      throw new Error(`Supabase auth error: ${responseBody.error}`);
    }
  }

  // 5. Esperar un momento para que las cookies se propaguen completamente
  await page.waitForTimeout(3000);

  // Verificar cookies antes de navegar
  const cookies = await page.context().cookies();
  const supabaseCookies = cookies.filter(
    (c) => c.name.includes('supabase') || c.name.includes('sb-'),
  );
  if (supabaseCookies.length === 0) {
    throw new Error('No se encontraron cookies de Supabase luego del login.');
  }

  // 6. Navegar manualmente al dashboard para verificar la autenticación.
  // networkidle puede fallar en apps con polling/realtime; usamos domcontentloaded y reintento.
  try {
    await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  } catch {
    await page.waitForTimeout(1000);
    await page.goto('/dashboard', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  // 7. Verificar que estamos en dashboard (no redirigidos a /auth)
  const currentUrl = page.url();

  if (currentUrl.includes('/auth')) {
    throw new Error(
      `Login did not persist. Redirected to: ${currentUrl}. Check if user exists in Supabase.`,
    );
  }

  // 8. Verificar que finalmente estamos en dashboard
  await expect(page).toHaveURL(/\/(dashboard|projects)/, { timeout: 15000 });

  // 9. Guardar el estado de autenticación
  await page.context().storageState({ path: authFile });
});

/*
 * CONFIGURACIÓN NECESARIA:
 *
 * 1. Crea un usuario de prueba en tu base de datos:
 *    - Email: test@example.com
 *    - Password: testpassword123
 *    (O usa las credenciales que prefieras)
 *
 * 2. Actualiza los selectores en este archivo si tu formulario
 *    de login tiene campos diferentes
 *
 * 3. Verifica que el redirect después del login sea a /dashboard
 *    o ajusta la línea waitForURL
 *
 * 4. Ejecuta: npm run test:e2e
 *    El setup se ejecutará automáticamente antes de los tests
 */
