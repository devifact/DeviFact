export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          raison_sociale: string | null
          nom: string | null
          prenom: string | null
          adresse: string | null
          code_postal: string | null
          ville: string | null
          departement: string | null
          pays: string | null
          siret: string | null
          tva_applicable: boolean | null
          taux_tva: number | null
          email_contact: string | null
          telephone: string | null
          telephone_verified: boolean | null
          telephone_verification_code: string | null
          telephone_verification_expires_at: string | null
          telephone_verification_sent_at: string | null
          telephone_verification_attempts: number | null
          telephone_verification_resend_count: number | null
          telephone_verification_resend_window_start: string | null
          logo_url: string | null
          iban: string | null
          bic: string | null
          profil_complete: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          raison_sociale?: string | null
          nom?: string | null
          prenom?: string | null
          adresse?: string | null
          code_postal?: string | null
          ville?: string | null
          departement?: string | null
          pays?: string | null
          siret?: string | null
          tva_applicable?: boolean | null
          taux_tva?: number | null
          email_contact?: string | null
          telephone?: string | null
          telephone_verified?: boolean | null
          telephone_verification_code?: string | null
          telephone_verification_expires_at?: string | null
          telephone_verification_sent_at?: string | null
          telephone_verification_attempts?: number | null
          telephone_verification_resend_count?: number | null
          telephone_verification_resend_window_start?: string | null
          logo_url?: string | null
          iban?: string | null
          bic?: string | null
          profil_complete?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          raison_sociale?: string | null
          nom?: string | null
          prenom?: string | null
          adresse?: string | null
          code_postal?: string | null
          ville?: string | null
          departement?: string | null
          pays?: string | null
          siret?: string | null
          tva_applicable?: boolean | null
          taux_tva?: number | null
          email_contact?: string | null
          telephone?: string | null
          telephone_verified?: boolean | null
          telephone_verification_code?: string | null
          telephone_verification_expires_at?: string | null
          telephone_verification_sent_at?: string | null
          telephone_verification_attempts?: number | null
          telephone_verification_resend_count?: number | null
          telephone_verification_resend_window_start?: string | null
          logo_url?: string | null
          iban?: string | null
          bic?: string | null
          profil_complete?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          user_id: string
          nom: string
          societe: string | null
          adresse: string
          code_postal: string
          ville: string
          departement: string | null
          adresse_intervention: string | null
          code_postal_intervention: string | null
          ville_intervention: string | null
          departement_intervention: string | null
          email: string
          telephone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nom: string
          societe?: string | null
          adresse: string
          code_postal: string
          ville: string
          departement?: string | null
          adresse_intervention?: string | null
          code_postal_intervention?: string | null
          ville_intervention?: string | null
          departement_intervention?: string | null
          email: string
          telephone: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nom?: string
          societe?: string | null
          adresse?: string
          code_postal?: string
          ville?: string
          departement?: string | null
          adresse_intervention?: string | null
          code_postal_intervention?: string | null
          ville_intervention?: string | null
          departement_intervention?: string | null
          email?: string
          telephone?: string
          created_at?: string
          updated_at?: string
        }
      }
      produits: {
        Row: {
          id: string
          user_id: string
          designation: string
          reference: string | null
          categorie: string | null
          unite: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          designation: string
          reference?: string | null
          categorie?: string | null
          unite?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          designation?: string
          reference?: string | null
          categorie?: string | null
          unite?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      fournisseurs: {
        Row: {
          id: string
          user_id: string
          nom: string
          contact: string | null
          email: string | null
          telephone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          nom: string
          contact?: string | null
          email?: string | null
          telephone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nom?: string
          contact?: string | null
          email?: string | null
          telephone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      produits_fournisseurs: {
        Row: {
          id: string
          user_id: string
          produit_id: string
          fournisseur_id: string
          prix_achat_ht: number
          prix_vente_ht: number
          marge_ht: number
          marge_pourcentage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          produit_id: string
          fournisseur_id: string
          prix_achat_ht: number
          prix_vente_ht: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          produit_id?: string
          fournisseur_id?: string
          prix_achat_ht?: number
          prix_vente_ht?: number
          created_at?: string
          updated_at?: string
        }
      }
      devis: {
        Row: {
          id: string
          user_id: string
          numero: string
          client_id: string
          date_creation: string
          date_validite: string | null
          statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse'
          total_ht: number
          total_tva: number
          total_ttc: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          numero: string
          client_id: string
          date_creation?: string
          date_validite?: string | null
          statut?: 'brouillon' | 'envoye' | 'accepte' | 'refuse'
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          numero?: string
          client_id?: string
          date_creation?: string
          date_validite?: string | null
          statut?: 'brouillon' | 'envoye' | 'accepte' | 'refuse'
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lignes_devis: {
        Row: {
          id: string
          devis_id: string
          designation: string
          quantite: number
          prix_unitaire_ht: number
          taux_tva: number
          total_ligne_ht: number
          fournisseur_id: string | null
          ordre: number
          created_at: string
        }
        Insert: {
          id?: string
          devis_id: string
          designation: string
          quantite: number
          prix_unitaire_ht: number
          taux_tva: number
          fournisseur_id?: string | null
          ordre?: number
          created_at?: string
        }
        Update: {
          id?: string
          devis_id?: string
          designation?: string
          quantite?: number
          prix_unitaire_ht?: number
          taux_tva?: number
          fournisseur_id?: string | null
          ordre?: number
          created_at?: string
        }
      }
      factures: {
        Row: {
          id: string
          user_id: string
          numero: string
          devis_id: string | null
          client_id: string
          date_emission: string
          date_echeance: string | null
          statut: 'payee' | 'non_payee' | 'annulee'
          total_ht: number
          total_tva: number
          total_ttc: number
          notes: string | null
          verrouille: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          numero: string
          devis_id?: string | null
          client_id: string
          date_emission?: string
          date_echeance?: string | null
          statut?: 'payee' | 'non_payee' | 'annulee'
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          verrouille?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          numero?: string
          devis_id?: string | null
          client_id?: string
          date_emission?: string
          date_echeance?: string | null
          statut?: 'payee' | 'non_payee' | 'annulee'
          total_ht?: number
          total_tva?: number
          total_ttc?: number
          notes?: string | null
          verrouille?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lignes_factures: {
        Row: {
          id: string
          facture_id: string
          designation: string
          quantite: number
          prix_unitaire_ht: number
          taux_tva: number
          total_ligne_ht: number
          fournisseur_id: string | null
          ordre: number
          created_at: string
        }
        Insert: {
          id?: string
          facture_id: string
          designation: string
          quantite: number
          prix_unitaire_ht: number
          taux_tva: number
          fournisseur_id?: string | null
          ordre?: number
          created_at?: string
        }
        Update: {
          id?: string
          facture_id?: string
          designation?: string
          quantite?: number
          prix_unitaire_ht?: number
          taux_tva?: number
          fournisseur_id?: string | null
          ordre?: number
          created_at?: string
        }
      }
      abonnements: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          statut: 'trial' | 'active' | 'canceled' | 'expired'
          type_abonnement: 'mensuel' | 'annuel' | null
          date_debut_trial: string
          date_fin_trial: string
          date_debut_abonnement: string | null
          date_fin_abonnement: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          statut?: 'trial' | 'active' | 'canceled' | 'expired'
          type_abonnement?: 'mensuel' | 'annuel' | null
          date_debut_trial?: string
          date_fin_trial?: string
          date_debut_abonnement?: string | null
          date_fin_abonnement?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          statut?: 'trial' | 'active' | 'canceled' | 'expired'
          type_abonnement?: 'mensuel' | 'annuel' | null
          date_debut_trial?: string
          date_fin_trial?: string
          date_debut_abonnement?: string | null
          date_fin_abonnement?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
