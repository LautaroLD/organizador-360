/**
 * Auth Models
 * Tipos relacionados con autenticación
 */

import { User } from '@supabase/supabase-js';

export interface AuthStore {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => void;
}
