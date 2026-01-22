import { GET } from '@/app/api/mercadopago/subscription-details/route';
import { createClient } from '@/lib/supabase/server';
import { preapproval } from '@/lib/mercadopago';

// Mock de Supabase y Mercado Pago
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/mercadopago');

// Mock de NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
    })),
  },
}));

describe('GET /api/mercadopago/subscription-details', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockPreapproval = preapproval as jest.Mocked<typeof preapproval>;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('should return 401 if user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'No autenticado' });
  });

  it('should return null details if user has no subscription in DB', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    
    // Mock user subscription query
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null }); // Sin suscripción

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    const response = await GET();
    const json = await response.json();

    expect(json).toEqual({
      hasSubscription: false,
      source: null,
      details: null,
    });
  });

  it('should return subscription details from Mercado Pago', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    // Mock DB subscription
    const mockSubscriptionDB = {
      mercadopago_subscription_id: 'sub-mp-123',
    };

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: mockSubscriptionDB });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    // Mock MP API response
    const mockMpResponse = {
      id: 'sub-mp-123',
      status: 'authorized',
      reason: 'Plan Pro',
      date_created: '2023-01-01T00:00:00.000Z',
      next_payment_date: '2023-02-01T00:00:00.000Z',
      auto_recurring: {
        transaction_amount: 1000,
        currency_id: 'ARS',
        frequency: 1,
        frequency_type: 'months',
        start_date: '2023-01-01T00:00:00.000Z',
        end_date: null,
      },
      summarized: {
        charged_quantity: 1,
        charged_amount: 1000,
      },
      payment_method_id: 'visa',
    };

    // @ts-expect-error Mocking MP response type which might not match exactly
    mockPreapproval.get.mockResolvedValue(mockMpResponse);

    const response = await GET();
    const json = await response.json();

    expect(json.hasSubscription).toBe(true);
    expect(json.source).toBe('mercadopago');
    expect(json.details.status).toBe('authorized');
    expect(json.details.statusLabel).toBe('Activa');
    expect(json.details.nextPaymentDate).toBe('2023-02-01T00:00:00.000Z');
  });

  it('should handle errors from Mercado Pago gracefully', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    // Mock DB subscription
    const mockSubscriptionDB = {
        mercadopago_subscription_id: 'sub-mp-123',
        status: 'active',
        current_period_start: '2023-01-01',
        current_period_end: '2023-02-01',
      };
  
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockSubscriptionDB });
  
      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

    mockPreapproval.get.mockRejectedValue(new Error('MP API Error'));

    const response = await GET();
    const json = await response.json();

    expect(json.hasSubscription).toBe(true);
    expect(json.source).toBe('database'); // Fallback a DB
    expect(json.details.id).toBe('sub-mp-123');
    expect(json.error).toBe('No se pudo obtener información actualizada de MercadoPago');
  });
});
