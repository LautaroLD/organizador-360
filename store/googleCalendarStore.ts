'use client';

import { create } from 'zustand';

interface GoogleCalendarState {
  tokens: any | null;
  isConnected: boolean;
  userEmail: string | null; // Email del usuario de Google conectado
  setTokens: (tokens: any, userEmail?: string) => void;
  disconnect: () => void;
  clearIfDifferentUser: (currentEmail: string) => boolean;
}

// Store sin persist - los tokens siempre se cargan desde Supabase
export const useGoogleCalendarStore = create<GoogleCalendarState>()((set, get) => ({
  tokens: null,
  isConnected: false,
  userEmail: null,
  setTokens: (tokens, userEmail) => set({ 
    tokens, 
    isConnected: true,
    userEmail: userEmail || null
  }),
  disconnect: () => set({ tokens: null, isConnected: false, userEmail: null }),
  clearIfDifferentUser: (currentEmail: string) => {
    const state = get();
    if (state.userEmail && state.userEmail !== currentEmail) {
      set({ tokens: null, isConnected: false, userEmail: null });
      return true; // Indica que se limpiaron los tokens
    }
    return false;
  },
}));
