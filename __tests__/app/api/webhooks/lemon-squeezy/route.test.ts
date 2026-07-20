/**
 * @jest-environment node
 */

import crypto from 'crypto';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockUpsert = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { POST } from '@/app/api/webhooks/lemon-squeezy/route';

const WEBHOOK_SECRET = 'test-secret';

function signBody(body: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function buildPayload(overrides?: {
  variant_id?: number | string | null;
  event_name?: string;
}) {
  return {
    meta: {
      event_name: overrides?.event_name ?? 'subscription_created',
      custom_data: {
        user_id: '11111111-1111-4111-8111-111111111111',
      },
    },
    data: {
      id: 'sub_123',
      attributes: {
        status: 'active',
        variant_id:
          overrides && 'variant_id' in overrides
            ? overrides.variant_id
            : 1773666,
        product_id: 999,
        customer_id: 1,
        order_id: 2,
        renews_at: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        cancelled: false,
      },
    },
  };
}

describe('Lemon Squeezy webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: mockSelect,
          upsert: mockUpsert,
        };
      }
      return {
        select: mockSelect,
      };
    });
  });

  it('resuelve plan por variant_id y persiste lemon_squeezy_variant_id', async () => {
    mockRpc.mockResolvedValue({
      data: {
        plan_id: 'plan-pro-id',
        code: 'pro',
        limits: {},
        features: [],
      },
      error: null,
    });

    const payload = buildPayload();
    const body = JSON.stringify(payload);
    const req = new Request('http://localhost/api/webhooks/lemon-squeezy', {
      method: 'POST',
      body,
      headers: { 'x-signature': signBody(body) },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith('get_plan_by_variant', {
      p_provider: 'lemon_squeezy',
      p_variant_id: '1773666',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-pro-id',
        plan_tier: 'pro',
        lemon_squeezy_variant_id: '1773666',
        lemon_squeezy_subscription_id: 'sub_123',
      }),
      { onConflict: 'user_id' },
    );
  });

  it('rechaza variant_id desconocido', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const payload = buildPayload({ variant_id: 999999 });
    const body = JSON.stringify(payload);
    const req = new Request('http://localhost/api/webhooks/lemon-squeezy', {
      method: 'POST',
      body,
      headers: { 'x-signature': signBody(body) },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
