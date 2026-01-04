import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

// Credenciales de test desde variables de entorno
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword';

/**
 * Script de setup para autenticación
 * 
 * Este script se ejecuta una vez antes de los tests y guarda
 * el estado de autenticación para reutilizarlo en todos los tests.
 */
setup('authenticate', async ({ page }) => {
  // Validar que las credenciales estén configuradas
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    console.warn('[Warning] E2E_TEST_EMAIL or E2E_TEST_PASSWORD not set. Using default test credentials.');
  }

  // Capturar logs de consola para debug
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('auth') || msg.text().includes('supabase')) {
      console.log(`[Browser ${msg.type()}]: ${msg.text()}`);
    }
  });

  // Capturar respuestas de red para debug
  page.on('response', response => {
    if (response.url().includes('supabase') && response.url().includes('auth')) {
      console.log(`[Network] ${response.status()} ${response.url()}`);
    }
  });

  // 1. Navegar a la página de login
  await page.goto('/auth', { waitUntil: 'networkidle' });

  // 2. Esperar a que el formulario esté visible
  await page.waitForSelector('form', { timeout: 15000 });

  // 3. Completar formulario de login usando placeholders
  const emailInput = page.getByPlaceholder('tu@email.com');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL);
  
  const passwordInput = page.getByPlaceholder('••••••••');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(TEST_PASSWORD);

  // 4. Hacer click en el botón de login
  const loginButton = page.getByRole('button', { name: 'Iniciar Sesión' });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Click y esperar a que las cookies de Supabase se establezcan
  const [response] = await Promise.all([
    // Esperar respuesta de autenticación de Supabase
    page.waitForResponse(
      resp => resp.url().includes('supabase') && resp.url().includes('token'),
      { timeout: 30000 }
    ),
    loginButton.click(),
  ]);

  // Verificar la respuesta de autenticación
  const status = response.status();
  console.log(`[Auth Response] Status: ${status}`);
  
  if (status !== 200) {
    const body = await response.text();
    console.log(`[Auth Response] Error body: ${body}`);
    throw new Error(`Authentication failed with status ${status}: ${body}`);
  }

  // Verificar que la respuesta contiene access_token
  const responseBody = await response.json().catch(() => null);
  if (responseBody) {
    console.log(`[Auth Response] Has access_token: ${!!responseBody.access_token}`);
    console.log(`[Auth Response] Has user: ${!!responseBody.user}`);
    if (responseBody.error) {
      console.log(`[Auth Response] Error: ${responseBody.error}`);
      throw new Error(`Supabase auth error: ${responseBody.error}`);
    }
  }

  // 5. Esperar un momento para que las cookies se propaguen completamente
  await page.waitForTimeout(3000);

  // Verificar cookies antes de navegar
  const cookies = await page.context().cookies();
  const supabaseCookies = cookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'));
  console.log(`[Cookies] Found ${supabaseCookies.length} Supabase cookies`);
  supabaseCookies.forEach(c => console.log(`  - ${c.name}: ${c.value.substring(0, 20)}...`));

  // 6. Navegar manualmente al dashboard para verificar la autenticación
  await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });

  // 7. Verificar que estamos en dashboard (no redirigidos a /auth)
  const currentUrl = page.url();
  console.log(`[Navigation] Current URL after goto /dashboard: ${currentUrl}`);
  
  if (currentUrl.includes('/auth')) {
    // Si fuimos redirigidos a /auth, mostrar información de debug
    console.log('[Debug] Redirected to auth - authentication may have failed');
    
    // Verificar si hay algún toast de error visible
    const errorToast = page.locator('.Toastify__toast--error');
    if (await errorToast.isVisible().catch(() => false)) {
      const errorText = await errorToast.textContent();
      console.log(`[Debug] Error toast: ${errorText}`);
    }
    
    throw new Error(`Login did not persist. Redirected to: ${currentUrl}. Check if user exists in Supabase.`);
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
