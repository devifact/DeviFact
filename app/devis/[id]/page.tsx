'use client';

export const runtime = 'edge';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';

type Devis = Database['public']['Tables']['devis']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type LigneDevis = Database['public']['Tables']['lignes_devis']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const sumTotals = (lignes: LigneDevis[]) => {
  return lignes.reduce(
    (acc, ligne) => {
      const totalLigne = Number(ligne.total_ligne_ht ?? 0);
      const taux = Number(ligne.taux_tva ?? 0);
      acc.totalHt += totalLigne;
      acc.totalTva += totalLigne * (taux / 100);
      return acc;
    },
    { totalHt: 0, totalTva: 0 }
  );
};

export default function DevisDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const devisId = params?.id as string;

  const [devis, setDevis] = useState<Devis | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [factureId, setFactureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [factureLoading, setFactureLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [printHandled, setPrintHandled] = useState(false);

  const fetchDevisDetails = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [devisResult, profileResult] = await Promise.all([
        supabase
          .from('devis')
          .select('*')
          .eq('id', devisId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (devisResult.error) throw devisResult.error;
      if (profileResult.error) throw profileResult.error;

      if (!devisResult.data) {
        toast.error('Devis introuvable');
        router.push('/devis');
        return;
      }

      setDevis(devisResult.data);
      setNotesDraft(devisResult.data.notes || '');
      setProfile(profileResult.data);

      const [clientResult, lignesResult, factureResult] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('id', devisResult.data.client_id)
          .maybeSingle(),
        supabase
          .from('lignes_devis')
          .select('*')
          .eq('devis_id', devisId)
          .order('ordre'),
        supabase
          .from('factures')
          .select('id')
          .eq('devis_id', devisId)
          .eq('user_id', user.id)
          .limit(1),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (lignesResult.error) throw lignesResult.error;
      if (factureResult.error) throw factureResult.error;

      setClient(clientResult.data);
      setLignes(lignesResult.data || []);
      setFactureId(factureResult.data?.[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
      router.push('/devis');
    } finally {
      setLoading(false);
    }
  }, [user, devisId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && devisId) {
      fetchDevisDetails();
    }
  }, [user, authLoading, devisId, router, fetchDevisDetails]);

  useEffect(() => {
    if (!devis || printHandled) return;
    if (searchParams.get('print') === '1') {
      setPrintHandled(true);
      requestAnimationFrame(() => {
        window.print();
      });
      router.replace(`/devis/${devisId}`);
    }
  }, [devis, devisId, printHandled, router, searchParams]);

  const creerFactureDepuisDevis = async (sourceDevisId: string) => {
    if (!user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data: devisData, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', sourceDevisId)
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

    const { data: lignesData, error: lignesError } = await supabase
      .from('lignes_devis')
      .select('*')
      .eq('devis_id', devisData.id);
    if (lignesError) throw lignesError;

    if (lignesData?.length) {
      const lignesFacture = lignesData.map((ligne) => ({
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

  const dupliquerDevis = async (sourceDevisId: string) => {
    if (!user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data: devisData, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', sourceDevisId)
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

    const { data: lignesData, error: lignesError } = await supabase
      .from('lignes_devis')
      .select('*')
      .eq('devis_id', devisData.id);
    if (lignesError) throw lignesError;

    if (lignesData?.length) {
      const lignesDupliquees = lignesData.map((ligne) => ({
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

    return newDevis;
  };

  const handleDownloadPdf = () => {
    if (!devis) return;

    try {
      setGeneratingPdf(true);
      toast.loading("Ouverture de l'impression...", { id: 'pdf-generation' });
      window.print();
      toast.success('Impression ouverte', { id: 'pdf-generation' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'pdf-generation' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleFacturer = async () => {
    if (!devis) return;
    if (factureId) {
      toast.error('Une facture existe déjà pour ce devis');
      return;
    }
    if (devis.statut !== 'accepte') {
      toast.error('Le devis doit être accepté pour facturer');
      return;
    }
    if (factureLoading) return;
    setFactureLoading(true);

    try {
      toast.loading('Création de la facture...', { id: 'create-facture' });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expirée');
      }

      const facture = await creerFactureDepuisDevis(devis.id);

      toast.success('Devis accepté et facture créée avec succès', { id: 'create-facture' });
      setFactureId(facture?.id ?? null);
      if (facture?.id) {
        router.push(`/factures/${facture.id}`);
      } else {
        router.push('/factures');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'create-facture' });
    } finally {
      setFactureLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!devis || duplicateLoading) return;
    setDuplicateLoading(true);

    try {
      toast.loading('Duplication du devis...', { id: 'duplicate-devis' });
      const newDevis = await dupliquerDevis(devis.id);
      toast.success('Devis dupliqué avec succès', { id: 'duplicate-devis' });
      router.push(`/devis/${newDevis.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'duplicate-devis' });
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleUpdateStatus = async (statut: Devis['statut']) => {
    if (!devis || !user) return;
    if (devis.statut === statut) return;
    if (factureId) {
      toast.error('Ce devis est déjà facturé');
      return;
    }

    try {
      setStatusUpdating(true);
      const { error } = await supabase
        .from('devis')
        .update({ statut })
        .eq('id', devis.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setDevis({ ...devis, statut });
      toast.success('Statut mis à jour');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!devis || !user) return;
    setNotesSaving(true);

    try {
      const { error } = await supabase
        .from('devis')
        .update({ notes: notesDraft.trim() || null })
        .eq('id', devis.id)
        .eq('user_id', user.id);
      if (error) throw error;

      setDevis({ ...devis, notes: notesDraft.trim() || null });
      setEditingNotes(false);
      toast.success('Notes mises à jour');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!devis || !user) return;

    const confirmDelete = globalThis.confirm?.(
      `Êtes-vous sûr de vouloir supprimer le devis ${devis.numero} ?`
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
        .eq('id', devis.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Devis supprimé avec succès');
      router.push('/devis');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (statut: string) => {
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
      <span className={`px-3 py-1 text-sm font-medium rounded ${styles[statut as keyof typeof styles]}`}>
        {labels[statut as keyof typeof labels] || statut}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user || !devis || !client || !profile) {
    return null;
  }

  const { totalHt, totalTva } = sumTotals(lignes);
  const totalTtc = totalHt + totalTva;
  const displayTotals = lignes.length
    ? { totalHt, totalTva, totalTtc }
    : { totalHt: Number(devis.total_ht), totalTva: Number(devis.total_tva), totalTtc: Number(devis.total_ttc) };
  const displayStatus = factureId ? 'facture' : devis.statut;

  const defaultTvaRate = typeof profile.taux_tva === 'number'
    ? profile.taux_tva
    : (profile.tva_applicable === false ? 0 : 20);
  const tvaNonApplicable = defaultTvaRate === 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push('/devis')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center print-hide"
            >
              ← Retour aux devis
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                Devis {devis.numero}
              </h1>
              {getStatusBadge(displayStatus)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print-hide">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPdf ? 'Impression...' : 'Imprimer / Exporter en PDF'}
            </button>
            {factureId && (
              <button
                type="button"
                onClick={() => router.push(`/factures/${factureId}`)}
                className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 font-medium"
              >
                Voir la facture
              </button>
            )}
            <button
              type="button"
              onClick={handleFacturer}
              disabled={factureLoading || devis.statut !== 'accepte' || Boolean(factureId)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Créer une facture
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={duplicateLoading}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dupliquer
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8 print-area">
          <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Émetteur</h3>
              <p className="text-lg font-semibold text-gray-900">{profile.raison_sociale}</p>
              {profile.adresse && <p className="text-gray-600">{profile.adresse}</p>}
              {(profile.code_postal || profile.ville) && (
                <p className="text-gray-600">
                  {profile.code_postal} {profile.ville}
                </p>
              )}
              <p className="text-gray-600">{profile.pays || 'France'}</p>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {profile.telephone && <p>Tél: {profile.telephone}</p>}
                {profile.email_contact && <p>{profile.email_contact}</p>}
                {profile.siret && <p>SIRET: {profile.siret}</p>}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client</h3>
              <p className="text-lg font-semibold text-gray-900">{client.nom}</p>
              {client.societe && <p className="text-gray-600">{client.societe}</p>}
              {client.adresse && <p className="text-gray-600">{client.adresse}</p>}
              {(client.code_postal || client.ville) && (
                <p className="text-gray-600">
                  {client.code_postal} {client.ville}
                </p>
              )}
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {client.email && <p>{client.email}</p>}
                {client.telephone && <p>Tél: {client.telephone}</p>}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Informations</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Date d&apos;émission:</span>{' '}
                  {new Date(devis.date_creation).toLocaleDateString('fr-FR')}
                </p>
                {devis.date_validite && (
                  <p>
                    <span className="font-medium">Date de validité:</span>{' '}
                    {new Date(devis.date_validite).toLocaleDateString('fr-FR')}
                  </p>
                )}
                <p>
                  <span className="font-medium">TVA appliquée:</span>{' '}
                  {defaultTvaRate}%
                </p>
                {tvaNonApplicable && (
                  <p className="text-xs text-gray-500">TVA non applicable, art. 293B du CGI</p>
                )}
              </div>
              <div className="mt-4 print-hide">
                <label htmlFor="devis-statut" className="block text-sm font-medium text-gray-700 mb-2">
                  Statut du devis
                </label>
                <select
                  id="devis-statut"
                  value={devis.statut}
                  onChange={(e) => handleUpdateStatus(e.target.value as Devis['statut'])}
                  disabled={statusUpdating || Boolean(factureId)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="envoye">Envoyé</option>
                  <option value="accepte">Accepté</option>
                  <option value="refuse">Refusé</option>
                </select>
                <div className="flex flex-wrap gap-2 mt-3">
                  {devis.statut === 'brouillon' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('envoye')}
                      className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                    >
                      Marquer envoyé
                    </button>
                  )}
                  {devis.statut === 'envoye' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('accepte')}
                        className="px-3 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium"
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus('refuse')}
                        className="px-3 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium"
                      >
                        Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Total HT</p>
              <p className="text-2xl font-semibold text-gray-900">{displayTotals.totalHt.toFixed(2)} €</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Total TVA</p>
              <p className="text-2xl font-semibold text-gray-900">{displayTotals.totalTva.toFixed(2)} €</p>
            </div>
            <div className="rounded-lg border border-gray-900 bg-gray-900 p-4">
              <p className="text-xs uppercase text-gray-200">Total TTC</p>
              <p className="text-2xl font-semibold text-white">{displayTotals.totalTtc.toFixed(2)} €</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lignes du devis</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">
                      Désignation
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">
                      Qté
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">
                      Prix unit. HT
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white">
                      TVA
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-white">
                      Total HT
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                        Aucune ligne
                      </td>
                    </tr>
                  ) : (
                    lignes.map((ligne) => (
                      <tr key={ligne.id} className="print-break-avoid">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ligne.designation}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ligne.quantite}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {Number(ligne.prix_unitaire_ht).toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {ligne.taux_tva}%
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {Number(ligne.total_ligne_ht).toFixed(2)} €
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Notes et conditions</h3>
              <div className="flex items-center gap-2 print-hide">
                {!editingNotes && (
                  <button
                    type="button"
                    onClick={() => setEditingNotes(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Modifier
                  </button>
                )}
                {editingNotes && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotes(false);
                        setNotesDraft(devis.notes || '');
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="text-sm text-green-700 hover:text-green-900 disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingNotes ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ajoutez des conditions, délais, ou informations utiles..."
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {devis.notes || 'Ajoutez vos conditions de réalisation, délais ou mentions particulières.'}
              </p>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: #fff;
          }

          nav,
          aside,
          header,
          button,
          select,
          .print-hide {
            display: none !important;
          }

          .print-area {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }

          .print-area table {
            page-break-inside: auto;
          }

          thead {
            display: table-header-group;
          }

          .print-break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
