import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para planes Pro o Enterprise' },
        { status: 403 }
      );
    }

    const { messages, startDate, endDate, channelName } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const messagesText = messages.map(msg => {
        const senderName = msg.user?.name || 'Usuario desconocido';
        const timestamp = new Date(msg.created_at).toLocaleString('es-ES');
        return `[${timestamp}] ${senderName}: ${msg.content}`;
    }).join('\n');

    const prompt = `
Genera un resumen conciso y estructurado de la conversación del chat "${channelName}" para el rango de fechas ${startDate} a ${endDate}.

Aquí están los mensajes:
${messagesText}

Instrucciones:
1.  Identifica los temas principales discutidos.
2.  Destaca cualquier decisión importante tomada o tarea asignada.
3.  Mantén un tono profesional y objetivo.
4.  Si no hay suficiente información relevante, indícalo.
5.  Formatea la respuesta en Markdown.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      }
    });
    
    return NextResponse.json({ summary: response.text });
  } catch (error) {
    console.error('Error generating chat summary:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
