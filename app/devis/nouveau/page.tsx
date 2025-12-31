'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useProfile } from '@/lib/hooks/use-profile.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ProductSearch } from '@/components/product-search.tsx';
import type { Database } from '@/lib/database.types.ts';

type Client = Database['public']['Tables']['clients']['Row'];
type ProduitSelection = {
  id: string;
  designation: string;
  reference: string | null;
  categorie: string | null;
  unite: string | null;
  type: 'standard' | 'custom' | null;
  prix_ht_defaut: number | null;
  taux_tva_defaut: number | null;
  fournisseur_defaut_id: string | null;
  fournisseur_nom?: string | null;
  actif: boolean | null;
};
type LigneDevis = {
  id: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  fournisseur_id?: string;
  showProductSearch?: boolean;
};

export default function NouveauDevisPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetchProfile } = useProfile();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState('');
  const [numero, setNumero] = useState('');
  const [dateValidite, setDateValidite] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LigneDevis[]>([
    {
      id: crypto.randomUUID(),
      designation: '',
      quantite: 1,
      prix_unitaire_ht: 0,
      taux_tva: 20,
    }
  ]);
  const tvaOptions = [0, 5.5, 10, 20];
  const defaultTvaRate = typeof profile?.taux_tva === 'number'
    ? profile.taux_tva
    : (profile?.tva_applicable === false ? 0 : 20);
  const tvaNonApplicable = defaultTvaRate === 0;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      refetchProfile();
    }
  }, [user, authLoading, router, refetchProfile]);

  useEffect(() => {
    if (!profile) return;
    setLignes((current) =>
      current.map((ligne) =>
        ligne.designation ? ligne : { ...ligne, taux_tva: defaultTvaRate }
      )
    );
  }, [profile, defaultTvaRate]);

  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('nom');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement des clients';
      toast.error(message);
    }
  }, [user]);

  const generateNumero = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('generate_devis_number', { p_user_id: user.id });

      if (error) throw error;

      if (data) {
        setNumero(data);
      } else {
        setNumero('DEV-0001');
      }
    } catch {
      setNumero('DEV-0001');
    }
  }, [user]);

  useEffect(() => {
    if (user && profile !== null) {
      if (!profile.profil_complete) {
        toast.error('Veuillez compléter votre profil avant de créer un devis');
        router.push('/profil');
        return;
      }
      fetchClients();
      generateNumero();
    }
  }, [user, profile, fetchClients, generateNumero, router]);

  const addLigne = () => {
    setLignes([
      ...lignes,
      {
        id: crypto.randomUUID(),
        designation: '',
        quantite: 1,
        prix_unitaire_ht: 0,
        taux_tva: defaultTvaRate,
      }
    ]);
  };

  const removeLigne = (id: string) => {
    if (lignes.length === 1) {
      toast.error('Au moins une ligne est requise');
      return;
    }
    setLignes(lignes.filter(l => l.id !== id));
  };

  const updateLigne = <K extends keyof LigneDevis>(
    id: string,
    field: K,
    value: LigneDevis[K]
  ) => {
    setLignes(lignes.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const toggleProductSearch = (id: string) => {
    setLignes(lignes.map(l =>
      l.id === id ? { ...l, showProductSearch: !l.showProductSearch } : l
    ));
  };

  const handleSelectProduct = (id: string, product: ProduitSelection) => {
    const prixUnitaire = product?.prix_ht_defaut !== null ? Number(product.prix_ht_defaut) : 0;
    const tauxTva = product?.taux_tva_defaut !== null
      ? Number(product.taux_tva_defaut)
      : defaultTvaRate;

    setLignes(lignes.map(l =>
      l.id === id ? {
        ...l,
        designation: product.designation,
        prix_unitaire_ht: Number.isFinite(prixUnitaire) ? prixUnitaire : 0,
        taux_tva: Number.isFinite(tauxTva) ? tauxTva : defaultTvaRate,
        fournisseur_id: product.fournisseur_defaut_id || undefined,
        showProductSearch: false,
      } : l
    ));
    toast.success('Produit ajouté');
  };

  const calculateTotals = () => {
    let totalHT = 0;
    let totalTVA = 0;

    lignes.forEach(ligne => {
      const ligneHT = ligne.quantite * ligne.prix_unitaire_ht;
      const ligneTVA = ligneHT * (ligne.taux_tva / 100);
      totalHT += ligneHT;
      totalTVA += ligneTVA;
    });

    return {
      totalHT,
      totalTVA,
      totalTTC: totalHT + totalTVA
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    const emptyLigne = lignes.find(l => !l.designation.trim());
    if (emptyLigne) {
      toast.error('Toutes les lignes doivent avoir une désignation');
      return;
    }

    setLoading(true);

    try {
      const totals = calculateTotals();

      const { data: devisData, error: devisError } = await supabase
        .from('devis')
        .insert({
          user_id: user!.id,
          numero,
          client_id: clientId,
          date_validite: dateValidite || null,
          statut: 'brouillon',
          total_ht: totals.totalHT,
          total_tva: totals.totalTVA,
          total_ttc: totals.totalTTC,
          notes: notes || null,
        })
        .select()
        .single();

      if (devisError) throw devisError;

      const lignesData = lignes.map((ligne, index) => ({
        devis_id: devisData.id,
        designation: ligne.designation,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva,
        fournisseur_id: ligne.fournisseur_id || null,
        ordre: index,
      }));

      const { error: lignesError } = await supabase
        .from('lignes_devis')
        .insert(lignesData);

      if (lignesError) throw lignesError;

      toast.success('Devis créé avec succès');
      router.push('/devis');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la création du devis';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile?.profil_complete) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nouveau Devis</h1>
          <button
            type="button"
            onClick={() => router.push('/devis')}
            className="text-gray-600 hover:text-gray-900"
          >
            Annuler
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Informations générales</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro du devis
                </label>
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required
                  title="Numéro du devis"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de validité
                </label>
                <input
                  type="date"
                  value={dateValidite}
                  onChange={(e) => setDateValidite(e.target.value)}
                  title="Date de validité"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{ colorScheme: 'light' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                title="Client"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Sélectionner un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nom} {client.societe ? `- ${client.societe}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                title="Notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Notes additionnelles..."
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Lignes du devis</h2>
              <button
                type="button"
                onClick={addLigne}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3">
              {lignes.map((ligne, index) => (
                <div key={ligne.id} className="border border-gray-200 rounded-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Ligne {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => toggleProductSearch(ligne.id)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                    >
                      {ligne.showProductSearch ? 'Masquer la recherche' : 'Choisir depuis la bibliothèque'}
                    </button>
                  </div>

                  {ligne.showProductSearch && (
                    <div className="mb-3">
                      <ProductSearch
                        onSelectProduct={(product) => handleSelectProduct(ligne.id, product)}
                        placeholder="Rechercher dans votre bibliothèque de produits..."
                      />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-12 gap-3">
                      <div className="col-span-5">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Désignation
                        </label>
                        <input
                          type="text"
                          value={ligne.designation}
                          onChange={(e) => updateLigne(ligne.id, 'designation', e.target.value)}
                          required
                          title="Désignation"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                          placeholder="Description du produit/service"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantité
                        </label>
                        <input
                          type="number"
                          value={ligne.quantite}
                          onChange={(e) => updateLigne(ligne.id, 'quantite', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          title="Quantité"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Prix HT
                        </label>
                        <input
                          type="number"
                          value={ligne.prix_unitaire_ht}
                          onChange={(e) => updateLigne(ligne.id, 'prix_unitaire_ht', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          title="Prix HT"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          TVA %
                        </label>
                        <select
                          value={String(ligne.taux_tva)}
                          onChange={(e) => updateLigne(ligne.id, 'taux_tva', parseFloat(e.target.value))}
                          required
                          title="TVA %"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        >
                          {tvaOptions.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate} %
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-1 flex items-end">
                        <div className="text-sm font-medium text-gray-900">
                          {(ligne.quantite * ligne.prix_unitaire_ht).toFixed(2)} €
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLigne(ligne.id)}
                      className="mt-6 text-red-600 hover:text-red-700"
                      title="Supprimer la ligne"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total HT:</span>
                    <span className="font-medium text-gray-900">{totals.totalHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total TVA:</span>
                    <span className="font-medium text-gray-900">{totals.totalTVA.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span className="text-gray-900">Total TTC:</span>
                    <span className="text-blue-600">{totals.totalTTC.toFixed(2)} €</span>
                  </div>
                  {tvaNonApplicable && (
                    <p className="text-xs text-gray-500 pt-2">
                      TVA non applicable, art. 293B du CGI
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/devis')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow-md transition-all"
            >
              {loading ? 'Création...' : 'Créer le devis'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
