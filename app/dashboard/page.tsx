'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { usePremium } from '@/lib/hooks/use-premium.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { isPremium } = usePremium();
  const router = useRouter();
  const [stats, setStats] = useState({
    clients: 0,
    produits: 0,
    devis: 0,
    factures: 0,
  });

  const fetchStats = useCallback(async () => {
    if (!user) return;

    const [clients, produits, devis, factures] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('produits').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('devis').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('factures').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    setStats({
      clients: clients.count || 0,
      produits: produits.count || 0,
      devis: devis.count || 0,
      factures: factures.count || 0,
    });
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchStats();
    }
  }, [user, loading, router, fetchStats]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
          {isPremium && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-2 rounded-lg border-2 border-amber-300">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-bold text-amber-900">Premium Actif</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            href="/clients"
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition"
          >
            <div className="text-3xl mb-2">👥</div>
            <div className="text-2xl font-bold text-gray-900">{stats.clients}</div>
            <div className="text-sm text-gray-600">Clients</div>
          </Link>

          <Link
            href="/produits"
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition"
          >
            <div className="text-3xl mb-2">📦</div>
            <div className="text-2xl font-bold text-gray-900">{stats.produits}</div>
            <div className="text-sm text-gray-600">Produits</div>
          </Link>

          <Link
            href="/devis"
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition"
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="text-2xl font-bold text-gray-900">{stats.devis}</div>
            <div className="text-sm text-gray-600">Devis</div>
          </Link>

          <Link
            href="/factures"
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition"
          >
            <div className="text-3xl mb-2">🧾</div>
            <div className="text-2xl font-bold text-gray-900">{stats.factures}</div>
            <div className="text-sm text-gray-600">Factures</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions rapides</h2>
            <div className="space-y-3">
              <Link
                href="/devis"
                className="block px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
              >
                Créer un devis
              </Link>
              <Link
                href="/factures"
                className="block px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium"
              >
                Créer une facture
              </Link>
              <Link
                href="/clients"
                className="block px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Ajouter un client
              </Link>
            </div>
          </div>

          {isPremium ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <h2 className="text-xl font-semibold text-slate-900">Fonctionnalités Premium</h2>
              </div>
              <div className="space-y-3">
                <Link
                  href="/comptabilite"
                  className="block px-4 py-3 bg-white text-slate-900 rounded-lg hover:bg-slate-50 transition font-medium shadow-sm border border-amber-200"
                >
                  📊 Comptabilité
                </Link>
                <Link
                  href="/stocks"
                  className="block px-4 py-3 bg-white text-slate-900 rounded-lg hover:bg-slate-50 transition font-medium shadow-sm border border-amber-200"
                >
                  📦 Gestion des stocks
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">Découvrez le Premium</h2>
              <p className="text-sm text-slate-600 mb-4">
                Débloquez la comptabilité avancée et la gestion des stocks pour optimiser votre activité.
              </p>
              <ul className="space-y-2 mb-4 text-sm">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-slate-700">Analyses comptables par période</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-slate-700">Gestion complète des stocks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-slate-700">Alertes automatiques</span>
                </li>
              </ul>
              <Link
                href="/abonnement"
                className="block text-center px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
              >
                Découvrir Premium
              </Link>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
