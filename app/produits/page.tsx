'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

type Produit = {
  id: string;
  designation: string;
  reference: string | null;
  categorie: string | null;
  unite: string | null;
  type: 'standard' | 'custom' | null;
  code_standard: string | null;
  prix_ht_defaut: number | null;
  taux_tva_defaut: number | null;
  fournisseur_defaut_id: string | null;
  actif: boolean | null;
  created_at: string;
};

type Fournisseur = {
  id: string;
  nom: string;
};

export default function ProduitsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [produitsStandards, setProduitsStandards] = useState<Produit[]>([]);
  const [produitsCustom, setProduitsCustom] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);

  const [formData, setFormData] = useState({
    designation: '',
    reference: '',
    categorie: '',
    unite: 'unité',
    prix_ht_defaut: 0,
    taux_tva_defaut: 20,
    fournisseur_defaut_id: '',
    actif: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchProduits();
      fetchFournisseurs();
    }
  }, [user, authLoading, router]);

  const fetchProduits = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const standards = (data || []).filter(p => p.type === 'standard');
      const customs = (data || []).filter(p => p.type !== 'standard');

      setProduitsStandards(standards);
      setProduitsCustom(customs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement des produits';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('id, nom')
        .eq('user_id', user.id)
        .order('nom');

      if (error) throw error;
      setFournisseurs(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
    }
  };

  const openModal = (produit?: Produit) => {
    if (produit) {
      setEditingProduit(produit);
      setFormData({
        designation: produit.designation,
        reference: produit.reference || '',
        categorie: produit.categorie || '',
        unite: produit.unite || 'unité',
        prix_ht_defaut: produit.prix_ht_defaut || 0,
        taux_tva_defaut: produit.taux_tva_defaut || 20,
        fournisseur_defaut_id: produit.fournisseur_defaut_id || '',
        actif: produit.actif !== false,
      });
    } else {
      setEditingProduit(null);
      setFormData({
        designation: '',
        reference: '',
        categorie: '',
        unite: 'unité',
        prix_ht_defaut: 0,
        taux_tva_defaut: 20,
        fournisseur_defaut_id: '',
        actif: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduit(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        fournisseur_defaut_id: formData.fournisseur_defaut_id || null,
      };

      if (editingProduit) {
        const { error } = await supabase
          .from('produits')
          .update(dataToSave)
          .eq('id', editingProduit.id);

        if (error) throw error;
        toast.success('Produit modifié');
      } else {
        const { error } = await supabase
          .from('produits')
          .insert([{
            ...dataToSave,
            user_id: user!.id,
            type: 'custom',
          }]);

        if (error) throw error;
        toast.success('Produit ajouté');
      }

      closeModal();
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du produit';
      toast.error(message);
    }
  };

  const handleToggleActif = async (produit: Produit) => {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ actif: !produit.actif })
        .eq('id', produit.id);

      if (error) throw error;
      toast.success(produit.actif ? 'Produit désactivé' : 'Produit activé');
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la mise a jour du produit';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;

    try {
      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Produit supprimé');
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la suppression du produit';
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

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Produits et Prestations</h1>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/fournisseurs"
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 font-medium text-center whitespace-nowrap"
            >
              Gérer les fournisseurs
            </Link>
            <button
              type="button"
              onClick={() => openModal()}
              className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 font-medium shadow-sm hover:shadow-md transition-all text-center whitespace-nowrap"
            >
              Ajouter un produit
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Produits Standards
          </h3>
          <p className="text-sm text-blue-700">
            Ces produits sont préconfigurés et peuvent être utilisés directement dans vos devis.
            Vous pouvez modifier leurs prix et paramètres selon vos besoins.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Désignation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {produitsStandards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit standard
                  </td>
                </tr>
              ) : (
                produitsStandards.map((produit) => (
                  <tr key={produit.id} className={!produit.actif ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                          Standard
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {produit.designation}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {produit.prix_ht_defaut?.toFixed(2) || '0.00'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.taux_tva_defaut || 20}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.unite}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {produit.actif ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActif(produit)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {produit.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(produit)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Produits Personnalisés</h2>
          <p className="text-sm text-gray-600 mt-1">
            Créez vos propres produits, prestations et postes pour les réutiliser dans vos devis.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[840px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Désignation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {produitsCustom.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit personnalisé. Cliquez sur &quot;Ajouter un produit&quot; pour commencer.
                  </td>
                </tr>
              ) : (
                produitsCustom.map((produit) => (
                  <tr key={produit.id} className={!produit.actif ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {produit.designation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {produit.prix_ht_defaut?.toFixed(2) || '0.00'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.taux_tva_defaut || 20}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.unite}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {produit.actif ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActif(produit)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {produit.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(produit)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(produit.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingProduit ? 'Modifier le produit' : 'Ajouter un produit'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Désignation *
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                  disabled={editingProduit?.type === 'standard'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Référence
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    placeholder="Ex: Matériel, Prestation, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix HT par défaut *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prix_ht_defaut}
                    onChange={(e) => setFormData({ ...formData, prix_ht_defaut: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TVA par défaut (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.taux_tva_defaut}
                    onChange={(e) => setFormData({ ...formData, taux_tva_defaut: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unité *
                  </label>
                  <select
                    value={formData.unite}
                    onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="unité">unité</option>
                    <option value="m">m</option>
                    <option value="m²">m²</option>
                    <option value="m³">m³</option>
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="heure">heure</option>
                    <option value="jour">jour</option>
                    <option value="forfait">forfait</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fournisseur par défaut
                  </label>
                  <select
                    value={formData.fournisseur_defaut_id}
                    onChange={(e) => setFormData({ ...formData, fournisseur_defaut_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Aucun</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">
                  Produit actif (disponible dans les devis)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 shadow-sm hover:shadow-md transition-all"
                >
                  {editingProduit ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
