import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationStore {
    notificationsEnabled: boolean;
    pushEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => void;
    setPushEnabled: (enabled: boolean) => void;
    toggleNotifications: () => void;
    togglePush: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
    persist(
        (set) => ({
            notificationsEnabled: false,
            pushEnabled: false,
            setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
            setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
            toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
            togglePush: () => set((state) => ({ pushEnabled: !state.pushEnabled })),
        }),
        {
            name: 'notification-storage', // name of the item in localStorage
        }
    )
);
