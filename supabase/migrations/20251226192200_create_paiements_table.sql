/*
  # Création de la table paiements

  1. New Tables
    - `paiements` - Historique des paiements reçus pour les factures
      - `id` (uuid, primary key)
      - `facture_id` (uuid, foreign key vers factures)
      - `user_id` (uuid, foreign key vers auth.users)
      - `montant` (numeric) - Montant du paiement reçu
      - `date_paiement` (date) - Date du paiement
      - `mode_paiement` (text) - Virement, chèque, espèces, CB, etc.
      - `reference` (text) - Référence du paiement (numéro de chèque, etc.)
      - `notes` (text) - Notes optionnelles
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `paiements` table
    - Add policies for authenticated users to manage their own payments

  3. Functions
    - Auto-update facture status based on total payments received
*/

CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  montant numeric NOT NULL CHECK (montant > 0),
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  mode_paiement text DEFAULT 'Virement',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON paiements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments"
  ON paiements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
  ON paiements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payments"
  ON paiements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_facture_statut_after_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_paye numeric;
  v_total_facture numeric;
  v_nouveau_statut text;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
  FROM paiements
  WHERE facture_id = NEW.facture_id;
  
  SELECT total_ttc INTO v_total_facture
  FROM factures
  WHERE id = NEW.facture_id;
  
  IF v_total_paye >= v_total_facture THEN
    v_nouveau_statut := 'payee';
  ELSIF v_total_paye > 0 THEN
    v_nouveau_statut := 'partiellement_payee';
  ELSE
    v_nouveau_statut := 'non_payee';
  END IF;
  
  UPDATE factures
  SET statut = v_nouveau_statut,
      updated_at = now()
  WHERE id = NEW.facture_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_facture_after_paiement
AFTER INSERT OR UPDATE OR DELETE ON paiements
FOR EACH ROW
EXECUTE FUNCTION update_facture_statut_after_paiement();

CREATE INDEX IF NOT EXISTS idx_paiements_facture ON paiements(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_user ON paiements(user_id);