# TERAL’O Business V1 — Correctifs Auth / Inscription / Onboarding

## Correctifs inclus

- Inscription enrichie avec `business_name`, `sector` et `plan` obligatoires.
- `supabase.auth.signUp()` transmet ces champs dans `options.data`.
- Le trigger `handle_new_user()` récupère et écrit ces métadonnées dans `public.merchants`.
- Gestion explicite du cas Supabase `user != null` mais `session == null` lorsque la confirmation e-mail est activée.
- Affichage d'un feedback de succès après création du compte, puis retour à l'écran de connexion.
- Aucun appel à `getAppData()` après une inscription sans session active.
- Vérification de `email_confirmed_at` avant chargement de l'espace SaaS.
- Échec de chargement métier protégé par une limite de 10 secondes et un écran de retour à la connexion.
- Listener Supabase pour les déconnexions / changements de session.
- Hooks React maintenus inconditionnels avant les returns du composant `App`.

## Schéma logique

```text
INSCRIPTION
   │
   ├── Nom complet
   ├── Entreprise
   ├── Secteur
   ├── Plan
   ├── Email
   └── Mot de passe
          │
          ▼
supabase.auth.signUp()
          │
          └── options.data
               ├── full_name
               ├── business_name
               ├── sector
               └── plan
          │
          ▼
Trigger handle_new_user()
          │
          ▼
public.merchants
          │
          ├── session présente → chargement sécurisé
          │
          └── session absente → message confirmation e-mail → Login
```

## Important pour Supabase

Exécuter `supabase/schema.sql` dans le SQL Editor du projet Supabase afin de mettre à jour le trigger `handle_new_user()`.

Dans Supabase Auth, laisser la confirmation e-mail activée si le parcours souhaité est :

`Inscription → e-mail de confirmation → activation → connexion → tableau de bord`.

## Test local

```bash
npm install
npm run dev
```

## Test de sécurité attendu

1. Créer un compte.
2. Vérifier que le formulaire contient entreprise + secteur + plan.
3. Soumettre.
4. Aucun écran « Préparation de votre espace… » ne doit rester bloqué.
5. Un message de confirmation e-mail apparaît.
6. L'écran de connexion est affiché.
7. Après confirmation de l'e-mail, se connecter.
8. Le dashboard ne doit être chargé qu'après session active et profil `merchants` disponible.
