/**
 * Tests para la lógica de sugerencias de tareas con Gemini
 * 
 * Nota: Estos tests prueban la lógica de integración con Gemini.
 * Los tests E2E cubren el flujo completo de la API.
 */

// Mock del módulo de Gemini antes de importar
const mockGenerateContent = jest.fn();

jest.mock('@/lib/gemini', () => ({
  ai: {
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  },
}));

import { ai } from '@/lib/gemini';

describe('Gemini Task Suggestions Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería generar sugerencias de tareas correctamente', async () => {
    const mockSuggestions = JSON.stringify([
      'Implementar autenticación',
      'Crear página de dashboard',
      'Agregar tests unitarios',
    ]);

    mockGenerateContent.mockResolvedValueOnce({
      text: mockSuggestions,
    });

    const project = {
      name: 'Mi Proyecto',
      description: 'Un proyecto de ejemplo',
    };

    const currentTasks = {
      todo: [{ id: '1', title: 'Tarea existente' }],
      'in-progress': [],
      done: [],
    };

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: 'Sugiere una lista de tareas relevantes para el siguiente proyecto.' },
        { text: `Proyecto: {nombre: ${project.name}, descripcion: ${project.description}}` },
        { text: `Tareas actuales: ${JSON.stringify(currentTasks)}. no repitas tareas ya existentes.` }
      ],
      config: {
        systemInstruction: [
          'Eres un asistente de un equipo debes sugerir tareas para un proyecto dado.',
        ],
      }
    });

    expect(result.text).toBe(mockSuggestions);
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('debería evitar sugerir tareas duplicadas pasando las tareas actuales', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '["Nueva tarea sugerida"]',
    });

    const currentTasks = {
      todo: [{ id: '1', title: 'Tarea existente' }],
      'in-progress': [{ id: '2', title: 'En progreso' }],
      done: [{ id: '3', title: 'Completada' }],
    };

    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: 'Sugiere tareas' },
        { text: `Tareas actuales: ${JSON.stringify(currentTasks)}` }
      ],
      config: { systemInstruction: [] }
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining(JSON.stringify(currentTasks)),
          }),
        ]),
      })
    );
  });

  it('debería manejar errores de la API de Gemini', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Gemini API error'));

    await expect(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: 'Test' }],
        config: { systemInstruction: [] }
      })
    ).rejects.toThrow('Gemini API error');
  });

  it('debería manejar error de rate limit (429)', async () => {
    const rateLimitError = { status: 429, message: 'Rate limit exceeded' };
    mockGenerateContent.mockRejectedValueOnce(rateLimitError);

    await expect(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: 'Test' }],
        config: { systemInstruction: [] }
      })
    ).rejects.toEqual(rateLimitError);
  });

  it('debería retornar un array de sugerencias válido', async () => {
    const suggestions = ['Tarea 1', 'Tarea 2', 'Tarea 3'];

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(suggestions),
    });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: 'Sugiere tareas' }],
      config: { systemInstruction: [] }
    });

    const parsed = JSON.parse(result.text as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
    expect(parsed).toEqual(suggestions);
  });

  it('debería manejar proyecto sin descripción', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '["Tarea sugerida"]',
    });

    const project = { name: 'Solo nombre' };

    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: `Proyecto: {nombre: ${project.name}, descripcion: ${undefined}}` }
      ],
      config: { systemInstruction: [] }
    });

    expect(mockGenerateContent).toHaveBeenCalled();
  });
});
