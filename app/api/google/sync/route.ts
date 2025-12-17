// API Routes para sincronización con Google Calendar
import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/googleCalendar';
import { formatEventForGoogle } from '@/lib/googleCalendarUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, event, checkDuplicate = false } = body;

    if (!tokens) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 401 }
      );
    }

    const calendarService = new GoogleCalendarService(tokens);
    
    // Si se solicita verificar duplicados
    if (checkDuplicate) {
      const existingEvents = await calendarService.getEvents();
      const startDate = event.start_date;
      
      // Buscar eventos duplicados por título y fecha
      const isDuplicate = existingEvents.some((e: any) => 
        e.summary === event.title && 
        e.start?.dateTime?.startsWith(startDate)
      );
      
      if (isDuplicate) {
        return NextResponse.json({ 
          success: true, 
          skipped: true,
          message: 'Event already exists' 
        });
      }
    }

    const googleEvent = formatEventForGoogle(event);
    const result = await calendarService.createEvent(googleEvent);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error al sincronizar evento:', error);
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar evento' },
      { status: 500 }
    );
  }
}

// Obtener eventos de Google Calendar
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokensParam = searchParams.get('tokens');

    if (!tokensParam) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 401 }
      );
    }

    const tokens = JSON.parse(decodeURIComponent(tokensParam));
    const calendarService = new GoogleCalendarService(tokens);
    const events = await calendarService.getEvents();

    return NextResponse.json({ success: true, data: events });
  } catch (error: any) {
    console.error('Error al obtener eventos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener eventos' },
      { status: 500 }
    );
  }
}

// Eliminar evento de Google Calendar
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, eventTitle, startDate } = body;

    if (!tokens) {
      return NextResponse.json(
        { error: 'No tokens provided' },
        { status: 401 }
      );
    }

    const calendarService = new GoogleCalendarService(tokens);
    
    // Buscar eventos por título y fecha
    const events = await calendarService.getEvents();
    const matchingEvents = events.filter((event: any) => 
      event.summary === eventTitle && 
      event.start?.dateTime?.startsWith(startDate)
    );

    // Eliminar todos los eventos coincidentes
    for (const event of matchingEvents) {
      if (event.id) {
        await calendarService.deleteEvent(event.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      deleted: matchingEvents.length 
    });
  } catch (error: any) {
    console.error('Error al eliminar evento:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar evento' },
      { status: 500 }
    );
  }
}
