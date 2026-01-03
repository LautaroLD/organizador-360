import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Script de setup para autenticación
 * 
 * Este script se ejecuta una vez antes de los tests y guarda
 * el estado de autenticación para reutilizarlo en todos los tests.
 */
setup('authenticate', async ({ page }) => {
  // 1. Navegar a la página de login
  await page.goto('/auth', { waitUntil: 'networkidle' });

  // 2. Esperar a que el formulario esté visible
  await page.waitForSelector('form', { timeout: 15000 });

  // 3. Completar formulario de login usando placeholders
  const emailInput = page.getByPlaceholder('tu@email.com');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('lauttyd@gmail.com');
  
  const passwordInput = page.getByPlaceholder('••••••••');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill('cuenta123');

  // 4. Hacer click en el botón de login
  const loginButton = page.getByRole('button', { name: 'Iniciar Sesión' });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Click y esperar a que las cookies de Supabase se establezcan
  await Promise.all([
    // Esperar respuesta de autenticación de Supabase
    page.waitForResponse(
      response => response.url().includes('supabase') && response.url().includes('token'),
      { timeout: 30000 }
    ),
    loginButton.click(),
  ]);

  // 5. Esperar un momento para que las cookies se propaguen completamente
  // El cliente de Supabase necesita tiempo para establecer las cookies en el navegador
  await page.waitForTimeout(2000);

  // 6. Navegar manualmente al dashboard para verificar la autenticación
  // En lugar de depender del router.push del lado del cliente
  await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });

  // 7. Verificar que estamos en dashboard (no redirigidos a /auth)
  const currentUrl = page.url();
  
  if (currentUrl.includes('/auth')) {
    // Si fuimos redirigidos a /auth, las cookies no se establecieron correctamente
    // Intentar una vez más con más tiempo de espera
    console.log('Redirected to auth, retrying with longer wait...');
    
    // Volver a hacer login
    await page.waitForSelector('form', { timeout: 15000 });
    await page.getByPlaceholder('tu@email.com').fill('lauttyd@gmail.com');
    await page.getByPlaceholder('••••••••').fill('cuenta123');
    
    await Promise.all([
      page.waitForResponse(
        response => response.url().includes('supabase') && response.url().includes('token'),
        { timeout: 30000 }
      ),
      page.getByRole('button', { name: 'Iniciar Sesión' }).click(),
    ]);
    
    // Esperar más tiempo para las cookies
    await page.waitForTimeout(3000);
    
    // Intentar navegar de nuevo
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
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
