'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { AddressAutocomplete } from '@/components/address-autocomplete.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';

type Client = Database['public']['Tables']['clients']['Row'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];
type Devis = Database['public']['Tables']['devis']['Row'];
type Facture = Database['public']['Tables']['factures']['Row'];
type DevisHistory = Pick<Devis, 'id' | 'numero' | 'date_creation' | 'statut' | 'total_ttc'>;
type FactureHistory = Pick<Facture, 'id' | 'numero' | 'date_emission' | 'statut' | 'total_ttc'>;
type ClientFormData = {
  nom: string;
  societe: string;
  adresse: string;
  code_postal: string;
  ville: string;
  departement: string;
  adresse_intervention: string;
  code_postal_intervention: string;
  ville_intervention: string;
  departement_intervention: string;
  email: string;
  telephone: string;
};

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [clientDevis, setClientDevis] = useState<DevisHistory[]>([]);
  const [clientFactures, setClientFactures] = useState<FactureHistory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<ClientFormData>({
    nom: '',
    societe: '',
    adresse: '',
    code_postal: '',
    ville: '',
    departement: '',
    adresse_intervention: '',
    code_postal_intervention: '',
    ville_intervention: '',
    departement_intervention: '',
    email: '',
    telephone: '',
  });

  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement des clients';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const haystack = [
        client.nom,
        client.societe,
        client.email,
        client.telephone,
        client.ville,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [clients, searchQuery]);

  const selectedCount = selectedIds.length;
  const selectedClient =
    selectedCount === 1
      ? clients.find((client) => client.id === selectedIds[0]) || null
      : null;
  const isAllSelected =
    filteredClients.length > 0 &&
    filteredClients.every((client) => selectedIds.includes(client.id));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchClients();
    }
  }, [user, authLoading, router, fetchClients]);

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        nom: client.nom,
        societe: client.societe || '',
        adresse: client.adresse,
        code_postal: client.code_postal,
        ville: client.ville,
        departement: client.departement || '',
        adresse_intervention: client.adresse_intervention || '',
        code_postal_intervention: client.code_postal_intervention || '',
        ville_intervention: client.ville_intervention || '',
        departement_intervention: client.departement_intervention || '',
        email: client.email,
        telephone: client.telephone,
      });
    } else {
      setEditingClient(null);
      setFormData({
        nom: '',
        societe: '',
        adresse: '',
        code_postal: '',
        ville: '',
        departement: '',
        adresse_intervention: '',
        code_postal_intervention: '',
        ville_intervention: '',
        departement_intervention: '',
        email: '',
        telephone: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
  };

  const openView = async (client: Client) => {
    setViewClient(client);
    setViewLoading(true);

    try {
      const [devisResult, facturesResult] = await Promise.all([
        supabase
          .from('devis')
          .select('id, numero, date_creation, statut, total_ttc')
          .eq('user_id', user!.id)
          .eq('client_id', client.id)
          .order('date_creation', { ascending: false }),
        supabase
          .from('factures')
          .select('id, numero, date_emission, statut, total_ttc')
          .eq('user_id', user!.id)
          .eq('client_id', client.id)
          .order('date_emission', { ascending: false }),
      ]);

      if (devisResult.error) throw devisResult.error;
      if (facturesResult.error) throw facturesResult.error;

      setClientDevis(devisResult.data || []);
      setClientFactures(facturesResult.data || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement du client';
      toast.error(message);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewClient(null);
    setClientDevis([]);
    setClientFactures([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !filteredClients.some((client) => client.id === id))
      );
      return;
    }

    setSelectedIds((prev) => [
      ...new Set([...prev, ...filteredClients.map((client) => client.id)]),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingClient) {
        const updates: ClientUpdate = { ...formData };
        const { error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', editingClient.id);

        if (error) throw error;
        toast.success('Client modifié');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([{ ...formData, user_id: user!.id }]);

        if (error) throw error;
        toast.success('Client ajouté');
      }

      closeModal();
      fetchClients();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du client';
      toast.error(message);
    }
  };


  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm('Supprimer les clients selectionnes ?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;
      toast.success('Clients supprimes');
      setSelectedIds([]);
      fetchClients();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la suppression des clients';
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <button
            type="button"
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            Ajouter un client
          </button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectedClient && openView(selectedClient)}
              disabled={!selectedClient}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Voir
            </button>
            <button
              type="button"
              onClick={() => selectedClient && openModal(selectedClient)}
              disabled={!selectedClient}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedCount === 0}
              className="px-3 py-2 rounded-md border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Supprimer
            </button>
          </div>
          <div className="w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    aria-label="Tout selectionner"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Société
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ville
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Aucun client
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedIds.includes(client.id);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => openView(client)}
                      className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(client.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          aria-label={`Selectionner ${client.nom}`}
                        />
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.societe || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.telephone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.ville}
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Fiche client</h2>
              <button
                type="button"
                onClick={closeView}
                className="text-gray-600 hover:text-gray-900"
              >
                Fermer
              </button>
            </div>

            {viewLoading ? (
              <div className="py-8 text-center text-gray-600">Chargement...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">Identite</p>
                    <p>{viewClient.nom}</p>
                    <p>{viewClient.societe || '-'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Contact</p>
                    <p>{viewClient.email}</p>
                    <p>{viewClient.telephone}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Adresse de facturation</p>
                    <p>{viewClient.adresse}</p>
                    <p>
                      {viewClient.code_postal} {viewClient.ville}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Adresse d&apos;intervention</p>
                    <p>{viewClient.adresse_intervention || '-'}</p>
                    <p>
                      {viewClient.code_postal_intervention || '-'}{' '}
                      {viewClient.ville_intervention || ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-md p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Historique devis</h3>
                    {clientDevis.length === 0 ? (
                      <p className="text-sm text-gray-600">Aucun devis</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {clientDevis.map((devis) => (
                          <li key={devis.id} className="flex justify-between">
                            <span>
                              {devis.numero} • {new Date(devis.date_creation).toLocaleDateString('fr-FR')} • {devis.statut}
                            </span>
                            <span>{Number(devis.total_ttc).toFixed(2)}&nbsp;&euro;</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-md p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Historique factures</h3>
                    {clientFactures.length === 0 ? (
                      <p className="text-sm text-gray-600">Aucune facture</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {clientFactures.map((facture) => (
                          <li key={facture.id} className="flex justify-between">
                            <span>
                              {facture.numero} • {new Date(facture.date_emission).toLocaleDateString('fr-FR')} • {facture.statut}
                            </span>
                            <span>{Number(facture.total_ttc).toFixed(2)}&nbsp;&euro;</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingClient ? 'Modifier le client' : 'Ajouter un client'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="client_nom" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    id="client_nom"
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_societe" className="block text-sm font-medium text-gray-700 mb-1">
                    Société
                  </label>
                  <input
                    id="client_societe"
                    type="text"
                    value={formData.societe}
                    onChange={(e) => setFormData({ ...formData, societe: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-gray-900">Adresse de facturation</p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="adresse_facturation" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse de facturation *
                  </label>
                  <AddressAutocomplete
                    inputId="adresse_facturation"
                    value={formData.adresse}
                    onChange={(value) => setFormData({ ...formData, adresse: value })}
                    onSelect={(suggestion) =>
                      setFormData({
                        ...formData,
                        adresse: suggestion.adresse,
                        code_postal: suggestion.code_postal,
                        ville: suggestion.ville,
                        departement: suggestion.departement,
                      })
                    }
                    inputClassName="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_code_postal" className="block text-sm font-medium text-gray-700 mb-1">
                    Code postal de facturation *
                  </label>
                  <input
                    id="client_code_postal"
                    type="text"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_ville" className="block text-sm font-medium text-gray-700 mb-1">
                    Ville de facturation *
                  </label>
                  <input
                    id="client_ville"
                    type="text"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_departement" className="block text-sm font-medium text-gray-700 mb-1">
                    Departement de facturation
                  </label>
                  <input
                    id="client_departement"
                    type="text"
                    value={formData.departement}
                    onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-gray-900">Adresse d'intervention</p>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="adresse_intervention" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse d'intervention
                  </label>
                  <AddressAutocomplete
                    inputId="adresse_intervention"
                    value={formData.adresse_intervention}
                    onChange={(value) =>
                      setFormData({ ...formData, adresse_intervention: value })
                    }
                    onSelect={(suggestion) =>
                      setFormData({
                        ...formData,
                        adresse_intervention: suggestion.adresse,
                        code_postal_intervention: suggestion.code_postal,
                        ville_intervention: suggestion.ville,
                        departement_intervention: suggestion.departement,
                      })
                    }
                    inputClassName="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_code_postal_intervention" className="block text-sm font-medium text-gray-700 mb-1">
                    Code postal d'intervention
                  </label>
                  <input
                    id="client_code_postal_intervention"
                    type="text"
                    value={formData.code_postal_intervention}
                    onChange={(e) =>
                      setFormData({ ...formData, code_postal_intervention: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_ville_intervention" className="block text-sm font-medium text-gray-700 mb-1">
                    Ville d'intervention
                  </label>
                  <input
                    id="client_ville_intervention"
                    type="text"
                    value={formData.ville_intervention}
                    onChange={(e) =>
                      setFormData({ ...formData, ville_intervention: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_departement_intervention" className="block text-sm font-medium text-gray-700 mb-1">
                    Departement d'intervention
                  </label>
                  <input
                    id="client_departement_intervention"
                    type="text"
                    value={formData.departement_intervention}
                    onChange={(e) =>
                      setFormData({ ...formData, departement_intervention: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    id="client_email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="client_telephone" className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    id="client_telephone"
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingClient ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
