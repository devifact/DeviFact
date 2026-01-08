'use client';

export const runtime = 'edge';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';

type Devis = Database['public']['Tables']['devis']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type LigneDevis = Database['public']['Tables']['lignes_devis']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function DevisDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const devisId = params?.id as string;

  const [devis, setDevis] = useState<Devis | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [factureLoading, setFactureLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      setProfile(profileResult.data);

      const [clientResult, lignesResult] = await Promise.all([
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
      ]);

      if (clientResult.error) throw clientResult.error;
      if (lignesResult.error) throw lignesResult.error;

      setClient(clientResult.data);
      setLignes(lignesResult.data || []);
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

  const creerFactureDepuisDevis = async (devisId: string) => {
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

    if (!user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    const numero = devisData.numero?.startsWith('DEV-')
      ? devisData.numero.replace(/^DEV-/, 'FA-')
      : `FA-${devisData.numero ?? devisData.id}`;

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

    const { error: updateError } = await supabase
      .from('devis')
      .update({ statut: 'accepte' })
      .eq('id', devisData.id);
    if (updateError) throw updateError;

    return facture;
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
    if (devis.statut !== 'accepte') {
      toast.error('Le devis doit etre accepte pour facturer');
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

  const handleUpdateStatus = async (statut: Devis['statut']) => {
    if (!devis || !user) return;
    if (devis.statut === statut) return;

    try {
      setStatusUpdating(true);
      const { error } = await supabase
        .from('devis')
        .update({ statut })
        .eq('id', devis.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setDevis({ ...devis, statut });
      toast.success('Statut mis a jour');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setStatusUpdating(false);
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
    };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded ${styles[statut as keyof typeof styles]}`}>
        {statut.charAt(0).toUpperCase() + statut.slice(1)}
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

  const defaultTvaRate = typeof profile.taux_tva === 'number'
    ? profile.taux_tva
    : (profile.tva_applicable === false ? 0 : 20);
  const tvaNonApplicable = defaultTvaRate === 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              type="button"
              onClick={() => router.push('/devis')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center print-hide"
            >
              ← Retour aux devis
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Devis {devis.numero}
            </h1>
          </div>
          <div className="flex items-center gap-4 print-hide">
            {getStatusBadge(devis.statut)}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPdf ? 'Impression...' : 'Imprimer / Exporter en PDF'}
            </button>
            <button
              type="button"
              onClick={handleFacturer}
              disabled={factureLoading || devis.statut !== 'accepte'}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Créer une facture
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
          <div className="border-b-2 border-blue-600 pb-6 mb-6">
            <div className="flex justify-between">
              <div className="flex items-start gap-4">
                {profile.logo_url && (
                  <img
                    src={profile.logo_url}
                    alt="Logo de l'entreprise"
                    className="h-16 w-16 rounded border border-gray-200 bg-white p-1 object-contain"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {profile.raison_sociale}
                  </h2>
                  <p className="text-gray-600">{profile.adresse}</p>
                  <p className="text-gray-600">
                    {profile.code_postal} {profile.ville}
                  </p>
                  <p className="text-gray-600">{profile.pays || 'France'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-600">
                  <span className="font-medium">Téléphone:</span> {profile.telephone}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Email:</span> {profile.email_contact}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">SIRET:</span> {profile.siret}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Regime TVA:</span> {defaultTvaRate}%
                </p>
                {tvaNonApplicable && (
                  <p className="text-gray-600">TVA non applicable, art. 293B du CGI</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-600 mb-3">Client</h3>
              <p className="font-medium text-gray-900">{client.nom}</p>
              {client.societe && <p className="text-gray-600">{client.societe}</p>}
              <p className="text-gray-600">{client.adresse}</p>
              <p className="text-gray-600">
                {client.code_postal} {client.ville}
              </p>
              <p className="text-gray-600 mt-2">
                <span className="font-medium">Email:</span> {client.email}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Téléphone:</span> {client.telephone}
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-600 mb-3">Informations</h3>
              <p className="text-gray-600">
                <span className="font-medium">Date d&apos;émission:</span>{' '}
                {new Date(devis.date_creation).toLocaleDateString('fr-FR')}
              </p>
              {devis.date_validite && (
                <p className="text-gray-600">
                  <span className="font-medium">Date de validité:</span>{' '}
                  {new Date(devis.date_validite).toLocaleDateString('fr-FR')}
                </p>
              )}
              <div className="text-gray-600 mt-2 print-hide">
                <label htmlFor="devis-statut" className="font-medium mr-2">Statut:</label>
                <select
                  id="devis-statut"
                  value={devis.statut}
                  onChange={(e) => handleUpdateStatus(e.target.value as Devis['statut'])}
                  disabled={statusUpdating}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="envoye">Envoye</option>
                  <option value="accepte">Accepte</option>
                  <option value="refuse">Refuse</option>
                </select>
              </div>
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

          <div className="flex justify-end">
            <div className="w-80">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      Total HT
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {Number(devis.total_ht).toFixed(2)} €
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      Total TVA
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {Number(devis.total_tva).toFixed(2)} €
                    </td>
                  </tr>
                  <tr className="bg-blue-600">
                    <td className="px-4 py-3 text-base font-bold text-white">
                      Total TTC
                    </td>
                    <td className="px-4 py-3 text-base font-bold text-white text-right">
                      {Number(devis.total_ttc).toFixed(2)} €
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {devis.notes && (
            <div className="mt-8 p-4 bg-gray-50 border-l-4 border-blue-600 rounded">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-600">{devis.notes}</p>
            </div>
          )}
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
