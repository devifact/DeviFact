# DevisFact - SaaS de Gestion de Devis et Factures

Application SaaS complète pour artisans français permettant la gestion professionnelle de devis et factures avec abonnement Stripe.

## Fonctionnalités

### Gestion Complète
- Gestion de clients
- Gestion de produits et fournisseurs
- Calcul automatique des marges
- Création de devis avec numérotation chronologique automatique
- Conversion automatique devis vers facture
- Génération de PDF professionnels conformes aux mentions légales françaises
- Système d'abonnement avec essai gratuit de 30 jours

### Sécurité et Conformité
- Row Level Security (RLS) sur toutes les tables
- Factures verrouillées (non modifiables après création)
- Numérotation chronologique légale (non modifiable)
- Mentions légales françaises sur les PDF
- Protection par abonnement actif

### Monétisation
- Essai gratuit de 30 jours
- Plan mensuel : 9,90€/mois
- Plan annuel : 99€/an (2 mois offerts)
- Paiements sécurisés via Stripe
- Webhooks Stripe automatiques

## Stack Technique

- **Frontend**: Next.js 13 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Paiements**: Stripe (Checkout + Webhooks)
- **PDF**: Puppeteer (génération HTML vers PDF)

## Prérequis

- Node.js 18+
- Compte Supabase (gratuit)
- Compte Stripe (mode test gratuit)

## Installation

### 1. Cloner et installer les dépendances

```bash
npm install
```

### 2. Configuration Supabase

Les variables d'environnement Supabase sont déjà configurées dans `.env`. Le projet est déjà connecté à une instance Supabase fonctionnelle.

La base de données comprend :
- Tables : `profiles`, `clients`, `produits`, `fournisseurs`, `produits_fournisseurs`, `devis`, `lignes_devis`, `factures`, `lignes_factures`, `abonnements`
- Fonctions : génération automatique de numéros, calcul des totaux, conversion devis vers facture
- Triggers : mise à jour automatique des totaux, création d'abonnement trial
- RLS : policies restrictives sur toutes les tables

### 3. Configuration Stripe

#### 3.1 Créer un compte Stripe

