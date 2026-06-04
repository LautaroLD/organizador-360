/**
 * @jest-environment node
 */
import { POST } from '@/app/api/invitations/reject/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('API Route: /api/invitations/reject', () => {
  const originalEnv = process.env;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invitationResult: { data: any; error: any };
  const updateMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };

    invitationResult = {
      data: {
        id: 'inv-1',
        status: 'pending',
        expires_at: '2099-12-31T23:59:59.000Z',
        invite_type: 'email',
      },
      error: null,
    };

    updateMock.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    (createClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest
              .fn()
              .mockImplementation(async () => invitationResult),
          }),
        }),
        update: updateMock,
      }),
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('no debe invalidar invitaciones por link al rechazar', async () => {
    invitationResult = {
      data: {
        id: 'inv-link',
        status: 'pending',
        expires_at: '2099-12-31T23:59:59.000Z',
        invite_type: 'link',
      },
      error: null,
    };

    const req = {
      json: async () => ({ token: 'token-link' }),
    } as unknown as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('debe marcar como rechazada una invitacion por email pendiente', async () => {
    invitationResult = {
      data: {
        id: 'inv-email',
        status: 'pending',
        expires_at: '2099-12-31T23:59:59.000Z',
        invite_type: 'email',
      },
      error: null,
    };

    const req = {
      json: async () => ({ token: 'token-email' }),
    } as unknown as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('rejected');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' }),
    );
  });
});
