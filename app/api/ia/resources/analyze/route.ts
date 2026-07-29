import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUseAIFeatures } from '@/lib/subscriptionUtils';
import { AICreditError, consumeAICredits } from '@/lib/aiCredits';
import {
  AI_MODEL,
  aiOutputConfig,
  isFileTooLargeForAIAnalysis,
  resourceAnalyzeSizeLimitMessage,
  RESOURCE_ANALYZE_MAX_BYTES,
  RESOURCE_ANALYZE_MAX_MB,
} from '@/lib/aiGeneration';

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

    // Rechazar antes de cobrar créditos si el tamaño conocido supera el límite.
    if (isFileTooLargeForAIAnalysis(resource.size)) {
      return NextResponse.json(
        {
          error: resourceAnalyzeSizeLimitMessage(),
          code: 'FILE_TOO_LARGE',
          maxBytes: RESOURCE_ANALYZE_MAX_BYTES,
          maxMb: RESOURCE_ANALYZE_MAX_MB,
        },
        { status: 413 },
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

    // 2. Descargar el archivo (validar tamaño antes de cargar en memoria)
    const fileResponse = await fetch(resource.url);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 },
      );
    }

    const contentLengthHeader = fileResponse.headers.get('content-length');
    const contentLength = contentLengthHeader
      ? Number(contentLengthHeader)
      : NaN;
    if (isFileTooLargeForAIAnalysis(contentLength)) {
      await fileResponse.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        {
          error: resourceAnalyzeSizeLimitMessage(),
          code: 'FILE_TOO_LARGE',
          maxBytes: RESOURCE_ANALYZE_MAX_BYTES,
          maxMb: RESOURCE_ANALYZE_MAX_MB,
        },
        { status: 413 },
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (isFileTooLargeForAIAnalysis(buffer.length)) {
      return NextResponse.json(
        {
          error: resourceAnalyzeSizeLimitMessage(),
          code: 'FILE_TOO_LARGE',
          maxBytes: RESOURCE_ANALYZE_MAX_BYTES,
          maxMb: RESOURCE_ANALYZE_MAX_MB,
        },
        { status: 413 },
      );
    }

    // Nivel 2: análisis de documento/recurso (después de validar tamaño)
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
        fileSize: buffer.length,
      },
    });

    const base64Data = buffer.toString('base64');
    const mimeType =
      fileResponse.headers.get('content-type') || 'application/pdf'; // Fallback común

    // 3. Enviar a Gemini
    const projectContext = project
      ? `El archivo pertenece al proyecto "${project.name}"${project.description ? ` (${project.description})` : ''}. Usa ese contexto solo para interpretar términos o referencias; no inventes vínculo con el proyecto si el documento no lo menciona.`
      : '';

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      config: {
        ...aiOutputConfig('resource_analyze'),
        systemInstruction: `Eres un asistente que explica el contenido de archivos a miembros de un equipo de trabajo.
Tu objetivo principal es ayudar a entender qué dice y qué contiene el documento adjunto, de forma clara y fiel.
${projectContext}
Reglas:
- Basa la explicación solo en lo que realmente aparece en el archivo. Si no puedes leerlo o falta información, dilo explícitamente.
- No inventes datos, secciones ni conclusiones que no estén en el documento.
- Adapta el nivel técnico al tipo de archivo (técnico, negocio, diseño, etc.).
- Sé conciso y directo. Responde siempre en español.`,
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
              text: `Explica el contenido de este archivo: "${resource.title}".

Genera una respuesta en Markdown con esta estructura:
1. **Qué es:** tipo de documento y de qué trata (2-3 frases).
2. **Contenido principal:** explicación clara de lo que dice o muestra el archivo (secciones, temas, datos o ideas relevantes).
3. **Puntos clave:** lista breve de los hallazgos o ideas más importantes del documento.

No agregues recomendaciones ni plan de acciones salvo que el propio archivo las incluya de forma explícita.`,
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
