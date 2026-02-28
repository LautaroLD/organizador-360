// Script para crear un USUARIO DE PRUEBA (Comprador)
// Ejecutar con: node scripts/create_test_buyer.js

require('dotenv').config({ path: '.env.local' });
// Fallback a .env si .env.local no funciona con path explícito en algunas configuraciones
require('dotenv').config({ path: '.env' });

const https = require('https');

const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
    console.error('❌ Error: No se encontró MP_ACCESS_TOKEN');
    process.exit(1);
}

console.log('--- CREANDO USUARIO DE PRUEBA (COMPRADOR) ---');

const data = JSON.stringify({
    "site_id": "MLA", // Argentina
    //"description": "Buyer for testing subscription"
});

const options = {
    hostname: 'api.mercadopago.com',
    path: '/users/test_user',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    }
};

const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const user = JSON.parse(responseBody);
            console.log('✅ Usuario de Prueba Creado Exitosamente:');
            console.log('------------------------------------------------');
            console.log(`📧 Email:    ${user.email}`); // test_user_...
            console.log(`🔑 Password: ${user.password}`); // password generado
            console.log(`👤 Nickname: ${user.nickname}`);
            console.log(`🆔 ID:       ${user.id}`);
            console.log('------------------------------------------------');
            console.log('INSTRUCCIONES:');
            console.log('1. Abre una ventana de INCOGNITO.');
            console.log('2. Inicia el proceso de pago/suscripción.');
            console.log('3. Cuando Mercado Pago pida login, usa ESTAS credenciales.');
            console.log('4. Luego usa una tarjeta de prueba (ej: visa terminada en 1111).');
        } else {
            console.error(`❌ Error creando usuario: ${res.statusCode}`);
            console.error(responseBody);
        }
    });
});

req.on('error', (error) => {
    console.error('Error de conexión:', error);
});

req.write(data);
req.end();