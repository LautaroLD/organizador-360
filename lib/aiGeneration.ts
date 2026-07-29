import type { AICreditAction } from '@/lib/aiCredits';

export const AI_MODEL = 'gemini-3.1-flash-lite';

/** Tope de tokens de salida por acción (protege costo por request). */
export const AI_MAX_OUTPUT_TOKENS: Record<AICreditAction, number> = {
  agent_message: 1024,
  task_description: 512,
  task_suggestions: 512,
  chat_summary: 1024,
  resource_analyze: 1280,
  project_insights: 1280,
};

/** Últimos turnos de conversación enviados al modelo (user + assistant). */
export const AGENT_HISTORY_MAX_MESSAGES = 12;

/** Longitud máxima del mensaje actual del usuario. */
export const AGENT_MESSAGE_MAX_CHARS = 2000;

/** Longitud máxima por mensaje del historial. */
export const AGENT_HISTORY_MESSAGE_MAX_CHARS = 1200;

export type AgentHistoryMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export function aiOutputConfig(action: AICreditAction): {
  maxOutputTokens: number;
} {
  return { maxOutputTokens: AI_MAX_OUTPUT_TOKENS[action] };
}

export function truncateForAI(value: string, maxChars: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function clampAgentUserMessage(message: unknown): string {
  if (typeof message !== 'string') return '';
  return truncateForAI(message, AGENT_MESSAGE_MAX_CHARS);
}

/**
 * Queda con los últimos N mensajes válidos y trunca cada contenido.
 * Omite el saludo inicial del asistente si es el único mensaje previo.
 */
export function clampAgentHistory(
  history: unknown,
  maxMessages = AGENT_HISTORY_MAX_MESSAGES,
): AgentHistoryMessage[] {
  if (!Array.isArray(history)) return [];

  const normalized: AgentHistoryMessage[] = [];

  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;

    normalized.push({
      role,
      content: truncateForAI(content, AGENT_HISTORY_MESSAGE_MAX_CHARS),
    });
  }

  // Evitar mandar solo el welcome message del UI (no aporta contexto útil).
  if (
    normalized.length === 1 &&
    normalized[0].role === 'assistant' &&
    /asistente IA de tu proyecto/i.test(normalized[0].content)
  ) {
    return [];
  }

  if (normalized.length <= maxMessages) return normalized;
  return normalized.slice(-maxMessages);
}
