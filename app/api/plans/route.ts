import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/plans
 *
 * Devuelve los IDs externos de cada plan por proveedor desde el catálogo interno.
 * El cliente usa esto para construir checkouts sin depender de variables de entorno.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('plan_provider_mappings')
      .select('provider, external_id, plans(code)');

    if (error) {
      console.error('Error fetching plan mappings:', error);
      return NextResponse.json(
        { error: 'Error obteniendo planes' },
        { status: 500 },
      );
    }
    const normalizePlanCode = (
      value: unknown,
    ): 'starter' | 'pro' | undefined => {
      const code = typeof value === 'string' ? value.toLowerCase() : '';
      if (code === 'starter' || code === 'pro') {
        return code;
      }
      return undefined;
    };

    const tierOrder: Record<'starter' | 'pro', number> = {
      starter: 0,
      pro: 1,
    };

    const groupByProvider = data.reduce(
      (
        acc: Record<
          string,
          {
            provider: string;
            external_id: string;
            plan_code?: 'starter' | 'pro';
          }[]
        >,
        item,
      ) => {
        const rawPlan = item.plans as
          | { code?: string }
          | { code?: string }[]
          | null;
        const nestedCode = Array.isArray(rawPlan)
          ? rawPlan[0]?.code
          : rawPlan?.code;

        const planCode = normalizePlanCode(nestedCode);

        (acc[item.provider] = acc[item.provider] || []).push({
          provider: item.provider,
          external_id: item.external_id,
          plan_code: planCode,
        });
        return acc;
      },
      {},
    );

    Object.values(groupByProvider).forEach((plans) => {
      plans.sort((a, b) => {
        const aOrder = a.plan_code
          ? tierOrder[a.plan_code]
          : Number.MAX_SAFE_INTEGER;
        const bOrder = b.plan_code
          ? tierOrder[b.plan_code]
          : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    });

    return NextResponse.json(groupByProvider, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
