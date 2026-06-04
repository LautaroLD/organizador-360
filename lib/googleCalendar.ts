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

  return {
    status: err?.response?.status || err?.code || responseData?.code || null,
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
    this.oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_REDIRECT_URI,
    );
    this.oauth2Client.setCredentials(tokens);
  }

  // Crear evento en Google Calendar
  async createEvent(
    event: GoogleCalendarEvent,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

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

  // Obtener eventos de Google Calendar
  async getEvents(
    timeMin?: string,
    timeMax?: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

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

  // Actualizar evento en Google Calendar
  async updateEvent(
    eventId: string,
    event: GoogleCalendarEvent,
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

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

  // Eliminar evento de Google Calendar
  async deleteEvent(eventId: string): Promise<void> {
    const calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });

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
      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });
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
