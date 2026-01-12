import { ai } from '@/lib/gemini';
import { Project } from '@/models';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {project, title_task, current_checklist}:{ project: Project, title_task: string, current_checklist?: unknown } = await req.json();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          text: 'Genera una descripcion breve y un checklist para la siguiente tarea del proyecto.',
        },
        { text: `Proyecto: {nombre: ${project.name}, descripcion: ${project.description}}` },
        { text: `Titulo de la tarea: ${title_task}` },
        { text: `Checklist actual: ${JSON.stringify(current_checklist)}. No debes repetir los items que ya están en el checklist.` }
      ],
      config: {
        systemInstruction: [
          'Eres un asistente de un equipo debes generar descripciones breves y checklists para las tareas del proyecto.',
          'Debes Responder exactamente con la siguiente estructura: {"descripcion": "", "checklist": ["item1", "item2", "..."]}',
          'Responde solo en español.',
          'No agregues texto adicional fuera de la estructura solicitada. NO use bloques de codigo ni formato especial. Solo la estructura solicitada en texto plano.',
          'Asegurate de que el checklist sea relevante para la tarea dada y deben ser entre 3 y 5 items.',
        ],
      }
    })
    console.log(response.text);
    
    return NextResponse.json({ message: response.text });
  } catch (error) {
    console.error('Error generating task description:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}