DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'devis'
      AND column_name = 'informations_travaux'
  ) THEN
    ALTER TABLE public.devis
      ADD COLUMN informations_travaux text;
  END IF;
END $$;
