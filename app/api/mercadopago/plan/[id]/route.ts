import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {
    const {id} = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID del plan no proporcionado' }, { status: 400 });
    }
    const res_plan = await fetch(`https://api.mercadopago.com/preapproval_plan/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      }
    });
    const plan = await res_plan.json();
    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    console.error('Error fetching MercadoPago plan:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}