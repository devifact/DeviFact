'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useProfile } from '@/lib/hooks/use-profile.ts';
import { useCompanySettings } from '@/lib/hooks/use-company-settings.ts';
import { usePremium } from '@/lib/hooks/use-premium.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter, useSearchParams } from 'next/navigation';
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
  marge_defaut: number | null;
  fournisseur_defaut_id: string | null;
  fournisseur_nom?: string | null;
  actif: boolean | null;
  stock_actuel: number | null;
  stock_minimum: number | null;
  gestion_stock: boolean | null;
};
type LigneDevis = {
  id: string;
  designation: string;
  reference: string;
  unite: string;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  marge_pourcentage: number;
  fournisseur_id?: string;
  produit_id?: string | null;
  stock_actuel?: number | null;
  stock_minimum?: number | null;
  gestion_stock?: boolean | null;
  showProductSearch?: boolean;
};

const formatDateValue = (value: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return '';
  return parsed.toISOString().slice(0, 10);
};

export default function NouveauDevisPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetchProfile } = useProfile();
  const { settings } = useCompanySettings();
  const { isPremium } = usePremium();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDevis, setLoadingDevis] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [creatingProductId, setCreatingProductId] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [numero, setNumero] = useState('');
  const [dateValidite, setDateValidite] = useState('');
  const [informationsTravaux, setInformationsTravaux] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LigneDevis[]>([
    {
      id: crypto.randomUUID(),
      designation: '',
      reference: '',
      unite: '',
      quantite: 1,
      prix_unitaire_ht: 0,
      taux_tva: 20,
      marge_pourcentage: 0,
      produit_id: null,
    }
  ]);
  const tvaOptions = [0, 5.5, 10, 20];
  const defaultTvaRate = typeof settings?.taux_tva_defaut === 'number'
    ? settings.taux_tva_defaut
    : (typeof profile?.taux_tva === 'number'
      ? profile.taux_tva
      : (profile?.tva_applicable === false ? 0 : 20));
  const defaultMarge = typeof settings?.marge_defaut === 'number'
    ? settings.marge_defaut
    : (typeof profile?.marge_defaut === 'number' ? profile.marge_defaut : 0);
  const tvaNonApplicable = defaultTvaRate === 0;
  const unitOptions = ['unite', 'h', 'jour', 'm2', 'm3', 'ml', 'kg', 'lot'];
  const lineGridClass = isPremium
    ? 'grid gap-3 min-w-[1180px] grid-cols-[minmax(220px,2.2fr)_minmax(120px,1fr)_minmax(110px,0.9fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)_minmax(90px,0.7fr)_minmax(90px,0.7fr)_minmax(110px,0.9fr)_minmax(90px,0.7fr)]'
    : 'grid gap-3 min-w-[1080px] grid-cols-[minmax(240px,2.4fr)_minmax(130px,1fr)_minmax(120px,0.9fr)_minmax(90px,0.7fr)_minmax(80px,0.6fr)_minmax(90px,0.7fr)_minmax(90px,0.7fr)_minmax(120px,0.9fr)]';

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
        ligne.designation
          ? ligne
          : { ...ligne, taux_tva: defaultTvaRate, marge_pourcentage: defaultMarge }
      )
    );
  }, [profile, defaultTvaRate, defaultMarge, settings]);

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

  const loadDevisForEdit = useCallback(async (devisId: string) => {
    if (!user) return;

    try {
      setLoadingDevis(true);

      const { data: devisData, error: devisError } = await supabase
        .from('devis')
        .select('*')
        .eq('id', devisId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (devisError) throw devisError;
      if (!devisData) {
        toast.error('Devis introuvable');
        router.push('/devis');
        return;
      }

      const { data: lignesData, error: lignesError } = await supabase
        .from('lignes_devis')
        .select('*')
        .eq('devis_id', devisId)
        .order('ordre');

      if (lignesError) throw lignesError;

      setClientId(devisData.client_id ?? '');
      setNumero(devisData.numero ?? '');
      setDateValidite(formatDateValue(devisData.date_validite));
      setInformationsTravaux(devisData.informations_travaux ?? '');
      setNotes(devisData.notes ?? '');

      const produitIds = (lignesData || [])
        .map((ligne) => ligne.produit_id)
        .filter((id): id is string => Boolean(id));
      const stockMap = new Map<string, { stock_actuel: number | null; stock_minimum: number | null; gestion_stock: boolean | null }>();

      if (produitIds.length) {
        const { data: produitsData, error: produitsError } = await supabase
          .from('produits')
          .select('id, stock_actuel, stock_minimum, gestion_stock')
          .in('id', produitIds);

        if (produitsError) throw produitsError;

        (produitsData || []).forEach((produit) => {
          stockMap.set(produit.id, {
            stock_actuel: produit.stock_actuel !== null ? Number(produit.stock_actuel) : null,
            stock_minimum: produit.stock_minimum !== null ? Number(produit.stock_minimum) : null,
            gestion_stock: produit.gestion_stock ?? false,
          });
        });
      }

      const mappedLignes = (lignesData || []).map((ligne) => {
        const stockInfo = ligne.produit_id ? stockMap.get(ligne.produit_id) : null;
        return {
          id: ligne.id,
          designation: ligne.designation ?? '',
          reference: ligne.reference ?? '',
          unite: ligne.unite ?? '',
          quantite: Number(ligne.quantite ?? 0),
          prix_unitaire_ht: Number(ligne.prix_unitaire_ht ?? 0),
          taux_tva: Number(ligne.taux_tva ?? defaultTvaRate),
          marge_pourcentage: Number(ligne.marge_pourcentage ?? defaultMarge),
          fournisseur_id: ligne.fournisseur_id ?? undefined,
          produit_id: ligne.produit_id ?? null,
          stock_actuel: stockInfo?.stock_actuel ?? null,
          stock_minimum: stockInfo?.stock_minimum ?? null,
          gestion_stock: stockInfo?.gestion_stock ?? null,
        };
      });

      setLignes(
        mappedLignes.length
          ? mappedLignes
          : [
              {
                id: crypto.randomUUID(),
                designation: '',
                reference: '',
                unite: '',
                quantite: 1,
                prix_unitaire_ht: 0,
                taux_tva: defaultTvaRate,
                marge_pourcentage: defaultMarge,
                produit_id: null,
              },
            ]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement du devis';
      toast.error(message);
      router.push('/devis');
    } finally {
      setLoadingDevis(false);
    }
  }, [user, router, defaultTvaRate, defaultMarge]);

  useEffect(() => {
    if (user && profile !== null) {
      if (!profile.profil_complete) {
        toast.error('Veuillez compléter votre profil avant de créer un devis');
        router.push('/profil');
        return;
      }
      fetchClients();
      if (editId) {
        loadDevisForEdit(editId);
      } else {
        generateNumero();
      }
    }
  }, [user, profile, fetchClients, generateNumero, loadDevisForEdit, router, editId]);

  const addLigne = () => {
    setLignes([
      ...lignes,
      {
        id: crypto.randomUUID(),
        designation: '',
        reference: '',
        unite: '',
        quantite: 1,
        prix_unitaire_ht: 0,
        taux_tva: defaultTvaRate,
        marge_pourcentage: defaultMarge,
        produit_id: null,
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
    const margeDefaut = product?.marge_defaut !== null
      ? Number(product.marge_defaut)
      : defaultMarge;

    setLignes(lignes.map(l =>
      l.id === id ? {
        ...l,
        designation: product.designation,
        reference: product.reference || '',
        unite: product.unite || '',
        prix_unitaire_ht: Number.isFinite(prixUnitaire) ? prixUnitaire : 0,
        taux_tva: Number.isFinite(tauxTva) ? tauxTva : defaultTvaRate,
        marge_pourcentage: Number.isFinite(margeDefaut) ? margeDefaut : defaultMarge,
        fournisseur_id: product.fournisseur_defaut_id || undefined,
        produit_id: product.id,
        stock_actuel: product.stock_actuel ?? null,
        stock_minimum: product.stock_minimum ?? null,
        gestion_stock: product.gestion_stock ?? null,
        showProductSearch: false,
      } : l
    ));
    toast.success('Produit ajouté');
  };


  const getStockBadge = (ligne: LigneDevis) => {
    if (!ligne.produit_id) {
      return { label: '-', className: 'bg-gray-100 text-gray-700' };
    }
    if (!ligne.gestion_stock) {
      return { label: 'Sur commande', className: 'bg-gray-100 text-gray-700' };
    }
    const stock = Number(ligne.stock_actuel ?? 0);
    const minimum = Number(ligne.stock_minimum ?? 0);

    if (stock <= 0) {
      return { label: 'Rupture', className: 'bg-red-100 text-red-700' };
    }
    if (minimum > 0 && stock <= minimum) {
      return { label: 'Faible', className: 'bg-yellow-100 text-yellow-700' };
    }
    return { label: 'En stock', className: 'bg-green-100 text-green-700' };
  };

  const handleUpdateProduct = async (ligne: LigneDevis) => {
    if (!user) return;
    const designation = ligne.designation.trim();
    if (!designation) {
      toast.error('La designation est requise');
      return;
    }

    if (savingProductId === ligne.id) return;
    setSavingProductId(ligne.id);

    try {
      const reference = ligne.reference.trim();
      const referenceNormalized = reference ? reference.toUpperCase() : '';
      const unite = ligne.unite.trim();
      const margeValue = Number.isFinite(ligne.marge_pourcentage)
        ? ligne.marge_pourcentage
        : defaultMarge;

      const payload = {
        designation,
        reference: referenceNormalized || null,
        categorie: null,
        unite: unite || null,
        prix_ht_defaut: ligne.prix_unitaire_ht,
        taux_tva_defaut: ligne.taux_tva,
        marge_defaut: margeValue,
        fournisseur_defaut_id: ligne.fournisseur_id || null,
        actif: true,
        gestion_stock: true,
      };

      let existingProduct = null;

      if (referenceNormalized) {
        const { data, error } = await supabase
          .from('produits')
          .select('id, stock_actuel, stock_minimum, gestion_stock')
          .eq('user_id', user.id)
          .ilike('reference', referenceNormalized)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        existingProduct = data ?? null;
      }

      if (!existingProduct) {
        const { data, error } = await supabase
          .from('produits')
          .select('id, stock_actuel, stock_minimum, gestion_stock')
          .eq('user_id', user.id)
          .ilike('designation', designation)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        existingProduct = data ?? null;
      }

      if (existingProduct) {
        const confirmUpdate = globalThis.confirm?.(
          'Un produit existe deja avec cette reference ou designation. Le mettre a jour ?'
        );
        if (!confirmUpdate) {
          return;
        }

        const { error } = await supabase
          .from('produits')
          .update({
            ...payload,
            stock_actuel: existingProduct.stock_actuel === null ? 0 : undefined,
            stock_minimum: existingProduct.stock_minimum === null ? 1 : undefined,
            gestion_stock: true,
          })
          .eq('id', existingProduct.id);

        if (error) throw error;

        setLignes((current) =>
          current.map((item) =>
            item.id === ligne.id ? { ...item, produit_id: existingProduct.id } : item
          )
        );
        toast.success('Produit mis a jour');
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('produits')
        .insert([
          {
            ...payload,
            user_id: user.id,
            type: 'custom',
            stock_actuel: 0,
            stock_minimum: 1,
            gestion_stock: true,
          },
        ])
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          toast.error('Reference deja utilisee');
          return;
        }
        throw insertError;
      }

      setLignes((current) =>
        current.map((item) =>
          item.id === ligne.id ? { ...item, produit_id: inserted.id } : item
        )
      );
      toast.success('Produit enregistre');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l enregistrement du produit';
      toast.error(message);
    } finally {
      setSavingProductId(null);
    }
  };

  const handleCreateProduct = async (ligne: LigneDevis) => {
    if (!user) return;
    const designation = ligne.designation.trim();
    if (!designation) {
      toast.error('La designation est requise');
      return;
    }

    if (creatingProductId === ligne.id) return;
    setCreatingProductId(ligne.id);

    try {
      const reference = ligne.reference.trim();
      const referenceNormalized = reference ? reference.toUpperCase() : '';
      const unite = ligne.unite.trim();
      const margeValue = Number.isFinite(ligne.marge_pourcentage)
        ? ligne.marge_pourcentage
        : defaultMarge;

      const payload = {
        designation,
        reference: referenceNormalized || null,
        categorie: null,
        unite: unite || null,
        prix_ht_defaut: ligne.prix_unitaire_ht,
        taux_tva_defaut: ligne.taux_tva,
        marge_defaut: margeValue,
        fournisseur_defaut_id: ligne.fournisseur_id || null,
        actif: true,
        gestion_stock: true,
      };

      const { data: inserted, error } = await supabase
        .from('produits')
        .insert([
          {
            ...payload,
            user_id: user.id,
            type: 'custom',
            stock_actuel: 0,
            stock_minimum: 1,
            gestion_stock: true,
          },
        ])
        .select('id, stock_actuel, stock_minimum, gestion_stock')
        .single();

      if (error) throw error;

      setLignes((current) =>
        current.map((item) =>
          item.id === ligne.id
            ? {
                ...item,
                produit_id: inserted.id,
                stock_actuel: inserted.stock_actuel ?? 0,
                stock_minimum: inserted.stock_minimum ?? 1,
                gestion_stock: inserted.gestion_stock ?? true,
              }
            : item
        )
      );
      toast.success('Nouveau produit enregistre');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l enregistrement du produit';
      toast.error(message);
    } finally {
      setCreatingProductId(null);
    }
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

      if (isEditMode && editId) {
        const { error: devisError } = await supabase
          .from('devis')
          .update({
            numero,
            client_id: clientId,
            date_validite: dateValidite || null,
            informations_travaux: informationsTravaux || null,
            total_ht: totals.totalHT,
            total_tva: totals.totalTVA,
            total_ttc: totals.totalTTC,
            notes: notes || null,
          })
          .eq('id', editId)
          .eq('user_id', user!.id);

        if (devisError) throw devisError;

        const { error: deleteError } = await supabase
          .from('lignes_devis')
          .delete()
          .eq('devis_id', editId);

        if (deleteError) throw deleteError;

        const lignesData = lignes.map((ligne, index) => ({
          devis_id: editId,
          designation: ligne.designation,
          reference: ligne.reference || null,
          unite: ligne.unite || null,
          quantite: ligne.quantite,
          prix_unitaire_ht: ligne.prix_unitaire_ht,
          taux_tva: ligne.taux_tva,
          marge_pourcentage: ligne.marge_pourcentage ?? null,
          produit_id: ligne.produit_id || null,
          fournisseur_id: ligne.fournisseur_id || null,
          ordre: index,
        }));

        const { error: lignesError } = await supabase
          .from('lignes_devis')
          .insert(lignesData);

        if (lignesError) throw lignesError;

        toast.success('Devis mis a jour avec succes');
        router.push('/devis');
        return;
      }

      const { data: devisData, error: devisError } = await supabase
        .from('devis')
        .insert({
          user_id: user!.id,
          numero,
          client_id: clientId,
          date_validite: dateValidite || null,
          informations_travaux: informationsTravaux || null,
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
        reference: ligne.reference || null,
        unite: ligne.unite || null,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        taux_tva: ligne.taux_tva,
        marge_pourcentage: ligne.marge_pourcentage ?? null,
        produit_id: ligne.produit_id || null,
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

  if (authLoading || profileLoading || loadingDevis) {
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
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? 'Modifier le devis' : 'Nouveau Devis'}
          </h1>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Informations sur les travaux / services
              </label>
              <textarea
                value={informationsTravaux}
                onChange={(e) => setInformationsTravaux(e.target.value)}
                rows={3}
                title="Informations sur les travaux / services"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Description globale du devis..."
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
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">Ligne {index + 1}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleProductSearch(ligne.id)}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                      >
                        {ligne.showProductSearch ? 'Masquer la recherche' : 'Choisir depuis la bibliotheque'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateProduct(ligne)}
                        disabled={savingProductId === ligne.id || creatingProductId === ligne.id}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingProductId === ligne.id ? 'Mise a jour...' : 'Mettre a jour'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateProduct(ligne)}
                        disabled={creatingProductId === ligne.id || savingProductId === ligne.id}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingProductId === ligne.id ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>


                  {ligne.showProductSearch && (
                    <div className="mb-3">
                      <ProductSearch
                        onSelectProduct={(product) => handleSelectProduct(ligne.id, product)}
                        placeholder="Rechercher dans votre bibliotheque de produits..."
                      />
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 overflow-x-auto">
                      <div className={lineGridClass}>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={ligne.designation}
                          onChange={(e) => updateLigne(ligne.id, 'designation', e.target.value)}
                          required
                          title="Designation"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                          placeholder="Description du produit/service"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Reference
                        </label>
                        <input
                          type="text"
                          value={ligne.reference}
                          onChange={(e) => updateLigne(ligne.id, 'reference', e.target.value)}
                          title="Reference"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                          placeholder="REF-001"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
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
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Marge %
                        </label>
                        <input
                          type="number"
                          value={ligne.marge_pourcentage}
                          onChange={(e) => updateLigne(ligne.id, 'marge_pourcentage', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          title="Marge"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          TVA %
                        </label>
                        <select
                          value={String(ligne.taux_tva)}
                          onChange={(e) => updateLigne(ligne.id, 'taux_tva', parseFloat(e.target.value))}
                          required
                          title="TVA %"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                        >
                          {tvaOptions.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate} %
                            </option>
                          ))}
                        </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Unite
                        </label>
                        <input
                          type="text"
                          list="unit-options"
                          value={ligne.unite}
                          onChange={(e) => updateLigne(ligne.id, 'unite', e.target.value)}
                          title="Unite"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                          placeholder="unite"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Quantite
                        </label>
                        <input
                          type="number"
                          value={ligne.quantite}
                          onChange={(e) => updateLigne(ligne.id, 'quantite', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          required
                          title="Quantite"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-[13px]"
                        />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                          Total HT
                        </label>
                        <div className="px-3 py-1.5 text-[13px] font-medium text-gray-900 rounded-md bg-gray-50 border border-gray-200 whitespace-nowrap">
                          {(ligne.quantite * ligne.prix_unitaire_ht).toFixed(2)} EUR
                        </div>
                        </div>

                        {isPremium && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 whitespace-nowrap">
                              Stock
                            </label>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStockBadge(ligne).className}`}>
                              {getStockBadge(ligne).label}
                            </span>
                          </div>
                        )}
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
              <datalist id="unit-options">
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total HT:</span>
                    <span className="font-medium text-gray-900">{totals.totalHT.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total TVA:</span>
                    <span className="font-medium text-gray-900">{totals.totalTVA.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span className="text-gray-900">Total TTC:</span>
                    <span className="text-blue-600">{totals.totalTTC.toFixed(2)} EUR</span>
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
              disabled={loading || loadingDevis}
              className="px-6 py-3 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow-md transition-all"
            >
              {loading ? 'Traitement...' : (isEditMode ? 'Mettre a jour' : 'Creer le devis')}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
