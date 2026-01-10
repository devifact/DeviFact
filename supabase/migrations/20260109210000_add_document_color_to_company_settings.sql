DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'company_settings'
      AND column_name = 'couleur_documents'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN couleur_documents text DEFAULT '#2563eb';
  END IF;
END $$;

UPDATE public.company_settings
SET couleur_documents = '#2563eb'
WHERE couleur_documents IS NULL
   OR couleur_documents = '';
