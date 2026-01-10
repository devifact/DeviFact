import type { Database } from '@/lib/database.types.ts';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];

export const buildDocumentFooter = (
  profile?: Profile | null,
  settings?: CompanySettings | null
) => {
  if (!profile) return '';

  const addressParts = [
    profile.adresse,
    [profile.code_postal, profile.ville].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);

  const parts = [
    profile.raison_sociale,
    addressParts.length ? `Adresse siege: ${addressParts.join(', ')}` : '',
    profile.telephone ? `Tel: ${profile.telephone}` : '',
    profile.email_contact ? `Email: ${profile.email_contact}` : '',
    profile.siret ? `SIRET: ${profile.siret}` : '',
    settings?.tva_intracommunautaire
      ? `TVA intracommunautaire: ${settings.tva_intracommunautaire}`
      : '',
    profile.code_ape ? `Code APE: ${profile.code_ape}` : '',
  ].filter(Boolean);

  return parts.join(' | ');
};
