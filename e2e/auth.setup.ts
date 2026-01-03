import { test as setup } from '@playwright/test';
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
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });

  // 2. Esperar a que el formulario esté visible
  await page.waitForSelector('form', { timeout: 10000 });

  // 3. Completar formulario de login usando placeholders
  // IMPORTANTE: Usa credenciales de un usuario de prueba en tu BD
  const emailInput = page.getByPlaceholder('tu@email.com');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('lauttyd@gmail.com');
  
  const passwordInput = page.getByPlaceholder('••••••••');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill('cuenta123');

  // 4. Hacer click en el botón de login
  const loginButton = page.getByRole('button', { name: 'Iniciar Sesión' });
  await loginButton.waitFor({ state: 'visible', timeout: 10000 });
  await loginButton.click();

  // 5. Esperar a que la autenticación sea exitosa
  // Esto puede ser:
  // - Redirección a /dashboard
  // - Aparecer un elemento específico después del login
  // - Cambio en el localStorage/sessionStorage
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  
  // O alternativamente, espera por un elemento que solo aparece cuando estás autenticado:
  // await expect(page.getByText(/bienvenido|dashboard/i)).toBeVisible({ timeout: 10000 });

  // 5. Guardar el estado de autenticación
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
