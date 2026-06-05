import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

const CHAT_SUMMARY_MAX_MESSAGES = 100;

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

    const { messages, startDate, endDate, rangeHours, channelName } =
      await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 },
      );
    }

    const cappedMessages = messages.slice(-CHAT_SUMMARY_MAX_MESSAGES);
    const reachedMessageLimit = messages.length > CHAT_SUMMARY_MAX_MESSAGES;

    const messagesText = cappedMessages
      .map((msg) => {
        const senderName = msg.user?.name || 'Usuario desconocido';
        const timestamp = new Date(msg.created_at).toLocaleString('es-ES');
        return `[${timestamp}] ${senderName}: ${msg.content}`;
      })
      .join('\n');

    const prompt = `
Genera un resumen conciso y estructurado de la conversación del chat "${channelName}" para el rango de las últimas ${rangeHours} horas (desde ${startDate} hasta ${endDate}).

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
    console.error('Error generating chat summary:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
