import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import { AICreditError, consumeAICredits } from '@/lib/aiCredits';

const CHAT_SUMMARY_MAX_MESSAGES = 100;

function formatDateTimeForUser(
  value: string,
  locale: string,
  timeZone: string,
): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para plan Pro' },
        { status: 403 },
      );
    }

    const {
      messages,
      startDate,
      endDate,
      startDateLocal,
      endDateLocal,
      rangeHours,
      userTimeZone,
      userLocale,
      channelName,
      requestId,
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 },
      );
    }

    // Nivel 2: resumen analítico de chat (2 créditos)
    await consumeAICredits(supabase, {
      userId: user.id,
      action: 'chat_summary',
      idempotencyKey:
        typeof requestId === 'string' && requestId
          ? requestId
          : crypto.randomUUID(),
      metadata: {
        endpoint: '/api/ia/chat/summary',
        messageCount: messages.length,
      },
    });

    const locale =
      typeof userLocale === 'string' && userLocale ? userLocale : 'es-ES';
    const timeZone =
      typeof userTimeZone === 'string' && userTimeZone ? userTimeZone : 'UTC';

    const formattedStartDate =
      typeof startDateLocal === 'string' && startDateLocal
        ? startDateLocal
        : formatDateTimeForUser(startDate, locale, timeZone);
    const formattedEndDate =
      typeof endDateLocal === 'string' && endDateLocal
        ? endDateLocal
        : formatDateTimeForUser(endDate, locale, timeZone);

    const cappedMessages = messages.slice(-CHAT_SUMMARY_MAX_MESSAGES);
    const reachedMessageLimit = messages.length > CHAT_SUMMARY_MAX_MESSAGES;

    const messagesText = cappedMessages
      .map((msg) => {
        const senderName = msg.user?.name || 'Usuario desconocido';
        const timestamp = formatDateTimeForUser(
          msg.created_at,
          locale,
          timeZone,
        );
        return `[${timestamp}] ${senderName}: ${msg.content}`;
      })
      .join('\n');

    const prompt = `
Genera un resumen conciso y estructurado de la conversación del chat "${channelName}" para el rango de las últimas ${rangeHours} horas.

Periodo en hora local del usuario (${timeZone}): ${formattedStartDate} - ${formattedEndDate}

Aquí están los mensajes:
${messagesText}

Instrucciones:
1.  Identifica los temas principales discutidos.
2.  Destaca cualquier decisión importante tomada o tarea asignada.
3.  Mantén un tono profesional y objetivo.
4.  Si no hay suficiente información relevante, indícalo.
5.  Formatea la respuesta en Markdown.
6.  ${reachedMessageLimit ? `Indica explícitamente que se alcanzó el límite y que solo analizaste los últimos ${CHAT_SUMMARY_MAX_MESSAGES} mensajes.` : 'No menciones límites de mensajes si no se alcanzó ninguno.'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          text: prompt,
        },
      ],
      config: {
        systemInstruction: [
          'Eres un asistente de IA experto en resumir conversaciones de equipos de trabajo.',
          'Tu objetivo es proporcionar resúmenes claros, accionables y bien organizados.',
          'Responde siempre en español.',
        ],
      },
    });

    const limitNotice = reachedMessageLimit
      ? `\n\n> Nota: Se alcanzó el límite de mensajes y se usaron como referencia solo los últimos ${CHAT_SUMMARY_MAX_MESSAGES} mensajes.`
      : '';

    return NextResponse.json({
      summary: `${response.text}${limitNotice}`,
      usedMessages: cappedMessages.length,
      reachedMessageLimit,
      maxMessages: CHAT_SUMMARY_MAX_MESSAGES,
    });
  } catch (error) {
    if (error instanceof AICreditError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          creditStatus: error.details
            ? {
                remaining: error.details.remaining,
                required: error.details.cost,
                quota: error.details.quota,
              }
            : undefined,
        },
        { status: error.status },
      );
    }

    console.error('Error generating chat summary:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
