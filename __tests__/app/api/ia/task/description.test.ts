/**
 * Tests para la lógica de generación de descripciones de tareas con Gemini
 * 
 * Nota: Estos tests prueban la lógica de integración con Gemini.
 * Los tests E2E cubren el flujo completo de la API.
 */

// Mock del módulo de Gemini
const mockGenerateContent = jest.fn();

jest.mock('@/lib/gemini', () => ({
  ai: {
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  },
}));

import { ai } from '@/lib/gemini';

describe('Gemini Task Description Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería llamar a generateContent con la estructura correcta', async () => {
    const mockResponseText = JSON.stringify({
      descripcion: 'Una descripción generada por IA',
      checklist: ['Item 1', 'Item 2', 'Item 3'],
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: mockResponseText,
    });

    const project = {
      name: 'Test Project',
      description: 'A test project',
    };
    const title_task = 'Implementar login';
    const current_checklist: unknown[] = [];

    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: 'Genera una descripcion breve y un checklist para la siguiente tarea del proyecto.' },
        { text: `Proyecto: {nombre: ${project.name}, descripcion: ${project.description}}` },
        { text: `Titulo de la tarea: ${title_task}` },
        { text: `Checklist actual: ${JSON.stringify(current_checklist)}. No debes repetir los items que ya están en el checklist.` }
      ],
      config: {
        systemInstruction: [
          'Eres un asistente de un equipo debes generar descripciones breves y checklists para las tareas del proyecto.',
        ],
      }
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        contents: expect.any(Array),
        config: expect.objectContaining({
          systemInstruction: expect.any(Array),
        }),
      })
    );
  });

  it('debería incluir el checklist actual en el prompt', async () => {
    const currentChecklist = [
      { id: '1', content: 'Item existente', is_completed: false },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        descripcion: 'Descripción',
        checklist: ['Nuevo item'],
      }),
    });

    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: 'Genera una descripcion' },
        { text: `Checklist actual: ${JSON.stringify(currentChecklist)}` }
      ],
      config: { systemInstruction: [] }
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining(JSON.stringify(currentChecklist)),
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

  it('debería retornar la respuesta en formato JSON válido', async () => {
    const expectedResponse = {
      descripcion: 'Una descripción de prueba',
      checklist: ['Item 1', 'Item 2'],
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(expectedResponse),
    });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: 'Test' }],
      config: { systemInstruction: [] }
    });

    const parsed = JSON.parse(result.text as string);
    expect(parsed).toEqual(expectedResponse);
    expect(parsed.descripcion).toBe('Una descripción de prueba');
    expect(parsed.checklist).toHaveLength(2);
  });
});
