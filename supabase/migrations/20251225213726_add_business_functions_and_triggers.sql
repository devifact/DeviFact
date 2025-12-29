/*
  # Ajout des fonctions métier et triggers

  ## 1. Fonctions de génération de numéros
    - `generate_devis_number()` - Génère un numéro de devis chronologique (DEV-2025-0001)
    - `generate_facture_number()` - Génère un numéro de facture chronologique (FACT-2025-0001)

  ## 2. Triggers pour calcul automatique
    - Mise à jour automatique des totaux devis quand les lignes changent
    - Mise à jour automatique des totaux factures quand les lignes changent

  ## 3. Fonction de conversion devis vers facture
    - `create_invoice_from_quote()` - Crée une facture à partir d'un devis accepté
    - Copie toutes les lignes du devis vers la facture (données figées)
    - Marque le devis comme facturé

  ## 4. Contraintes supplémentaires
    - Une facture ne peut être créée que depuis un devis accepté
    - Les factures sont verrouillées par défaut
    - Numérotation unique par utilisateur et par année
*/

-- Fonction: Générer numéro de devis chronologique
CREATE OR REPLACE FUNCTION generate_devis_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_year text;
  v_number text;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM devis
  WHERE user_id = p_user_id
  AND EXTRACT(YEAR FROM date_creation) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  v_number := 'DEV-' || v_year || '-' || LPAD(v_count::text, 4, '0');
  
  RETURN v_number;
END;
$$;

-- Fonction: Générer numéro de facture chronologique
CREATE OR REPLACE FUNCTION generate_facture_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_year text;
  v_number text;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM factures
  WHERE user_id = p_user_id
  AND EXTRACT(YEAR FROM date_emission) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  v_number := 'FACT-' || v_year || '-' || LPAD(v_count::text, 4, '0');
  
  RETURN v_number;
END;
$$;

-- Fonction: Mettre à jour les totaux du devis
CREATE OR REPLACE FUNCTION update_devis_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_ht decimal(10, 2);
  v_total_tva decimal(10, 2);
  v_total_ttc decimal(10, 2);
BEGIN
  SELECT 
    COALESCE(SUM(total_ligne_ht), 0),
    COALESCE(SUM(total_ligne_ht * taux_tva / 100), 0),
    COALESCE(SUM(total_ligne_ht * (1 + taux_tva / 100)), 0)
  INTO v_total_ht, v_total_tva, v_total_ttc
  FROM lignes_devis
  WHERE devis_id = COALESCE(NEW.devis_id, OLD.devis_id);
  
  UPDATE devis
  SET 
    total_ht = v_total_ht,
    total_tva = v_total_tva,
    total_ttc = v_total_ttc,
    updated_at = now()
  WHERE id = COALESCE(NEW.devis_id, OLD.devis_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fonction: Mettre à jour les totaux de la facture
CREATE OR REPLACE FUNCTION update_facture_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_ht decimal(10, 2);
  v_total_tva decimal(10, 2);
  v_total_ttc decimal(10, 2);
BEGIN
  SELECT 
    COALESCE(SUM(total_ligne_ht), 0),
    COALESCE(SUM(total_ligne_ht * taux_tva / 100), 0),
    COALESCE(SUM(total_ligne_ht * (1 + taux_tva / 100)), 0)
  INTO v_total_ht, v_total_tva, v_total_ttc
  FROM lignes_factures
  WHERE facture_id = COALESCE(NEW.facture_id, OLD.facture_id);
  
  UPDATE factures
  SET 
    total_ht = v_total_ht,
    total_tva = v_total_tva,
    total_ttc = v_total_ttc,
    updated_at = now()
  WHERE id = COALESCE(NEW.facture_id, OLD.facture_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fonction: Créer une facture depuis un devis accepté
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
  
  IF v_devis_record.statut != 'accepte' THEN
    RAISE EXCEPTION 'Le devis doit être accepté avant de créer une facture';
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
  
  RETURN v_facture_id;
END;
$$;

-- Fonction: Vérifier si l'utilisateur a un abonnement actif
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription record;
BEGIN
  SELECT * INTO v_subscription
  FROM abonnements
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF v_subscription.statut = 'trial' THEN
    RETURN v_subscription.date_fin_trial > now();
  END IF;
  
  IF v_subscription.statut = 'active' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Trigger: Empêcher la modification des factures verrouillées
CREATE OR REPLACE FUNCTION prevent_locked_facture_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.verrouille = true AND (
    OLD.total_ht IS DISTINCT FROM NEW.total_ht OR
    OLD.total_tva IS DISTINCT FROM NEW.total_tva OR
    OLD.total_ttc IS DISTINCT FROM NEW.total_ttc OR
    OLD.client_id IS DISTINCT FROM NEW.client_id OR
    OLD.numero IS DISTINCT FROM NEW.numero
  ) THEN
    RAISE EXCEPTION 'Les factures verrouillées ne peuvent pas être modifiées';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Triggers pour mise à jour automatique des totaux devis
DROP TRIGGER IF EXISTS trigger_update_devis_totals_insert ON lignes_devis;
CREATE TRIGGER trigger_update_devis_totals_insert
  AFTER INSERT ON lignes_devis
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_totals();

DROP TRIGGER IF EXISTS trigger_update_devis_totals_update ON lignes_devis;
CREATE TRIGGER trigger_update_devis_totals_update
  AFTER UPDATE ON lignes_devis
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_totals();

DROP TRIGGER IF EXISTS trigger_update_devis_totals_delete ON lignes_devis;
CREATE TRIGGER trigger_update_devis_totals_delete
  AFTER DELETE ON lignes_devis
  FOR EACH ROW
  EXECUTE FUNCTION update_devis_totals();

-- Triggers pour mise à jour automatique des totaux factures
DROP TRIGGER IF EXISTS trigger_update_facture_totals_insert ON lignes_factures;
CREATE TRIGGER trigger_update_facture_totals_insert
  AFTER INSERT ON lignes_factures
  FOR EACH ROW
  EXECUTE FUNCTION update_facture_totals();

DROP TRIGGER IF EXISTS trigger_update_facture_totals_update ON lignes_factures;
CREATE TRIGGER trigger_update_facture_totals_update
  AFTER UPDATE ON lignes_factures
  FOR EACH ROW
  EXECUTE FUNCTION update_facture_totals();

DROP TRIGGER IF EXISTS trigger_update_facture_totals_delete ON lignes_factures;
CREATE TRIGGER trigger_update_facture_totals_delete
  AFTER DELETE ON lignes_factures
  FOR EACH ROW
  EXECUTE FUNCTION update_facture_totals();

-- Trigger: Empêcher modification factures verrouillées
DROP TRIGGER IF EXISTS trigger_prevent_locked_facture_modification ON factures;
CREATE TRIGGER trigger_prevent_locked_facture_modification
  BEFORE UPDATE ON factures
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_facture_modification();

-- Créer un index pour améliorer les performances des requêtes de numérotation
CREATE INDEX IF NOT EXISTS idx_devis_user_year ON devis(user_id, EXTRACT(YEAR FROM date_creation));
CREATE INDEX IF NOT EXISTS idx_factures_user_year ON factures(user_id, EXTRACT(YEAR FROM date_emission));
CREATE INDEX IF NOT EXISTS idx_abonnements_user_status ON abonnements(user_id, statut);
