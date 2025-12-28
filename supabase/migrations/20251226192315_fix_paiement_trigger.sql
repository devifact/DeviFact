/*
  # Correction du trigger de mise à jour du statut de facture

  1. Changes
    - Correction de la fonction trigger pour gérer correctement les DELETE
    - Le trigger doit utiliser OLD.facture_id lors des suppressions
    
  2. Notes
    - Cette correction assure que le statut de la facture est correctement mis à jour
      même lors de la suppression de paiements
*/

CREATE OR REPLACE FUNCTION update_facture_statut_after_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_paye numeric;
  v_total_facture numeric;
  v_nouveau_statut text;
  v_facture_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_facture_id := OLD.facture_id;
  ELSE
    v_facture_id := NEW.facture_id;
  END IF;
  
  SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
  FROM paiements
  WHERE facture_id = v_facture_id;
  
  SELECT total_ttc INTO v_total_facture
  FROM factures
  WHERE id = v_facture_id;
  
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
  WHERE id = v_facture_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;