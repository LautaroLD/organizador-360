/**
 * @jest-environment node
 */
import { POST } from '@/app/api/ia/agent/route';
import { createClient } from '@/lib/supabase/server';
import { ai } from '@/lib/gemini';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/gemini', () => ({
  ai: {
    models: {
      generateContent: jest.fn(),
    },
  },
}));

jest.mock('@/lib/subscriptionUtils', () => ({
  canUseAIFeatures: jest.fn().mockResolvedValue(true),
}));

describe('API Route: /api/ia/agent', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [] }),
      single: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      rpc: jest.fn().mockResolvedValue({
        data: {
          ok: true,
          charged: true,
          idempotent_replay: false,
          idempotency_key: 'test-request-id',
          action: 'agent_message',
          cost: 1,
          reason: null,
          remaining: 249,
          used: 1,
          quota: 250,
          cycle_start: null,
          cycle_end: null,
        },
        error: null,
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('debe retornar error 400 si falta projectId', async () => {
    const req = {
      json: async () => ({ message: 'Hola', history: [] }),
    } as unknown as NextRequest;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('debe procesar la solicitud correctamente y llamar a Gemini', async () => {
    const req = {
      json: async () => ({
        message: '¿Qué tareas tengo?',
        history: [],
        projectId: 'proj-1',
      }),
    } as unknown as NextRequest;

    mockSupabase.single.mockResolvedValue({
      data: { name: 'Test Project', description: 'Test Desc' },
    });
    mockSupabase.limit.mockResolvedValue({ data: [] });
    mockSupabase.maybeSingle.mockResolvedValue({ data: null });

    (ai.models.generateContent as jest.Mock).mockResolvedValue({
      text: 'Respuesta Simulada de Gemini',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(createClient).toHaveBeenCalled();
    expect(ai.models.generateContent).toHaveBeenCalled();
    expect(data.response).toBe('Respuesta Simulada de Gemini');
  });

  it('debe incluir estado de revisión, asignados y fechas en el contexto de Gemini', async () => {
    const req = {
      json: async () => ({
        message: '¿Qué tareas están pendientes de revisión?',
        history: [],
        projectId: 'proj-1',
        requestId: 'req-context-1',
      }),
    } as unknown as NextRequest;

    mockSupabase.single.mockResolvedValue({
      data: { name: 'Proyecto Review', description: 'Desc' },
    });

    mockSupabase.from.mockImplementation((table: string) => {
      const result = { data: [] as unknown };
      const chain: Record<string, unknown> = {};
      const api = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        in: jest.fn(() => chain),
        gte: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => Promise.resolve(result)),
        single: jest.fn(() => Promise.resolve(result)),
        maybeSingle: jest.fn(() => Promise.resolve(result)),
        then: (
          onfulfilled?: (value: unknown) => unknown,
          onrejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(onfulfilled, onrejected),
      };
      Object.assign(chain, api);

      if (table === 'projects') {
        result.data = { name: 'Proyecto Review', description: 'Desc' };
      } else if (table === 'tasks') {
        result.data = [
          {
            id: 'task-1',
            title: 'Entregar informe',
            description: 'Informe final del sprint',
            status: 'done',
            priority: 'alta',
            done_estimated_at: '2026-07-20',
            done_at: '2026-07-19',
            phase_roadmap_id: 10,
            epic_id: 'epic-1',
            assignments: [
              { user: { name: 'Ana', email: 'ana@test.com' } },
            ],
            tags: [{ tag: { label: 'docs' } }],
            checklist: [
              { content: 'Borrador', is_completed: true },
              { content: 'Revisión', is_completed: false },
            ],
          },
        ];
      } else if (table === 'approval_requests') {
        result.data = [
          {
            entity_type: 'task',
            entity_id: 'task-1',
            status: 'pending',
            request_note: 'Por favor revisá el informe',
            created_at: '2026-07-19T12:00:00Z',
            requester: { name: 'Ana', email: 'ana@test.com' },
            reviewer: { name: 'Luis', email: 'luis@test.com' },
          },
        ];
      } else if (table === 'epics') {
        result.data = [{ id: 'epic-1', title: 'Cierre de sprint' }];
      } else if (table === 'roadmap') {
        result.data = { id: 'road-1' };
      } else if (table === 'phase_roadmap') {
        result.data = [{ id: 10, name: 'Fase final' }];
      }

      return api;
    });

    (ai.models.generateContent as jest.Mock).mockResolvedValue({
      text: 'Hay 1 tarea pendiente de revisión',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.usedContext.pendingReviewCount).toBe(1);

    const geminiCall = (ai.models.generateContent as jest.Mock).mock.calls[0][0];
    const contextText = geminiCall.contents[0].parts[0].text as string;

    expect(contextText).toContain('Entregar informe');
    expect(contextText).toContain('Pendiente de revisión');
    expect(contextText).toContain('Ana');
    expect(contextText).toContain('Luis');
    expect(contextText).toContain('Cierre de sprint');
    expect(contextText).toContain('Fase final');
    expect(contextText).toContain('1/2');
    expect(geminiCall.config.systemInstruction).toContain(
      'Pendiente de revisión',
    );
  });

  it('debe manejar errores de Supabase o Gemini', async () => {
    const req = {
      json: async () => ({ message: 'Hola', projectId: 'proj-1' }),
    } as unknown as NextRequest;

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'DB Error' },
    });

    const res = await POST(req);
    await res.json();

    expect(res.status).toBe(404);
  });
});
