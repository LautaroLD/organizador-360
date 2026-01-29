import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res_plans = await fetch('https://api.mercadopago.com/preapproval_plan/search?status=active', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      }
    });
    const plans = await res_plans.json();
console.log(plans);

const plan_free = {
          reason: 'free',
          status: 'active',
          subscribed: 0,
          back_url: '',
          auto_recurring: {
            frequency: 0,
            currency_id: 'ARS',
            transaction_amount: 0,
            frequency_type: 'forever',
          },
          collector_id: 0,
          init_point: '',
          date_created: new Date(),
          id: 'free',
          last_modified: new Date(),
          application_id: 0,

        }
const plan_pro_anual = plans.results.find((plan: {reason: string, auto_recurring: object, init_point: string, external_reference: string}) => plan.external_reference === 'PRO_ANUAL');
const plan_pro_mensual = plans.results.find((plan: {reason: string, auto_recurring: object, init_point: string, external_reference: string}) => plan.external_reference === 'PRO_MENSUAL');
    return NextResponse.json(
      [
        {
          reason: plan_pro_anual.reason,
          auto_recurring: plan_pro_anual.auto_recurring,
          init_point: plan_pro_anual.init_point,
          external_reference: plan_pro_anual.external_reference,
        },
        {
          reason: plan_pro_mensual.reason,
          auto_recurring: plan_pro_mensual.auto_recurring,
          init_point: plan_pro_mensual.init_point,
          external_reference: plan_pro_mensual.external_reference,
        }
    ]
    , { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}