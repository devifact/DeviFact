# Configuration de l'Option Premium DevisFact

## Prérequis

Votre abonnement Stripe de base doit déjà être configuré et fonctionnel.

## Étapes de Configuration

### 1. Créer les Prix Premium dans Stripe

Connectez-vous à votre [Dashboard Stripe](https://dashboard.stripe.com) et créez deux nouveaux prix **récurrents** :

#### Prix Mensuel Premium
- Produit : "Option Premium DevisFact" (créez-le si nécessaire)
- Prix : **14,90 €**
- Type : **Récurrent**
- Fréquence : **Mensuel**
- Notez l'ID du prix (commence par `price_...`)

#### Prix Annuel Premium
- Produit : "Option Premium DevisFact" (même produit)
- Prix : **149 €**
- Type : **Récurrent**
- Fréquence : **Annuel**
- Notez l'ID du prix (commence par `price_...`)

### 2. Configurer les Variables d'Environnement

Dans votre projet Supabase, ajoutez ces variables d'environnement pour vos Edge Functions :

```bash
STRIPE_PREMIUM_PRICE_MONTHLY=price_xxxxxxxxxxxxx  # Votre ID de prix mensuel
STRIPE_PREMIUM_PRICE_ANNUAL=price_xxxxxxxxxxxxx   # Votre ID de prix annuel
```

**Comment les ajouter :**
1. Allez dans votre projet Supabase
2. Paramètres → Edge Functions
3. Ajoutez les variables d'environnement

### 3. Mettre à Jour les Webhooks Stripe

Les webhooks Stripe existants gèrent déjà les événements premium. Assurez-vous simplement que votre webhook écoute ces événements :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

### 4. Tester l'Option Premium

1. **Connectez-vous** à votre application
2. **Assurez-vous** que votre abonnement principal est actif (pas en période d'essai)
3. Allez dans **"Abonnement"**
4. Vous devriez voir la section "Option Premium"
5. Cliquez sur **"Souscrire"** pour l'abonnement mensuel ou annuel
6. Complétez le paiement de test Stripe

### 5. Vérifier l'Accès Premium

Une fois l'abonnement premium actif :

- ✅ Badge "Premium Actif" visible sur le dashboard
- ✅ Liens "Comptabilité" et "Gestion des stocks" dans le menu latéral
- ✅ Accès aux pages `/comptabilite` et `/stocks`

## Règles d'Accès Premium

### ❌ Accès REFUSÉ si :
- Utilisateur en période d'essai
- Abonnement principal non actif
- Option premium non souscrite

### ✅ Accès AUTORISÉ si :
- Abonnement principal = **actif**
- Option premium = **active**
- Paiement premium = **à jour**

## Fonctionnalités Premium

### Page Comptabilité (`/comptabilite`)
- Calcul automatique du total encaissé
- Calcul automatique du total à encaisser
- Taux d'encaissement
- Filtres par période (mois, trimestre, année, personnalisée)
- Liste détaillée des factures

### Page Gestion des Stocks (`/stocks`)
- Création d'entrées de stock (avec fournisseur)
- Création de sorties de stock
- Sorties automatiques lors de l'émission de factures
- Alertes de stock faible
- Historique complet des mouvements
- Suivi du stock actuel par produit

## Dépannage

### "Les prix premium Stripe ne sont pas configurés"
→ Vérifiez que vous avez bien ajouté `STRIPE_PREMIUM_PRICE_MONTHLY` et `STRIPE_PREMIUM_PRICE_ANNUAL` aux variables d'environnement de vos Edge Functions.

### "L'option premium n'est pas disponible pendant la période d'essai"
→ Normal ! L'utilisateur doit d'abord souscrire à l'abonnement principal.

### "Votre abonnement principal doit être actif"
→ L'abonnement de base doit être payant et actif avant de pouvoir ajouter l'option premium.

### Les pages premium sont bloquées
→ Vérifiez dans la table `abonnements` que :
  - `option_premium_active` = true
  - `statut` = 'active'
  - `date_fin_premium` > date actuelle

## Structure Tarifaire

| Type | Prix | Fonctionnalités |
|------|------|----------------|
| **Abonnement de Base** | 9,90€/mois ou 99€/an | Devis, Factures, Clients, Produits, Fournisseurs |
| **Option Premium** | +14,90€/mois ou +149€/an | Comptabilité avancée + Gestion des stocks |
| **Total avec Premium** | 24,80€/mois ou 248€/an | Toutes les fonctionnalités |

## Support

Pour toute question sur la configuration de l'option premium :
1. Vérifiez que Stripe est correctement configuré pour l'abonnement de base
2. Assurez-vous que les variables d'environnement premium sont définies
3. Testez avec les cartes de test Stripe
