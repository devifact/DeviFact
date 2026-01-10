DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'forme_juridique'
  ) THEN
    ALTER TABLE public.company_settings DROP COLUMN forme_juridique;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'capital_social'
  ) THEN
    ALTER TABLE public.company_settings DROP COLUMN capital_social;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'rcs_rm'
  ) THEN
    ALTER TABLE public.company_settings DROP COLUMN rcs_rm;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'tva_intracommunautaire'
  ) THEN
    ALTER TABLE public.company_settings DROP COLUMN tva_intracommunautaire;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'mentions_complementaires'
  ) THEN
    ALTER TABLE public.company_settings DROP COLUMN mentions_complementaires;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'conditions_reglement'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN conditions_reglement text DEFAULT 'Paiement a 30 jours';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'delai_paiement'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN delai_paiement text DEFAULT 'Paiement a 30 jours';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'penalites_retard'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN penalites_retard text DEFAULT 'Taux BCE + 10 points';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'indemnite_recouvrement_montant'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN indemnite_recouvrement_montant numeric DEFAULT 40;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'indemnite_recouvrement_texte'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN indemnite_recouvrement_texte text DEFAULT 'EUR (article L441-6 du Code de commerce)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'escompte'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN escompte text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'titulaire_compte'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN titulaire_compte text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'banque_nom'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN banque_nom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'domiciliation'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN domiciliation text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'modes_paiement_acceptes'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN modes_paiement_acceptes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'reference_paiement'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN reference_paiement text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'rib'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN rib text;
  END IF;
END $$;

UPDATE public.company_settings
SET conditions_reglement = COALESCE(conditions_reglement, 'Paiement a 30 jours'),
    delai_paiement = COALESCE(delai_paiement, 'Paiement a 30 jours'),
    penalites_retard = COALESCE(penalites_retard, 'Taux BCE + 10 points'),
    indemnite_recouvrement_montant = COALESCE(indemnite_recouvrement_montant, 40),
    indemnite_recouvrement_texte = COALESCE(indemnite_recouvrement_texte, 'EUR (article L441-6 du Code de commerce)')
WHERE conditions_reglement IS NULL
   OR delai_paiement IS NULL
   OR penalites_retard IS NULL
   OR indemnite_recouvrement_montant IS NULL
   OR indemnite_recouvrement_texte IS NULL;
