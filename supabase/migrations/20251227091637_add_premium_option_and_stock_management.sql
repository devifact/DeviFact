/*
  # Ajout de l'option premium et gestion des stocks

  ## Modifications apportées

  ### 1. Table abonnements - Ajout option premium
    - `option_premium_active` (boolean) - Indique si l'option premium est active
    - `stripe_premium_subscription_id` (text) - ID de la souscription premium Stripe
    - `type_premium` (text) - Type d'abonnement premium (mensuel/annuel)
    - `date_debut_premium` (timestamptz) - Date de début de l'option premium
    - `date_fin_premium` (timestamptz) - Date de fin de l'option premium

  ### 2. Nouvelle table: mouvements_stock
    - `id` (uuid, PK) - Identifiant unique
    - `user_id` (uuid, FK) - Référence vers auth.users
    - `produit_id` (uuid, FK) - Référence vers produits
    - `type_mouvement` (text) - Type: 'entree' ou 'sortie'
    - `quantite` (numeric) - Quantité du mouvement
    - `stock_avant` (numeric) - Stock avant le mouvement
    - `stock_apres` (numeric) - Stock après le mouvement
    - `fournisseur_id` (uuid, FK, nullable) - Fournisseur (pour entrées)
    - `facture_id` (uuid, FK, nullable) - Facture (pour sorties)
    - `prix_unitaire` (numeric, nullable) - Prix unitaire d'achat/vente
    - `reference_document` (text, nullable) - Référence du document d'origine
    - `notes` (text, nullable) - Notes complémentaires
    - `created_at` (timestamptz) - Date de création
    - `created_by` (uuid, FK) - Utilisateur créateur

  ### 3. Ajout de colonnes dans produits
    - `stock_actuel` (numeric) - Stock actuel du produit
    - `stock_minimum` (numeric) - Seuil d'alerte stock faible
    - `gestion_stock` (boolean) - Active la gestion du stock pour ce produit

  ## Sécurité
    - RLS activé sur mouvements_stock
    - Politiques restrictives par utilisateur
    - Contraintes de validation sur les types de mouvements
*/

-- Ajout des colonnes pour l'option premium dans abonnements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'option_premium_active'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN option_premium_active boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'stripe_premium_subscription_id'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN stripe_premium_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'type_premium'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN type_premium text CHECK (type_premium IN ('mensuel', 'annuel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'date_debut_premium'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN date_debut_premium timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'date_fin_premium'
  ) THEN
    ALTER TABLE abonnements ADD COLUMN date_fin_premium timestamptz;
  END IF;
END $$;

-- Ajout des colonnes de gestion de stock dans produits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'stock_actuel'
  ) THEN
    ALTER TABLE produits ADD COLUMN stock_actuel numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'stock_minimum'
  ) THEN
    ALTER TABLE produits ADD COLUMN stock_minimum numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'gestion_stock'
  ) THEN
    ALTER TABLE produits ADD COLUMN gestion_stock boolean DEFAULT false;
  END IF;
END $$;

-- Création de la table mouvements_stock
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  type_mouvement text NOT NULL CHECK (type_mouvement IN ('entree', 'sortie')),
  quantite numeric NOT NULL CHECK (quantite > 0),
  stock_avant numeric NOT NULL DEFAULT 0,
  stock_apres numeric NOT NULL DEFAULT 0,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  prix_unitaire numeric,
  reference_document text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_user_id ON mouvements_stock(user_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit_id ON mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_created_at ON mouvements_stock(created_at);

-- Activation de RLS sur mouvements_stock
ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour mouvements_stock
CREATE POLICY "Users can view own stock movements"
  ON mouvements_stock FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock movements"
  ON mouvements_stock FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock movements"
  ON mouvements_stock FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock movements"
  ON mouvements_stock FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour automatiquement le stock d'un produit
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Récupérer le stock actuel du produit
  SELECT stock_actuel INTO NEW.stock_avant
  FROM produits
  WHERE id = NEW.produit_id;

  -- Calculer le nouveau stock
  IF NEW.type_mouvement = 'entree' THEN
    NEW.stock_apres := NEW.stock_avant + NEW.quantite;
  ELSIF NEW.type_mouvement = 'sortie' THEN
    NEW.stock_apres := NEW.stock_avant - NEW.quantite;
    
    -- Vérifier que le stock ne devient pas négatif
    IF NEW.stock_apres < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour ce produit';
    END IF;
  END IF;

  -- Mettre à jour le stock du produit
  UPDATE produits
  SET stock_actuel = NEW.stock_apres,
      updated_at = now()
  WHERE id = NEW.produit_id;

  -- Définir created_by si non défini
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour le stock automatiquement
DROP TRIGGER IF EXISTS trigger_update_product_stock ON mouvements_stock;
CREATE TRIGGER trigger_update_product_stock
  BEFORE INSERT ON mouvements_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- Fonction pour créer automatiquement des sorties de stock lors de la création d'une facture
CREATE OR REPLACE FUNCTION create_stock_movements_from_facture()
RETURNS TRIGGER AS $$
DECLARE
  ligne RECORD;
  produit_record RECORD;
BEGIN
  -- Parcourir toutes les lignes de la facture
  FOR ligne IN 
    SELECT lf.*, p.id as produit_id, p.gestion_stock
    FROM lignes_factures lf
    LEFT JOIN produits p ON p.designation = lf.designation AND p.user_id = NEW.user_id
    WHERE lf.facture_id = NEW.id
  LOOP
    -- Vérifier si le produit existe et si la gestion de stock est activée
    IF ligne.produit_id IS NOT NULL AND ligne.gestion_stock = true THEN
      -- Créer une sortie de stock
      INSERT INTO mouvements_stock (
        user_id,
        produit_id,
        type_mouvement,
        quantite,
        facture_id,
        prix_unitaire,
        reference_document,
        notes,
        created_by
      ) VALUES (
        NEW.user_id,
        ligne.produit_id,
        'sortie',
        ligne.quantite,
        NEW.id,
        ligne.prix_unitaire_ht,
        NEW.numero,
        'Sortie automatique depuis facture ' || NEW.numero,
        auth.uid()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer les mouvements de stock depuis les factures
DROP TRIGGER IF EXISTS trigger_create_stock_from_facture ON factures;
CREATE TRIGGER trigger_create_stock_from_facture
  AFTER INSERT ON factures
  FOR EACH ROW
  WHEN (NEW.verrouille = true)
  EXECUTE FUNCTION create_stock_movements_from_facture();