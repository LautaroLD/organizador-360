import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Customer, CustomerCard } from 'mercadopago';

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('MP_ACCESS_TOKEN is missing from environment variables');
}

export const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '',
  options: { timeout: 10000 }
});

export const preapproval = new PreApproval(client);
export const preapprovalPlan = new PreApprovalPlan(client);
export const customer = new Customer(client);
export const card = new CustomerCard(client);

export const PLANS = {
  PRO: {
    // Este ID debe ser generado una vez ejecutando un script o endpoint y copiado al .env o aquí
    // Para simplificar, asumimos que se pasa por env o se usa una constante
    id: process.env.MP_PRO_PLAN_ID, 
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 10000, // Ejemplo: $10,000 ARS
    currency_id: 'ARS',
    reason: 'Plan Pro Mensual'
  }
};
