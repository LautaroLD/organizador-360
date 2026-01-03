/**
 * Web Push utilities for managing push notifications
 */

import { sendPushLog } from './pushLogs';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Convert VAPID public key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    if (typeof window === 'undefined') {
        // Return empty array during SSR
        return new Uint8Array(0);
    }

    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers are not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });

        // Force update check to ensure we have the latest version
        await registration.update();

        return registration;
    } catch (error) {
        console.error('Service worker registration failed:', error);
        return null;
    }
}

export async function subscribeToPush(
    registration: ServiceWorkerRegistration,
    userId?: string,
    retryCount: number = 0
): Promise<PushSubscription | null> {
    if (!VAPID_PUBLIC_KEY) {
        console.error('❌ VAPID public key not configured');
        if (userId) {
            sendPushLog(userId, 'error', 'VAPID public key not configured', {
                vapidKey: VAPID_PUBLIC_KEY,
            }).catch(() => {});
        }
        return null;
    }

    if (userId) {
        sendPushLog(userId, 'info', `subscribeToPush attempt ${retryCount + 1}`, {
            retryCount,
        }).catch(() => {});
    }

    try {
        // First, check if we already have a subscription
        let subscription = await registration.pushManager.getSubscription();

        // Check if existing subscription is invalid (Chrome/Android issue)
        if (subscription && (
            subscription.endpoint.includes('permanently-removed.invalid') ||
            subscription.endpoint.includes('google.com/fcm/send/')
        )) {
            console.warn('⚠️ Found invalid/expired subscription endpoint. Performing full Service Worker reset...');

            // 1. Unsubscribe
            await subscription.unsubscribe().catch(e => console.error('Unsubscribe failed:', e));

            // 2. Unregister Service Worker (Nuclear option)
            await registration.unregister();

            // 3. Re-register Service Worker
            const newRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await newRegistration.update();

            // 4. Wait for activation
            await new Promise<void>(resolve => {
                if (newRegistration.active) resolve();
                newRegistration.addEventListener('activate', () => resolve());
                // Fallback timeout
                setTimeout(resolve, 1000);
            });

            // 5. Subscribe with new registration
            subscription = await newRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });

            return subscription;
        }

        // Normal flow: If no subscription, create a new one
        if (!subscription) {
            try {
                const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource;
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey,
                });
            } catch (subscribeError) {
                console.error('❌ Failed during subscription creation:', subscribeError);
                throw subscribeError;
            }
        }

        // Double check the NEW subscription isn't invalid too
        if (subscription && subscription.endpoint.includes('permanently-removed.invalid')) {
            throw new Error('Browser returned invalid subscription even after reset. Please clear site data.');
        }

        return subscription;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Error in subscribeToPush:', errorMessage);
        
        // Log remoto del error
        if (userId) {
            sendPushLog(userId, 'error', `subscribeToPush error: ${errorMessage}`, {
                error: errorMessage,
                retryCount,
                name: (error instanceof Error ? error.name : 'Unknown'),
            }).catch(() => {});
        }
        
        // Handle Edge-specific "invalid subscription" error with retry
        if (retryCount === 0 && errorMessage && 
            (errorMessage.includes('invalid subscription') ||
             errorMessage.includes('InvalidStateError') ||
             errorMessage.includes('NetworkError'))) {
            
            console.warn('🔧 Corrupted subscription detected (Edge-specific issue). Attempting repair...');
            if (userId) {
                sendPushLog(userId, 'warn', 'Corrupted subscription detected, attempting repair', {
                    error: errorMessage,
                }).catch(() => {});
            }
            
            try {
                // 1. Get existing subscription (even if broken)
                const existingSub = await registration.pushManager.getSubscription();
                
                // 2. Force unsubscription
                if (existingSub) {
                    await existingSub.unsubscribe().catch(() => {});
                }
                
                // 3. Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 4. Retry subscription cleanly (recursive call once)
                return await subscribeToPush(registration, userId, retryCount + 1);
            } catch (repairError) {
                console.error('❌ Failed to repair subscription:', repairError);
                throw error; // Throw original error if repair fails
            }
        }
        
        // Re-throw the error so the UI can show it
        throw error;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
    registration: ServiceWorkerRegistration
): Promise<boolean> {
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Failed to unsubscribe from push:', error);
        return false;
    }
}

/**
 * Get current push subscription
 */
export async function getPushSubscription(
    registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
    try {
        const subscription = await registration.pushManager.getSubscription();

        // Auto-cleanup invalid subscriptions on read
        if (subscription && (
            subscription.endpoint.includes('permanently-removed.invalid') ||
            subscription.endpoint.includes('google.com/fcm/send/')
        )) {
            try {
                await subscription.unsubscribe().catch(() => {});
            } catch {
                // Ignore cleanup errors
            }
            return null;
        }

        return subscription;
    } catch (error) {
        console.error('❌ Failed to get push subscription:', error);
        return null;
    }
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/**
 * Save push subscription to backend
 */
export async function savePushSubscription(
    subscription: PushSubscription,
    userId: string
): Promise<boolean> {
    try {
        const subscriptionJson = subscription.toJSON();

        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                subscription: subscriptionJson,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Backend error response:', errorText);
            throw new Error(`Backend returned ${response.status}: ${errorText}`);
        }

        await response.json();
        return true;
    } catch (error) {
        console.error('❌ Failed to save push subscription:', error);
        return false;
    }
}

/**
 * Delete push subscription from backend
 */
export async function deletePushSubscription(userId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
            throw new Error('Failed to delete subscription');
        }

        return true;
    } catch (error) {
        console.error('Failed to delete push subscription:', error);
        return false;
    }
}
