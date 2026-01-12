/**
 * Tests para el hook useGemini
 * 
 * Verifica la funcionalidad de generación de descripciones y sugerencias de tareas con IA
 */

import { renderHook, act } from '@testing-library/react';

// Mock del store
const mockCurrentProject = {
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project for unit testing',
};

jest.mock('@/store/projectStore', () => ({
  useProjectStore: () => ({
    currentProject: mockCurrentProject,
  }),
}));

// Mock de fetch
global.fetch = jest.fn();

import useGemini from '@/hooks/useGemini';

describe('useGemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTaskDescription', () => {
    it('debería llamar a la API con los parámetros correctos', async () => {
      const mockResponse = {
        message: JSON.stringify({
          descripcion: 'Una descripción generada',
          checklist: ['Item 1', 'Item 2', 'Item 3'],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useGemini());

      let response: string | undefined;
      await act(async () => {
        response = await result.current.generateTaskDescription({
          title_task: 'Test Task',
          current_checklist: [],
        });
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/ia/task/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: mockCurrentProject,
          title_task: 'Test Task',
          current_checklist: [],
        }),
      });

      expect(response).toBe(mockResponse.message);
    });

    it('debería pasar el checklist actual si existe', async () => {
      const currentChecklist = [
        { id: '1', content: 'Existing item', is_completed: false },
      ];

      const mockResponse = {
        message: JSON.stringify({
          descripcion: 'Otra descripción',
          checklist: ['Nuevo item'],
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useGemini());

      await act(async () => {
        await result.current.generateTaskDescription({
          title_task: 'Task with checklist',
          current_checklist: currentChecklist,
        });
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/ia/task/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: mockCurrentProject,
          title_task: 'Task with checklist',
          current_checklist: currentChecklist,
        }),
      });
    });

    it('debería lanzar error si la API falla', async () => {
      const error = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useGemini());

      await expect(
        result.current.generateTaskDescription({
          title_task: 'Test Task',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('generateSuggestedTasks', () => {
    it('debería llamar a la API con las tareas actuales', async () => {
      const currentTasks = {
        todo: [{ id: '1', title: 'Task 1', status: 'todo' }],
        'in-progress': [],
        done: [],
      };

      const mockResponse = {
        suggestions: JSON.stringify(['Suggested Task 1', 'Suggested Task 2']),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useGemini());

      let response: string | undefined;
      await act(async () => {
        response = await result.current.generateSuggestedTasks({
          currentTasks,
        });
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/ia/task/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: mockCurrentProject,
          currentTasks,
        }),
      });

      expect(response).toBe(mockResponse.suggestions);
    });

    it('debería manejar respuesta vacía', async () => {
      const mockResponse = {
        suggestions: JSON.stringify([]),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useGemini());

      let response: string | undefined;
      await act(async () => {
        response = await result.current.generateSuggestedTasks({
          currentTasks: { todo: [], 'in-progress': [], done: [] },
        });
      });

      expect(response).toBe('[]');
    });

    it('debería lanzar error si la API falla', async () => {
      const error = new Error('API error');
      (global.fetch as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useGemini());

      await expect(
        result.current.generateSuggestedTasks({
          currentTasks: { todo: [], 'in-progress': [], done: [] },
        })
      ).rejects.toThrow('API error');
    });
  });
});
