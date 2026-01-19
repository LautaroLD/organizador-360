import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
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
