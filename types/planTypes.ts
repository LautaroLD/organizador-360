// Ponytail: Tipos centralizados para evitar duplicación en componentes

export type PlanTier = 'free' | 'starter' | 'pro';

export interface PlanResponse {
  name?: string;
  price?: string;
  buy_url?: string;
  description?: string;
  hasFreeTrial: boolean;
  trialDays: number;
}
