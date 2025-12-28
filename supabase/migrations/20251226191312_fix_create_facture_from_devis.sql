/*
  # Correction de la fonction create_facture_from_devis

  1. Changes
    - Modification de la fonction create_facture_from_devis pour permettre la création de factures 
      à partir de devis avec n'importe quel statut (pas uniquement "accepte")
    - Cette modification permet de facturer un devis en attente ou brouillon
    - Le statut du devis sera automatiquement mis à jour à "accepte" lors de la création de la facture

  2. Notes
    - Dans la pratique, on peut vouloir créer une facture pour déclencher le paiement 
      sans attendre l'acceptation formelle du devis
    - La facture reste liée au devis via devis_id pour traçabilité
*/

CREATE OR REPLACE FUNCTION create_facture_from_devis(p_devis_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_devis_record record;
  v_facture_id uuid;
  v_numero_facture text;
BEGIN
  SELECT * INTO v_devis_record
  FROM devis
  WHERE id = p_devis_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis non trouvé';
  END IF;
  
  IF EXISTS (SELECT 1 FROM factures WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Une facture existe déjà pour ce devis';
  END IF;
  
  v_numero_facture := generate_facture_number(p_user_id);
  
  INSERT INTO factures (
    user_id,
    numero,
    devis_id,
    client_id,
    date_emission,
    date_echeance,
    statut,
    total_ht,
    total_tva,
    total_ttc,
    notes,
    verrouille
  )
  VALUES (
    p_user_id,
    v_numero_facture,
    p_devis_id,
    v_devis_record.client_id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'non_payee',
    v_devis_record.total_ht,
    v_devis_record.total_tva,
    v_devis_record.total_ttc,
    v_devis_record.notes,
    true
  )
  RETURNING id INTO v_facture_id;
  
  INSERT INTO lignes_factures (
    facture_id,
    designation,
    quantite,
    prix_unitaire_ht,
    taux_tva,
    fournisseur_id,
    ordre
  )
  SELECT
    v_facture_id,
    designation,
    quantite,
    prix_unitaire_ht,
    taux_tva,
    fournisseur_id,
    ordre
  FROM lignes_devis
  WHERE devis_id = p_devis_id
  ORDER BY ordre;
  
  UPDATE devis
  SET statut = 'accepte'
  WHERE id = p_devis_id;
  
  RETURN v_facture_id;
END;
$$;