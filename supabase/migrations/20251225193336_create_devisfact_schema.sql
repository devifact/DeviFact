/*
  # Création du schéma complet DevisFact

  ## Tables créées
  
  1. **profiles** - Profil artisan
    - id (uuid, FK vers auth.users)
    - raison_sociale (text)
    - nom (text)
    - prenom (text)
    - adresse (text)
    - code_postal (text)
    - ville (text)
    - pays (text, défaut 'France')
    - siret (text)
    - tva_applicable (boolean, défaut true)
    - taux_tva (numeric, défaut 20)
    - email_contact (text)
    - telephone (text)
    - logo_url (text, optionnel)
    - iban (text, optionnel)
    - bic (text, optionnel)
    - profil_complete (boolean, défaut false)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  2. **clients** - Clients de l'artisan
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - nom (text)
    - societe (text, optionnel)
    - adresse (text)
    - code_postal (text)
    - ville (text)
    - email (text)
    - telephone (text)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  3. **produits** - Catalogue produits
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - designation (text)
    - reference (text, optionnel)
    - categorie (text, optionnel)
    - unite (text, défaut 'unité')
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  4. **fournisseurs** - Fournisseurs
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - nom (text)
    - contact (text, optionnel)
    - email (text, optionnel)
    - telephone (text, optionnel)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  5. **produits_fournisseurs** - Prix et marges par fournisseur
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - produit_id (uuid, FK vers produits)
    - fournisseur_id (uuid, FK vers fournisseurs)
    - prix_achat_ht (numeric)
    - prix_vente_ht (numeric)
    - marge_ht (numeric, calculé automatiquement)
    - marge_pourcentage (numeric, calculé automatiquement)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  6. **devis** - Devis
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - numero (text, unique par user)
    - client_id (uuid, FK vers clients)
    - date_creation (date)
    - date_validite (date)
    - statut (text: brouillon/envoye/accepte/refuse)
    - total_ht (numeric)
    - total_tva (numeric)
    - total_ttc (numeric)
    - notes (text, optionnel)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  7. **lignes_devis** - Lignes de devis
    - id (uuid, PK)
    - devis_id (uuid, FK vers devis)
    - designation (text, figée)
    - quantite (numeric)
    - prix_unitaire_ht (numeric)
    - taux_tva (numeric)
    - total_ligne_ht (numeric, calculé)
    - fournisseur_id (uuid, FK vers fournisseurs, optionnel)
    - ordre (integer)
    - created_at (timestamptz)
  
  8. **factures** - Factures
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users)
    - numero (text, unique par user)
    - devis_id (uuid, FK vers devis, optionnel)
    - client_id (uuid, FK vers clients)
    - date_emission (date)
    - date_echeance (date)
    - statut (text: payee/non_payee/annulee)
    - total_ht (numeric)
    - total_tva (numeric)
    - total_ttc (numeric)
    - notes (text, optionnel)
    - verrouille (boolean, défaut true)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  9. **lignes_factures** - Lignes de factures
    - id (uuid, PK)
    - facture_id (uuid, FK vers factures)
    - designation (text)
    - quantite (numeric)
    - prix_unitaire_ht (numeric)
    - taux_tva (numeric)
    - total_ligne_ht (numeric, calculé)
    - fournisseur_id (uuid, FK vers fournisseurs, optionnel)
    - ordre (integer)
    - created_at (timestamptz)
  
  10. **abonnements** - Gestion abonnements Stripe
    - id (uuid, PK)
    - user_id (uuid, FK vers auth.users, unique)
    - stripe_customer_id (text, optionnel)
    - stripe_subscription_id (text, optionnel)
    - statut (text: trial/active/canceled/expired)
    - type_abonnement (text: mensuel/annuel, optionnel)
    - date_debut_trial (timestamptz)
    - date_fin_trial (timestamptz)
    - date_debut_abonnement (timestamptz, optionnel)
    - date_fin_abonnement (timestamptz, optionnel)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  ## Sécurité
  - RLS activé sur toutes les tables
  - Politiques strictes par utilisateur
  - Cascade delete sur les relations
*/

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  raison_sociale text,
  nom text,
  prenom text,
  adresse text,
  code_postal text,
  ville text,
  pays text DEFAULT 'France',
  siret text,
  tva_applicable boolean DEFAULT true,
  taux_tva numeric DEFAULT 20,
  email_contact text,
  telephone text,
  logo_url text,
  iban text,
  bic text,
  profil_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. TABLE CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  societe text,
  adresse text NOT NULL,
  code_postal text NOT NULL,
  ville text NOT NULL,
  email text NOT NULL,
  telephone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. TABLE PRODUITS
CREATE TABLE IF NOT EXISTS produits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation text NOT NULL,
  reference text,
  categorie text,
  unite text DEFAULT 'unité',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own produits"
  ON produits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own produits"
  ON produits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own produits"
  ON produits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own produits"
  ON produits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. TABLE FOURNISSEURS
CREATE TABLE IF NOT EXISTS fournisseurs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  contact text,
  email text,
  telephone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fournisseurs"
  ON fournisseurs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fournisseurs"
  ON fournisseurs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fournisseurs"
  ON fournisseurs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fournisseurs"
  ON fournisseurs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. TABLE PRODUITS_FOURNISSEURS
