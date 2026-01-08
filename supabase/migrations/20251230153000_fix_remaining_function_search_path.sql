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
  fournisseur_defaut_id uuid,
  fournisseur_nom text,
  actif boolean
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

CREATE OR REPLACE FUNCTION public.create_facture_from_devis(p_devis_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    RAISE EXCEPTION 'Devis non trouve';
  END IF;
  
  IF EXISTS (SELECT 1 FROM factures WHERE devis_id = p_devis_id) THEN
    RAISE EXCEPTION 'Une facture existe deja pour ce devis';
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

CREATE OR REPLACE FUNCTION public.update_facture_statut_after_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
