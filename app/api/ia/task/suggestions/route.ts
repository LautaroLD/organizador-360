import { ai } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkIsPremiumUser } from '@/lib/subscriptionUtils';

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const supabase = await createClient();
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

    const { project, currentTasks } = await req.json();
    
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        text: 'Sugiere una lista de tareas relevantes para el siguiente proyecto.',
      },
      { text: `Proyecto: {nombre: ${project.name}, descripcion: ${project.description}}`
      }, 
      { text: `Tareas actuales: ${JSON.stringify(currentTasks)}. no repitas tareas ya existentes.` }],
      config: {
        systemInstruction: [
          'Eres un asistente de un equipo debes sugerir tareas para un proyecto dado.',
          'Debes Responder con una lista de tareas relevantes para el proyecto.',
          'Responde solo en español.',
          'Cada tarea debe ser un titulo breve.',
          'Devuelve la respuesta en formato JSON como un array de strings.',
          'No agregues texto adicional fuera de la estructura solicitada. NO use bloques de codigo ni formato especial. Solo el array en texto plano.',
          'Asegurate de que las tareas sean relevantes para el proyecto dado y evita tareas duplicadas.',
          'Sugiere entre 3 y 5 tareas.',
        ],
      }
    });
    
    const suggestions = res.text;

    return new Response(JSON.stringify({ suggestions }), { status: 200 });
  } catch (error: unknown) {
    const err = error as { status?: number };
    console.error('Error fetching suggestions:', error);
    if (err.status === 429) {
      return new Response('Rate Limit Exceeded', { status: 429 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}