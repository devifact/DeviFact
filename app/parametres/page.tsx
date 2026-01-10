'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useProfile } from '@/lib/hooks/use-profile.ts';
import { useCompanySettings } from '@/lib/hooks/use-company-settings.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const defaultMentions = {
  conditions_reglement: 'Paiement a 30 jours',
  delai_paiement: 'Paiement a 30 jours',
  penalites_retard: 'Taux BCE + 10 points',
  indemnite_recouvrement_montant: 40,
  indemnite_recouvrement_texte: 'EUR (article L441-6 du Code de commerce)',
  escompte: '',
};

export default function ParametresPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { settings, loading: settingsLoading, updateSettings } = useCompanySettings();
  const router = useRouter();
  const [savingLegal, setSavingLegal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const [legalForm, setLegalForm] = useState({
    conditions_reglement: defaultMentions.conditions_reglement,
    delai_paiement: defaultMentions.delai_paiement,
    penalites_retard: defaultMentions.penalites_retard,
    indemnite_recouvrement_montant: defaultMentions.indemnite_recouvrement_montant,
    indemnite_recouvrement_texte: defaultMentions.indemnite_recouvrement_texte,
    escompte: defaultMentions.escompte,
  });

  const [bankForm, setBankForm] = useState({
    iban: '',
    bic: '',
    titulaire_compte: '',
    banque_nom: '',
    domiciliation: '',
    modes_paiement_acceptes: '',
    reference_paiement: '',
    rib: '',
  });

  const [defaultsForm, setDefaultsForm] = useState({
    taux_tva_defaut: 20,
    marge_defaut: 0,
    tva_intracommunautaire: '',
  });

  const tvaOptions = [0, 5.5, 10, 20];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    const rawIndemnite = settings?.indemnite_recouvrement_montant;
    const indemniteMontant = Number.isFinite(Number(rawIndemnite))
      ? Number(rawIndemnite)
      : defaultMentions.indemnite_recouvrement_montant;

    setLegalForm({
      conditions_reglement: settings?.conditions_reglement ?? defaultMentions.conditions_reglement,
      delai_paiement: settings?.delai_paiement ?? defaultMentions.delai_paiement,
      penalites_retard: settings?.penalites_retard ?? defaultMentions.penalites_retard,
      indemnite_recouvrement_montant: indemniteMontant,
      indemnite_recouvrement_texte: settings?.indemnite_recouvrement_texte ?? defaultMentions.indemnite_recouvrement_texte,
      escompte: settings?.escompte || defaultMentions.escompte,
    });
  }, [settings]);

  useEffect(() => {
    setBankForm({
      iban: profile?.iban || '',
      bic: profile?.bic || '',
      titulaire_compte: settings?.titulaire_compte || '',
      banque_nom: settings?.banque_nom || '',
      domiciliation: settings?.domiciliation || '',
      modes_paiement_acceptes: settings?.modes_paiement_acceptes || '',
      reference_paiement: settings?.reference_paiement || '',
      rib: settings?.rib || '',
    });
  }, [profile, settings]);

  useEffect(() => {
    const fallbackTva = typeof settings?.taux_tva_defaut === 'number'
      ? settings.taux_tva_defaut
      : (typeof profile?.taux_tva === 'number'
        ? profile.taux_tva
        : (profile?.tva_applicable === false ? 0 : 20));
    const fallbackMarge = typeof settings?.marge_defaut === 'number'
      ? settings.marge_defaut
      : (typeof profile?.marge_defaut === 'number' ? profile.marge_defaut : 0);

    setDefaultsForm({
      taux_tva_defaut: fallbackTva,
      marge_defaut: fallbackMarge,
      tva_intracommunautaire: settings?.tva_intracommunautaire || '',
    });
  }, [profile, settings]);

  const handleSaveLegal = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSavingLegal(true);
      const indemnityValue = Number(legalForm.indemnite_recouvrement_montant);
      const indemnityAmount = Number.isFinite(indemnityValue)
        ? indemnityValue
        : defaultMentions.indemnite_recouvrement_montant;

      await updateSettings({
        conditions_reglement: legalForm.conditions_reglement.trim() || defaultMentions.conditions_reglement,
        delai_paiement: legalForm.delai_paiement.trim() || defaultMentions.delai_paiement,
        penalites_retard: legalForm.penalites_retard.trim() || defaultMentions.penalites_retard,
        indemnite_recouvrement_montant: indemnityAmount,
        indemnite_recouvrement_texte: legalForm.indemnite_recouvrement_texte.trim()
          || defaultMentions.indemnite_recouvrement_texte,
        escompte: legalForm.escompte.trim() || null,
      });

      toast.success('Mentions obligatoires enregistrees');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement';
      toast.error(message);
    } finally {
      setSavingLegal(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSavingBank(true);
      await updateSettings({
        titulaire_compte: bankForm.titulaire_compte.trim() || null,
        banque_nom: bankForm.banque_nom.trim() || null,
        domiciliation: bankForm.domiciliation.trim() || null,
        modes_paiement_acceptes: bankForm.modes_paiement_acceptes.trim() || null,
        reference_paiement: bankForm.reference_paiement.trim() || null,
        rib: bankForm.rib.trim() || null,
      });
      await updateProfile({
        iban: bankForm.iban.trim() || null,
        bic: bankForm.bic.trim() || null,
      });
      toast.success('Informations bancaires enregistrees');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement';
      toast.error(message);
    } finally {
      setSavingBank(false);
    }
  };

  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSavingDefaults(true);
      const tvaValue = Number(defaultsForm.taux_tva_defaut);
      const margeValue = Number(defaultsForm.marge_defaut);

      await updateSettings({
        taux_tva_defaut: Number.isFinite(tvaValue) ? tvaValue : 20,
        marge_defaut: Number.isFinite(margeValue) ? margeValue : 0,
        tva_intracommunautaire: defaultsForm.tva_intracommunautaire.trim() || null,
      });

      toast.success('Reglages enregistres');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement';
      toast.error(message);
    } finally {
      setSavingDefaults(false);
    }
  };

  if (authLoading || profileLoading || settingsLoading) {
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
      <div className="max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Parametres</h1>
          <p className="text-sm text-gray-600 mt-2">
            Configurez les mentions obligatoires et les informations bancaires affichees sur vos devis et factures.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Mentions obligatoires</h2>
              <p className="text-sm text-gray-600">
                Ces mentions sont affichees sur vos factures et devis.
              </p>
            </div>

            <form onSubmit={handleSaveLegal} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="conditions_reglement" className="block text-sm font-medium text-gray-700 mb-1">
                    Conditions de reglement
                  </label>
                  <input
                    id="conditions_reglement"
                    type="text"
                    value={legalForm.conditions_reglement}
                    onChange={(e) => setLegalForm({ ...legalForm, conditions_reglement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="delai_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                    Delai de paiement
                  </label>
                  <input
                    id="delai_paiement"
                    type="text"
                    value={legalForm.delai_paiement}
                    onChange={(e) => setLegalForm({ ...legalForm, delai_paiement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="penalites_retard" className="block text-sm font-medium text-gray-700 mb-1">
                    Penalites de retard
                  </label>
                  <input
                    id="penalites_retard"
                    type="text"
                    value={legalForm.penalites_retard}
                    onChange={(e) => setLegalForm({ ...legalForm, penalites_retard: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="indemnite_montant" className="block text-sm font-medium text-gray-700 mb-1">
                    Indemnite forfaitaire (montant)
                  </label>
                  <input
                    id="indemnite_montant"
                    type="number"
                    step="0.01"
                    value={legalForm.indemnite_recouvrement_montant}
                    onChange={(e) => setLegalForm({
                      ...legalForm,
                      indemnite_recouvrement_montant: Number.parseFloat(e.target.value) || 0,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="indemnite_texte" className="block text-sm font-medium text-gray-700 mb-1">
                    Indemnite forfaitaire (texte)
                  </label>
                  <input
                    id="indemnite_texte"
                    type="text"
                    value={legalForm.indemnite_recouvrement_texte}
                    onChange={(e) => setLegalForm({ ...legalForm, indemnite_recouvrement_texte: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="escompte" className="block text-sm font-medium text-gray-700 mb-1">
                    Escompte (optionnel)
                  </label>
                  <input
                    id="escompte"
                    type="text"
                    value={legalForm.escompte}
                    onChange={(e) => setLegalForm({ ...legalForm, escompte: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingLegal}
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingLegal ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Reglages documents</h2>
              <p className="text-sm text-gray-600">
                Ces valeurs sont appliquees par defaut lors de la creation des devis et factures.
              </p>
            </div>

            <form onSubmit={handleSaveDefaults} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taux_tva_defaut" className="block text-sm font-medium text-gray-700 mb-1">
                    Regime TVA par defaut
                  </label>
                  <select
                    id="taux_tva_defaut"
                    value={String(defaultsForm.taux_tva_defaut)}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        taux_tva_defaut: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {tvaOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate} %
                      </option>
                    ))}
                  </select>
                  {defaultsForm.taux_tva_defaut === 0 && (
                    <p className="mt-1 text-xs text-orange-600">
                      TVA non applicable, art. 293B du CGI
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="marge_defaut" className="block text-sm font-medium text-gray-700 mb-1">
                    Marge par defaut (%)
                  </label>
                  <input
                    id="marge_defaut"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={defaultsForm.marge_defaut}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        marge_defaut: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="tva_intracommunautaire" className="block text-sm font-medium text-gray-700 mb-1">
                    TVA intracommunautaire
                  </label>
                  <input
                    id="tva_intracommunautaire"
                    type="text"
                    value={defaultsForm.tva_intracommunautaire}
                    onChange={(e) =>
                      setDefaultsForm({
                        ...defaultsForm,
                        tva_intracommunautaire: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingDefaults}
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingDefaults ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Informations bancaires</h2>
              <p className="text-sm text-gray-600">
                Ces informations seront affichees dans les devis et factures.
              </p>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="iban" className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN
                  </label>
                  <input
                    id="iban"
                    type="text"
                    value={bankForm.iban}
                    onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="bic" className="block text-sm font-medium text-gray-700 mb-1">
                    BIC
                  </label>
                  <input
                    id="bic"
                    type="text"
                    value={bankForm.bic}
                    onChange={(e) => setBankForm({ ...bankForm, bic: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="titulaire_compte" className="block text-sm font-medium text-gray-700 mb-1">
                    Titulaire du compte
                  </label>
                  <input
                    id="titulaire_compte"
                    type="text"
                    value={bankForm.titulaire_compte}
                    onChange={(e) => setBankForm({ ...bankForm, titulaire_compte: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="banque_nom" className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de la banque
                  </label>
                  <input
                    id="banque_nom"
                    type="text"
                    value={bankForm.banque_nom}
                    onChange={(e) => setBankForm({ ...bankForm, banque_nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="domiciliation" className="block text-sm font-medium text-gray-700 mb-1">
                    Domiciliation / agence
                  </label>
                  <input
                    id="domiciliation"
                    type="text"
                    value={bankForm.domiciliation}
                    onChange={(e) => setBankForm({ ...bankForm, domiciliation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="reference_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                    Reference paiement
                  </label>
                  <input
                    id="reference_paiement"
                    type="text"
                    value={bankForm.reference_paiement}
                    onChange={(e) => setBankForm({ ...bankForm, reference_paiement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="rib" className="block text-sm font-medium text-gray-700 mb-1">
                    RIB (optionnel)
                  </label>
                  <input
                    id="rib"
                    type="text"
                    value={bankForm.rib}
                    onChange={(e) => setBankForm({ ...bankForm, rib: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modes_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                  Modes de paiement acceptes
                </label>
                <textarea
                  id="modes_paiement"
                  rows={3}
                  value={bankForm.modes_paiement_acceptes}
                  onChange={(e) => setBankForm({ ...bankForm, modes_paiement_acceptes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingBank ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



