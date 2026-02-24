const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');

// Cargar .env.local
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const accessToken = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

console.log('--- TEST DE CONECTIVIDAD Y PERTENENCIA ---');

if (!accessToken) {
  console.error('❌ Falta MP_ACCESS_TOKEN');
  process.exit(1);
}

// 1. Obtener información del usuario dueño del Access Token
const options = {
  hostname: 'api.mercadopago.com',
  path: '/users/me',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const user = JSON.parse(data);
      console.log(`✅ Access Token válido.`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Nickname: ${user.nickname}`);
      console.log(`   Sandbox Mode: ${user.tags?.includes('test_user') ? 'SI' : 'NO'}`);

      console.log('\n--- VERIFICACIÓN DE PUBLIC KEY ---');
      console.log(`Public Key configurada: ${publicKey}`);
      console.log('⚠️  No podemos validar programáticamente que la Public Key pertenezca a este mismo User ID.');
      console.log('   POR FAVOR, ve a tu panel de Mercado Pago Developers:');
      console.log('   1. Selecciona la aplicación.');
      console.log('   2. Ve a "Credenciales de prueba".');
      console.log('   3. Verifica que AMBAS coincidan con las de tu .env.local:');
      console.log(`      -> Access Token: ${accessToken.substring(0, 10)}...`);
      console.log(`      -> Public Key:   ${publicKey.substring(0, 10)}...`);

      if (publicKey.startsWith('TEST-') && accessToken.startsWith('TEST-')) {
        console.log('\n✅ Ambas tienen prefijo TEST-. Pero DEBEN ser de la misma App.');
      }
    } else {
      console.log(`❌ Error al validar Access Token: ${res.statusCode} ${res.statusMessage}`);
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error de conexión: ${e.message}`);
});

req.end();