'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context.tsx';
import { useSubscription } from '@/lib/hooks/use-subscription.ts';

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, isActive } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!subLoading && user && !isActive) {
      router.push('/abonnement');
    }
  }, [user, authLoading, isActive, subLoading, router]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user || !isActive) {
    return null;
  }

  return <>{children}</>;
}
