'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';

type Facture = Database['public']['Tables']['factures']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type LigneFacture = Database['public']['Tables']['lignes_factures']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type FactureStatut = 'payee' | 'non_payee' | 'annulee' | 'partiellement_payee';
type FactureExtras = Facture & {
  conditions_reglement?: string | null;
  penalites_retard?: string | null;
  escompte?: string | null;
  indemnite_recouvrement?: number | null;
};

type Paiement = {
  id: string;
  facture_id: string;
  user_id: string;
  montant: number;
  date_paiement: string;
  mode_paiement: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

const sumTotals = (lignes: LigneFacture[]) => {
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

const formatCurrency = (value: number) => `${value.toFixed(2)} €`;

export default function FactureDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const factureId = params?.id as string;

  const [facture, setFacture] = useState<FactureExtras | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printHandled, setPrintHandled] = useState(false);
  const [paiementHandled, setPaiementHandled] = useState(false);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const [editingConditions, setEditingConditions] = useState(false);
  const [conditionsDraft, setConditionsDraft] = useState({
    conditions_reglement: '',
    penalites_retard: '',
    escompte: '',
    indemnite_recouvrement: '',
  });
  const [conditionsSaving, setConditionsSaving] = useState(false);

  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [paiementType, setPaiementType] = useState<'acompte' | 'solde'>('acompte');
  const [montant, setMontant] = useState('');
  const [datePaiement, setDatePaiement] = useState(() => new Date().toISOString().split('T')[0]);
  const [modePaiement, setModePaiement] = useState('Virement');
  const [reference, setReference] = useState('');
  const [paiementNotes, setPaiementNotes] = useState('');
  const [savingPaiement, setSavingPaiement] = useState(false);

  const fetchFactureDetails = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [factureResult, profileResult] = await Promise.all([
        supabase
          .from('factures')
          .select('*')
          .eq('id', factureId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (factureResult.error) throw factureResult.error;
      if (profileResult.error) throw profileResult.error;

      if (!factureResult.data) {
        toast.error('Facture introuvable');
        router.push('/factures');
        return;
      }

      const factureData = factureResult.data as FactureExtras;
      setFacture(factureData);
      setNotesDraft(factureData.notes || '');
      setConditionsDraft({
        conditions_reglement: factureData.conditions_reglement || 'Paiement à 30 jours',
        penalites_retard: factureData.penalites_retard || 'Taux BCE + 10 points',
        escompte: factureData.escompte || '',
        indemnite_recouvrement:
          factureData.indemnite_recouvrement != null
            ? String(factureData.indemnite_recouvrement)
            : '40',
      });
      setProfile(profileResult.data);

      const supabaseAny = supabase as any;
      const [clientResult, lignesResult, paiementsResult] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('id', factureData.client_id)
          .maybeSingle(),
        supabase
          .from('lignes_factures')
          .select('*')
          .eq('facture_id', factureId)
          .order('ordre'),
        supabaseAny
          .from('paiements')
          .select('*')
          .eq('facture_id', factureId)
          .order('date_paiement', { ascending: false }),
      ]);

      if (clientResult.error) throw clientResult.error;
      if (lignesResult.error) throw lignesResult.error;
      if (paiementsResult.error) throw paiementsResult.error;

      setClient(clientResult.data);
      setLignes(lignesResult.data || []);
      setPaiements((paiementsResult.data || []) as Paiement[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
      router.push('/factures');
    } finally {
      setLoading(false);
    }
  }, [user, factureId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && factureId) {
      fetchFactureDetails();
    }
  }, [authLoading, user, factureId, router, fetchFactureDetails]);

  const totals = useMemo(() => {
    if (!facture) {
      return { totalHt: 0, totalTva: 0, totalTtc: 0 };
    }

    if (lignes.length > 0) {
      const { totalHt, totalTva } = sumTotals(lignes);
      return { totalHt, totalTva, totalTtc: totalHt + totalTva };
    }

    return {
      totalHt: Number(facture.total_ht ?? 0),
      totalTva: Number(facture.total_tva ?? 0),
      totalTtc: Number(facture.total_ttc ?? 0),
    };
  }, [facture, lignes]);

  const totalPaye = useMemo(
    () => paiements.reduce((acc, paiement) => acc + Number(paiement.montant ?? 0), 0),
    [paiements]
  );
  const resteAPayer = Math.max(totals.totalTtc - totalPaye, 0);

  const statusInfo = useMemo(() => {
    if (!facture) {
      return { label: '', className: '' };
    }

    const statut = facture.statut as FactureStatut;
    if (statut === 'payee') {
      return { label: 'Payée', className: 'bg-green-100 text-green-800' };
    }
    if (statut === 'partiellement_payee') {
      return { label: 'Partiellement payée', className: 'bg-yellow-100 text-yellow-800' };
    }
    if (statut === 'annulee') {
      return { label: 'Annulée', className: 'bg-red-100 text-red-800' };
    }
    if (totals.totalTtc === 0) {
      return { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' };
    }
    return { label: 'Envoyée', className: 'bg-blue-100 text-blue-800' };
  }, [facture, totals.totalTtc]);

  const openPaiementModal = useCallback(
    (type: 'acompte' | 'solde') => {
      setPaiementType(type);
      setMontant(type === 'solde' ? resteAPayer.toFixed(2) : '');
      setDatePaiement(new Date().toISOString().split('T')[0]);
      setModePaiement('Virement');
      setReference('');
      setPaiementNotes('');
      setShowPaiementModal(true);
    },
    [resteAPayer]
  );

  useEffect(() => {
    if (!facture || printHandled || loading) return;
    if (searchParams.get('print') === '1') {
      setPrintHandled(true);
      requestAnimationFrame(() => {
        window.print();
      });
      router.replace(`/factures/${factureId}`);
    }
  }, [facture, factureId, loading, printHandled, router, searchParams]);

  useEffect(() => {
    if (!facture || paiementHandled || loading) return;

    const param = searchParams.get('paiement');
    if (param === 'acompte' || param === 'solde') {
      setPaiementHandled(true);
      openPaiementModal(param);
      router.replace(`/factures/${factureId}`);
    }
  }, [facture, factureId, loading, openPaiementModal, paiementHandled, router, searchParams]);

  const handlePrint = () => {
    try {
      setPrinting(true);
      toast.loading("Ouverture de l'impression...", { id: 'print-facture' });
      window.print();
      toast.success('Impression ouverte', { id: 'print-facture' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message, { id: 'print-facture' });
    } finally {
      setPrinting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!facture || !user) return;
    setNotesSaving(true);

    try {
      const { error } = await supabase
        .from('factures')
        .update({ notes: notesDraft.trim() || null })
        .eq('id', facture.id)
        .eq('user_id', user.id);
      if (error) throw error;

      setFacture({ ...facture, notes: notesDraft.trim() || null });
      setEditingNotes(false);
      toast.success('Notes mises à jour');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleSaveConditions = async () => {
    if (!facture || !user) return;

    const indemniteValue = conditionsDraft.indemnite_recouvrement.trim();
    const indemniteParsed = indemniteValue === '' ? null : Number(indemniteValue.replace(',', '.'));

    if (indemniteParsed !== null && Number.isNaN(indemniteParsed)) {
      toast.error("L'indemnité de recouvrement doit être un nombre");
      return;
    }

    setConditionsSaving(true);

    try {
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from('factures')
        .update({
          conditions_reglement: conditionsDraft.conditions_reglement.trim() || null,
          penalites_retard: conditionsDraft.penalites_retard.trim() || null,
          escompte: conditionsDraft.escompte.trim() || null,
          indemnite_recouvrement: indemniteParsed,
        })
        .eq('id', facture.id)
        .eq('user_id', user.id);
      if (error) throw error;

      setFacture({
        ...facture,
        conditions_reglement: conditionsDraft.conditions_reglement.trim() || null,
        penalites_retard: conditionsDraft.penalites_retard.trim() || null,
        escompte: conditionsDraft.escompte.trim() || null,
        indemnite_recouvrement: indemniteParsed,
      });
      setEditingConditions(false);
      toast.success('Conditions mises à jour');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setConditionsSaving(false);
    }
  };

  const handleAddPaiement = async () => {
    if (!facture || !user) return;

    const montantValue = Number(montant.replace(',', '.'));
    if (Number.isNaN(montantValue) || montantValue <= 0) {
      toast.error('Montant invalide');
      return;
    }

    if (montantValue > resteAPayer + 0.01) {
      toast.error('Le montant dépasse le reste à payer');
      return;
    }

    setSavingPaiement(true);

    try {
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from('paiements')
        .insert({
          facture_id: facture.id,
          user_id: user.id,
          montant: montantValue,
          date_paiement: datePaiement,
          mode_paiement: modePaiement,
          reference: reference.trim() || null,
          notes: paiementNotes.trim() || null,
        });
      if (error) throw error;

      toast.success('Paiement enregistré');
      setShowPaiementModal(false);
      await fetchFactureDetails();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setSavingPaiement(false);
    }
  };

  const handleAnnulerFacture = async () => {
    if (!facture || !user) return;

    const confirmCancel = globalThis.confirm?.('Annuler cette facture ?');
    if (!confirmCancel) return;

    try {
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from('factures')
        .update({ statut: 'annulee' })
        .eq('id', facture.id)
        .eq('user_id', user.id);
      if (error) throw error;

      setFacture({ ...facture, statut: 'annulee' as FactureStatut });
      toast.success('Facture annulée');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user || !facture || !client || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push('/factures')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center print-hide"
            >
              ← Retour aux factures
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                Facture {facture.numero}
              </h1>
              <span className={`px-3 py-1 text-sm font-medium rounded ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print-hide">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {printing ? 'Impression...' : 'Imprimer / Exporter en PDF'}
            </button>
            {facture.devis_id && (
              <button
                type="button"
                onClick={() => router.push(`/devis/${facture.devis_id}`)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-medium"
              >
                Voir le devis
              </button>
            )}
            <button
              type="button"
              onClick={() => openPaiementModal('acompte')}
              disabled={facture.statut === 'annulee' || resteAPayer <= 0}
              className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Acompte
            </button>
            <button
              type="button"
              onClick={() => openPaiementModal('solde')}
              disabled={facture.statut === 'annulee' || resteAPayer <= 0}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Solde
            </button>
            {facture.statut !== 'annulee' && (
              <button
                type="button"
                onClick={handleAnnulerFacture}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-medium"
              >
                Annuler
              </button>
            )}
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
                  <span className="font-medium">Date d'émission:</span>{' '}
                  {new Date(facture.date_emission).toLocaleDateString('fr-FR')}
                </p>
                {facture.date_echeance && (
                  <p>
                    <span className="font-medium">Date d'échéance:</span>{' '}
                    {new Date(facture.date_echeance).toLocaleDateString('fr-FR')}
                  </p>
                )}
                <p>
                  <span className="font-medium">Total TTC:</span>{' '}
                  {formatCurrency(totals.totalTtc)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Total HT</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totals.totalHt)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Total TVA</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totals.totalTva)}</p>
            </div>
            <div className="rounded-lg border border-gray-900 bg-gray-900 p-4">
              <p className="text-xs uppercase text-gray-200">Total TTC</p>
              <p className="text-2xl font-semibold text-white">{formatCurrency(totals.totalTtc)}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lignes de facture</h3>
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

          <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Suivi des paiements</h3>
                <div className="flex items-center gap-2 print-hide">
                  <button
                    type="button"
                    onClick={() => openPaiementModal('acompte')}
                    disabled={facture.statut === 'annulee' || resteAPayer <= 0}
                    className="text-sm text-yellow-700 hover:text-yellow-900 disabled:opacity-50"
                  >
                    Ajouter un acompte
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => openPaiementModal('solde')}
                    disabled={facture.statut === 'annulee' || resteAPayer <= 0}
                    className="text-sm text-green-700 hover:text-green-900 disabled:opacity-50"
                  >
                    Régler le solde
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase text-gray-500">Total payé</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalPaye)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Reste à payer</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(resteAPayer)}</p>
                </div>
              </div>
              {paiements.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
              ) : (
                <div className="space-y-3">
                  {paiements.map((paiement) => (
                    <div
                      key={paiement.id}
                      className="flex items-start justify-between rounded-md border border-gray-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(Number(paiement.montant))}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')} · {paiement.mode_paiement || 'Virement'}
                        </p>
                        {paiement.reference && (
                          <p className="text-xs text-gray-500">Réf: {paiement.reference}</p>
                        )}
                      </div>
                      {paiement.notes && (
                        <p className="text-xs text-gray-500 max-w-[160px] text-right">{paiement.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
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
                          setNotesDraft(facture.notes || '');
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
                  placeholder="Ajoutez des précisions, délais ou mentions particulières..."
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {facture.notes || 'Ajoutez vos informations complémentaires.'}
                </p>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Conditions de règlement</h3>
              <div className="flex items-center gap-2 print-hide">
                {!editingConditions && (
                  <button
                    type="button"
                    onClick={() => setEditingConditions(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Modifier
                  </button>
                )}
                {editingConditions && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingConditions(false);
                        setConditionsDraft({
                          conditions_reglement: facture.conditions_reglement || 'Paiement à 30 jours',
                          penalites_retard: facture.penalites_retard || 'Taux BCE + 10 points',
                          escompte: facture.escompte || '',
                          indemnite_recouvrement:
                            facture.indemnite_recouvrement != null
                              ? String(facture.indemnite_recouvrement)
                              : '40',
                        });
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveConditions}
                      disabled={conditionsSaving}
                      className="text-sm text-green-700 hover:text-green-900 disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingConditions ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conditions de règlement</label>
                  <input
                    type="text"
                    value={conditionsDraft.conditions_reglement}
                    onChange={(e) =>
                      setConditionsDraft((prev) => ({
                        ...prev,
                        conditions_reglement: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pénalités de retard</label>
                  <input
                    type="text"
                    value={conditionsDraft.penalites_retard}
                    onChange={(e) =>
                      setConditionsDraft((prev) => ({
                        ...prev,
                        penalites_retard: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escompte</label>
                  <input
                    type="text"
                    value={conditionsDraft.escompte}
                    onChange={(e) =>
                      setConditionsDraft((prev) => ({
                        ...prev,
                        escompte: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indemnité de recouvrement (€)</label>
                  <input
                    type="text"
                    value={conditionsDraft.indemnite_recouvrement}
                    onChange={(e) =>
                      setConditionsDraft((prev) => ({
                        ...prev,
                        indemnite_recouvrement: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Conditions:</span>{' '}
                  {facture.conditions_reglement || 'Paiement à 30 jours'}
                </p>
                <p>
                  <span className="font-medium">Pénalités:</span>{' '}
                  {facture.penalites_retard || 'Taux BCE + 10 points'}
                </p>
                <p>
                  <span className="font-medium">Escompte:</span>{' '}
                  {facture.escompte || 'Aucun'}
                </p>
                <p>
                  <span className="font-medium">Indemnité recouvrement:</span>{' '}
                  {facture.indemnite_recouvrement != null ? formatCurrency(facture.indemnite_recouvrement) : '40 €'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaiementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {paiementType === 'acompte' ? 'Enregistrer un acompte' : 'Enregistrer le solde'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Reste à payer: {formatCurrency(resteAPayer)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant à payer</label>
                <input
                  type="text"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Montant en €"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de paiement</label>
                <input
                  type="date"
                  value={datePaiement}
                  onChange={(e) => setDatePaiement(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Virement">Virement</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Carte bancaire">Carte bancaire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence (optionnel)</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="N° de chèque, transaction..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea
                  value={paiementNotes}
                  onChange={(e) => setPaiementNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Informations complémentaires"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowPaiementModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAddPaiement}
                disabled={savingPaiement}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {savingPaiement ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

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