CREATE TABLE IF NOT EXISTS produits_fournisseurs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  fournisseur_id uuid NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  prix_achat_ht numeric NOT NULL,
  prix_vente_ht numeric NOT NULL,
  marge_ht numeric GENERATED ALWAYS AS (prix_vente_ht - prix_achat_ht) STORED,
  marge_pourcentage numeric GENERATED ALWAYS AS (
    CASE 
      WHEN prix_achat_ht > 0 THEN ((prix_vente_ht - prix_achat_ht) / prix_achat_ht * 100)
      ELSE 0
    END
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(produit_id, fournisseur_id)
);

ALTER TABLE produits_fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own produits_fournisseurs"
  ON produits_fournisseurs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own produits_fournisseurs"
  ON produits_fournisseurs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own produits_fournisseurs"
  ON produits_fournisseurs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own produits_fournisseurs"
  ON produits_fournisseurs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. TABLE DEVIS
CREATE TABLE IF NOT EXISTS devis (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date_creation date DEFAULT CURRENT_DATE,
  date_validite date,
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse')),
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, numero)
);

ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devis"
  ON devis FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devis"
  ON devis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devis"
  ON devis FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own devis"
  ON devis FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. TABLE LIGNES_DEVIS
CREATE TABLE IF NOT EXISTS lignes_devis (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  devis_id uuid NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  designation text NOT NULL,
  quantite numeric NOT NULL,
  prix_unitaire_ht numeric NOT NULL,
  taux_tva numeric NOT NULL,
  total_ligne_ht numeric GENERATED ALWAYS AS (quantite * prix_unitaire_ht) STORED,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lignes_devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lignes_devis"
  ON lignes_devis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = lignes_devis.devis_id
      AND devis.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own lignes_devis"
  ON lignes_devis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = lignes_devis.devis_id
      AND devis.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own lignes_devis"
  ON lignes_devis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = lignes_devis.devis_id
      AND devis.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = lignes_devis.devis_id
      AND devis.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own lignes_devis"
  ON lignes_devis FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = lignes_devis.devis_id
      AND devis.user_id = auth.uid()
    )
  );

-- 8. TABLE FACTURES
CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL,
  devis_id uuid REFERENCES devis(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date_emission date DEFAULT CURRENT_DATE,
  date_echeance date,
  statut text DEFAULT 'non_payee' CHECK (statut IN ('payee', 'non_payee', 'annulee')),
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  notes text,
  verrouille boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, numero)
);

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own factures"
  ON factures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own factures"
  ON factures FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. TABLE LIGNES_FACTURES
CREATE TABLE IF NOT EXISTS lignes_factures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  facture_id uuid NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  designation text NOT NULL,
  quantite numeric NOT NULL,
  prix_unitaire_ht numeric NOT NULL,
  taux_tva numeric NOT NULL,
  total_ligne_ht numeric GENERATED ALWAYS AS (quantite * prix_unitaire_ht) STORED,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lignes_factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lignes_factures"
  ON lignes_factures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = lignes_factures.facture_id
      AND factures.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own lignes_factures"
  ON lignes_factures FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = lignes_factures.facture_id
      AND factures.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own lignes_factures"
  ON lignes_factures FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = lignes_factures.facture_id
      AND factures.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = lignes_factures.facture_id
      AND factures.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own lignes_factures"
  ON lignes_factures FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = lignes_factures.facture_id
      AND factures.user_id = auth.uid()
    )
  );

-- 10. TABLE ABONNEMENTS
CREATE TABLE IF NOT EXISTS abonnements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  statut text DEFAULT 'trial' CHECK (statut IN ('trial', 'active', 'canceled', 'expired')),
  type_abonnement text CHECK (type_abonnement IN ('mensuel', 'annuel')),
  date_debut_trial timestamptz DEFAULT now(),
  date_fin_trial timestamptz DEFAULT (now() + INTERVAL '30 days'),
  date_debut_abonnement timestamptz,
  date_fin_abonnement timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own abonnement"
  ON abonnements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own abonnement"
  ON abonnements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own abonnement"
  ON abonnements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INDEXES pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_produits_user_id ON produits(user_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_user_id ON fournisseurs(user_id);
CREATE INDEX IF NOT EXISTS idx_produits_fournisseurs_user_id ON produits_fournisseurs(user_id);
CREATE INDEX IF NOT EXISTS idx_produits_fournisseurs_produit_id ON produits_fournisseurs(produit_id);
CREATE INDEX IF NOT EXISTS idx_produits_fournisseurs_fournisseur_id ON produits_fournisseurs(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_client_id ON devis(client_id);
CREATE INDEX IF NOT EXISTS idx_lignes_devis_devis_id ON lignes_devis(devis_id);
CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id);
CREATE INDEX IF NOT EXISTS idx_factures_client_id ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON factures(devis_id);
CREATE INDEX IF NOT EXISTS idx_lignes_factures_facture_id ON lignes_factures(facture_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_user_id ON abonnements(user_id);

-- FONCTIONS TRIGGERS pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produits_updated_at BEFORE UPDATE ON produits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produits_fournisseurs_updated_at BEFORE UPDATE ON produits_fournisseurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON devis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON factures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_abonnements_updated_at BEFORE UPDATE ON abonnements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FONCTION pour créer un profil et abonnement trial automatiquement à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email_contact)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO abonnements (user_id, statut, date_debut_trial, date_fin_trial)
  VALUES (NEW.id, 'trial', now(), now() + INTERVAL '30 days');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();