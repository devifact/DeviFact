'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';
import { resolveDocumentColor } from '@/lib/document-colors.ts';
import { buildDocumentFooter } from '@/lib/document-footer.ts';

type Facture = Database['public']['Tables']['factures']['Row'];
type LigneFacture = Database['public']['Tables']['lignes_factures']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

interface Paiement {
  id: string;
  facture_id: string;
  user_id: string;
  montant: number;
  date_paiement: string;
  mode_paiement: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FactureDetails extends Facture {
  client: Client;
  lignes: LigneFacture[];
  paiements: Paiement[];
  profile?: Profile;
  conditions_reglement?: string;
  penalites_retard?: string;
  escompte?: string;
  indemnite_recouvrement?: number;
  informations_travaux?: string | null;
}

export default function FactureDetailPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [facture, setFacture] = useState<FactureDetails | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [montantPaiement, setMontantPaiement] = useState('');
  const [typePaiement, setTypePaiement] = useState<'acompte' | 'solde'>('solde');
  const [modePaiement, setModePaiement] = useState('Virement');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [notesPaiement, setNotesPaiement] = useState('');
  const [pendingActionHandled, setPendingActionHandled] = useState(false);

  const fetchFactureDetails = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('factures')
        .select(`
          *,
          client:clients(*),
          lignes:lignes_factures(*),
          paiements(*)
        `)
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      let informationsTravaux: string | null = null;

      if (data.devis_id) {
        const { data: devisInfo } = await supabase
          .from('devis')
          .select('informations_travaux')
          .eq('id', data.devis_id)
          .maybeSingle();

        informationsTravaux = devisInfo?.informations_travaux ?? null;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: settingsData, error: settingsError } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const factureDetails: FactureDetails = {
        ...data,
        profile: profileData || undefined,
        informations_travaux: informationsTravaux,
      } as FactureDetails;

