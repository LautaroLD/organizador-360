'use client';

import { SubscriptionView } from '@/components/dashboard/SubscriptionView';
import { Header } from '@/components/ui/Header';

export default function SubscriptionPage() {
  return <>
    <Header
      title="Suscripción"
      subtitle="Administra tu plan y funciones premium"
    />
    <SubscriptionView />;
  </>;
}
