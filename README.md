# TERAL'O Business V1

SaaS POS / stocks / trésorerie / CRM conçu pour les commerçants et PME d'Afrique de l'Ouest.

## Stack
- React 19 + Vite
- Supabase Auth / PostgreSQL / Storage / RLS
- Recharts
- Lucide React
- PapaParse pour l'import CSV
- Capacitor pour Android / iOS

## Démarrage

```bash
npm install
copy .env.example .env
npm run dev
```

Sans variables Supabase, l'application démarre en **mode démonstration local** afin de permettre une présentation UI/UX et un test des principaux flux. Les données de démonstration sont conservées dans localStorage.

Pour le vrai mode SaaS :
1. créer un projet Supabase ;
2. exécuter `supabase/schema.sql` dans SQL Editor ;
3. créer le bucket Storage `business-assets` ;
4. copier les clés dans `.env` ;
5. lancer `npm run build`.

## Netlify
Le fichier `netlify.toml` est déjà inclus et configure le fallback SPA.

## Capacitor
Après le premier build :

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Pour un APK debug via Android Studio :

```bash
cd android
gradlew assembleDebug
```

> Si Gradle signale une incompatibilité Java, utilisez une version de JDK supportée par la version Gradle/Android Gradle Plugin installée dans le projet Android.

## Comptes de démonstration
En mode local, aucun mot de passe n'est nécessaire. Cliquez sur « Entrer en démonstration ».

## Principes anti-bugs
- Tous les hooks React sont déclarés avant tout return.
- Les requêtes Supabase sont centralisées dans `src/lib/api.js`.
- Les écrans utilisent des états de chargement et des fallbacks.
- Le mode démo évite qu'une absence de configuration Supabase produise une page blanche.
