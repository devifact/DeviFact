DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_produits_user_reference_unique'
  ) THEN
    DROP INDEX idx_produits_user_reference_unique;
  END IF;
END $$;
