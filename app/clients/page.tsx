'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { AddressAutocomplete } from '@/components/address-autocomplete.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types.ts';

type Client = Database['public']['Tables']['clients']['Row'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];
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

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ?')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Client supprimé');
      fetchClients();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la suppression du client';
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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <button
            type="button"
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
          >
            Ajouter un client
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Aucun client
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id}>
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        onClick={() => openModal(client)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client.id)}
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
