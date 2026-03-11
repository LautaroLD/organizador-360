import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {
    const {id} = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID del plan no proporcionado' }, { status: 400 });
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Configuracion incompleta de Mercado Pago' }, { status: 500 });
    }

    const res_plan = await fetch(`https://api.mercadopago.com/preapproval_plan/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 300 },
    });

    if (!res_plan.ok) {
      const message = await res_plan.text();
      return NextResponse.json(
        {
          error: 'No se pudo obtener el plan desde Mercado Pago',
          details: message,
        },
        { status: res_plan.status }
      );
    }

    const plan = await res_plan.json();
    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    console.error('Error fetching MercadoPago plan:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}