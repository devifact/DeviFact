import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase.ts';
import { useAuth } from '../auth-context.tsx';
import type { Database } from '../database.types.ts';

type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

export function useCompanySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data ?? null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<CompanySettings>) => {
    if (!user) throw new Error('No user');

    const payload = {
      user_id: user.id,
      ...updates,
    };

    const { error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;

    const { data: updated } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (updated) {
      setSettings(updated);
    }
  };

  return { settings, loading, error, updateSettings, refetchSettings: fetchSettings };
}
