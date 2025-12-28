'use client';

import { usePremium } from '@/lib/hooks/use-premium';
import { useRouter } from 'next/navigation';

interface PremiumGuardProps {
  children: React.ReactNode;
}

export default function PremiumGuard({ children }: PremiumGuardProps) {
  const { isPremium, loading, mainSubscriptionActive, premiumActive, subscriptionStatus } = usePremium();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  if (!isPremium) {
    let statusMessage = "Option premium requise.";
    if (!mainSubscriptionActive) {
      statusMessage = subscriptionStatus === 'trial'
        ? "L'option premium est indisponible pendant la periode d'essai."
        : "Votre abonnement principal doit etre actif pour acceder au premium.";
    } else if (!premiumActive) {
      statusMessage = "Option premium inactive. Activez-la pour acceder a cette page.";
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Option Premium Requise
            </h1>

            <p className="text-lg text-slate-600 mb-3 max-w-2xl mx-auto">
              Cette fonctionnalité avancée est réservée aux utilisateurs premium.
              Débloquez  la comptabilité et la gestion des stocks en souscrivant
              à notre option premium.
            </p>
            <p className="text-sm text-slate-500 mb-8">
              {statusMessage}
            </p>

            <div className="bg-slate-50 rounded-xl p-8 mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Fonctionnalités Premium
              </h2>
              <ul className="space-y-3 text-left max-w-md mx-auto">
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-700">
                    Comptabilité complète avec analyses par période
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-700">
                    Gestion des stocks avec entrées/sorties automatiques
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-700">
                    Alertes de stock faible automatiques
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-6 h-6 text-green-600 mr-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-700">
                    Rapports comptables détaillés
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/abonnement')}
                className="px-8 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
              >
                Souscrire à l'option Premium
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-lg font-semibold"
              >
                Retour au tableau de bord
              </button>
            </div>

            <p className="text-sm text-slate-500 mt-8">
              À partir de 14,90€/mois • Sans engagement
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
