/*
  # Amélioration du système de produits

  ## 1. Modifications de la table produits
    - Ajout du champ `type` (enum: standard, custom)
    - Ajout du champ `actif` (booléen) pour activer/désactiver
    - Ajout du champ `prix_ht_defaut` (prix par défaut)
    - Ajout du champ `taux_tva_defaut` (TVA par défaut)
    - Ajout du champ `fournisseur_defaut_id` (fournisseur par défaut)

  ## 2. Types de produits
    - `standard` : Produits intégrés (main d'œuvre, déplacement)
    - `custom` : Produits personnalisés par l'artisan

  ## 3. Fonction d'initialisation
    - `initialize_default_products()` : Crée les produits standards lors de la création d'un profil

  ## 4. Contraintes
    - Un artisan ne peut avoir qu'un seul produit "main d'œuvre" standard
    - Un artisan ne peut avoir qu'un seul produit "déplacement" standard
*/

-- Créer le type ENUM pour les types de produits
DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('standard', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Ajouter les nouvelles colonnes à la table produits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'type'
  ) THEN
    ALTER TABLE produits ADD COLUMN type product_type DEFAULT 'custom';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'actif'
  ) THEN
    ALTER TABLE produits ADD COLUMN actif boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'prix_ht_defaut'
  ) THEN
    ALTER TABLE produits ADD COLUMN prix_ht_defaut decimal(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'taux_tva_defaut'
  ) THEN
    ALTER TABLE produits ADD COLUMN taux_tva_defaut decimal(5, 2) DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'fournisseur_defaut_id'
  ) THEN
    ALTER TABLE produits ADD COLUMN fournisseur_defaut_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'code_standard'
  ) THEN
    ALTER TABLE produits ADD COLUMN code_standard text;
  END IF;
END $$;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_produits_type ON produits(type);
CREATE INDEX IF NOT EXISTS idx_produits_actif ON produits(actif);
CREATE INDEX IF NOT EXISTS idx_produits_user_actif ON produits(user_id, actif);
CREATE INDEX IF NOT EXISTS idx_produits_code_standard ON produits(code_standard);

-- Fonction pour initialiser les produits standards par défaut
CREATE OR REPLACE FUNCTION initialize_default_products(p_user_id uuid, p_taux_tva decimal)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM produits
    WHERE user_id = p_user_id AND type = 'standard' AND code_standard = 'MAIN_OEUVRE'
  ) THEN
    INSERT INTO produits (
      user_id,
      designation,
      reference,
      categorie,
      unite,
      type,
      code_standard,
      prix_ht_defaut,
      taux_tva_defaut,
      actif
    ) VALUES (
      p_user_id,
      'Main d''œuvre',
      'MO',
      'Prestation',
      'heure',
      'standard',
      'MAIN_OEUVRE',
      45.00,
      p_taux_tva,
      true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM produits
    WHERE user_id = p_user_id AND type = 'standard' AND code_standard = 'DEPLACEMENT'
  ) THEN
    INSERT INTO produits (
      user_id,
      designation,
      reference,
      categorie,
      unite,
      type,
      code_standard,
      prix_ht_defaut,
      taux_tva_defaut,
      actif
    ) VALUES (
      p_user_id,
      'Déplacement',
      'DEP',
      'Prestation',
      'forfait',
      'standard',
      'DEPLACEMENT',
      30.00,
      p_taux_tva,
      true
    );
  END IF;
END;
$$;

-- Trigger pour créer les produits standards lors de la création d'un profil
CREATE OR REPLACE FUNCTION create_default_products_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM initialize_default_products(NEW.id, COALESCE(NEW.taux_tva, 20));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_products ON profiles;
CREATE TRIGGER trigger_create_default_products
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_products_on_profile();

-- Initialiser les produits standards pour les profils existants
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, COALESCE(taux_tva, 20) as taux_tva
    FROM profiles
  LOOP
    PERFORM initialize_default_products(profile_record.id, profile_record.taux_tva);
  END LOOP;
END $$;

-- Fonction pour rechercher des produits (utilisée dans l'édition de devis)
CREATE OR REPLACE FUNCTION search_products(
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
  fournisseur_defaut_id uuid,
  fournisseur_nom text,
  actif boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    p.fournisseur_defaut_id,
    f.nom as fournisseur_nom,
    p.actif
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

-- Contrainte : un seul produit standard de chaque type par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS idx_produits_user_code_standard
  ON produits(user_id, code_standard)
  WHERE code_standard IS NOT NULL;
