/**
 * Push Notification Logs Model
 * Para debuggear problemas de notificaciones en producción
 */

export interface PushLog {
  id?: string;
  user_id: string;
  device_type: string; // 'android' | 'ios' | 'desktop'
  browser: string; // 'edge' | 'brave' | 'chrome' | etc
  log_level: 'info' | 'warn' | 'error';
  message: string;
  error_details?: string;
  endpoint?: string;
  timestamp: string;
  created_at?: string;
}

export interface PushLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
