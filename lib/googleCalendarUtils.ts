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
  const eventTimeZone = appEvent.timeZone || appEvent.time_zone || 'UTC';
  
  // Asegurar formato correcto HH:MM
  const formattedStartTime = startTime.length === 5 ? startTime : `${startTime}:00`.slice(0, 5);
  const formattedEndTime = endTime.length === 5 ? endTime : `${endTime}:00`.slice(0, 5);
  
  const startDateTimeStr = `${startDate}T${formattedStartTime}:00`;
  const endDateTimeStr = `${endDate}T${formattedEndTime}:00`;
  
  // Validar formato básico (sin conversión UTC)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(startDateTimeStr)) {
    throw new Error(`Invalid time format: start=${startDateTimeStr}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(endDateTimeStr)) {
    throw new Error(`Invalid time format: end=${endDateTimeStr}`);
  }

  const googleEvent: GoogleCalendarEvent = {
    summary: appEvent.title,
    description: appEvent.description || '',
    start: {
      dateTime: startDateTimeStr,
      timeZone: eventTimeZone,
    },
    end: {
      dateTime: endDateTimeStr,
      timeZone: eventTimeZone,
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
