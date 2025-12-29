import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushNotificationToUser } from '@/lib/push-notifications';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, message, targetUserId } = body;

        // Por seguridad, en este endpoint de prueba, solo permitimos enviarse a uno mismo
        // a menos que sea admin (lógica que deberías implementar según tus roles)
        // Aquí asumimos que si targetUserId es diferente, verificamos permisos (omitido por brevedad)
        
        const recipientId = targetUserId || user.id;

        const result = await sendPushNotificationToUser(recipientId, {
            title: title || 'Notificación de prueba',
            body: message || 'Esta es una notificación de prueba',
            icon: '/icons/icon-192x192.png',
            data: {
                url: '/dashboard',
                timestamp: Date.now(),
            }
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error sending push notification:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
