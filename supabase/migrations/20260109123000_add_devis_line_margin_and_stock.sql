DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'marge_defaut'
  ) THEN
    ALTER TABLE profiles ADD COLUMN marge_defaut numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'produits'
      AND column_name = 'marge_defaut'
  ) THEN
    ALTER TABLE produits ADD COLUMN marge_defaut numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lignes_devis'
      AND column_name = 'reference'
  ) THEN
    ALTER TABLE lignes_devis ADD COLUMN reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lignes_devis'
      AND column_name = 'unite'
  ) THEN
    ALTER TABLE lignes_devis ADD COLUMN unite text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lignes_devis'
      AND column_name = 'marge_pourcentage'
  ) THEN
    ALTER TABLE lignes_devis ADD COLUMN marge_pourcentage numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lignes_devis'
      AND column_name = 'produit_id'
  ) THEN
    ALTER TABLE lignes_devis
      ADD COLUMN produit_id uuid REFERENCES produits(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.search_products(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.search_products(
  p_user_id uuid,
  p_search_term text DEFAULT '',
  p_active_only boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  designation text,
  reference text,
  categorie text,
  unite text,
  type product_type,
  prix_ht_defaut decimal,
  taux_tva_defaut decimal,
  marge_defaut decimal,
  fournisseur_defaut_id uuid,
  fournisseur_nom text,
  actif boolean,
  stock_actuel numeric,
  stock_minimum numeric,
  gestion_stock boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.designation,
    p.reference,
    p.categorie,
    p.unite,
    p.type,
    p.prix_ht_defaut,
    p.taux_tva_defaut,
    p.marge_defaut,
    p.fournisseur_defaut_id,
    f.nom as fournisseur_nom,
    p.actif,
    p.stock_actuel,
    p.stock_minimum,
    p.gestion_stock
  FROM produits p
  LEFT JOIN fournisseurs f ON f.id = p.fournisseur_defaut_id
  WHERE p.user_id = p_user_id
    AND (NOT p_active_only OR p.actif = true)
    AND (
      p_search_term = ''
      OR p.designation ILIKE '%' || p_search_term || '%'
      OR p.reference ILIKE '%' || p_search_term || '%'
      OR p.categorie ILIKE '%' || p_search_term || '%'
    )
  ORDER BY
    CASE WHEN p.type = 'standard' THEN 0 ELSE 1 END,
    p.designation;
END;
$$;
