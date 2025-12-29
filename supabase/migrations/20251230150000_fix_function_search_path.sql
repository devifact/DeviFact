CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_devis_numero_fr(p_user_id uuid)
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

CREATE OR REPLACE FUNCTION public.generate_facture_numero_fr(p_user_id uuid)
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

CREATE OR REPLACE FUNCTION public.generate_devis_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN generate_devis_numero_fr(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_facture_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN generate_facture_numero_fr(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_devis_totals()
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

CREATE OR REPLACE FUNCTION public.update_facture_totals()
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

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
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

CREATE OR REPLACE FUNCTION public.prevent_locked_facture_modification()
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

CREATE OR REPLACE FUNCTION public.initialize_default_products(p_user_id uuid, p_taux_tva decimal)
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

CREATE OR REPLACE FUNCTION public.create_default_products_on_profile()
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

CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT stock_actuel INTO NEW.stock_avant
  FROM produits
  WHERE id = NEW.produit_id;

  IF NEW.type_mouvement = 'entree' THEN
    NEW.stock_apres := NEW.stock_avant + NEW.quantite;
  ELSIF NEW.type_mouvement = 'sortie' THEN
    NEW.stock_apres := NEW.stock_avant - NEW.quantite;

    IF NEW.stock_apres < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour ce produit';
    END IF;
  END IF;

  UPDATE produits
  SET stock_actuel = NEW.stock_apres,
      updated_at = now()
  WHERE id = NEW.produit_id;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_stock_movements_from_facture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ligne RECORD;
  produit_record RECORD;
BEGIN
  FOR ligne IN
    SELECT lf.*, p.id as produit_id, p.gestion_stock
    FROM lignes_factures lf
    LEFT JOIN produits p ON p.designation = lf.designation AND p.user_id = NEW.user_id
    WHERE lf.facture_id = NEW.id
  LOOP
    IF ligne.produit_id IS NOT NULL AND ligne.gestion_stock = true THEN
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
$$;

CREATE OR REPLACE FUNCTION public.protect_phone_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.telephone IS DISTINCT FROM OLD.telephone THEN
      NEW.telephone_verified := false;
      NEW.telephone_verification_code := null;
      NEW.telephone_verification_expires_at := null;
      NEW.telephone_verification_sent_at := null;
      NEW.telephone_verification_attempts := 0;
      NEW.telephone_verification_resend_count := 0;
      NEW.telephone_verification_resend_window_start := null;
    ELSE
      IF NEW.telephone_verified IS DISTINCT FROM OLD.telephone_verified THEN
        RAISE EXCEPTION 'Telephone verification must be confirmed via email';
      END IF;

      IF NEW.telephone_verification_code IS DISTINCT FROM OLD.telephone_verification_code
        OR NEW.telephone_verification_expires_at IS DISTINCT FROM OLD.telephone_verification_expires_at
        OR NEW.telephone_verification_sent_at IS DISTINCT FROM OLD.telephone_verification_sent_at
        OR NEW.telephone_verification_attempts IS DISTINCT FROM OLD.telephone_verification_attempts
        OR NEW.telephone_verification_resend_count IS DISTINCT FROM OLD.telephone_verification_resend_count
        OR NEW.telephone_verification_resend_window_start IS DISTINCT FROM OLD.telephone_verification_resend_window_start
      THEN
        RAISE EXCEPTION 'Telephone verification fields are managed server-side';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
