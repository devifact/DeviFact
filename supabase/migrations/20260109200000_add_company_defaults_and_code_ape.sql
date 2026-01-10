DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'taux_tva_defaut'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN taux_tva_defaut numeric DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'marge_defaut'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN marge_defaut numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'tva_intracommunautaire'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN tva_intracommunautaire text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'code_ape'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN code_ape text;
  END IF;
END $$;

UPDATE public.company_settings
SET taux_tva_defaut = COALESCE(taux_tva_defaut, 20),
    marge_defaut = COALESCE(marge_defaut, 0)
WHERE taux_tva_defaut IS NULL
   OR marge_defaut IS NULL;
