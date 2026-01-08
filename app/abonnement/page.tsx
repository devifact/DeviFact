'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useSubscription } from '@/lib/hooks/use-subscription.ts';
import { usePremium } from '@/lib/hooks/use-premium.ts';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase.ts';

export default function AbonnementPage() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, isActive } = useSubscription();
  const {
    isPremium,
    premiumType,
    premiumEndDate,
    premiumActive,
    mainSubscriptionActive,
    loading: premiumLoading,
  } = usePremium();
  const router = useRouter();
  const [subscribing, setSubscribing] = useState(false);
  const [subscribingPremium, setSubscribingPremium] = useState(false);
  const [managingPremium, setManagingPremium] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSubscribe = async (plan: 'mensuel' | 'annuel') => {
    try {
      setSubscribing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Non authentifié');
        return;
      }

      // deno-lint-ignore no-process-global
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session');
      }

      if (data.url) {
        const location = globalThis.location;
        if (!location) {
          throw new Error('Navigation indisponible');
        }
        location.href = data.url;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la souscription';
      toast.error(message);
    } finally {
      setSubscribing(false);
    }
  };

  const handleSubscribePremium = async (plan: 'mensuel' | 'annuel') => {
    try {
      setSubscribingPremium(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Non authentifié');
        return;
      }

      // deno-lint-ignore no-process-global
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-premium-checkout`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session premium');
      }

      if (data.url) {
        const location = globalThis.location;
        if (!location) {
          throw new Error('Navigation indisponible');
        }
        location.href = data.url;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la souscription premium';
      toast.error(message);
    } finally {
      setSubscribingPremium(false);
    }
  };

  const handleManagePremium = async () => {
    try {
      setManagingPremium(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Non authentifie');
        return;
      }

      const location = globalThis.location;
      if (!location) {
        throw new Error('Navigation indisponible');
      }

      // deno-lint-ignore no-process-global
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-billing-portal`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: `${location.origin}/abonnement`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la creation du portail');
      }

      if (data.url) {
        location.href = data.url;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la gestion premium';
      toast.error(message);
    } finally {
      setManagingPremium(false);
    }
  };

  if (authLoading || subLoading || premiumLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user || !subscription) {
    return null;
  }

  const isTrial = subscription.statut === 'trial' && isActive;
  const hasActiveSubscription = subscription.statut === 'active';
  const isMonthlyActive = hasActiveSubscription && subscription.type_abonnement === 'mensuel';
  const isAnnualActive = hasActiveSubscription && subscription.type_abonnement === 'annuel';
  const premiumStatusLabel = isPremium ? 'Active' : 'Inactive';
  const premiumStatusClass = isPremium
    ? 'bg-green-100 text-green-800'
    : 'bg-slate-100 text-slate-700';
  let premiumStatusMessage = 'Option premium inactive. Activez-la pour acceder aux pages premium.';
  if (!mainSubscriptionActive) {
    premiumStatusMessage = isTrial
      ? "L'option premium est indisponible pendant la periode d'essai."
      : "Votre abonnement principal doit etre actif pour activer l'option premium.";
  } else if (premiumActive) {
    premiumStatusMessage = 'Option premium active.';
  }
  const premiumButtonsDisabled = subscribingPremium || premiumActive || !mainSubscriptionActive;

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Mon abonnement</h1>

        <div className="grid gap-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Statut actuel</h2>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-600">Statut</span>
                <div className="mt-1">
                  {subscription.statut === 'trial' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                      Essai gratuit
                    </span>
                  )}
                  {subscription.statut === 'active' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Actif
                    </span>
                  )}
                  {subscription.statut === 'canceled' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      Annulé
                    </span>
                  )}
                  {subscription.statut === 'expired' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      Expiré
                    </span>
                  )}
                </div>
              </div>

              {subscription.statut === 'trial' && (
                <div>
                  <span className="text-sm text-gray-600">Fin de l&apos;essai gratuit</span>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {format(new Date(subscription.date_fin_trial), 'PPP', { locale: fr })}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {Math.ceil((new Date(subscription.date_fin_trial).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} jours restants
                  </p>
                </div>
              )}

              {subscription.statut === 'active' && subscription.type_abonnement && (
                <>
                  <div>
                    <span className="text-sm text-gray-600">Type d&apos;abonnement</span>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {subscription.type_abonnement === 'mensuel' ? 'Mensuel (9,90€/mois)' : 'Annuel (99€/an)'}
                    </p>
                  </div>
                  {subscription.date_fin_abonnement && (
                    <div>
                      <span className="text-sm text-gray-600">Prochaine facturation</span>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {format(new Date(subscription.date_fin_abonnement), 'PPP', { locale: fr })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-base font-semibold text-slate-900">Option Premium</h3>
                {premiumActive && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                    Premium actif
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${premiumStatusClass}`}>
                    Statut: {premiumStatusLabel}
                  </span>
                  {premiumActive && premiumType && (
                    <span className="text-sm text-slate-600">
                      {premiumType === 'mensuel' ? 'Plan mensuel (14,90/mois)' : 'Plan annuel (149/an)'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{premiumStatusMessage}</p>
                {premiumActive && premiumEndDate && (
                  <p className="text-sm text-slate-500">
                    Prochaine facturation: {format(new Date(premiumEndDate), 'PPP', { locale: fr })}
                  </p>
                )}
              </div>
              {premiumActive && (
                <button
                  type="button"
                  onClick={handleManagePremium}
                  disabled={managingPremium}
                  className="mt-4 w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {managingPremium ? 'Chargement...' : 'Gerer / Resilier'}
                </button>
              )}
            </div>
          </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-blue-600 flex flex-col h-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Abonnement Mensuel</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">9,90€</div>
              <div className="text-sm text-gray-600 mb-4">par mois</div>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Devis et factures illimités
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Gestion clients et produits
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Calcul automatique des marges
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Export PDF professionnel
                </li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe('mensuel')}
                disabled={subscribing || hasActiveSubscription}
                className="w-full mt-auto bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {subscribing ? 'Chargement...' : isMonthlyActive
                  ? 'Abonnement actif'
                  : hasActiveSubscription
                    ? 'Déjà abonné'
                    : 'Souscrire'}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-blue-600 flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Abonnement Annuel</h3>
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                  2 MOIS OFFERTS
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">99€</div>
              <div className="text-sm text-gray-600 mb-1">par an</div>
              <div className="text-sm text-green-600 font-medium mb-4">
                Soit 8,25€/mois
              </div>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Devis et factures illimités
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Gestion clients et produits
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Calcul automatique des marges
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">✓</span>
                  Export PDF professionnel
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="font-medium">Économisez 20€/an</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe('annuel')}
                disabled={subscribing || hasActiveSubscription}
                className="w-full mt-auto bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {subscribing ? 'Chargement...' : isAnnualActive
                  ? 'Abonnement actif'
                  : hasActiveSubscription
                    ? 'Déjà abonné'
                    : 'Souscrire'}
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-md border-2 border-blue-600 p-6 hover:border-blue-700 transition-colors flex flex-col h-full">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Premium Mensuel</h3>
              <div className="text-4xl font-bold text-slate-900 mb-1">14,90 €</div>
              <div className="text-sm text-slate-600 mb-6">par mois</div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-700"><strong>Comptabilité complète</strong> avec analyses par période</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-700"><strong>Gestion des stocks</strong> avec entrées/sorties automatiques</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-700"><strong>Alertes de stock faible</strong> automatiques</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-700"><strong>Rapports comptables</strong> détaillés</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribePremium('mensuel')}
                disabled={premiumButtonsDisabled}
                className="w-full mt-auto bg-slate-900 text-white py-3 px-4 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {subscribingPremium ? 'Chargement...' : premiumActive ? 'Option active' : "Activer l'option premium"}
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-xl border-2 border-amber-400 p-6 relative overflow-hidden flex flex-col h-full">
              <div className="absolute top-4 right-4 bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">
                ECONOMISEZ 10 €
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Premium Annuel</h3>
              <div className="text-4xl font-bold text-white mb-1">149 €</div>
              <div className="text-sm text-slate-300 mb-1">par an</div>
              <div className="text-sm text-amber-400 font-semibold mb-6">
                Soit 12,42 €/mois
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-100"><strong>Comptabilité complète</strong> avec analyses par période</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-100"><strong>Gestion des stocks</strong> avec entrées/sorties automatiques</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-100"><strong>Alertes de stock faible</strong> automatiques</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-100"><strong>Rapports comptables</strong> détaillés</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-amber-400 font-semibold">Économisez 10 €/an</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribePremium('annuel')}
                disabled={premiumButtonsDisabled}
                className="w-full mt-auto bg-amber-400 text-slate-900 py-3 px-4 rounded-lg hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
              >
                {subscribingPremium ? 'Chargement...' : premiumActive ? 'Option active' : "Activer l'option premium"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-slate-50 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-600">
            Option premium en complement de votre abonnement principal - Sans engagement - Annulation a tout moment
          </p>
        </div>
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Configuration Stripe requise
          </h3>
          <p className="text-blue-700 mb-4">
            Pour activer les paiements par abonnement, vous devez configurer Stripe.
          </p>
          <a
            href="https://bolt.new/setup/stripe"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            Configurer Stripe
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}


