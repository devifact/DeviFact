'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { useProfile } from '@/lib/hooks/use-profile';
import { usePremium } from '@/lib/hooks/use-premium';
import { Logo } from './logo';

const navItems = [
  { name: 'Tableau de bord', href: '/dashboard', icon: '📊' },
  { name: 'Mon profil', href: '/profil', icon: '👤' },
  { name: 'Clients', href: '/clients', icon: '👥' },
  { name: 'Produits', href: '/produits', icon: '📦' },
  { name: 'Fournisseurs', href: '/fournisseurs', icon: '🏭' },
  { name: 'Devis', href: '/devis', icon: '📄' },
  { name: 'Factures', href: '/factures', icon: '🧾' },
  { name: 'Abonnement', href: '/abonnement', icon: '💳' },
];

const premiumNavItems = [
  { name: 'Comptabilité', href: '/comptabilite', icon: '💰' },
  { name: 'Gestion des stocks', href: '/stocks', icon: '📊' },
];

const trialNavItems = [
  { name: 'Comptabilité', href: '/comptabilite', icon: '🧮' },
  { name: 'Gestion Stock', href: '/stocks', icon: '📦' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { subscription, isActive } = useSubscription();
  const { profile } = useProfile();
  const { isPremium } = usePremium();
  const isTrial = subscription?.statut === 'trial' && isActive;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
                <Logo size="small" />
              </Link>
            </div>

            <div className="flex items-center gap-4">
              {subscription && (
                <div className="text-sm">
                  {subscription.statut === 'trial' && (
                    <span className="text-orange-600 font-medium">
                      Essai gratuit
                    </span>
                  )}
                  {subscription.statut === 'active' && (
                    <span className="text-green-600 font-medium">
                      Abonnement actif
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-red-600 font-medium">
                      Abonnement expiré
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </nav>

      {!isActive && pathname !== '/abonnement' && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-red-800 text-center">
              Votre abonnement a expiré.{' '}
              <Link href="/abonnement" className="font-medium underline">
                Renouveler maintenant
              </Link>
            </p>
          </div>
        </div>
      )}

      {profile && !profile.profil_complete && pathname !== '/profil' && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-yellow-800 text-center">
              Veuillez compléter votre profil avant de créer des devis.{' '}
              <Link href="/profil" className="font-medium underline">
                Compléter mon profil
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                        : 'text-gray-700 hover:bg-gray-100 border-l-4 border-transparent'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}

              {isTrial && trialNavItems.map((item) => (
                <span
                  key={item.href}
                  role="link"
                  aria-disabled="true"
                  title="Disponible apres la periode d'essai"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 bg-gray-50 border-l-4 border-transparent cursor-not-allowed"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </span>
              ))}

              {isPremium && (
                <>
                  <div className="my-4 border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2 px-4 mb-2">
                      <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Premium
                      </span>
                    </div>
                  </div>
                  {premiumNavItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-amber-50 text-amber-900 border-l-4 border-amber-500'
                            : 'text-slate-700 hover:bg-amber-50 border-l-4 border-transparent'
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
