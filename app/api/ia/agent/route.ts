import { ai } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkIsPremiumUser } from '@/lib/subscriptionUtils';

export async function POST(req: NextRequest) {
  try {
    const { message, history, projectId } = await req.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verificar que el usuario esté autenticado
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que el usuario sea premium
    const isPremium = await checkIsPremiumUser(supabase, user.id);
    if (!isPremium) {
      return NextResponse.json(
        { error: 'Esta función está disponible solo para usuarios Pro' },
        { status: 403 }
      );
    }

    // 1. Obtener datos básicos del proyecto
    const { data: project } = await supabase
      .from('projects')
      .select('name, description')
      .eq('id', projectId)
      .single();

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Obtener canales del proyecto para buscar mensajes
    const { data: channels } = await supabase
        .from('channels')
        .select('id, name')
        .eq('project_id', projectId);

    const channelIds = channels?.map(c => c.id) || [];

    // 3. Ejecutar consultas en paralelo para optimizar tiempo
    const [tasksResult, messagesResult, membersResult, resourcesResult, eventsResult] = await Promise.all([
      // Tareas recientes (limitado a 100 para tener contexto suficiente)
      supabase
        .from('tasks')
        .select('title, status, description, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100),

      // Mensajes recientes de cualquier canal del proyecto
      channelIds.length > 0 ? supabase
        .from('messages')
        .select('content, user_id, created_at, users:user_id(email)') // Asumiendo relación con users
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false })
        .limit(50) // Aumentamos límite a 50
        : { data: [] },
        
      // Miembros del equipo
       supabase
        .from('project_members')
        .select(`user_id, role,
            users:user_id(email),
            tags:member_tags (
            id,
            tag_id,
            tag:project_tags (
              id,
              label,
              color
            )
          )`)
        .eq('project_id', projectId),

      // Archivos/Recursos recientes
      supabase
        .from('resources')
        .select('title, type, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(30),

      // Eventos del calendario (Próximos)
      supabase
        .from('events')
        .select('title, start_date, end_date, description')
        .eq('project_id', projectId)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(20)
    ]);

    const tasks = tasksResult.data || [];
    const chatMessages = messagesResult.data || [];
    const members = membersResult.data || [];
    const resources = resourcesResult.data || [];
    const events = eventsResult.data || [];

    // 4. Construir el contexto limitado y relevante
    const contextText = `
    DATOS DEL PROYECTO:
    Nombre: ${project.name}
    Descripción: ${project.description}

    MIEMBROS DEL EQUIPO:
    ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members.map((m: any) => `- ${m.users?.email} (rol: ${m.role}) - (tags: ${m.tags.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map((tag: any) => tag.tag.label).join(', ')})`).join('\n')}

    ARCHIVOS Y RECURSOS DISPONIBLES (Últimos 30):
    ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resources.map((r: any) => `- [${r.type}] ${r.title} (${new Date(r.created_at).toLocaleDateString()})`).join('\n')}

    PRÓXIMOS EVENTOS (Calendario):
    ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events.map((e: any) => `- [${new Date(e.start_date).toLocaleString()} - ${new Date(e.end_date).toLocaleTimeString()}] ${e.title}: ${e.description || 'Sin descripción'}`).join('\n')}

    TAREAS DEL PROYECTO (Agrupadas por estado):
    ${(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tasksByStatus = tasks.reduce((acc: any, task: any) => {
        const status = task.status || 'Sin estado';
        if (!acc[status]) acc[status] = [];
        acc[status].push(task);
        return acc;
      }, {});
      
      return Object.entries(tasksByStatus).map(([status, list]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return `ESTADO: ${status.toUpperCase()}\n${(list as any[]).map((t: any) => `- ${t.title}`).join('\n')}`;
      }).join('\n\n');
    })()}

    ÚLTIMOS MENSAJES DE CHAT (Contexto de conversación):
    ${
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatMessages.reverse().map((m: any) => `[${m.created_at}] ${m.users?.email || 'Usuario'}: ${m.content}`).join('\n')}
    `;

    // 5. Llamada a Gemini
    // Construimos el historial de conversación para Gemini
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationHistory = history?.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })) || [];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: contextText }] },
        ...conversationHistory,
        { role: 'user', parts: [{ text: `Pregunta actual del usuario: ${message}` }] }
      ],
      config: {
        systemInstruction: `Eres el Asistente de IA oficial del proyecto "${project.name}".
        Tu objetivo es ayudar al equipo respondiendo preguntas sobre el estado del proyecto, tareas y conversaciones pasadas.
        
        INSTRUCCIONES:
        1. Usa la información proporcionada arriba para responder. Si no está en el contexto, di que no tienes esa información reciente.
        2. Sé conciso y directo.
        3. Si sugieres crear tareas, hazlo en formato de lista clara.
        4. Puedes analizar el sentimiento del equipo basado en el chat.
        5. Mantén el hilo de la conversación actual si el usuario hace referencias a mensajes anteriores.
        
        Responde siempre en español.
        `
      }
    });

    const responseText = response.text

    return NextResponse.json({ 
      response: responseText, 
      usedContext: {
        taskCount: tasks.length,
        messageCount: chatMessages.length
      } 
    });
    
  } catch (error) {
    console.error('Error in AI agent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
