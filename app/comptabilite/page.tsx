'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/dashboard-layout';
import PremiumGuard from '@/components/premium-guard';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ComptabiliteStats {
  totalEncaisse: number;
  totalAEncaisser: number;
  nombreFacturesPayees: number;
  nombreFacturesNonPayees: number;
  facturesMoyennes: number;
  tauxEncaissement: number;
}

interface Facture {
  id: string;
  numero: string;
  date_emission: string;
  statut: string;
  total_ttc: number;
  client: {
    nom: string;
    societe: string;
  };
}

type PeriodeType = 'mois' | 'trimestre' | 'annee' | 'personnalisee';

export default function ComptabilitePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ComptabiliteStats>({
    totalEncaisse: 0,
    totalAEncaisser: 0,
    nombreFacturesPayees: 0,
    nombreFacturesNonPayees: 0,
    facturesMoyennes: 0,
    tauxEncaissement: 0,
  });
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodeType, setPeriodeType] = useState<PeriodeType>('mois');
  const [dateDebut, setDateDebut] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateFin, setDateFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const handlePeriodeChange = (type: PeriodeType) => {
    setPeriodeType(type);
    const now = new Date();

    switch (type) {
      case 'mois':
        setDateDebut(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'trimestre':
        setDateDebut(format(startOfQuarter(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfQuarter(now), 'yyyy-MM-dd'));
        break;
      case 'annee':
        setDateDebut(format(startOfYear(now), 'yyyy-MM-dd'));
        setDateFin(format(endOfYear(now), 'yyyy-MM-dd'));
        break;
    }
  };

  const fetchComptabilite = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('factures')
        .select(`
          id,
          numero,
          date_emission,
          statut,
          total_ttc,
          client:clients(nom, societe)
        `)
        .eq('user_id', user.id)
        .gte('date_emission', dateDebut)
        .lte('date_emission', dateFin)
        .order('date_emission', { ascending: false });

      if (error) throw error;

      const facturesData = (data || []) as any[];
      setFactures(facturesData.map(f => ({
        ...f,
        client: Array.isArray(f.client) ? f.client[0] : f.client
      })));

      const facturesPayees = facturesData.filter((f) => f.statut === 'payee');
      const facturesNonPayees = facturesData.filter(
        (f) => f.statut === 'non_payee' || f.statut === 'partiellement_payee'
      );

      const totalEncaisse = facturesPayees.reduce((sum, f) => sum + Number(f.total_ttc), 0);
      const totalAEncaisser = facturesNonPayees.reduce((sum, f) => sum + Number(f.total_ttc), 0);
      const totalGeneral = totalEncaisse + totalAEncaisser;

      setStats({
        totalEncaisse,
        totalAEncaisser,
        nombreFacturesPayees: facturesPayees.length,
        nombreFacturesNonPayees: facturesNonPayees.length,
        facturesMoyennes: facturesData.length > 0 ? totalGeneral / facturesData.length : 0,
        tauxEncaissement: totalGeneral > 0 ? (totalEncaisse / totalGeneral) * 100 : 0,
      });
    } catch (error) {
      console.error('Error fetching comptabilite:', error);
    } finally {
      setLoading(false);
    }
  }, [user, dateDebut, dateFin]);

  useEffect(() => {
    if (user) {
      fetchComptabilite();
    }
  }, [user, dateDebut, dateFin, fetchComptabilite]);

  return (
    <PremiumGuard>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Comptabilité</h1>
              <p className="text-slate-600 mt-1">Analyse de vos revenus et encaissements</p>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-amber-900">Premium</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Période d'analyse</h2>
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => handlePeriodeChange('mois')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  periodeType === 'mois'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Mois en cours
              </button>
              <button
                onClick={() => handlePeriodeChange('trimestre')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  periodeType === 'trimestre'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Trimestre
              </button>
              <button
                onClick={() => handlePeriodeChange('annee')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  periodeType === 'annee'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Année
              </button>
              <button
                onClick={() => setPeriodeType('personnalisee')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  periodeType === 'personnalisee'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Personnalisée
              </button>
            </div>

            {periodeType === 'personnalisee' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    title="Date de début"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    title="Date de fin"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Total Encaissé</h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">{stats.totalEncaisse.toFixed(2)} €</p>
                  <p className="text-sm mt-2 opacity-90">
                    {stats.nombreFacturesPayees} facture{stats.nombreFacturesPayees > 1 && "s"} payée{stats.nombreFacturesPayees > 1 && "s"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">À Encaisser</h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">{stats.totalAEncaisser.toFixed(2)} €</p>
                  <p className="text-sm mt-2 opacity-90">
                    {stats.nombreFacturesNonPayees} facture{stats.nombreFacturesNonPayees > 1 && "s"} en attente
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium opacity-90">Taux d'Encaissement</h3>
                    <svg
                      className="w-8 h-8 opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold">{stats.tauxEncaissement.toFixed(1)} %</p>
                  <p className="text-sm mt-2 opacity-90">Facture moyenne: {stats.facturesMoyennes.toFixed(2)} €</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Factures de la période ({factures.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Numéro
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Montant TTC
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {factures.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                            Aucune facture pour cette période
                          </td>
                        </tr>
                      ) : (
                        factures.map((facture) => (
                          <tr key={facture.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-slate-900">{facture.numero}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm">
                                <div className="font-medium text-slate-900">
                                  {facture.client?.societe || facture.client?.nom || 'N/A'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {format(new Date(facture.date_emission), 'dd MMM yyyy', { locale: fr })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-900">
                                {Number(facture.total_ttc).toFixed(2)} €
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  facture.statut === 'payee'
                                    ? 'bg-green-100 text-green-800'
                                    : facture.statut === 'partiellement_payee'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {facture.statut === 'payee'
                                  ? 'Payée'
                                  : facture.statut === 'partiellement_payee'
                                  ? 'Partielle'
                                  : 'Non payée'}
                              </span>
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
      </DashboardLayout>
    </PremiumGuard>
  );
}
