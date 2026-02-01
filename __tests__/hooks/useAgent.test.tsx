import { renderHook, act } from '@testing-library/react';
import { useAgent } from '@/hooks/useAgent';

// Mock del store
const mockUseProjectStore = jest.fn();
jest.mock('@/store/projectStore', () => ({
  useProjectStore: () => mockUseProjectStore(),
}));

describe('useAgent Hook', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = jest.fn();
    // Silenciar console.error para pruebas de errores
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProjectStore.mockReturnValue({
      currentProject: { id: 'project-123' },
    });
  });

  it('debe iniciar con estado inicial correcto', () => {
    const { result } = renderHook(() => useAgent());
    expect(result.current.loading).toBe(false);
    expect(result.current.response).toBeNull();
  });

  it('debe realizar una consulta al agente correctamente', async () => {
    const mockResponse = { response: 'Respuesta del agente' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockResponse,
      ok: true,
    });

    const { result } = renderHook(() => useAgent());

    let answer;
    await act(async () => {
      answer = await result.current.askAgent('Hola agente');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.response).toBe('Respuesta del agente');
    expect(answer).toBe('Respuesta del agente');
    expect(global.fetch).toHaveBeenCalledWith('/api/ia/agent', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        message: 'Hola agente',
        history: undefined,
        projectId: 'project-123',
      }),
    }));
  });

  it('debe manejar errores en la consulta', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ error: 'Error del servidor' }),
      ok: true,
    });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      try {
        await result.current.askAgent('Mensaje error');
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });

    expect(result.current.loading).toBe(false);
  });

  it('no debe llamar al agente si no hay proyecto activo', async () => {
    mockUseProjectStore.mockReturnValue({ currentProject: null });

    const { result } = renderHook(() => useAgent());

    await act(async () => {
      await result.current.askAgent('Hola');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
