/**
 * Notification utilities for browser notifications
 */

export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Request permission to show browser notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('Este navegador no soporta notificaciones');
        return 'denied';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission as NotificationPermission;
    }

    return Notification.permission as NotificationPermission;
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
    return (
        'Notification' in window &&
        Notification.permission === 'granted'
    );
}

/**
 * Show a browser notification
 */
export interface ShowNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    data?: Record<string, unknown>;
    onClick?: () => void;
}

export function showNotification({
    title,
    body,
    icon = '/icons/icon-192x192.png',
    tag,
    data,
    onClick,
}: ShowNotificationOptions): Notification | null {
    if (!canShowNotifications()) {
        return null;
    }

    const notification = new Notification(title, {
        body,
        icon,
        tag,
        data,
        badge: icon,
    });

    if (onClick) {
        notification.onclick = () => {
            window.focus();
            onClick();
            notification.close();
        };
    }

    return notification;
}

/**
 * Play notification sound
 */
export function playNotificationSound(): void {
    if (typeof window === 'undefined') return;

    try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
            // Silently fail - browser autoplay policy prevents playing without user interaction
            // This is expected behavior and not an error
        });
    } catch {
        // Silently fail - audio not available or other issue
    }
}
