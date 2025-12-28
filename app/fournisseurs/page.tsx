'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types';

type Fournisseur = Database['public']['Tables']['fournisseurs']['Row'];
type Produit = Database['public']['Tables']['produits']['Row'];
type ProduitFournisseur = Database['public']['Tables']['produits_fournisseurs']['Row'];

export default function FournisseursPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitsPrices, setProduitsPrices] = useState<ProduitFournisseur[]>([]);

  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    email: '',
    telephone: '',
  });

  const [priceForm, setPriceForm] = useState({
    produit_id: '',
    prix_achat_ht: 0,
    prix_vente_ht: 0,
  });

  const fetchFournisseurs = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFournisseurs(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchProduits = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('produits')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setProduits(data || []);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchFournisseurs();
      fetchProduits();
    }
  }, [authLoading, fetchFournisseurs, fetchProduits, router, user]);

  const openModal = (fournisseur?: Fournisseur) => {
    if (fournisseur) {
      setEditingFournisseur(fournisseur);
      setFormData({
        nom: fournisseur.nom,
        contact: fournisseur.contact || '',
        email: fournisseur.email || '',
        telephone: fournisseur.telephone || '',
      });
    } else {
      setEditingFournisseur(null);
      setFormData({
        nom: '',
        contact: '',
        email: '',
        telephone: '',
      });
    }
    setShowModal(true);
  };

  const openPriceModal = async (fournisseur: Fournisseur) => {
    setSelectedFournisseur(fournisseur);
    await fetchProduitsPrices(fournisseur.id);
    setPriceForm({
      produit_id: '',
      prix_achat_ht: 0,
      prix_vente_ht: 0,
    });
    setShowPriceModal(true);
  };

  const fetchProduitsPrices = async (fournisseurId: string) => {
    const { data, error } = await supabase
      .from('produits_fournisseurs')
      .select('*')
      .eq('fournisseur_id', fournisseurId);

    if (error) {
      toast.error(error.message);
      return;
    }
    setProduitsPrices(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingFournisseur) {
        const { error } = await supabase
          .from('fournisseurs')
          .update(formData)
          .eq('id', editingFournisseur.id);

        if (error) throw error;
        toast.success('Fournisseur modifié');
      } else {
        const { error } = await supabase
          .from('fournisseurs')
          .insert([{ ...formData, user_id: user!.id }]);

        if (error) throw error;
        toast.success('Fournisseur ajouté');
      }

      setShowModal(false);
      setEditingFournisseur(null);
      fetchFournisseurs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFournisseur) return;

    try {
      const existing = produitsPrices.find(p => p.produit_id === priceForm.produit_id);

      if (existing) {
        const { error } = await supabase
          .from('produits_fournisseurs')
          .update({
            prix_achat_ht: priceForm.prix_achat_ht,
            prix_vente_ht: priceForm.prix_vente_ht,
          })
          .eq('id', existing.id);

        if (error) throw error;
        toast.success('Prix modifié');
      } else {
        const { error } = await supabase
          .from('produits_fournisseurs')
          .insert([{
            user_id: user!.id,
            produit_id: priceForm.produit_id,
            fournisseur_id: selectedFournisseur.id,
            prix_achat_ht: priceForm.prix_achat_ht,
            prix_vente_ht: priceForm.prix_vente_ht,
          }]);

        if (error) throw error;
        toast.success('Prix ajouté');
      }

      setPriceForm({
        produit_id: '',
        prix_achat_ht: 0,
        prix_vente_ht: 0,
      });
      await fetchProduitsPrices(selectedFournisseur.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce fournisseur ?')) return;

    try {
      const { error } = await supabase
        .from('fournisseurs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Fournisseur supprimé');
      fetchFournisseurs();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeletePrice = async (id: string) => {
    if (!confirm('Supprimer ce prix ?')) return;

    try {
      const { error } = await supabase
        .from('produits_fournisseurs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Prix supprimé');
      if (selectedFournisseur) {
        await fetchProduitsPrices(selectedFournisseur.id);
      }
    } catch (error: any) {
      toast.error(error.message);
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
          <h1 className="text-3xl font-bold text-gray-900">Fournisseurs</h1>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            Ajouter un fournisseur
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fournisseurs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucun fournisseur
                  </td>
                </tr>
              ) : (
                fournisseurs.map((fournisseur) => (
                  <tr key={fournisseur.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {fournisseur.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fournisseur.contact || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fournisseur.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fournisseur.telephone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => openPriceModal(fournisseur)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Prix
                      </button>
                      <button
                        onClick={() => openModal(fournisseur)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(fournisseur.id)}
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingFournisseur ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <input
                  aria-label="Nom"
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact
                  </label>
                  <input
                    aria-label="Contact"
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    aria-label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    aria-label="Telephone"
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingFournisseur ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPriceModal && selectedFournisseur && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Prix - {selectedFournisseur.nom}
            </h2>

            <form onSubmit={handlePriceSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Ajouter/Modifier un prix</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produit *
                  </label>
                  <select
                    aria-label="Produit"
                    value={priceForm.produit_id}
                    onChange={(e) => setPriceForm({ ...priceForm, produit_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un produit</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>{p.designation}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix achat HT *
                  </label>
                  <input
                    aria-label="Prix achat HT"
                    type="number"
                    step="0.01"
                    value={priceForm.prix_achat_ht}
                    onChange={(e) => setPriceForm({ ...priceForm, prix_achat_ht: parseFloat(e.target.value) })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix vente HT *
                  </label>
                  <input
                    aria-label="Prix vente HT"
                    type="number"
                    step="0.01"
                    value={priceForm.prix_vente_ht}
                    onChange={(e) => setPriceForm({ ...priceForm, prix_vente_ht: parseFloat(e.target.value) })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                >
                  Ajouter/Modifier
                </button>
              </div>
            </form>

            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prix achat HT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prix vente HT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Marge HT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Marge %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {produitsPrices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-gray-500 text-sm">
                        Aucun prix configuré
                      </td>
                    </tr>
                  ) : (
                    produitsPrices.map((pp) => {
                      const produit = produits.find(p => p.id === pp.produit_id);
                      return (
                        <tr key={pp.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {produit?.designation || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {pp.prix_achat_ht.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {pp.prix_vente_ht.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {pp.marge_ht.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {pp.marge_pourcentage.toFixed(2)} %
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            <button
                              onClick={() => handleDeletePrice(pp.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
