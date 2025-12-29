/*
  # Système de numérotation conforme aux normes françaises

  1. New Tables
    - `facture_counters` - Compteurs pour la numérotation des factures
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key vers auth.users)
      - `annee` (integer) - Année du compteur
      - `dernier_numero` (integer) - Dernier numéro utilisé pour cette année
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Contrainte unique sur (user_id, annee)

  2. Functions
    - `generate_facture_numero_fr` - Génère un numéro de facture conforme (FA-YYYY-NNNN)
    - Format : FA-2024-0001, FA-2024-0002, etc.
    - Séquentiel par année et par utilisateur
    - Pas de trous dans la numérotation

  3. Changes
    - Ajout de colonnes pour les mentions légales obligatoires
    - `conditions_reglement` (text) - Conditions de règlement
    - `penalites_retard` (text) - Taux de pénalités de retard
    - `escompte` (text) - Conditions d'escompte si paiement anticipé

  4. Security
    - Enable RLS on facture_counters
    - Policies pour les utilisateurs authentifiés
*/

-- Table des compteurs de factures
CREATE TABLE IF NOT EXISTS facture_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee integer NOT NULL,
  dernier_numero integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, annee)
);

ALTER TABLE facture_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own counters"
  ON facture_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own counters"
  ON facture_counters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counters"
  ON facture_counters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fonction pour générer un numéro de facture conforme aux normes françaises
CREATE OR REPLACE FUNCTION generate_facture_numero_fr(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee integer;
  v_numero integer;
  v_numero_facture text;
BEGIN
  v_annee := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO facture_counters (user_id, annee, dernier_numero)
  VALUES (p_user_id, v_annee, 1)
  ON CONFLICT (user_id, annee) 
  DO UPDATE SET 
    dernier_numero = facture_counters.dernier_numero + 1,
    updated_at = now()
  RETURNING dernier_numero INTO v_numero;
  
  v_numero_facture := 'FA-' || v_annee || '-' || LPAD(v_numero::text, 4, '0');
  
  RETURN v_numero_facture;
END;
$$;

-- Ajout des colonnes pour les mentions légales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'conditions_reglement'
  ) THEN
    ALTER TABLE factures ADD COLUMN conditions_reglement text DEFAULT 'Paiement à 30 jours';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'penalites_retard'
  ) THEN
    ALTER TABLE factures ADD COLUMN penalites_retard text DEFAULT 'Taux BCE + 10 points';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'escompte'
  ) THEN
    ALTER TABLE factures ADD COLUMN escompte text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'factures' AND column_name = 'indemnite_recouvrement'
  ) THEN
    ALTER TABLE factures ADD COLUMN indemnite_recouvrement numeric DEFAULT 40.00;
  END IF;
END $$;

-- Même système pour les devis
CREATE TABLE IF NOT EXISTS devis_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee integer NOT NULL,
  dernier_numero integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, annee)
);

ALTER TABLE devis_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devis counters"
  ON devis_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devis counters"
  ON devis_counters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devis counters"
  ON devis_counters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fonction pour générer un numéro de devis conforme
CREATE OR REPLACE FUNCTION generate_devis_numero_fr(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_annee integer;
  v_numero integer;
  v_numero_devis text;
BEGIN
  v_annee := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO devis_counters (user_id, annee, dernier_numero)
  VALUES (p_user_id, v_annee, 1)
  ON CONFLICT (user_id, annee) 
  DO UPDATE SET 
    dernier_numero = devis_counters.dernier_numero + 1,
    updated_at = now()
  RETURNING dernier_numero INTO v_numero;
  
  v_numero_devis := 'DEV-' || v_annee || '-' || LPAD(v_numero::text, 4, '0');
  
  RETURN v_numero_devis;
END;
$$;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_facture_counters_user_annee ON facture_counters(user_id, annee);
CREATE INDEX IF NOT EXISTS idx_devis_counters_user_annee ON devis_counters(user_id, annee);
