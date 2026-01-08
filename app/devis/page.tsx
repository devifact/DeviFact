'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useProfile } from '@/lib/hooks/use-profile.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Database } from '@/lib/database.types.ts';

type Devis = Database['public']['Tables']['devis']['Row'];
type ClientPreview = {
  nom: string;
  societe: string | null;
} | null;
type DevisWithRelations = Devis & {
  client: ClientPreview | ClientPreview[];
  factures?: { id: string }[] | null;
};
type DevisWithClient = Devis & {
  client: ClientPreview;
  hasInvoice: boolean;
};

export default function DevisPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [devis, setDevis] = useState<DevisWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [factureLoadingId, setFactureLoadingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchDevis = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('devis')
        .select('*, client:clients(nom, societe), factures(id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const devisData = ((data || []) as DevisWithRelations[]).map((d) => {
        const factures = Array.isArray(d.factures) ? d.factures : [];
        return {
          ...d,
          client: Array.isArray(d.client) ? d.client[0] : d.client,
          hasInvoice: factures.length > 0,
        };
      }) as DevisWithClient[];
      setDevis(devisData);
      setSelectedIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchDevis();
    }
  }, [user, authLoading, router, fetchDevis]);

  const getStatusBadge = (statut: string) => {
    const styles = {
      brouillon: 'bg-gray-100 text-gray-800',
      envoye: 'bg-blue-100 text-blue-800',
      accepte: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[statut as keyof typeof styles]}`}>
        {statut.charAt(0).toUpperCase() + statut.slice(1)}
      </span>
    );
  };

  const handleCreateDevis = () => {
    if (!profile?.profil_complete) {
      toast.error('Veuillez compléter votre profil avant de créer un devis');
      router.push('/profil');
      return;
    }
    router.push('/devis/nouveau');
  };

  const handleViewDevis = (devisId: string) => {
    router.push(`/devis/${devisId}`);
  };

  const handlePrintDevis = (devisId: string) => {
    router.push(`/devis/${devisId}?print=1`);
  };

  const handleDeleteDevis = async (devisId: string, numero: string) => {
    const confirmDelete = globalThis.confirm?.(
      `Êtes-vous sûr de vouloir supprimer le devis ${numero} ?`
    );
    if (!confirmDelete) {
      return;
    }

    if (deleteLoading) return;
    setDeleteLoading(true);

    try {
      const { error } = await supabase
        .from('devis')
        .delete()
        .eq('id', devisId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Devis supprimé avec succès');
      fetchDevis();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSelectedDevis = async (selected: DevisWithClient[]) => {
    if (!selected.length) return;

    const confirmDelete = globalThis.confirm?.(
      `Confirmer la suppression de ${selected.length} devis ?`
    );
    if (!confirmDelete) {
      return;
    }

    if (deleteLoading) return;
    setDeleteLoading(true);

    try {
      const ids = selected.map((d) => d.id);
      const { error } = await supabase
        .from('devis')
        .delete()
        .in('id', ids)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Devis supprimes avec succes');
      setSelectedIds([]);
      fetchDevis();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === devis.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(devis.map((d) => d.id));
    }
  };

  const toggleSelectDevis = (devisId: string) => {
    setSelectedIds((prev) => (
      prev.includes(devisId)
        ? prev.filter((id) => id !== devisId)
        : [...prev, devisId]
    ));
  };

  const getSingleSelection = (actionLabel: string) => {
    if (selectedIds.length !== 1) {
      toast.error(`Selectionnez un seul devis pour ${actionLabel}`);
      return null;
    }
    const selected = devis.find((d) => d.id === selectedIds[0]);
    return selected || null;
  };

  const handleActionFacturer = async () => {
    const selected = getSingleSelection('facturer');
    if (!selected) return;
    await handleFacturer(selected.id, selected.statut);
  };

  const handleActionModifier = () => {
    const selected = getSingleSelection('modifier');
    if (!selected) return;
    if (selected.hasInvoice) return;
    router.push(`/devis/nouveau?edit=${encodeURIComponent(selected.id)}`);
  };

  const handleActionDelete = async () => {
    if (!selectedIds.length) {
      toast.error('Selectionnez au moins un devis');
      return;
    }
    const selected = devis.filter((d) => selectedIds.includes(d.id));
    if (selected.length === 1) {
      await handleDeleteDevis(selected[0].id, selected[0].numero);
      return;
    }
    await handleDeleteSelectedDevis(selected);
  };

  const handleActionPrint = () => {
    if (!selectedIds.length) {
      return;
    }
    const selected = devis.filter((d) => selectedIds.includes(d.id));
    if (selected.length === 1) {
      handlePrintDevis(selected[0].id);
      return;
    }
    selected.forEach((item) => {
      window.open(`/devis/${item.id}?print=1`, '_blank', 'noopener,noreferrer');
    });
  };

  const handleFacturer = async (devisId: string, statut: Devis['statut']) => {
    if (statut !== 'accepte') {
      toast.error('Le devis doit etre accepte pour facturer');
      return;
    }
    if (factureLoadingId === devisId) return;
    setFactureLoadingId(devisId);

    try {
      toast.loading('Création de la facture...', { id: `facture-${devisId}` });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expirée');
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
            devis_id: devisId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création de la facture');
      }

      const { facture } = await response.json();

      toast.success('Facture créée avec succès', { id: `facture-${devisId}` });
      if (facture?.id) {
        router.push(`/factures/${facture.id}`);
      } else {
        router.push('/factures');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: `facture-${devisId}` });
    } finally {
      setFactureLoadingId(null);
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

  const allSelected = devis.length > 0 && selectedIds.length === devis.length;
  const selectedSingle = selectedIds.length === 1
    ? devis.find((d) => d.id === selectedIds[0]) ?? null
    : null;
  const hasSelection = selectedIds.length > 0;
  const canFacturer = !!selectedSingle && selectedSingle.statut === 'accepte';
  const canModifier = !!selectedSingle && !selectedSingle.hasInvoice;
  const canPrint = hasSelection;
  const isFacturerLoading = !!selectedSingle && factureLoadingId === selectedSingle.id;

  return (
    <DashboardLayout>
      <div>
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Devis</h1>
          <button
            type="button"
            onClick={handleCreateDevis}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            Créer un devis
          </button>
        </div>

        {!profile?.profil_complete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              Complétez votre profil pour pouvoir créer des devis.{' '}
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
                disabled={!canFacturer || isFacturerLoading}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Facturer
              </button>
              <button
                type="button"
                onClick={handleActionModifier}
                disabled={!canModifier}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={handleActionDelete}
                disabled={!hasSelection || deleteLoading}
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
            <table className="w-full min-w-[860px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Selectionner tous les devis"
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
              {devis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun devis
                  </td>
                </tr>
              ) : (
                devis.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => handleViewDevis(d.id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(d.id)}
                        onChange={() => toggleSelectDevis(d.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Selectionner le devis ${d.numero}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {d.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {d.client?.societe || d.client?.nom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(d.date_creation).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(d.statut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {d.total_ht.toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {d.total_ttc.toFixed(2)} €
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
