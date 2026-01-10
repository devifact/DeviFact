-- Create company settings table for invoice mandatory mentions and banking information
CREATE TABLE IF NOT EXISTS public.company_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  conditions_reglement text DEFAULT 'Paiement a 30 jours',
  delai_paiement text DEFAULT 'Paiement a 30 jours',
  penalites_retard text DEFAULT 'Taux BCE + 10 points',
  indemnite_recouvrement_montant numeric DEFAULT 40,
  indemnite_recouvrement_texte text DEFAULT 'EUR (article L441-6 du Code de commerce)',
  escompte text,
  titulaire_compte text,
  banque_nom text,
  domiciliation text,
  modes_paiement_acceptes text,
  reference_paiement text,
  rib text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company settings"
  ON public.company_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company settings"
  ON public.company_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