      setFacture(factureDetails);
      setCompanySettings(settingsData ?? null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement.';
      toast.error(message);
      router.push('/factures');
    } finally {
      setLoading(false);
    }
  }, [params.id, router, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchFactureDetails();
    }
  }, [authLoading, fetchFactureDetails, router, user]);

  const handlePrint = () => {
    if (!facture) return;

    try {
      toast.loading("Ouverture de l'impression...", { id: 'pdf' });
      window.print();
      toast.success('Impression ouverte', { id: 'pdf' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du telechargement.';
      toast.error(message, { id: 'pdf' });
    }
  };

  const handleEnregistrerPaiement = async () => {
    if (!facture) return;

    const montant = parseFloat(montantPaiement);

    if (isNaN(montant) || montant <= 0) {
      toast.error('Montant invalide');
      return;
    }

    const totalPaye = facture.paiements.reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0);
    const resteAPayer = parseFloat(facture.total_ttc.toString()) - totalPaye;

    if (montant > resteAPayer) {
      toast.error(`Le montant ne peut pas dépasser le reste à payer (${resteAPayer.toFixed(2)} €)`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Session expirée');
      }

      const { error } = await supabase
        .from('paiements')
        .insert({
          facture_id: facture.id,
          user_id: session.user.id,
          montant,
          mode_paiement: modePaiement,
          reference: referencePaiement || null,
          notes: notesPaiement || null,
          date_paiement: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      toast.success(`Paiement de ${montant.toFixed(2)} € enregistré avec succès`);
      setShowPaymentModal(false);
      setMontantPaiement('');
      setModePaiement('Virement');
      setReferencePaiement('');
      setNotesPaiement('');
      await fetchFactureDetails();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement.';
      toast.error(message);
    }
  };

  const getStatusBadge = (statut: string) => {
    const styles = {
      payee: 'bg-green-100 text-green-800',
      partiellement_payee: 'bg-yellow-100 text-yellow-800',
      non_payee: 'bg-orange-100 text-orange-800',
      annulee: 'bg-red-100 text-red-800',
    };

    const labels = {
      payee: 'Payée',
      partiellement_payee: 'Partiellement payée',
      non_payee: 'Non payée',
      annulee: 'Annulée',
    };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded ${styles[statut as keyof typeof styles]}`}>
        {labels[statut as keyof typeof labels] || statut}
      </span>
    );
  };

  const openPaymentModal = useCallback((type: 'acompte' | 'solde') => {
    setTypePaiement(type);
    if (type === 'solde' && facture) {
      const totalPaye = facture.paiements.reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0);
      const resteAPayer = parseFloat(facture.total_ttc.toString()) - totalPaye;
      setMontantPaiement(resteAPayer.toString());
    } else {
      setMontantPaiement('');
    }
    setShowPaymentModal(true);
  }, [facture]);

  useEffect(() => {
    if (!facture || pendingActionHandled) {
      return;
    }

    const paiement = searchParams.get('paiement');
    if (paiement === 'acompte' || paiement === 'solde') {
      setPendingActionHandled(true);
      openPaymentModal(paiement);
      router.replace(`/factures/${params.id}`);
      return;
    }

    if (searchParams.get('print') === '1') {
      setPendingActionHandled(true);
      requestAnimationFrame(() => {
        window.print();
      });
      router.replace(`/factures/${params.id}`);
    }
  }, [facture, openPaymentModal, params.id, pendingActionHandled, router, searchParams]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user || !facture) {
    return null;
  }

  const defaultTvaRate = typeof companySettings?.taux_tva_defaut === 'number'
    ? companySettings.taux_tva_defaut
    : (typeof facture.profile?.taux_tva === 'number'
      ? facture.profile.taux_tva
      : (facture.profile?.tva_applicable === false ? 0 : 20));
  const tvaNonApplicable = defaultTvaRate === 0;
  const mentionsDefaults = {
    conditions_reglement: 'Paiement a 30 jours',
    delai_paiement: 'Paiement a 30 jours',
    penalites_retard: 'Taux BCE + 10%',
    indemnite_recouvrement_montant: 40,
    indemnite_recouvrement_texte: 'EUR (article L441-6 du Code de commerce)',
  };
  const rawIndemnite = companySettings?.indemnite_recouvrement_montant
    ?? facture.indemnite_recouvrement
    ?? mentionsDefaults.indemnite_recouvrement_montant;
  const indemniteMontant = Number.isFinite(Number(rawIndemnite))
    ? Number(rawIndemnite)
    : mentionsDefaults.indemnite_recouvrement_montant;
  const mentions = {
    conditions_reglement: companySettings?.conditions_reglement
      || facture.conditions_reglement
      || mentionsDefaults.conditions_reglement,
    delai_paiement: companySettings?.delai_paiement
      || mentionsDefaults.delai_paiement,
    penalites_retard: companySettings?.penalites_retard
      || facture.penalites_retard
      || mentionsDefaults.penalites_retard,
    indemnite_recouvrement_montant: indemniteMontant,
    indemnite_recouvrement_texte: companySettings?.indemnite_recouvrement_texte
      || mentionsDefaults.indemnite_recouvrement_texte,
    escompte: companySettings?.escompte || facture.escompte || '',
  };
  const bankFields = [
    { label: 'Titulaire', value: companySettings?.titulaire_compte },
    { label: 'Banque', value: companySettings?.banque_nom },
    { label: 'Domiciliation', value: companySettings?.domiciliation },
    { label: 'IBAN', value: facture.profile?.iban },
    { label: 'BIC', value: facture.profile?.bic },
    { label: 'RIB', value: companySettings?.rib },
    { label: 'Reference paiement', value: companySettings?.reference_paiement },
    { label: 'Modes de paiement', value: companySettings?.modes_paiement_acceptes },
  ];
  const hasBank = bankFields.some((field) => field.value);
  const mentionParts = [
    `Conditions: ${mentions.conditions_reglement}`,
    `Delai: ${mentions.delai_paiement}`,
    `Penalites: ${mentions.penalites_retard}`,
    `Indemnite: ${mentions.indemnite_recouvrement_montant.toFixed(2)} ${mentions.indemnite_recouvrement_texte}`,
    mentions.escompte ? `Escompte: ${mentions.escompte}` : '',
    tvaNonApplicable ? 'TVA non applicable, art. 293B du CGI' : '',
  ].filter(Boolean);
  const mentionSummary = mentionParts.join(' | ');
  const bankSummary = bankFields
    .filter((field) => field.value)
    .map((field) => `${field.label}: ${String(field.value)}`)
    .join(' | ');
  const documentColor = resolveDocumentColor(companySettings?.couleur_documents);
  const totalPaye = facture.paiements.reduce(
    (sum, paiement) => sum + parseFloat(paiement.montant.toString()),
    0
  );
  const resteAPayer = Math.max(
    0,
    parseFloat(facture.total_ttc.toString()) - totalPaye
  );
  const footerText = buildDocumentFooter(facture.profile, companySettings);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              type="button"
              onClick={() => router.push('/factures')}
              className="text-gray-600 hover:text-gray-900 mb-2 flex items-center"
            >
              ← Retour aux factures
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Facture {facture.numero}</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Imprimer
            </button>
            {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
              <>
                <button
                  type="button"
                  onClick={() => openPaymentModal('acompte')}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 font-medium"
                >
                  Acompte
                </button>
                <button
                  type="button"
                  onClick={() => openPaymentModal('solde')}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium"
                >
                  Solde
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between mb-6">
            <div className="flex items-start gap-4">
              {facture.profile?.logo_url && (
                <img
                  src={facture.profile.logo_url}
                  alt="Logo de l'entreprise"
                  className="h-16 w-16 rounded border border-gray-200 bg-white p-1 object-contain"
                />
              )}
              <div className="text-sm text-gray-600">
                {facture.profile?.raison_sociale && (
                  <p className="text-gray-900 font-medium">{facture.profile.raison_sociale}</p>
                )}
                {facture.profile?.adresse && <p>{facture.profile.adresse}</p>}
                {(facture.profile?.code_postal || facture.profile?.ville) && (
                  <p>
                    {facture.profile?.code_postal} {facture.profile?.ville}
                  </p>
                )}
                {facture.profile?.email_contact && (
                  <p className="text-gray-600 text-sm">{facture.profile.email_contact}</p>
                )}
                {facture.profile?.telephone && (
                  <p className="text-gray-600 text-sm">{facture.profile.telephone}</p>
                )}
              </div>
            </div>
            <div className="w-full md:max-w-sm md:ml-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
              <p className="text-gray-900 font-medium">{facture.client.nom}</p>
              {facture.client.societe && <p className="text-gray-600">{facture.client.societe}</p>}
              {facture.client.adresse && <p className="text-gray-600">{facture.client.adresse}</p>}
              {(facture.client.code_postal || facture.client.ville) && (
                <p className="text-gray-600">
                  {facture.client.code_postal} {facture.client.ville}
                </p>
              )}
              {facture.client.email && <p className="text-gray-600 text-sm">{facture.client.email}</p>}
              {facture.client.telephone && <p className="text-gray-600 text-sm">{facture.client.telephone}</p>}
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3" style={{ color: documentColor }}>Informations</h3>
            <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Informations sur les travaux / services
                </p>
                <p className="text-sm text-gray-600">
                  {facture.informations_travaux || 'Aucune information renseignee.'}
                </p>
              </div>
              <div className="text-sm text-gray-600 md:text-right">
                <div className="mb-2">{getStatusBadge(facture.statut)}</div>
                <p>
                  <span className="font-medium">Total paye:</span> {totalPaye.toFixed(2)}&nbsp;&euro;
                </p>
                <p className="mt-1">
                  <span className="font-medium">Reste a payer:</span> {resteAPayer.toFixed(2)}&nbsp;&euro;
                </p>
              </div>
            </div>
          </div>

          {facture.notes && (
            <div className="mb-6 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">{facture.notes}</p>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: documentColor }}>Lignes de facturation</h3>
            <table className="min-w-full">
              <thead style={{ backgroundColor: documentColor }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">
                    Désignation
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">
                    Quantité
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">
                    Prix HT
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">
                    TVA
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {facture.lignes.map((ligne) => (
                  <tr key={ligne.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{ligne.designation}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{ligne.quantite}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {ligne.prix_unitaire_ht.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{ligne.taux_tva}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {(ligne.quantite * parseFloat(ligne.prix_unitaire_ht.toString())).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t mt-6 pt-4">
            <div className="flex justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-3" style={{ color: documentColor }}>Mentions obligatoires</h3>
                <p className="text-[11px] text-gray-600 leading-4">
                  {mentionSummary}
                </p>
              </div>

              <div className="w-64 space-y-2 border border-gray-200 rounded-md p-3" style={{ borderColor: documentColor }}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium" style={{ color: documentColor }}>Total HT:</span>
                  <span className="font-medium">{facture.total_ht.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium" style={{ color: documentColor }}>TVA:</span>
                  <span className="font-medium">{facture.total_tva.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-lg font-bold rounded-md px-3 py-2" style={{ backgroundColor: documentColor, color: "#fff" }}>
                  <span>Total TTC:</span>
                  <span>{facture.total_ttc.toFixed(2)} €</span>
                </div>
                {facture.paiements.length > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600 border-t pt-2">
                      <span>Déjà payé:</span>
                      <span className="font-medium">
                        {facture.paiements.reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0).toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-600">Reste à payer:</span>
                      <span>
                        {(parseFloat(facture.total_ttc.toString()) - facture.paiements.reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0)).toFixed(2)} €
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {hasBank && (
            <div className="border-t mt-6 pt-4">
              <div className="text-xs text-gray-600">
                <h4 className="text-sm font-semibold mb-2" style={{ color: documentColor }}>Informations bancaires</h4>
                <p className="text-[11px] text-gray-600 leading-4">
                  {bankSummary}
                </p>
              </div>
            </div>
          )}

          {footerText && (
            <div className="border-t mt-6 pt-4 text-[11px] text-gray-500 text-center">
              {footerText}
            </div>
          )}
        </div>

        {facture.paiements.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: documentColor }}>Historique des paiements</h3>
            <table className="min-w-full">
              <thead style={{ backgroundColor: documentColor }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {facture.paiements.map((paiement) => (
                  <tr key={paiement.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{paiement.mode_paiement}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{paiement.reference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {parseFloat(paiement.montant.toString()).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              Enregistrer un {typePaiement === 'acompte' ? 'acompte' : 'paiement du solde'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant à payer
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montantPaiement}
                  onChange={(e) => setMontantPaiement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Montant en €"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Reste à payer: {(parseFloat(facture.total_ttc.toString()) - facture.paiements.reduce((sum, p) => sum + parseFloat(p.montant.toString()), 0)).toFixed(2)} €
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de paiement
                </label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  title="Mode de paiement"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option>Virement</option>
                  <option>Chèque</option>
                  <option>Espèces</option>
                  <option>Carte bancaire</option>
                  <option>Prélèvement</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence (optionnel)
                </label>
                <input
                  type="text"
                  value={referencePaiement}
                  onChange={(e) => setReferencePaiement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="N° de chèque, transaction..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notesPaiement}
                  onChange={(e) => setNotesPaiement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Informations complémentaires..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setMontantPaiement('');
                  setModePaiement('Virement');
                  setReferencePaiement('');
                  setNotesPaiement('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEnregistrerPaiement}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}


