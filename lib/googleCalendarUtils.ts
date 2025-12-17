// Utilidades para formatear eventos (sin dependencias de Node.js)
// Este archivo puede usarse tanto en cliente como en servidor

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}

// Formatear evento de la app para Google Calendar
export function formatEventForGoogle(appEvent: any): GoogleCalendarEvent {
  // Validar y formatear las fechas
  const startDate = appEvent.start_date;
  const startTime = appEvent.start_time || '00:00';
  const endDate = appEvent.end_date || appEvent.start_date;
  const endTime = appEvent.end_time || '23:59';
  
  // Asegurar formato correcto HH:MM
  const formattedStartTime = startTime.length === 5 ? startTime : `${startTime}:00`.slice(0, 5);
  const formattedEndTime = endTime.length === 5 ? endTime : `${endTime}:00`.slice(0, 5);
  
  const startDateTimeStr = `${startDate}T${formattedStartTime}:00`;
  const endDateTimeStr = `${endDate}T${formattedEndTime}:00`;
  
  const startDateTime = new Date(startDateTimeStr);
  const endDateTime = new Date(endDateTimeStr);

  // Validar que las fechas sean válidas
  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    throw new Error(`Invalid time value: start=${startDateTimeStr}, end=${endDateTimeStr}`);
  }

  const googleEvent: GoogleCalendarEvent = {
    summary: appEvent.title,
    description: appEvent.description || '',
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
  };

  // Agregar recurrencia si existe
  if (appEvent.is_recurring && appEvent.recurrence_rule) {
    const rrule = convertToRRule(appEvent.recurrence_rule, appEvent.selected_days);
    if (rrule) {
      googleEvent.recurrence = [rrule];
    }
  }

  return googleEvent;
}

// Convertir regla de recurrencia a formato RFC 5545
function convertToRRule(recurrenceType: string, selectedDays?: string[]): string | null {
  if (recurrenceType === 'weekly' && selectedDays && selectedDays.length > 0) {
    const daysMap: Record<string, string> = {
      monday: 'MO',
      tuesday: 'TU',
      wednesday: 'WE',
      thursday: 'TH',
      friday: 'FR',
      saturday: 'SA',
      sunday: 'SU',
    };

    const days = selectedDays.map(day => daysMap[day]).filter(Boolean).join(',');
    return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }
  return null;
}
