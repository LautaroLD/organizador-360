import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import { AICreditError, consumeAICredits } from '@/lib/aiCredits';

export async function POST(req: NextRequest) {
  try {
    const { resourceId, requestId } = await req.json();

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Resource ID is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const canUseAI = await canUseAIFeatures(supabase, user.id);
    if (!canUseAI) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para plan Pro' },
        { status: 403 },
      );
    }

    // 1. Obtener detalles del recurso
    const { data: resource, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', resourceId)
      .single();

    if (error || !resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 },
      );
    }

    if (resource.type !== 'file') {
      return NextResponse.json(
        { error: 'Only files can be analyzed' },
        { status: 400 },
      );
    }

    // Obtener datos del proyecto al que pertenece el recurso
    const { data: project } = resource.project_id
      ? await supabase
          .from('projects')
          .select('name, description')
          .eq('id', resource.project_id)
          .single()
      : { data: null };

    // Nivel 2: análisis de documento/recurso
    await consumeAICredits(supabase, {
      userId: user.id,
      action: 'resource_analyze',
      projectId: resource.project_id ?? null,
      idempotencyKey:
        typeof requestId === 'string' && requestId
          ? requestId
          : crypto.randomUUID(),
      metadata: {
        endpoint: '/api/ia/resources/analyze',
        resourceId,
      },
    });

    // 2. Descargar el archivo
    // Asumimos que la URL es accesible (publicUrl). Si no, usaríamos supabase.storage.download
    const fileResponse = await fetch(resource.url);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 },
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType =
      fileResponse.headers.get('content-type') || 'application/pdf'; // Fallback común

    // 3. Enviar a Gemini
    const projectContext = project
      ? `El archivo pertenece al proyecto "${project.name}"${project.description ? ` (${project.description})` : ''}.`
      : '';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      config: {
        systemInstruction: `Eres un analista experto en documentación de equipos de trabajo. Tu tarea es leer el archivo adjunto y generar un resumen conciso, claro y útil para los miembros del equipo. ${projectContext} Adapta el nivel técnico del resumen al tipo de documento: si es técnico, mantén los términos; si es de negocio, enfócate en decisiones e impacto.`,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Analiza este archivo: "${resource.title}".
              
              Genera una respuesta en Markdown con la siguiente estructura:
              1. **Resumen Ejecutivo:** (2-3 frases)
              2. **Puntos Clave:** (Lista de bullets)
              3. **Conclusión/Acciones Sugeridas:** (Pasos concretos que el equipo podría tomar en el contexto del proyecto)
              
              Mantén el tono profesional y responde en español.`,
            },
          ],
        },
      ],
    });

    const summary = response.text;

    return NextResponse.json({ summary });
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

    console.error('Error analyzing resource:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
