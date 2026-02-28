// Script para crear un Plan de Suscripción en Mercado Pago
// Ejecutar con: node scripts/create_plan.js

require('dotenv').config({ path: '.env' }); // Cargar variables de entorno si tienes dotenv instalado, sino, pasar token manual

const { MercadoPagoConfig, PreApprovalPlan } = require('mercadopago');

// 1. Obtener Token
const accessToken = process.env.MP_ACCESS_TOKEN;

if (!accessToken) {
  console.error('❌ Error: No se encontró MP_ACCESS_TOKEN en las variables de entorno (.env.local)');
  console.log('👉 Asegúrate de tener MP_ACCESS_TOKEN configurado o edita este script para pegarlo directamente.');
  process.exit(1);
}

// 2. Configurar Cliente
const client = new MercadoPagoConfig({ accessToken: accessToken });
const preapprovalPlan = new PreApprovalPlan(client);

// 3. Definir el Plan
// Usar la variable de entorno NEXT_PUBLIC_APP_URL para el back_url
const backUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
console.log('📍 Back URL configurada:', backUrl + '/dashboard');

const planData = {
  reason: 'Plan Pro - Veenzo',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 2000, // $2,000 ARS
    currency_id: 'ARS', // Moneda (ARS, BRL, MXN, etc.)
    billing_day: 10,
    billing_day_proportional: true,
    free_trial: {
      frequency: 1,
      frequency_type: "months"
    },
  },
  back_url: backUrl + '/dashboard', // URL a donde vuelve el usuario después del pago
  status: 'active'
};

async function createPlan() {
  try {
    console.log('⏳ Creando plan en Mercado Pago...');
    const response = await preapprovalPlan.create({ body: planData });

    console.log('\n✅ ¡Plan Creado Exitosamente!');
    console.log('--------------------------------------------------');
    console.log(`🆔 ID del Plan: ${response.id}`);
    console.log(`📝 Nombre: ${response.reason}`);
    console.log(`💰 Monto: ${response.auto_recurring.transaction_amount} ${response.auto_recurring.currency_id}`);
    console.log('--------------------------------------------------');
    console.log('\n👉 AHORA: Copia el ID del Plan y agrégalo a tu archivo .env.local:');
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
