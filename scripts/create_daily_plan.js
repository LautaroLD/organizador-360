// Script para crear un Plan de Suscripción Diario en Mercado Pago (PARA PRUEBAS)
// Ejecutar con: node scripts/create_daily_plan.js

require('dotenv').config({ path: '.env.local' }); // Intentar cargar de .env.local primero
require('dotenv').config({ path: '.env' });      // Fallback a .env

const { MercadoPagoConfig, PreApprovalPlan } = require('mercadopago');

// 1. Obtener Token
const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('❌ Error: No se encontró MP_ACCESS_TOKEN en las variables de entorno');
  process.exit(1);
}

// 2. Configurar Cliente
const client = new MercadoPagoConfig({ accessToken: accessToken });
const preapprovalPlan = new PreApprovalPlan(client);

// 3. Definir el Plan Diario (TEST)
const backUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
console.log('📍 Back URL configurada:', backUrl + '/dashboard');

const planData = {
  reason: 'Plan Pro Diario (TEST) - Veenzo',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'days', // <--- CAMBIO CLAVE: Frecuencia diaria
    transaction_amount: 100, // Monto seguro para pruebas ($100)
    currency_id: 'ARS',
    // billing_day no se recomienda para frecuencia diaria, lo quitamos
    billing_day_proportional: false,
    // Sin trial para que se cobre rapido o trial de 1 dia?
    // Si queremos probar el cobro, mejor sin trial o trial muy corto.
    // MercadoPago a veces requiere minimo de dias para trial.
    // Para probar la suscripción activa inmediata, quitamos el free_trial 
    // Si quieres probar el cambio de estado vencido, 1 dia está bien.
  },
  back_url: backUrl + '/dashboard',
  status: 'active'
};

async function createPlan() {
  try {
    console.log('⏳ Creando plan DIARIO en Mercado Pago...');
    const response = await preapprovalPlan.create({ body: planData });

    console.log('\n✅ ¡Plan Diario Creado Exitosamente!');
    console.log('--------------------------------------------------');
    console.log(`🆔 ID del Plan: ${response.id}`);
    console.log(`📝 Nombre: ${response.reason}`);
    console.log(`💰 Monto: ${response.auto_recurring.transaction_amount} ${response.auto_recurring.currency_id}`);
    console.log(`🔄 Frecuencia: Cada ${response.auto_recurring.frequency} días`);
    console.log('--------------------------------------------------');
    console.log('\n👉 AHORA: Actualiza tu archivo .env con:');
    console.log(`MP_PRO_PLAN_ID=${response.id}`);

  } catch (error) {
    console.error('❌ Error al crear el plan:');
    if (error.cause) {
      console.error(JSON.stringify(error.cause, null, 2));
    } else {
      console.error(error);
    }
  }
}

createPlan();
