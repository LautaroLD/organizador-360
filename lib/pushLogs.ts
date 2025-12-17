/**
 * Remote Push Notification Logging
 * Envía logs a la base de datos para debuggear problemas en producción
 */

import { PushLog } from '@/models/pushLog';

/**
 * Detectar información del dispositivo
 */
function getDeviceInfo(): {
  deviceType: string;
  browser: string;
  userAgent: string;
} {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'unknown',
      browser: 'unknown',
      userAgent: 'server',
    };
  }

  const ua = navigator.userAgent;

  // Detectar dispositivo
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const deviceType = isAndroid ? 'android' : isIOS ? 'ios' : 'desktop';

  // Detectar navegador
  let browser = 'unknown';
  if (/Edg/.test(ua)) browser = 'edge';
  else if (/Chrome/.test(ua)) browser = 'chrome';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'safari';
  else if (/Firefox/.test(ua)) browser = 'firefox';
  else if (/Brave/.test(ua)) browser = 'brave';

  return { deviceType, browser, userAgent: ua };
}

/**
 * Enviar log remoto a la base de datos
 */
export async function sendPushLog(
  userId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const { deviceType, browser } = getDeviceInfo();

    const logEntry: PushLog = {
      user_id: userId,
      device_type: deviceType,
      browser,
      log_level: level,
      message,
      error_details: details ? JSON.stringify(details) : undefined,
      timestamp: new Date().toISOString(),
    };

    // Enviar log al backend
    await fetch('/api/push/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logEntry),
    }).catch(err => {
      // Si falla enviar log, no romper la app
      console.error('Failed to send push log:', err);
    });
  } catch (error) {
    // Silenciosamente fallar para no romper el flujo
    console.error('Error in sendPushLog:', error);
  }
}

/**
 * Versión mejorada de console.log que también envía logs remotos
 */
export function logPushEvent(
  userId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  emoji?: string,
  details?: Record<string, unknown>
): void {
  // Log local
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${emoji || ''} ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, details);
  } else if (level === 'warn') {
    console.warn(logMessage, details);
  } else {
    console.log(logMessage, details);
  }

  // Log remoto (asincrónico, no bloquea)
  if (userId) {
    sendPushLog(userId, level, message, details).catch(() => {
      // Silenciosamente fallar
    });
  }
}
