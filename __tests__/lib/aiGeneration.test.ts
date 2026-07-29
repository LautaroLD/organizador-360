import {
  AGENT_HISTORY_MAX_MESSAGES,
  AI_MAX_OUTPUT_TOKENS,
  aiOutputConfig,
  clampAgentHistory,
  clampAgentUserMessage,
  truncateForAI,
} from '@/lib/aiGeneration';

describe('aiGeneration helpers', () => {
  it('expone maxOutputTokens por acción', () => {
    expect(aiOutputConfig('agent_message')).toEqual({
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS.agent_message,
    });
    expect(AI_MAX_OUTPUT_TOKENS.agent_message).toBe(1024);
  });

  it('trunca texto largo', () => {
    expect(truncateForAI('hola mundo', 20)).toBe('hola mundo');
    expect(truncateForAI('abcdefghij', 5)).toBe('abcd…');
  });

  it('acota el mensaje del usuario', () => {
    expect(clampAgentUserMessage('  pregunta  ')).toBe('pregunta');
    expect(clampAgentUserMessage(null)).toBe('');
    expect(clampAgentUserMessage('x'.repeat(3000)).length).toBe(2000);
  });

  it('omite el saludo inicial del asistente', () => {
    expect(
      clampAgentHistory([
        {
          role: 'assistant',
          content:
            '¡Hola! Soy el asistente IA de tu proyecto. Puedo ayudarte.',
        },
      ]),
    ).toEqual([]);
  });

  it('conserva solo los últimos N mensajes válidos', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `msg-${i}`,
    }));

    const clamped = clampAgentHistory(history);
    expect(clamped).toHaveLength(AGENT_HISTORY_MAX_MESSAGES);
    expect(clamped[0].content).toBe('msg-8');
    expect(clamped.at(-1)?.content).toBe('msg-19');
  });

  it('ignora entradas inválidas del historial', () => {
    expect(
      clampAgentHistory([
        { role: 'system', content: 'nope' },
        { role: 'user', content: '' },
        { role: 'user', content: 'ok' },
        null,
      ]),
    ).toEqual([{ role: 'user', content: 'ok' }]);
  });
});
