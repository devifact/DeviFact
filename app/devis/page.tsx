'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';

type Devis = Database['public']['Tables']['devis']['Row'];

export default function DevisPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [factureLoadingId, setFactureLoadingId] = useState<string | null>(null);
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
      setDevis(data || []);
    } catch (error: any) {
      toast.error(error.message);
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

  const handleDownloadPdf = async (devisId: string, numero: string) => {
    if (pdfLoadingId === devisId) return;
    setPdfLoadingId(devisId);

    try {
      toast.loading('Génération du PDF en cours...', { id: `pdf-${devisId}` });

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expirée');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'devis',
            id: devisId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devis-${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF téléchargé avec succès', { id: `pdf-${devisId}` });
    } catch (error: any) {
      toast.error(error.message, { id: `pdf-${devisId}` });
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleDeleteDevis = async (devisId: string, numero: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le devis ${numero} ?`)) {
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
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteLoadingId(null);
    }
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

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-facture`,
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
    } catch (error: any) {
      toast.error(error.message, { id: `facture-${devisId}` });
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

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Devis</h1>
          <button
            onClick={handleCreateDevis}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
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
                devis.map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {d.numero}
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
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleViewDevis(d.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir le devis"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(d.id, d.numero)}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={pdfLoadingId === d.id}
                          title="Télécharger en PDF"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => handleFacturer(d.id, d.statut)}
                          className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Créer une facture"
                          disabled={d.statut !== 'accepte' || factureLoadingId === d.id}
                        >
                          Facturer
                        </button>
                        <button
                          onClick={() => handleDeleteDevis(d.id, d.numero)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={deleteLoadingId === d.id}
                          title="Supprimer le devis"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
