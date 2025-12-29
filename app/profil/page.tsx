'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import {
  isValidSiret,
  normalizePhoneInput,
  sanitizeDigits,
  validateFrenchPhone,
} from '@/lib/validation';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ProfilPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile, refetchProfile } = useProfile();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeRequested, setPhoneCodeRequested] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const [formData, setFormData] = useState({
    raison_sociale: '',
    nom: '',
    prenom: '',
    adresse: '',
    code_postal: '',
    ville: '',
    departement: '',
    pays: 'France',
    siret: '',
    tva_applicable: true,
    taux_tva: 20,
    email_contact: '',
    telephone: '',
    logo_url: '',
    iban: '',
    bic: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (profile) {
      setFormData({
        raison_sociale: profile.raison_sociale || '',
        nom: profile.nom || '',
        prenom: profile.prenom || '',
        adresse: profile.adresse || '',
        code_postal: profile.code_postal || '',
        ville: profile.ville || '',
        departement: profile.departement || '',
        pays: profile.pays || 'France',
        siret: sanitizeDigits(profile.siret || '', 14),
        tva_applicable: profile.tva_applicable ?? true,
        taux_tva: profile.taux_tva || 20,
        email_contact: profile.email_contact || '',
        telephone: profile.telephone || '',
        logo_url: profile.logo_url || '',
        iban: profile.iban || '',
        bic: profile.bic || '',
      });
    }
  }, [profile, user, authLoading, router]);

  useEffect(() => {
    if (!profile) return;
    const currentPhone = normalizePhoneInput(formData.telephone);
    const profilePhone = normalizePhoneInput(profile.telephone || '');
    if (currentPhone !== profilePhone) {
      setPhoneCodeRequested(false);
      setPhoneCode('');
      setPhoneMessage('');
      setPhoneError('');
    }
  }, [formData.telephone, profile]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const siretValue = sanitizeDigits(formData.siret, 14);
      const siretValid = siretValue.length === 14 && isValidSiret(siretValue);
      if (!siretValid) {
        toast.error('SIRET invalide.');
        setSaving(false);
        return;
      }

      const phoneMatchesProfile =
        normalizePhoneInput(formData.telephone) === normalizePhoneInput(profile?.telephone || '');
      const phoneVerified = !!profile?.telephone_verified && phoneMatchesProfile;

      const isComplete =
        !!formData.raison_sociale &&
        !!formData.nom &&
        !!formData.prenom &&
        !!formData.adresse &&
        !!formData.code_postal &&
        !!formData.ville &&
        siretValid &&
        !!formData.email_contact &&
        !!formData.telephone &&
        phoneVerified;

      await updateProfile({
        ...formData,
        profil_complete: isComplete,
      });

      toast.success('Profil enregistré avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPhoneCode = async () => {
    setPhoneMessage('');
    setPhoneError('');

    const phone = formData.telephone.trim();
    if (!phone) {
      setPhoneError('Veuillez saisir un numero de telephone.');
      return;
    }

    const phoneValidation = validateFrenchPhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError('Numero de telephone invalide.');
      return;
    }

    try {
      setSendingPhoneCode(true);
      const { error } = await supabase.functions.invoke('send-phone-verification', {
        body: { telephone: phoneValidation.normalized },
      });

      if (error) {
        throw error;
      }

      setPhoneCodeRequested(true);
      setPhoneMessage('Code envoye par email.');
      setPhoneCode('');
      await refetchProfile();
    } catch (error: any) {
      setPhoneError(error.message || 'Erreur lors de l\'envoi du code.');
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    setPhoneMessage('');
    setPhoneError('');

    const code = phoneCode.trim();
    if (!code) {
      setPhoneError('Veuillez saisir le code recu par email.');
      return;
    }

    try {
      setVerifyingPhoneCode(true);
      const { error } = await supabase.functions.invoke('verify-phone-verification', {
        body: { code },
      });

      if (error) {
        throw error;
      }

      setPhoneMessage('Numero verifie.');
      setPhoneCode('');
      setPhoneCodeRequested(false);
      await refetchProfile();
    } catch (error: any) {
      setPhoneError(error.message || 'Code invalide.');
    } finally {
      setVerifyingPhoneCode(false);
    }
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setLogoError('');

    if (!file) {
      setLogoFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl('');
      }
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const maxSizeMb = 5;

    if (!allowedTypes.includes(file.type)) {
      setLogoError('Format non supporte. Utilisez PNG, JPG, WEBP ou GIF.');
      setLogoFile(null);
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setLogoError('Taille maximale 5 Mo.');
      setLogoFile(null);
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !user) {
      setLogoError('Selectionnez une image avant de televerser.');
      return;
    }

    setLogoUploading(true);
    setLogoError('');

    try {
      const fileExt = logoFile.name.split('.').pop() || 'png';
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: logoFile.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      if (!data?.publicUrl) {
        throw new Error('Impossible de recuperer le lien du logo.');
      }

      setFormData({ ...formData, logo_url: data.publicUrl });
      setLogoFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl('');
      }
      toast.success('Logo televerse. Pensez a enregistrer le profil.');
    } catch (error: any) {
      setLogoError(error.message || 'Erreur lors du televersement.');
    } finally {
      setLogoUploading(false);
    }
  };

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

  const phoneInputNormalized = normalizePhoneInput(formData.telephone);
  const profilePhoneNormalized = normalizePhoneInput(profile?.telephone || '');
  const phoneMatchesProfile = phoneInputNormalized === profilePhoneNormalized;
  const phoneVerified = !!profile?.telephone_verified && phoneMatchesProfile;
  const phoneValidation = validateFrenchPhone(formData.telephone);
  const phoneIsValid = phoneValidation.isValid;
  const phoneValidationMessage = formData.telephone.trim() && !phoneIsValid
    ? 'Numero de telephone invalide'
    : '';
  const hasPendingCode = !!profile?.telephone_verification_expires_at &&
    new Date(profile.telephone_verification_expires_at).getTime() > Date.now();
  const codeExpired = !!profile?.telephone_verification_expires_at &&
    new Date(profile.telephone_verification_expires_at).getTime() <= Date.now();
  const showCodeInput = !phoneVerified && (hasPendingCode || phoneCodeRequested);
  const siretDigits = sanitizeDigits(formData.siret, 14);
  const siretIsComplete = siretDigits.length === 14;
  const siretIsValid = siretIsComplete && isValidSiret(siretDigits);
  const siretLengthMessage = siretIsComplete ? 'SIRET pret a valider' : 'SIRET incomplet';
  const siretLengthClass = siretIsComplete ? 'text-slate-600' : 'text-red-600';
  const siretValidityMessage = siretIsComplete
    ? (siretIsValid ? 'SIRET valide' : 'SIRET invalide')
    : '';
  const siretValidityClass = siretIsValid ? 'text-green-600' : 'text-red-600';
  const siretCounter = `${siretDigits.length} / 14 chiffres`;

  const isProfileComplete =
    !!formData.raison_sociale &&
    !!formData.nom &&
    !!formData.prenom &&
    !!formData.adresse &&
    !!formData.code_postal &&
    !!formData.ville &&
    siretIsValid &&
    !!formData.email_contact &&
    !!formData.telephone &&
    phoneVerified;

  const getFieldClassName = (value: string) => {
    const baseClasses = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
    if (!value.trim()) {
      return `${baseClasses} bg-yellow-50 border-yellow-300`;
    }
    return `${baseClasses} border-gray-300`;
  };

  const getSiretFieldClassName = () => {
    const baseClasses = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
    if (!siretDigits) {
      return `${baseClasses} bg-yellow-50 border-yellow-300`;
    }
    if (!siretIsComplete) {
      return `${baseClasses} border-red-300 bg-red-50`;
    }
    if (siretIsValid) {
      return `${baseClasses} border-green-300 bg-green-50`;
    }
    return `${baseClasses} border-red-300 bg-red-50`;
  };

  const getPhoneFieldClassName = () => {
    const baseClasses = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
    if (!phoneInputNormalized) {
      return `${baseClasses} bg-yellow-50 border-yellow-300`;
    }
    if (!phoneIsValid) {
      return `${baseClasses} border-red-300 bg-red-50`;
    }
    return `${baseClasses} border-green-300 bg-green-50`;
  };

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mon profil</h1>
          {!isProfileComplete && (
            <span className="text-sm text-orange-600 font-medium">
              Profil incomplet - Les champs en jaune sont obligatoires
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison sociale *
              </label>
              <input
                type="text"
                value={formData.raison_sociale}
                onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
                required
                className={getFieldClassName(formData.raison_sociale)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
                className={getFieldClassName(formData.nom)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                required
                className={getFieldClassName(formData.prenom)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse *
              </label>
              <AddressAutocomplete
                inputId="adresse"
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
                inputClassName={getFieldClassName(formData.adresse)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code postal *
              </label>
              <input
                type="text"
                value={formData.code_postal}
                onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                required
                className={getFieldClassName(formData.code_postal)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                required
                className={getFieldClassName(formData.ville)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departement
              </label>
              <input
                type="text"
                value={formData.departement}
                onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pays
              </label>
              <input
                type="text"
                value={formData.pays}
                onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SIRET *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={14}
                value={siretDigits}
                onChange={(e) =>
                  setFormData({ ...formData, siret: sanitizeDigits(e.target.value, 14) })
                }
                required
                className={getSiretFieldClassName()}
              />
              <div className="mt-2 space-y-1 text-xs">
                <div className={`flex items-center justify-between ${siretLengthClass}`}>
                  <span>{siretLengthMessage}</span>
                  <span>{siretCounter}</span>
                </div>
                {siretValidityMessage && (
                  <div className={`font-medium ${siretValidityClass}`}>
                    {siretValidityMessage}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email contact *
              </label>
              <input
                type="email"
                value={formData.email_contact}
                onChange={(e) => setFormData({ ...formData, email_contact: e.target.value })}
                required
                className={getFieldClassName(formData.email_contact)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: normalizePhoneInput(e.target.value) })
                }
                required
                className={getPhoneFieldClassName()}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    phoneVerified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {phoneVerified ? 'Numero verifie' : 'Numero non verifie'}
                </span>
                {!phoneVerified && (
                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={sendingPhoneCode || !phoneIsValid}
                    className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingPhoneCode
                      ? 'Envoi...'
                      : hasPendingCode
                        ? 'Renvoyer le code'
                        : 'Valider le numero'}
                  </button>
                )}
              </div>
              {codeExpired && !phoneVerified && (
                <p className="mt-2 text-sm text-orange-600">
                  Code expire. Demandez un nouveau code.
                </p>
              )}
              {showCodeInput && !phoneVerified && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Code de validation
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Code recu par email"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPhoneCode}
                      disabled={verifyingPhoneCode}
                      className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingPhoneCode ? 'Verification...' : 'Confirmer'}
                    </button>
                  </div>
                </div>
              )}
              {(phoneError || phoneValidationMessage) && (
                <p className="mt-2 text-sm text-red-600">
                  {phoneError || phoneValidationMessage}
                </p>
              )}
              {phoneMessage && (
                <p className="mt-2 text-sm text-green-600">{phoneMessage}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.tva_applicable}
                  onChange={(e) => setFormData({ ...formData, tva_applicable: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">TVA applicable</span>
              </label>
            </div>

            {formData.tva_applicable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.taux_tva}
                  onChange={(e) => setFormData({ ...formData, taux_tva: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Logo (optionnel)
              </label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleLogoFileChange}
                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <button
                    type="button"
                    onClick={handleUploadLogo}
                    disabled={logoUploading || !logoFile}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {logoUploading ? 'Televersement...' : 'Televerser le logo'}
                  </button>
                </div>
                {logoError && (
                  <p className="text-sm text-red-600">{logoError}</p>
                )}
                {(logoPreviewUrl || formData.logo_url) && (
                  <div className="flex items-center gap-3">
                    <img
                      src={logoPreviewUrl || formData.logo_url}
                      alt="Apercu du logo"
                      className="h-16 w-16 rounded-md border border-gray-200 object-contain bg-white"
                    />
                    <span className="text-sm text-gray-500">
                      Format conseille: PNG ou JPG, fond transparent si possible.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IBAN (optionnel)
              </label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BIC (optionnel)
              </label>
              <input
                type="text"
                value={formData.bic}
                onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !siretIsValid}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
