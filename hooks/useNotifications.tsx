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
    notify: (title: string, body: string, options?: { onClick?: () => void; playSound?: boolean }) => void;
    isSupported: boolean;
}

/**
 * Hook for managing browser notifications
 */
export function useNotifications(): UseNotificationsReturn {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        // Check if notifications are supported
        if ('Notification' in window) {
            setIsSupported(true);
            setPermission(Notification.permission as NotificationPermission);
        }
    }, []);

    const requestPermission = useCallback(async () => {
        const newPermission = await requestNotificationPermission();
        setPermission(newPermission);
    }, []);

    const notify = useCallback((
        title: string,
        body: string,
        options?: { onClick?: () => void; playSound?: boolean }
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
