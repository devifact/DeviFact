'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useProfile } from '@/lib/hooks/use-profile.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Database } from '@/lib/database.types.ts';

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
type DevisWithClient = DevisForFacture & {
  client: DevisForFacture['client'] | DevisForFacture['client'][];
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
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

      const devisData = ((data || []) as DevisWithClient[]).map((d) => ({
        ...d,
        client: Array.isArray(d.client) ? d.client[0] : d.client,
      }));

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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement des devis';
      toast.error(message);
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

  const getFactureStatus = (facture: Facture) => {
    if (facture.statut === 'payee') {
      return { label: 'Payée', className: 'bg-green-100 text-green-800' };
    }
    if (facture.statut === 'partiellement_payee') {
      return { label: 'Partiellement payée', className: 'bg-yellow-100 text-yellow-800' };
    }
    if (facture.statut === 'annulee') {
      return { label: 'Annulée', className: 'bg-red-100 text-red-800' };
    }
    if (Number(facture.total_ttc) === 0) {
      return { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' };
    }
    return { label: 'Envoyée', className: 'bg-blue-100 text-blue-800' };
  };

  const handleCreateFacture = () => {
    if (!profile?.profil_complete) {
      toast.error('Veuillez compléter votre profil avant de créer une facture');
      router.push('/profil');
      return;
    }
    setShowCreateModal(true);
    fetchEligibleDevis();
  };

  const handleViewFacture = (factureId: string) => {
    router.push(`/factures/${factureId}`);
  };

  const handlePrintFacture = (factureId: string) => {
    router.push(`/factures/${factureId}?print=1`);
  };

  const handlePaiementFacture = (factureId: string, type: 'acompte' | 'solde') => {
    router.push(`/factures/${factureId}?paiement=${type}`);
  };

  const creerFactureDepuisDevis = async (devisId: string) => {
    if (!user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data: devisData, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', devisId)
      .single();
    if (devisError) throw devisError;

    const { data: existingFactures, error: existingError } = await supabase
      .from('factures')
      .select('id')
      .eq('devis_id', devisData.id);
    if (existingError) throw existingError;
    if (existingFactures && existingFactures.length > 0) {
      throw new Error('Une facture existe déjà pour ce devis');
    }

    const { data: numeroData, error: numeroError } = await supabase
      .rpc('generate_facture_number', { p_user_id: user.id });
    const numero = numeroData
      || (devisData.numero?.startsWith('DEV-')
        ? devisData.numero.replace(/^DEV-/, 'FA-')
        : `FA-${Date.now()}`);
    if (numeroError && !numeroData) {
      throw numeroError;
    }

    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert({
        devis_id: devisData.id,
        client_id: devisData.client_id,
        user_id: user.id,
        numero,
        total_ht: devisData.total_ht,
        total_tva: devisData.total_tva,
        total_ttc: devisData.total_ttc,
      })
      .select()
      .single();
    if (factureError) throw factureError;

    const { data: lignes, error: lignesError } = await supabase
      .from('lignes_devis')
      .select('*')
      .eq('devis_id', devisData.id);
    if (lignesError) throw lignesError;

    if (lignes?.length) {
      const lignesFacture = lignes.map((ligne) => ({
        facture_id: facture.id,
        designation: ligne.designation,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva,
        fournisseur_id: ligne.fournisseur_id,
        ordre: ligne.ordre,
      }));
      const { error: insertError } = await supabase
        .from('lignes_factures')
        .insert(lignesFacture);
      if (insertError) throw insertError;
    }

    return facture;
  };

  const handleCreateFactureFromDevis = async () => {
    if (!selectedDevisId) {
      toast.error('Sélectionnez un devis');
      return;
    }

    try {
      setCreatingFacture(true);
      toast.loading('Création de la facture...', { id: 'create-facture' });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expirée');
      }

      const facture = await creerFactureDepuisDevis(selectedDevisId);

      toast.success('Facture créée avec succès', { id: 'create-facture' });
      setShowCreateModal(false);
      setSelectedDevisId('');
      fetchFactures();
      if (facture?.id) {
        router.push(`/factures/${facture.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'create-facture' });
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
            type="button"
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

        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] divide-y divide-gray-200">
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
                  factures.map((f) => {
                    const status = getFactureStatus(f);
                    return (
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
                          <span className={`px-2 py-1 text-xs font-medium rounded ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {f.total_ht.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {f.total_ttc.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex flex-wrap items-center justify-end gap-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewFacture(f.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintFacture(f.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Imprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaiementFacture(f.id, 'acompte')}
                              className="text-yellow-600 hover:text-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={f.statut === 'payee' || f.statut === 'annulee'}
                            >
                              Acompte
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaiementFacture(f.id, 'solde')}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={f.statut === 'payee' || f.statut === 'annulee'}
                            >
                              Solde
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Créer une facture</h2>

            {loadingDevis ? (
              <div className="text-sm text-gray-600">Chargement des devis...</div>
            ) : eligibleDevis.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aucun devis accepté disponible.
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="devis-facture" className="block text-sm font-medium text-gray-700">
                  Devis accepté
                </label>
                <select
                  id="devis-facture"
                  value={selectedDevisId}
                  onChange={(e) => setSelectedDevisId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Sélectionner un devis</option>
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
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white text-gray-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateFactureFromDevis}
                disabled={creatingFacture || loadingDevis || !selectedDevisId}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingFacture ? 'Création...' : 'Créer la facture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
