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
type ClientPreview = {
  nom: string;
  societe: string | null;
} | null;
type FactureWithClient = Facture & {
  client: ClientPreview;
};
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
  const [factures, setFactures] = useState<FactureWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleDevis, setEligibleDevis] = useState<DevisForFacture[]>([]);
  const [selectedDevisId, setSelectedDevisId] = useState('');
  const [loadingDevis, setLoadingDevis] = useState(false);
  const [creatingFacture, setCreatingFacture] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchFactures = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('factures')
        .select('*, client:clients(nom, societe)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const facturesData = ((data || []) as FactureWithClient[]).map((f) => ({
        ...f,
        client: Array.isArray(f.client) ? f.client[0] : f.client,
      }));
      setFactures(facturesData);
      setSelectedIds([]);
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

      // deno-lint-ignore no-process-global
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL manquante');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-facture`,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'create-facture' });
    } finally {
      setCreatingFacture(false);
    }
  };

  const handleViewFacture = (factureId: string) => {
    router.push(`/factures/${factureId}`);
  };

  const handlePrintFacture = (factureId: string) => {
    router.push(`/factures/${factureId}?print=1`);
  };

  const handleDeleteFacture = async (factureId: string, numero: string) => {
    const confirmDelete = globalThis.confirm?.(
      `Confirmer la suppression de la facture ${numero} ?`
    );
    if (!confirmDelete) {
      return;
    }

    if (deleteLoading) return;
    setDeleteLoading(true);

    try {
      const { error } = await supabase
        .from('factures')
        .delete()
        .eq('id', factureId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Facture supprimee avec succes');
      fetchFactures();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSelectedFactures = async (selected: FactureWithClient[]) => {
    if (!selected.length) return;

    const confirmDelete = globalThis.confirm?.(
      `Confirmer la suppression de ${selected.length} factures ?`
    );
    if (!confirmDelete) {
      return;
    }

    if (deleteLoading) return;
    setDeleteLoading(true);

    try {
      const ids = selected.map((f) => f.id);
      const { error } = await supabase
        .from('factures')
        .delete()
        .in('id', ids)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Factures supprimees avec succes');
      setSelectedIds([]);
      fetchFactures();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === factures.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(factures.map((f) => f.id));
    }
  };

  const toggleSelectFacture = (factureId: string) => {
    setSelectedIds((prev) => (
      prev.includes(factureId)
        ? prev.filter((id) => id !== factureId)
        : [...prev, factureId]
    ));
  };

  const getSingleSelection = (actionLabel: string) => {
    if (selectedIds.length !== 1) {
      toast.error(`Selectionnez une seule facture pour ${actionLabel}`);
      return null;
    }
    const selected = factures.find((f) => f.id === selectedIds[0]);
    return selected || null;
  };

  const handleActionFacturer = () => {
    toast.error('Action indisponible sur les factures');
  };

  const handleActionModifier = () => {
    const selected = getSingleSelection('modifier');
    if (!selected) return;
    handleViewFacture(selected.id);
  };

  const handleActionDelete = async () => {
    if (!selectedIds.length) {
      return;
    }
    const selected = factures.filter((f) => selectedIds.includes(f.id));
    if (selected.length === 1) {
      await handleDeleteFacture(selected[0].id, selected[0].numero);
      return;
    }
    await handleDeleteSelectedFactures(selected);
  };

  const handleActionPrint = () => {
    if (!selectedIds.length) {
      return;
    }
    const selected = factures.filter((f) => selectedIds.includes(f.id));
    if (selected.length === 1) {
      handlePrintFacture(selected[0].id);
      return;
    }
    selected.forEach((item) => {
      window.open(`/factures/${item.id}?print=1`, '_blank', 'noopener,noreferrer');
    });
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

  const allSelected = factures.length > 0 && selectedIds.length === factures.length;
  const hasSelection = selectedIds.length > 0;
  const canFacturer = false;
  const canModifier = false;
  const canPrint = hasSelection;
  const canDelete = hasSelection && !deleteLoading;

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
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-6 py-4">
            <span className="text-sm text-gray-600">
              Selection: {selectedIds.length}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleActionFacturer}
                disabled={!canFacturer}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="Action disponible sur les devis"
              >
                Facturer
              </button>
              <button
                type="button"
                onClick={handleActionModifier}
                disabled={!canModifier}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Action indisponible sur les factures"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={handleActionDelete}
                disabled={!canDelete}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={handleActionPrint}
                disabled={!canPrint}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Imprimer
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Selectionner toutes les factures"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numero
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Echeance
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {factures.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      Aucune facture
                    </td>
                  </tr>
                ) : (
                  factures.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => handleViewFacture(f.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(f.id)}
                          onChange={() => toggleSelectFacture(f.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Selectionner la facture ${f.numero}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {f.numero}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {f.client?.societe || f.client?.nom || '-'}
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
                      
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
