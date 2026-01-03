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
type FactureMap = Record<string, string>;

export default function DevisPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [factureMap, setFactureMap] = useState<FactureMap>({});
  const [factureLoadingId, setFactureLoadingId] = useState<string | null>(null);
  const [duplicateLoadingId, setDuplicateLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const fetchDevis = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('devis')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const devisData = data || [];
      setDevis(devisData);

      if (devisData.length === 0) {
        setFactureMap({});
        return;
      }

      const devisIds = devisData.map((item) => item.id);
      const { data: facturesData, error: facturesError } = await supabase
        .from('factures')
        .select('id, devis_id')
        .in('devis_id', devisIds);

      if (facturesError) throw facturesError;

      const map: FactureMap = {};
      for (const facture of facturesData || []) {
        if (facture.devis_id) {
          map[facture.devis_id] = facture.id;
        }
      }
      setFactureMap(map);
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

  const getStatusBadge = (statut: string, isFactured: boolean) => {
    const displayStatus = isFactured ? 'facture' : statut;
    const styles = {
      brouillon: 'bg-gray-100 text-gray-800',
      envoye: 'bg-blue-100 text-blue-800',
      accepte: 'bg-green-100 text-green-800',
      refuse: 'bg-red-100 text-red-800',
      facture: 'bg-teal-100 text-teal-800',
    };

    const labels = {
      brouillon: 'Brouillon',
      envoye: 'Envoyé',
      accepte: 'Accepté',
      refuse: 'Refusé',
      facture: 'Facturé',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[displayStatus as keyof typeof styles]}`}>
        {labels[displayStatus as keyof typeof labels] || displayStatus}
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

  const handleFacturer = async (devisId: string, statut: Devis['statut']) => {
    if (statut !== 'accepte') {
      toast.error('Le devis doit être accepté pour facturer');
      return;
    }

    if (factureMap[devisId]) {
      toast.error('Une facture existe déjà pour ce devis');
      return;
    }

    if (factureLoadingId === devisId) return;
    setFactureLoadingId(devisId);

    try {
      toast.loading('Création de la facture...', { id: `facture-${devisId}` });

      const facture = await creerFactureDepuisDevis(devisId);

      toast.success('Facture créée avec succès', { id: `facture-${devisId}` });
      await fetchDevis();
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

  const handleDuplicateDevis = async (devisId: string) => {
    if (!user) return;
    if (duplicateLoadingId === devisId) return;
    setDuplicateLoadingId(devisId);

    try {
      toast.loading('Duplication du devis...', { id: `duplicate-${devisId}` });

      const { data: devisData, error: devisError } = await supabase
        .from('devis')
        .select('*')
        .eq('id', devisId)
        .eq('user_id', user.id)
        .single();
      if (devisError) throw devisError;

      const { data: numeroData, error: numeroError } = await supabase
        .rpc('generate_devis_number', { p_user_id: user.id });
      const numero = numeroData || `DEV-${Date.now()}`;
      if (numeroError && !numeroData) {
        throw numeroError;
      }

      const { data: newDevis, error: newDevisError } = await supabase
        .from('devis')
        .insert({
          user_id: user.id,
          numero,
          client_id: devisData.client_id,
          date_validite: devisData.date_validite,
          statut: 'brouillon',
          total_ht: devisData.total_ht,
          total_tva: devisData.total_tva,
          total_ttc: devisData.total_ttc,
          notes: devisData.notes,
        })
        .select()
        .single();
      if (newDevisError) throw newDevisError;

      const { data: lignes, error: lignesError } = await supabase
        .from('lignes_devis')
        .select('*')
        .eq('devis_id', devisData.id);
      if (lignesError) throw lignesError;

      if (lignes?.length) {
        const lignesDupliquees = lignes.map((ligne) => ({
          devis_id: newDevis.id,
          designation: ligne.designation,
          quantite: ligne.quantite,
          prix_unitaire_ht: ligne.prix_unitaire_ht,
          taux_tva: ligne.taux_tva,
          fournisseur_id: ligne.fournisseur_id,
          ordre: ligne.ordre,
        }));
        const { error: insertError } = await supabase
          .from('lignes_devis')
          .insert(lignesDupliquees);
        if (insertError) throw insertError;
      }

      toast.success('Devis dupliqué avec succès', { id: `duplicate-${devisId}` });
      await fetchDevis();
      router.push(`/devis/${newDevis.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: `duplicate-${devisId}` });
    } finally {
      setDuplicateLoadingId(null);
    }
  };

  const handleDeleteDevis = async (devisId: string, numero: string) => {
    const confirmDelete = globalThis.confirm?.(
      `Êtes-vous sûr de vouloir supprimer le devis ${numero} ?`
    );
    if (!confirmDelete) {
      return;
    }

    if (deleteLoadingId === devisId) return;
    setDeleteLoadingId(devisId);

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
      setDeleteLoadingId(null);
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {devis.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucun devis
                    </td>
                  </tr>
                ) : (
                  devis.map((d) => {
                    const facturedId = factureMap[d.id];
                    return (
                      <tr key={d.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {d.numero}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(d.date_creation).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getStatusBadge(d.statut, Boolean(facturedId))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {d.total_ht.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {d.total_ttc.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium">
                          <div className="flex flex-wrap items-center justify-center gap-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewDevis(d.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintDevis(d.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Imprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateDevis(d.id)}
                              className="text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={duplicateLoadingId === d.id}
                            >
                              Dupliquer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFacturer(d.id, d.statut)}
                              className="text-green-700 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={facturedId ? 'Facture déjà créée' : 'Créer une facture'}
                              disabled={Boolean(facturedId) || d.statut !== 'accepte' || factureLoadingId === d.id}
                            >
                              Facturer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDevis(d.id, d.numero)}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={deleteLoadingId === d.id}
                            >
                              Supprimer
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
    </DashboardLayout>
  );
}
