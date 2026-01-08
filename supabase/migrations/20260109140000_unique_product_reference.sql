DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_produits_user_reference_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_produits_user_reference_unique
      ON produits (user_id, lower(trim(reference)))
      WHERE reference IS NOT NULL AND btrim(reference) <> '';
  END IF;
END $$;
