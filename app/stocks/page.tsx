'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import PremiumGuard from '@/components/premium-guard.tsx';
import toast from 'react-hot-toast';

interface Produit {
  id: string;
  designation: string;
  reference: string;
  categorie: string;
  stock_actuel: number;
  stock_minimum: number;
  gestion_stock: boolean;
  unite: string;
}

interface MouvementStock {
  id: string;
  type_mouvement: string;
  quantite: number;
  stock_avant: number;
  stock_apres: number;
  prix_unitaire: number;
  reference_document: string;
  notes: string;
  created_at: string;
  produit: {
    designation: string;
  } | null;
  fournisseur?: {
    nom: string;
  } | null;
}

type RawMouvementStock = Omit<MouvementStock, 'produit' | 'fournisseur'> & {
  produit: MouvementStock['produit'] | MouvementStock['produit'][] | null;
  fournisseur?: MouvementStock['fournisseur'] | MouvementStock['fournisseur'][] | null;
};

interface Fournisseur {
  id: string;
  nom: string;
}

export default function StocksPage() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMouvementModal, setShowMouvementModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);

  const [formData, setFormData] = useState({
    produit_id: '',
    type_mouvement: 'entree',
    quantite: '',
    fournisseur_id: '',
    prix_unitaire: '',
    reference_document: '',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const [produitsRes, mouvementsRes, fournisseursRes] = await Promise.all([
        supabase
          .from('produits')
          .select('*')
          .eq('user_id', user.id)
          .eq('gestion_stock', true)
          .order('designation'),
        supabase
          .from('mouvements_stock')
          .select(`
            *,
            produit:produits(designation),
            fournisseur:fournisseurs(nom)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('fournisseurs')
          .select('id, nom')
          .eq('user_id', user.id)
          .order('nom'),
      ]);

      if (produitsRes.error) throw produitsRes.error;
      if (mouvementsRes.error) throw mouvementsRes.error;
      if (fournisseursRes.error) throw fournisseursRes.error;

      setProduits(produitsRes.data || []);
      const mouvementsData = (mouvementsRes.data || []) as RawMouvementStock[];
      setMouvements(
        mouvementsData.map((m) => ({
          ...m,
          produit: Array.isArray(m.produit) ? m.produit[0] : m.produit,
          fournisseur: Array.isArray(m.fournisseur) ? m.fournisseur[0] : m.fournisseur,
        }))
      );
      setFournisseurs(fournisseursRes.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateStock = async (produitId: string) => {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ gestion_stock: true })
        .eq('id', produitId)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success('Gestion de stock activée');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSubmitMouvement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      const { error } = await supabase.from('mouvements_stock').insert({
        user_id: user.id,
        produit_id: formData.produit_id,
        type_mouvement: formData.type_mouvement,
        quantite: Number(formData.quantite),
        fournisseur_id: formData.fournisseur_id || null,
        prix_unitaire: formData.prix_unitaire ? Number(formData.prix_unitaire) : null,
        reference_document: formData.reference_document || null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast.success('Mouvement de stock enregistré');
      setShowMouvementModal(false);
      setFormData({
        produit_id: '',
        type_mouvement: 'entree',
        quantite: '',
        fournisseur_id: '',
        prix_unitaire: '',
        reference_document: '',
        notes: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const produitsStockFaible = produits.filter(
    (p) => p.stock_actuel <= p.stock_minimum && p.stock_minimum > 0
  );

  return (
    <PremiumGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Gestion des Stocks</h1>
              <p className="text-slate-600 mt-1">Suivez vos entrées et sorties de stock</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-semibold text-amber-900">Premium</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMouvementModal(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
              >
                + Nouveau mouvement
              </button>
            </div>
          </div>

          {produitsStockFaible.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-orange-500 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-orange-900 mb-1">
                    Alerte Stock Faible ({produitsStockFaible.length})
                  </h3>
                  <ul className="text-sm text-orange-800 space-y-1">
                    {produitsStockFaible.map((p) => (
                      <li key={p.id}>
                        {p.designation} - Stock: {p.stock_actuel} {p.unite} (Minimum: {p.stock_minimum})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Produits avec gestion de stock ({produits.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Produit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Référence
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Stock actuel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Stock minimum
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {produits.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                            Aucun produit avec gestion de stock. Activez la gestion de stock depuis la page Produits.
                          </td>
                        </tr>
                      ) : (
                        produits.map((produit) => (
                          <tr key={produit.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{produit.designation}</div>
                              {produit.categorie && (
                                <div className="text-sm text-slate-500">{produit.categorie}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {produit.reference || '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-900">
                                {produit.stock_actuel} {produit.unite}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {produit.stock_minimum} {produit.unite}
                            </td>
                            <td className="px-6 py-4">
                              {produit.stock_actuel <= produit.stock_minimum && produit.stock_minimum > 0 ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Stock faible
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Derniers mouvements ({mouvements.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Produit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Quantité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {mouvements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                            Aucun mouvement de stock
                          </td>
                        </tr>
                      ) : (
                        mouvements.map((mouvement) => (
                          <tr key={mouvement.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {new Date(mouvement.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">
                                {mouvement.produit?.designation || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  mouvement.type_mouvement === 'entree'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {mouvement.type_mouvement === 'entree' ? 'Entrée' : 'Sortie'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-900">
                                {mouvement.type_mouvement === 'entree' ? '+' : '-'}
                                {mouvement.quantite}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {mouvement.stock_avant} → {mouvement.stock_apres}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500">
                              {mouvement.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {showMouvementModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900">Nouveau mouvement de stock</h2>
              </div>
              <form onSubmit={handleSubmitMouvement} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Produit *
                  </label>
                  <select
                    required
                    value={formData.produit_id}
                    onChange={(e) => setFormData({ ...formData, produit_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="">Sélectionner un produit</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.designation} (Stock: {p.stock_actuel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type de mouvement *
                    </label>
                    <select
                      required
                      value={formData.type_mouvement}
                      onChange={(e) => setFormData({ ...formData, type_mouvement: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    >
                      <option value="entree">Entrée</option>
                      <option value="sortie">Sortie</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Quantité *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.quantite}
                      onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                </div>

                {formData.type_mouvement === 'entree' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fournisseur
                    </label>
                    <select
                      value={formData.fournisseur_id}
                      onChange={(e) => setFormData({ ...formData, fournisseur_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    >
                      <option value="">Aucun</option>
                      {fournisseurs.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Prix unitaire
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.prix_unitaire}
                      onChange={(e) => setFormData({ ...formData, prix_unitaire: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Référence document
                    </label>
                    <input
                      type="text"
                      value={formData.reference_document}
                      onChange={(e) =>
                        setFormData({ ...formData, reference_document: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                  >
                    Enregistrer le mouvement
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMouvementModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardLayout>
    </PremiumGuard>
  );
}
