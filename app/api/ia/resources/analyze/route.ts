import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';

export async function POST(req: NextRequest) {
  try {
    const { resourceId } = await req.json();

    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para planes Pro o Enterprise' },
        { status: 403 }
      );
    }

    // 1. Obtener detalles del recurso
    const { data: resource, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .single();

    if (error || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (resource.type !== 'file') {
         return NextResponse.json({ error: 'Only files can be analyzed' }, { status: 400 });
    }
    
    // 2. Descargar el archivo
    // Asumimos que la URL es accesible (publicUrl). Si no, usaríamos supabase.storage.download
    const fileResponse = await fetch(resource.url);
    if (!fileResponse.ok) {
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = fileResponse.headers.get('content-type') || 'application/pdf'; // Fallback común

    // 3. Enviar a Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "Eres un analista experto. Tu tarea es leer el archivo adjunto y generar un resumen conciso y útil para el equipo."
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: `Analiza este archivo: "${resource.title}".
              
              Genera una respuesta en Markdown con la siguiente estructura:
              1. **Resumen Ejecutivo:** (2-3 frases)
              2. **Puntos Clave:** (Lista de bullets)
              3. **Conclusión/Acciones Sugeridas:** (Si aplica)
              
              Mantén el tono profesional y responde en español.`
            }
          ]
        }
      ]
    });

    const summary = response.text

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error analyzing resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
