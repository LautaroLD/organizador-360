import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configurar web-push con las claves VAPID
// Estas claves deben estar en las variables de entorno
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const adminEmail = process.env.ADMIN_EMAIL || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        adminEmail,
        vapidPublicKey,
        vapidPrivateKey
    );
} else {
    console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
}

// Cliente de Supabase con Service Role para acceder a todas las suscripciones
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
}

/**
 * Envía una notificación push a un usuario específico
 */
export async function sendPushNotificationToUser(userId: string, payload: NotificationPayload) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error('❌ Cannot send notification: VAPID keys missing');
        return { success: false, error: 'VAPID keys missing' };
    }

    try {
        // 1. Obtener suscripciones del usuario
        const { data: subscriptions, error } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('❌ Error fetching subscriptions:', error);
            return { success: false, error: error.message };
        }

        if (!subscriptions || subscriptions.length === 0) {
            return { success: true, sentCount: 0 };
        }

        // 2. Enviar notificación a cada suscripción
        const notifications = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(
                    pushSubscription,
                    JSON.stringify(payload)
                );
                return { success: true, subId: sub.id };
            } catch (error: unknown) {
                const webPushError = error as { statusCode?: number };
                // Si la suscripción es inválida (410 Gone o 404 Not Found), eliminarla
                if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
                    await supabaseAdmin
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', sub.id);
                } else {
                    console.error(`❌ Error sending push to sub ${sub.id}:`, error);
                }
                return { success: false, error, subId: sub.id };
            }
        });

        const results = await Promise.all(notifications);
        const sentCount = results.filter(r => r.success).length;

        return { success: true, sentCount, total: subscriptions.length };

    } catch (error) {
        console.error('❌ Error in sendPushNotificationToUser:', error);
        return { success: false, error };
    }
}

/**
 * Envía una notificación push a múltiples usuarios
 */
export async function sendPushNotificationToUsers(userIds: string[], payload: NotificationPayload) {
    const results = await Promise.all(
        userIds.map(userId => sendPushNotificationToUser(userId, payload))
    );
    return results;
}
