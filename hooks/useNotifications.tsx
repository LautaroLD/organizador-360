'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    requestNotificationPermission,
    canShowNotifications,
    showNotification,
    playNotificationSound,
    type NotificationPermission,
} from '@/lib/notifications';

export interface UseNotificationsReturn {
    permission: NotificationPermission;
    requestPermission: () => Promise<void>;
    notify: (title: string, body: string, options?: { onClick?: () => void; playSound?: boolean; }) => void;
    isSupported: boolean;
}

/**
 * Hook for managing browser notifications
 */
export function useNotifications(): UseNotificationsReturn {
    const [permission, setPermission] = useState<NotificationPermission>(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission as NotificationPermission;
        }
        return 'default';
    });
    const [isSupported] = useState(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return true;
        }
        return false;
    });

    // Effect solo para actualizar el permiso si cambia externamente
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            // Solo actualizar si hay un cambio real
            if (Notification.permission !== permission) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPermission(Notification.permission as NotificationPermission);
            }
        }
    }, [permission]);

    const requestPermission = useCallback(async () => {
        const newPermission = await requestNotificationPermission();
        setPermission(newPermission);
    }, []);

    const notify = useCallback((
        title: string,
        body: string,
        options?: { onClick?: () => void; playSound?: boolean; }
    ) => {
        if (canShowNotifications()) {
            showNotification({
                title,
                body,
                onClick: options?.onClick,
            });

            if (options?.playSound) {
                playNotificationSound();
            }
        }
    }, []);

    return {
        permission,
        requestPermission,
        notify,
        isSupported,
    };
}
