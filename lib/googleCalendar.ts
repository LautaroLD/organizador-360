import { google, Auth, calendar_v3 } from 'googleapis';
import { GoogleCalendarEvent } from './googleCalendarUtils';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

type GoogleApiErrorShape = {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
};

type GoogleApiError = {
  message?: string;
  code?: number;
  response?: {
    status?: number;
    statusText?: string;
    data?: GoogleApiErrorShape;
  };
  errors?: Array<{ reason?: string; message?: string }>;
};

const extractGoogleErrorDetails = (error: unknown) => {
  const err = error as GoogleApiError;
  const responseData = err?.response?.data;

  // Extraer información útil de forma más robusta
  const status =
    err?.response?.status ||
    (typeof err?.code === 'number' ? err?.code : null) ||
    (typeof responseData?.code === 'number' ? responseData?.code : null);

  return {
    status,
    statusText: err?.response?.statusText || null,
    reason:
      responseData?.errors?.[0]?.reason || err?.errors?.[0]?.reason || null,
    message:
      responseData?.errors?.[0]?.message ||
      responseData?.message ||
      err?.message ||
      'Unknown Google API error',
  };
};

export class GoogleCalendarService {
  private oauth2Client: Auth.OAuth2Client;

  constructor(tokens: GoogleTokens) {
    if (
      !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET
    ) {
      throw new Error(
        'Missing Google OAuth credentials in environment variables',
      );
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_REDIRECT_URI,
    );
    this.oauth2Client.setCredentials(tokens);
  }

  private getCalendar() {
    return google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  // Crear evento en Google Calendar
  async createEvent(
    event: GoogleCalendarEvent,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      return response.data;
    } catch (error) {
      console.error('Error al crear evento en Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        title: event.summary || null,
      });
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });
      return response.data;
    } catch (error) {
      console.error('Error al obtener evento de Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        eventId,
      });
      throw error;
    }
  }

  // Obtener eventos de Google Calendar
  async getEvents(
    timeMin?: string,
    timeMax?: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = this.getCalendar();
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return response.data.items || [];
    } catch (error) {
      console.error(
        'Error al obtener eventos de Google Calendar:',
        extractGoogleErrorDetails(error),
      );
      throw error;
    }
  }

  async listEventInstances(
    recurringEventId: string,
    options?: { timeMin?: string; timeMax?: string; maxResults?: number },
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.instances({
        calendarId: 'primary',
        eventId: recurringEventId,
        timeMin: options?.timeMin,
        timeMax: options?.timeMax,
        maxResults: options?.maxResults ?? 100,
        showDeleted: false,
      });
      return response.data.items || [];
    } catch (error) {
      console.error('Error al listar instancias de Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        recurringEventId,
      });
      throw error;
    }
  }

  async findEventByPrivateProperty(
    propertyName: string,
    propertyValue: string,
  ): Promise<calendar_v3.Schema$Event | null> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        privateExtendedProperty: [`${propertyName}=${propertyValue}`],
        maxResults: 10,
        singleEvents: false,
        showDeleted: false,
      });
      return response.data.items?.[0] || null;
    } catch (error) {
      console.error('Error al buscar evento de Google Calendar por metadata:', {
        ...extractGoogleErrorDetails(error),
        propertyName,
      });
      throw error;
    }
  }

  // Actualizar evento en Google Calendar
  async updateEvent(
    eventId: string,
    event: GoogleCalendarEvent,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
      });
      return response.data;
    } catch (error) {
      console.error('Error al actualizar evento en Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        eventId,
      });
      throw error;
    }
  }

  async patchEvent(
    eventId: string,
    patch: calendar_v3.Schema$Event,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = this.getCalendar();

    try {
      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: patch,
      });
      return response.data;
    } catch (error) {
      console.error('Error al parchear evento de Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        eventId,
      });
      throw error;
    }
  }

  // Eliminar evento de Google Calendar
  async deleteEvent(eventId: string): Promise<void> {
    const calendar = this.getCalendar();

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
    } catch (error) {
      console.error('Error al eliminar evento de Google Calendar:', {
        ...extractGoogleErrorDetails(error),
        eventId,
      });
      throw error;
    }
  }

  // Verificar si los tokens son válidos
  async verifyTokens(): Promise<boolean> {
    try {
      const calendar = this.getCalendar();
      await calendar.calendarList.list({ maxResults: 1 });
      return true;
    } catch (error) {
      console.warn(
        'Google Calendar tokens invalid:',
        extractGoogleErrorDetails(error),
      );
      return false;
    }
  }
}
