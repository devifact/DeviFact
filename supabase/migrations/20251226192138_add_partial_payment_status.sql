/*
  # Ajout du statut de paiement partiel

  1. Changes
    - Ajout du statut 'partiellement_payee' pour les factures
    - Permet de gérer les acomptes et paiements échelonnés
    
  2. Notes
    - Le statut 'partiellement_payee' est utilisé lorsqu'un acompte est versé
    - Le statut passe à 'payee' lorsque le solde est réglé
    - Cette modification n'affecte pas les factures existantes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'factures_statut_check'
  ) THEN
    ALTER TABLE factures 
    ADD CONSTRAINT factures_statut_check 
    CHECK (statut IN ('payee', 'non_payee', 'partiellement_payee', 'annulee'));
  END IF;
END $$;