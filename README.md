# Planify — Générateur de planning employés

Web app de génération automatique de plannings pour entreprises : beaucoup de salariés,
contraintes légales (repos, amplitude, pauses), compétences, disponibilités, congés.

## Dev local

```bash
# 1. Base PostgreSQL (option rapide : https://neon.tech, free tier)
# Copiez l'URL de connexion dans .env
cp .env.example .env
# puis éditez DATABASE_URL

# 2. Install + setup
pnpm install
pnpm exec prisma migrate dev --name init
pnpm db:seed             # entreprise démo : 80 employés, 2 sites, 5 postes
pnpm dev                 # http://localhost:3000
```

Pour **désactiver l'auth en dev**, laissez `APP_PASSWORD` vide.

## Déploiement Vercel

Planify est prêt pour Vercel. Étapes :

1. **Provisionner une base PostgreSQL** (5 min)
   - [Neon](https://neon.tech) — recommandé, free tier, région EU
   - ou Vercel Postgres / Supabase / Railway / RDS
   - Récupérer l'URL : `postgresql://user:pwd@host/db?sslmode=require`

2. **Importer le projet sur Vercel**
   ```bash
   # depuis la racine du repo
   npx vercel              # lier à votre compte, choisir le repo
   ```
   Ou via l'UI : [vercel.com/new](https://vercel.com/new) → importer depuis GitHub.

3. **Configurer les variables d'env** (Project Settings → Environment Variables)
   - `DATABASE_URL` → l'URL Postgres de l'étape 1
   - `APP_PASSWORD` → un mot de passe partagé fort (≥ 16 caractères)

4. **Déployer**
   ```bash
   npx vercel --prod
   ```
   Le build exécute automatiquement `prisma migrate deploy` pour créer les tables.

5. **Initialiser les données** (une seule fois, depuis votre machine avec le même DATABASE_URL)
   ```bash
   DATABASE_URL="postgresql://..." pnpm db:seed
   ```
   Ou créez votre propre entreprise via une page d'onboarding (à ajouter).

L'app est accessible sur `https://<votre-projet>.vercel.app` — mot de passe demandé à l'entrée.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind v4**
- **Prisma 6** + **PostgreSQL**
- **ExcelJS** + **@react-pdf/renderer**
- **Zod** pour la validation
- Auth par mot de passe partagé (middleware Edge + cookie signé SHA-256)

## Fonctionnalités

### Écran planning (`/planning`)

- **« ⚡ Générer le planning »** : remplit la semaine en 1 clic (compétences,
  dispos, congés, règles légales, équité, heures contractuelles)
- Tableau employé × jour, clic sur une cellule pour **ajouter** un shift,
  clic sur un shift pour le **modifier / réassigner / supprimer / verrouiller**
- Shifts **verrouillés 🔒** protégés des prochaines générations
- Liste dépliable des **shifts non pourvus** avec bouton d'assignation directe
- Stats live : couverture, heures, conflits légaux (badge rouge par employé)
- Navigation semaine, filtre par département
- Export **Excel** (3 feuilles) et **PDF** (paysage, prêt à imprimer)
- Bouton **Publier** pour figer le planning

### Gestion (`/employees`, `/positions`, `/templates`, `/settings`)

- Employés : CRUD, édition inline (contrat, heures, dept, taux), désactivation
- Postes + compétences requises
- Modèles de shifts : CRUD avec validation (début<fin, ≥1 jour applicable,
  effectif ≥ 1), département/site attachés
- Réglages : entreprise, sites, règles légales (lecture seule pour l'instant)

## Règles légales (droit français par défaut)

Configurables par entreprise dans `LaborRule`. Vérifiées **en live** dans l'UI et
utilisées comme **contraintes dures** par le générateur :

- Repos quotidien min : 11 h
- Repos hebdo min : 35 h
- Max 10 h / jour · 48 h / semaine
- Moyenne max 44 h / sem sur 12 semaines
- Pause obligatoire 30 min après 6 h
- Amplitude journalière max : 13 h
- Jours consécutifs max : 6

## Moteur de génération (`src/lib/scheduler.ts`)

Heuristique gloutonne :

1. Génère les créneaux à pourvoir depuis les `ShiftTemplate` sur la période
2. Trie par difficulté (slots les plus contraints d'abord)
3. Pour chaque slot : filtre candidats valides (compétences, dispo, pas de
   violation des règles en simulation), choisit le meilleur selon déficit
   d'heures → équité week-ends → heures totales
4. Retourne : assignments + slots non pourvus + heures par employé

## Arborescence

```
src/
  middleware.ts           Auth (redirect /login si cookie invalide)
  app/
    login/                Page de connexion
    planning/             Écran principal + ShiftEditor modal
    employees/            CRUD employés
    positions/            Postes + compétences
    templates/            CRUD modèles de shifts
    settings/             Entreprise + règles légales
    api/
      auth/               login / logout
      schedule/           GET, generate, clear, publish
      shift/              CRUD shift
      employee/           CRUD employé
      template/           CRUD template
      export/xlsx         Export Excel (3 feuilles)
      export/pdf          Export PDF
  lib/
    prisma.ts             Singleton Prisma Client
    scheduler.ts          Moteur de génération
    labor-rules.ts        Vérification contraintes légales
    utils.ts              Helpers dates, heures
prisma/
  schema.prisma           Schéma complet
  seed.ts                 Données de démo (Le Grand Bistrot, 80 employés)
```

## Limites actuelles / à améliorer

- Pas d'édition UI des disponibilités et congés (seulement à la création employé)
- Pas d'édition UI des règles légales
- Pas d'onboarding (création d'entreprise) — passage par le seed
- Timezone du Company non utilisée (serveur en UTC → décalages possibles)
- Pas de drag & drop entre employés/jours (le modal suffit mais c'est moins fluide)
- Pas de rôles (tout le monde avec le mot de passe a les pleins pouvoirs)
- Règle `maxAvgWeeklyH` (44h/12 sem) définie mais non appliquée par le générateur
