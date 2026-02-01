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

    // Mock Supabase chain
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
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
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
        projectId: 'proj-1' 
      }),
    } as unknown as NextRequest;

    // Mock responses for Supabase queries
    mockSupabase.single.mockResolvedValue({ data: { name: 'Proyecto Test', description: 'Desc' } }); // Project
    
    // We need to return specific data for the Promise.all array destructuring
    // 1. Tasks, 2. Messages, 3. Members, 4. Resources, 5. Events
    // But since `from` returns `this`, we can't easily distinguish calls unless we use `mockImplementationOnce` on the chain terminator.
    // However, the Promise.all calls execute in parallel.
    // Simplifying the mock for all queries to return empty arrays/nulls for now, except the project
    
    // NOTE: Testing parallel supabase queries is tricky with a single mock object instance if calls are not sequential.
    // But typically the same `mockSupabase` object is reused.
    // Let's rely on `mockImplementation` returning a promise that resolves to data.
    
    // Mocking the specific results for the Promise.all
    // The code does:
    // const [tasksResult, messagesResult, membersResult, resourcesResult, eventsResult] = await Promise.all([...])
    
    // We can just make every `.limit()` or terminator return a default structure.
    // But wait, `single()` is called first for project.
    
    // Let's refine the mock.
    mockSupabase.single.mockResolvedValue({ data: { name: 'Test Project', description: 'Test Desc' } });
    
    // For the list queries (limit, order, etc), we need to ensure they return { data: [] }
    // Since `limit` is the last call in the chain for most of them.
    mockSupabase.limit.mockResolvedValue({ data: [] });
    // For messages (which might not have limit if channelIds is empty), handle that case. 
    // Actually the code handles channelIds check. 
    
    // Mock Gemini Response
    (ai.models.generateContent as jest.Mock).mockResolvedValue({
      text: 'Respuesta Simulada de Gemini',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(createClient).toHaveBeenCalled();
    expect(ai.models.generateContent).toHaveBeenCalled();
    expect(data.response).toBe('Respuesta Simulada de Gemini');
  });

  it('debe manejar errores de Supabase o Gemini', async () => {
     const req = {
      json: async () => ({ message: 'Hola', projectId: 'proj-1' }),
    } as unknown as NextRequest;

    // Mock project error
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'DB Error' } });

    const res = await POST(req);
    await res.json(); // Consumir promesa pero no asignar si no se usa

    // If project not found devuelve 404
    expect(res.status).toBe(404);
  });
});