1. Créez un compte sur [stripe.com](https://stripe.com)
2. Activez le mode test
3. Récupérez vos clés API (Dashboard > Developers > API keys)

#### 3.2 Créer les produits Stripe

Dans le Dashboard Stripe :

1. **Plan Mensuel**
   - Products > Create product
   - Name: DevisFact Mensuel
   - Price: 9.90 EUR
   - Billing period: Monthly
   - Récupérez le Price ID (commence par `price_...`)

2. **Plan Annuel**
   - Products > Create product
   - Name: DevisFact Annuel
   - Price: 99 EUR
   - Billing period: Yearly
   - Récupérez le Price ID (commence par `price_...`)

#### 3.3 Configurer les webhooks Stripe

1. Dashboard Stripe > Developers > Webhooks
2. Add endpoint
3. URL: `https://[votre-projet].supabase.co/functions/v1/stripe-webhooks`
4. Events à sélectionner :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
5. Récupérez le Webhook Secret (commence par `whsec_...`)

#### 3.4 Variables d'environnement Stripe

Les secrets Stripe doivent être configurés dans Supabase :

```bash
# Dans le dashboard Supabase : Settings > Edge Functions > Secrets
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

Et dans votre fichier `.env.local` (pour le frontend) :

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Edge Functions déployées

Les Edge Functions suivantes sont déjà déployées et fonctionnelles :

1. **create-checkout-session** : Crée une session Stripe Checkout
2. **stripe-webhooks** : Gère les événements Stripe
3. **create-facture** : Convertit un devis accepté en facture
4. **generate-pdf** : Génère un PDF professionnel pour devis ou facture

## Utilisation

### Démarrage en développement

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

### Build de production

```bash
npm run build
npm run start
```

## Architecture de la Base de Données

### Tables principales

#### profiles
Profil artisan avec informations légales (SIRET, TVA, etc.)

#### clients
Base de clients avec coordonnées complètes

#### produits / fournisseurs / produits_fournisseurs
Système complet de gestion de produits avec :
- **Produits standards** : Main d'œuvre et Déplacement (créés automatiquement)
- **Produits personnalisés** : Bibliothèque de produits réutilisables
- Prix HT par défaut, TVA par défaut, fournisseur par défaut
- Activation/désactivation des produits
- Recherche rapide dans la bibliothèque lors de la création de devis
- Calcul automatique des marges (si fournisseurs configurés)

#### devis / lignes_devis
Devis avec numérotation chronologique automatique (DEV-2025-0001)
- Statuts : brouillon, envoyé, accepté, refusé
- Totaux calculés automatiquement

#### factures / lignes_factures
Factures créées depuis devis acceptés uniquement
- Numérotation chronologique automatique (FACT-2025-0001)
- Données figées (non modifiables)
- Statuts : émise, payée

#### abonnements
Gestion des abonnements utilisateurs
- Statuts : trial, active, canceled, expired
- Essai gratuit de 30 jours automatique
- Synchronisation avec Stripe

## Flux Métier

### 1. Inscription et Essai Gratuit

1. L'utilisateur s'inscrit
2. Un profil est créé automatiquement
3. Un abonnement trial de 30 jours est créé automatiquement
4. L'utilisateur complète son profil (obligatoire)
5. L'utilisateur peut créer des devis/factures pendant 30 jours

### 2. Gestion des Produits

1. Produits standards créés automatiquement (Main d'œuvre, Déplacement)
2. Modification des prix et paramètres des produits standards
3. Création de produits personnalisés (prestations, matériel, etc.)
4. Configuration : prix HT, TVA, unité, fournisseur, statut actif/inactif
5. Bibliothèque de produits réutilisables

### 3. Création d'un Devis

1. Vérification : profil complet + abonnement actif
2. Saisie des informations client
3. Ajout de lignes avec recherche rapide dans la bibliothèque de produits
4. Ou saisie manuelle des lignes
5. Numéro généré automatiquement (chronologique)
6. Totaux calculés automatiquement
7. PDF généré avec mentions légales

### 4. Conversion Devis vers Facture

1. Le devis doit être au statut "accepté"
2. Appel de l'Edge Function `create-facture`
3. Création de la facture avec numéro chronologique
4. Copie des lignes du devis (données figées)
5. Facture verrouillée automatiquement

### 5. Abonnement Stripe

1. Utilisateur clique sur "Souscrire" (mensuel ou annuel)
2. Redirection vers Stripe Checkout
3. Paiement effectué
4. Webhook Stripe reçu
5. Abonnement activé automatiquement
6. Accès illimité à l'application

## Système de Produits

### Produits Standards

Deux produits sont automatiquement créés lors de l'inscription :

1. **Main d'œuvre** : Prix par défaut 45€/h HT
2. **Déplacement** : Prix par défaut 30€ HT forfait

Ces produits peuvent être :
- Modifiés (prix, TVA, unité)
- Activés ou désactivés
- Utilisés directement dans les devis

### Produits Personnalisés

Les artisans peuvent créer leur propre bibliothèque de produits :
- Matériel (ex: interrupteur, câble, etc.)
- Prestations (ex: diagnostic, mise en service, etc.)
- Postes de travail (ex: forfait installation, etc.)

Chaque produit peut avoir :
- Désignation et référence
- Catégorie
- Prix HT par défaut
- TVA par défaut
- Unité (unité, m, m², heure, jour, forfait, etc.)
- Fournisseur par défaut (optionnel)
- Statut actif/inactif

### Utilisation dans les Devis

Lors de la création d'un devis, pour chaque ligne :

1. Cliquer sur "Choisir depuis la bibliothèque"
2. Rechercher le produit (par désignation, référence ou catégorie)
3. Sélectionner le produit
4. Les données sont automatiquement pré-remplies :
   - Désignation
   - Prix unitaire HT
   - Taux de TVA
   - Fournisseur (si configuré)
5. Ajuster la quantité si nécessaire
6. Les données restent figées dans le devis même si le produit est modifié ultérieurement

### Avantages

- Gain de temps considérable lors de la création de devis
- Cohérence des prix et désignations
- Aucune ressaisie nécessaire
- Mise à jour centralisée des prix

## Génération de PDF

Les PDF sont générés via l'Edge Function `generate-pdf` avec :

- Logo de l'artisan (si configuré)
- Coordonnées artisan et client
- Tableau des prestations
- Totaux HT/TVA/TTC
- Mentions légales françaises
- Filigrane "VERSION D'ESSAI" si abonnement trial
- Conditions de paiement (factures uniquement)

### Appel de l'API PDF

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdf`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'devis', // ou 'facture'
      id: devisId,
    }),
  }
);

const blob = await response.blob();
```

## Sécurité

### Row Level Security (RLS)

Toutes les tables ont RLS activé avec policies restrictives :
- SELECT : utilisateur authentifié ne voit que ses données
- INSERT : utilisateur authentifié ne peut créer que pour lui-même
- UPDATE : utilisateur authentifié ne peut modifier que ses données
- DELETE : restrictions selon les tables (factures non supprimables)

### Protection des Routes

Utiliser le composant `<SubscriptionGuard>` pour protéger les routes nécessitant un abonnement actif :

```typescript
import { SubscriptionGuard } from '@/components/subscription-guard';

export default function ProtectedPage() {
  return (
    <SubscriptionGuard>
      {/* Contenu protégé */}
    </SubscriptionGuard>
  );
}
```

## Déploiement

### Déploiement sur Vercel

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Déployez

### Configuration post-déploiement

1. Mettez à jour l'URL des webhooks Stripe avec votre domaine de production
2. Testez le flux complet : inscription → essai → abonnement
3. Vérifiez la génération de PDF
4. Testez la conversion devis vers facture

## Tests

### Tester Stripe en mode test

Utilisez les cartes de test Stripe :
- Succès : `4242 4242 4242 4242`
- Échec : `4000 0000 0000 0002`
- Date : n'importe quelle date future
- CVC : n'importe quel 3 chiffres

## Support et Documentation

- Documentation Supabase : [supabase.com/docs](https://supabase.com/docs)
- Documentation Stripe : [stripe.com/docs](https://stripe.com/docs)
- Documentation Next.js : [nextjs.org/docs](https://nextjs.org/docs)

## Licence

Ce projet est un SaaS commercial destiné à être vendu à des artisans français.

---

**DevisFact** - Solution professionnelle de gestion de devis et factures pour artisans
