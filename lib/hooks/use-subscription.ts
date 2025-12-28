import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../auth-context';
import type { Database } from '../database.types';

type Abonnement = Database['public']['Tables']['abonnements']['Row'];

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Abonnement | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      setIsActive(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('abonnements')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        setSubscription(data);

        if (data) {
          const now = new Date();
          const isTrialActive =
            data.statut === 'trial' &&
            new Date(data.date_fin_trial) > now;

          const isSubscriptionActive =
            data.statut === 'active' &&
            (!data.date_fin_abonnement || new Date(data.date_fin_abonnement) > now);

          setIsActive(isTrialActive || isSubscriptionActive);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  return { subscription, loading, isActive };
}
