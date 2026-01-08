CREATE OR REPLACE FUNCTION public.create_facture_from_devis(p_devis_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_devis_record record;
  v_facture_id uuid;
  v_numero_facture text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Utilisateur non autorise';
  END IF;

  SELECT * INTO v_devis_record
  FROM devis
  WHERE id = p_devis_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis non trouve';
  END IF;

  IF EXISTS (SELECT 1 FROM factures WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Une facture existe deja pour ce devis';
  END IF;

  v_numero_facture := generate_facture_number(v_user_id);

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
    v_user_id,
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

REVOKE ALL ON FUNCTION public.create_facture_from_devis(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_facture_from_devis(uuid, uuid) TO authenticated;
