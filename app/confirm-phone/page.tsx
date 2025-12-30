'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase.ts';

type ConfirmationStatus = 'loading' | 'success' | 'error';

export default function ConfirmPhonePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<ConfirmationStatus>('loading');
  const [message, setMessage] = useState('Verification en cours...');

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? '';
    if (!token) {
      setStatus('error');
      setMessage('Lien invalide.');
      return;
    }

    let cancelled = false;

    const verifyToken = async () => {
      const { error } = await supabase.functions.invoke('verify-phone-verification', {
        body: { token },
      });

      if (cancelled) return;

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Erreur lors de la confirmation.');
        return;
      }

      setStatus('success');
      setMessage('Votre numero est confirme. Vous pouvez revenir au profil.');
    };

    verifyToken();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Confirmation du numero</h1>
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/profil')}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Aller au profil
          </button>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}
