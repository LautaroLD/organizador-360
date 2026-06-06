import { SupabaseClient } from '@supabase/supabase-js';

export type AICreditAction =
  | 'agent_message'
  | 'task_description'
  | 'task_suggestions'
  | 'chat_summary'
  | 'resource_analyze'
  | 'project_insights';

export const AI_CREDIT_COSTS: Record<AICreditAction, number> = {
  agent_message: 1,
  task_description: 1,
  task_suggestions: 2,
  chat_summary: 2,
  resource_analyze: 2,
  project_insights: 3,
};

export type ConsumeAICreditsResult = {
  ok: boolean;
  charged: boolean;
  idempotent_replay: boolean;
  idempotency_key: string;
  action: string;
  cost: number;
  reason: string | null;
  remaining: number;
  used: number;
  quota: number;
  cycle_start: string | null;
  cycle_end: string | null;
};

export class AICreditError extends Error {
  code: 'PRO_REQUIRED' | 'INSUFFICIENT_CREDITS' | 'UNKNOWN';
  status: number;
  details?: ConsumeAICreditsResult;

  constructor(
    code: 'PRO_REQUIRED' | 'INSUFFICIENT_CREDITS' | 'UNKNOWN',
    message: string,
    status: number,
    details?: ConsumeAICreditsResult,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeConsumeResult = (value: unknown): ConsumeAICreditsResult => {
  if (!isRecord(value)) {
    throw new AICreditError(
      'UNKNOWN',
      'Respuesta inválida de consumo de créditos',
      500,
    );
  }

  return {
    ok: Boolean(value.ok),
    charged: Boolean(value.charged),
    idempotent_replay: Boolean(value.idempotent_replay),
    idempotency_key: String(value.idempotency_key ?? ''),
    action: String(value.action ?? ''),
    cost: Number(value.cost ?? 0),
    reason: value.reason === null ? null : String(value.reason ?? null),
    remaining: Number(value.remaining ?? 0),
    used: Number(value.used ?? 0),
    quota: Number(value.quota ?? 0),
    cycle_start: value.cycle_start ? String(value.cycle_start) : null,
    cycle_end: value.cycle_end ? String(value.cycle_end) : null,
  };
};

export async function consumeAICredits(
  supabase: SupabaseClient,
  args: {
    userId: string;
    action: AICreditAction;
    projectId?: string | null;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ConsumeAICreditsResult> {
  const creditCost = AI_CREDIT_COSTS[args.action];

  const { data, error } = await supabase.rpc('consume_ai_credits', {
    p_user_id: args.userId,
    p_action: args.action,
    p_credit_cost: creditCost,
    p_project_id: args.projectId ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_metadata: args.metadata ?? {},
  });

  if (error) {
    const message = (error.message || '').toUpperCase();
    if (message.includes('PRO_REQUIRED')) {
      throw new AICreditError(
        'PRO_REQUIRED',
        'Esta función está disponible solo para plan Pro.',
        403,
      );
    }

    throw new AICreditError(
      'UNKNOWN',
      error.message || 'Error consumiendo créditos IA',
      500,
    );
  }

  const result = normalizeConsumeResult(data);

  if (!result.ok && result.reason === 'INSUFFICIENT_CREDITS') {
    throw new AICreditError(
      'INSUFFICIENT_CREDITS',
      'No tienes créditos suficientes para esta acción.',
      402,
      result,
    );
  }

  if (!result.ok) {
    throw new AICreditError(
      'UNKNOWN',
      'No fue posible consumir créditos IA.',
      500,
      result,
    );
  }

  return result;
}

export async function getAICreditStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  can_use_ai: boolean;
  plan_tier: string;
  quota: number;
  used: number;
  remaining: number;
  cycle_start: string | null;
  cycle_end: string | null;
}> {
  const { data, error } = await supabase.rpc('get_ai_credit_status', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Error obteniendo estado de créditos IA');
  }

  if (!isRecord(data)) {
    throw new Error('Respuesta inválida de estado de créditos IA');
  }

  return {
    can_use_ai: Boolean(data.can_use_ai),
    plan_tier: String(data.plan_tier ?? 'free'),
    quota: Number(data.quota ?? 250),
    used: Number(data.used ?? 0),
    remaining: Number(data.remaining ?? 0),
    cycle_start: data.cycle_start ? String(data.cycle_start) : null,
    cycle_end: data.cycle_end ? String(data.cycle_end) : null,
  };
}
