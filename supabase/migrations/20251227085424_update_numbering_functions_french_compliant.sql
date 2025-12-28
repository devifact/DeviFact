/*
  # Mise à jour des fonctions de numérotation pour conformité française

  1. Changes
    - Remplace les fonctions generate_devis_number et generate_facture_number
    - Utilise maintenant les compteurs dédiés pour garantir la séquentialité
    - Assure une numérotation sans trous conforme à la législation française
    - Format factures : FA-YYYY-NNNN (au lieu de FACT-YYYY-NNNN)
    - Format devis : DEV-YYYY-NNNN (inchangé)

  2. Notes
    - Les anciennes fonctions sont remplacées pour utiliser le système de compteurs
    - Garantit la conformité avec l'article 242 nonies A de l'annexe II du CGI
    - La numérotation est séquentielle et unique par utilisateur et par année
*/

-- Remplace la fonction de génération de numéros de devis
CREATE OR REPLACE FUNCTION generate_devis_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN generate_devis_numero_fr(p_user_id);
END;
$$;

-- Remplace la fonction de génération de numéros de facture
CREATE OR REPLACE FUNCTION generate_facture_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN generate_facture_numero_fr(p_user_id);
END;
$$;