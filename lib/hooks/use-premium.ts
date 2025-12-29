import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { useAuth } from '@/lib/auth-context.tsx';

interface PremiumStatus {
  isPremium: boolean;
  premiumActive: boolean;
  mainSubscriptionActive: boolean;
  subscriptionStatus: 'trial' | 'active' | 'canceled' | 'expired' | null;
  premiumType: 'mensuel' | 'annuel' | null;
  premiumEndDate: string | null;
  loading: boolean;
}

export function usePremium(): PremiumStatus {
  const { user } = useAuth();
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus>({
    isPremium: false,
    premiumActive: false,
    mainSubscriptionActive: false,
    subscriptionStatus: null,
    premiumType: null,
    premiumEndDate: null,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setPremiumStatus({
        isPremium: false,
        premiumActive: false,
        mainSubscriptionActive: false,
        subscriptionStatus: null,
        premiumType: null,
        premiumEndDate: null,
        loading: false,
      });
      return;
    }

    const fetchPremiumStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('abonnements')
          .select('option_premium_active, type_premium, date_fin_premium, statut, date_fin_abonnement')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const now = new Date();
          const mainSubscriptionActive =
            data.statut === 'active' &&
            (!data.date_fin_abonnement || new Date(data.date_fin_abonnement) > now);
          const premiumActive =
            data.option_premium_active === true &&
            (!data.date_fin_premium || new Date(data.date_fin_premium) > now);

          setPremiumStatus({
            isPremium: mainSubscriptionActive && premiumActive,
            premiumActive,
            mainSubscriptionActive,
            subscriptionStatus: data.statut ?? null,
            premiumType: data.type_premium,
            premiumEndDate: data.date_fin_premium,
            loading: false,
          });
        } else {
          setPremiumStatus({
            isPremium: false,
            premiumActive: false,
            mainSubscriptionActive: false,
            subscriptionStatus: null,
            premiumType: null,
            premiumEndDate: null,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error fetching premium status:', error);
        setPremiumStatus({
          isPremium: false,
          premiumActive: false,
          mainSubscriptionActive: false,
          subscriptionStatus: null,
          premiumType: null,
          premiumEndDate: null,
          loading: false,
        });
      }
    };

    fetchPremiumStatus();
  }, [user]);

  return premiumStatus;
}
