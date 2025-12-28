'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';

type Facture = Database['public']['Tables']['factures']['Row'];
type DevisForFacture = {
  id: string;
  numero: string;
  total_ttc: number;
  client: {
    nom: string;
    societe: string | null;
  } | null;
};

export default function FacturesPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleDevis, setEligibleDevis] = useState<DevisForFacture[]>([]);
  const [selectedDevisId, setSelectedDevisId] = useState('');
  const [loadingDevis, setLoadingDevis] = useState(false);
  const [creatingFacture, setCreatingFacture] = useState(false);

  const fetchFactures = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('factures')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFactures(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchEligibleDevis = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingDevis(true);
      const { data, error } = await supabase
        .from('devis')
        .select(`
          id,
          numero,
          total_ttc,
          client:clients(nom, societe)
        `)
        .eq('user_id', user.id)
        .eq('statut', 'accepte')
        .order('date_creation', { ascending: false });

      if (error) throw error;

      const devisData = (data || []).map((d: any) => ({
        ...d,
        client: Array.isArray(d.client) ? d.client[0] : d.client,
      })) as DevisForFacture[];

      if (devisData.length === 0) {
        setEligibleDevis([]);
        setSelectedDevisId('');
        return;
      }

      const devisIds = devisData.map((d) => d.id);
      const { data: facturesData, error: facturesError } = await supabase
        .from('factures')
        .select('devis_id')
        .in('devis_id', devisIds);

      if (facturesError) throw facturesError;

      const facturedIds = new Set(
        (facturesData || []).map((facture) => facture.devis_id).filter(Boolean)
      );

      const availableDevis = devisData.filter((d) => !facturedIds.has(d.id));
      setEligibleDevis(availableDevis);
      setSelectedDevisId(availableDevis[0]?.id || '');
    } catch (error: any) {
      toast.error('Erreur lors du chargement des devis');
    } finally {
      setLoadingDevis(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchFactures();
    }
  }, [authLoading, fetchFactures, router, user]);

  const getStatusBadge = (statut: string) => {
    const styles = {
      payee: 'bg-green-100 text-green-800',
      non_payee: 'bg-orange-100 text-orange-800',
      annulee: 'bg-red-100 text-red-800',
    };

    const labels = {
      payee: 'Payée',
      non_payee: 'Non payée',
      annulee: 'Annulée',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[statut as keyof typeof styles]}`}>
        {labels[statut as keyof typeof labels]}
      </span>
    );
  };

  const handleCreateFacture = () => {
    if (!profile?.profil_complete) {
      toast.error('Veuillez completer votre profil avant de creer une facture');
      router.push('/profil');
      return;
    }
    setShowCreateModal(true);
    fetchEligibleDevis();
  };

  const handleCreateFactureFromDevis = async () => {
    if (!selectedDevisId) {
      toast.error('Selectionnez un devis');
      return;
    }

    try {
      setCreatingFacture(true);
      toast.loading('Creation de la facture...', { id: 'create-facture' });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expiree');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-facture`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            devis_id: selectedDevisId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la creation de la facture');
      }

      const { facture } = await response.json();

      toast.success('Facture creee avec succes', { id: 'create-facture' });
      setShowCreateModal(false);
      setSelectedDevisId('');
      fetchFactures();
      if (facture?.id) {
        router.push(`/factures/${facture.id}`);
      }
    } catch (error: any) {
      toast.error(error.message, { id: 'create-facture' });
    } finally {
      setCreatingFacture(false);
    }
  };

  if (authLoading || loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Factures</h1>
          <button
            onClick={handleCreateFacture}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium"
          >
            Créer une facture
          </button>
        </div>

        {!profile?.profil_complete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              Complétez votre profil pour pouvoir créer des factures.{' '}
              <Link href="/profil" className="font-medium underline">
                Compléter maintenant
              </Link>
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numéro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Échéance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total HT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total TTC
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {factures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucune facture
                  </td>
                </tr>
              ) : (
                factures.map((f) => (
                  <tr key={f.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {f.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(f.date_emission).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(f.statut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {f.total_ht.toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {f.total_ttc.toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Link href={`/factures/${f.id}`} className="text-blue-600 hover:text-blue-900">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Creer une facture</h2>

            {loadingDevis ? (
              <div className="text-sm text-gray-600">Chargement des devis...</div>
            ) : eligibleDevis.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aucun devis accepte disponible.
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="devis-facture" className="block text-sm font-medium text-gray-700">
                  Devis accepte
                </label>
                <select
                  id="devis-facture"
                  value={selectedDevisId}
                  onChange={(e) => setSelectedDevisId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selectionner un devis</option>
                  {eligibleDevis.map((d) => {
                    const clientLabel = d.client?.societe || d.client?.nom || 'Client';
                    return (
                      <option key={d.id} value={d.id}>
                        {d.numero} - {clientLabel} - {Number(d.total_ttc).toFixed(2)} EUR
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedDevisId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateFactureFromDevis}
                disabled={creatingFacture || loadingDevis || !selectedDevisId}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingFacture ? 'Creation...' : 'Creer la facture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
