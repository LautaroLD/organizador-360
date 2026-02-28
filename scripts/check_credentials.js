const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Intentar cargar .env.local
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  // Cargar en process.env para que esté disponible
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else {
  console.log('⚠️ No se encontró .env.local, revisando variables de entorno del sistema...');
}

const accessToken = process.env.MP_ACCESS_TOKEN || '';
const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '';

console.log('\n--- VERIFICACIÓN DE CREDENCIALES MERCADO PAGO ---');
console.log(`📍 Archivo leído: ${fs.existsSync(envPath) ? '.env.local' : 'Variables de sistema'}`);

const atPrefix = accessToken.substring(0, 8);
const pkPrefix = publicKey.substring(0, 8);

console.log(`🔑 MP_ACCESS_TOKEN (Backend):        ${atPrefix}...  [${getEnvName(accessToken)}]`);
console.log(`🔑 NEXT_PUBLIC_MP_PUBLIC_KEY (Front): ${pkPrefix}...  [${getEnvName(publicKey)}]`);

function getEnvName(key) {
  if (!key) return 'VACÍO';
  if (key.startsWith('TEST-')) return 'SANDBOX/TEST';
  if (key.startsWith('APP_USR-')) return 'PRODUCCIÓN';
  return 'DESCONOCIDO';
}

console.log('\n--- DIAGNÓSTICO ---');
if (!accessToken || !publicKey) {
  console.log('❌ FALTAN CREDENCIALES. Verifica tu archivo .env.local');
} else if (getEnvName(accessToken) !== getEnvName(publicKey)) {
  console.log('❌ ERROR DE ENTORNO CRUZADO (MISMATCH):');
  console.log('   El Backend y el Frontend están en entornos diferentes.');
  console.log('   Esto causa el error "Card token service not found" (404).');
  console.log('   SOLUCIÓN: Asegúrate de que ambas credenciales sean TEST o ambas PROD.');
} else {
  console.log('✅ Credenciales alineadas correctamente.');
  console.log('   Si sigues teniendo errores, verifica que ambas pertenezcan a la MISMA cuenta de Mercado Pago.');
}
console.log('--------------------------------------------------\n');
