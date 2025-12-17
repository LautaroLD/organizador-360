'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    registerServiceWorker,
    subscribeToPush,
    unsubscribeFromPush,
    getPushSubscription,
    isPushSupported,
    savePushSubscription,
    deletePushSubscription,
} from '@/lib/webpush';

export interface UsePushNotificationsReturn {
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    subscribe: () => Promise<boolean>;
    unsubscribe: () => Promise<boolean>;
    registration: ServiceWorkerRegistration | null;
}

/**
 * Hook for managing push notification subscriptions
 */
export function usePushNotifications(): UsePushNotificationsReturn {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const { user } = useAuthStore();
    const isSupported = isPushSupported();

    // Check subscription status on mount
    useEffect(() => {
        if (!isSupported || !user) return;

        const checkSubscription = async () => {
            try {
                const reg = await registerServiceWorker();
                if (reg) {
                    setRegistration(reg);
                    const subscription = await getPushSubscription(reg);
                    setIsSubscribed(!!subscription);
                }
            } catch (error) {
                console.error('Error checking push subscription:', error);
            }
        };

        checkSubscription();
    }, [isSupported, user]);

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !user) {
            return false;
        }

        setIsLoading(true);

        try {
            let reg = registration;
            if (!reg) {
                reg = await registerServiceWorker();
                if (!reg) {
                    throw new Error('Failed to register service worker');
                }
                setRegistration(reg);
            }

            if (reg.installing) {
                await new Promise<void>(resolve => {
                    const worker = reg?.installing;
                    if (worker) {
                        worker.addEventListener('statechange', () => {
                            if (worker.state === 'activated') resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            }

            const subscription = await subscribeToPush(reg, user.id);
            if (!subscription) {
                throw new Error('Failed to create push subscription');
            }

            const saved = await savePushSubscription(subscription, user.id);
            if (!saved) {
                throw new Error('Failed to save subscription to backend');
            }

            setIsSubscribed(true);
            return true;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, user, registration]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !user || !registration) {
            return false;
        }

        setIsLoading(true);

        try {
            // Unsubscribe from push
            await unsubscribeFromPush(registration);

            // Delete subscription from backend
            await deletePushSubscription(user.id);

            setIsSubscribed(false);
            return true;
        } catch (error) {
            console.error('Error unsubscribing from push:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, user, registration]);

    return {
        isSupported,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
        registration,
    };
}
