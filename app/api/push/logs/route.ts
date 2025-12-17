import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            user_id,
            device_type,
            browser,
            log_level,
            message,
            error_details,
            endpoint,
            timestamp,
        } = body;

        if (!user_id || !log_level || !message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Guardar en la tabla push_logs
        const { error } = await supabase
            .from('push_logs')
            .insert({
                user_id,
                device_type: device_type || 'unknown',
                browser: browser || 'unknown',
                log_level,
                message,
                error_details: error_details || null,
                endpoint: endpoint || null,
                timestamp: timestamp || new Date().toISOString(),
                created_at: new Date().toISOString(),
            });

        if (error) {
            console.error('Error saving push log:', error);
            // No fallar si no podemos guardar el log
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in push logs API:', error);
        // No fallar - este endpoint nunca debe romper la app
        return NextResponse.json({ success: true });
    }
}
