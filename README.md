# Planify — Générateur de planning employés

Web app de génération automatique de plannings pour entreprises, pensée pour gérer
beaucoup de salariés et de contraintes (repos, compétences, disponibilités, congés).

## Démarrer

```bash
pnpm install
cp .env.example .env
pnpm exec prisma migrate dev --name init
pnpm db:seed               # entreprise démo, 80 employés, 5 postes, 2 sites
pnpm dev                   # http://localhost:3000
```

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind v4** pour le style (épuré, beaucoup d'espace blanc)
- **Prisma 6** + **SQLite** (remplaçable par PostgreSQL en prod)
- **ExcelJS** + **@react-pdf/renderer** pour les exports
- **Zod** pour la validation

## Fonctionnalités

### Génération automatique en 1 clic

Le bouton **« ⚡ Générer le planning »** remplit la semaine en respectant :

- les **compétences** requises par chaque poste ;
- les **disponibilités** récurrentes de chaque employé ;
- les **congés** / absences validés ;
- les **règles légales** (11h repos quotidien, 48h/sem, pauses, amplitude…) ;
- l'**équité** (répartition des heures et des week-ends) ;
- les **heures contractuelles** de chaque employé.

Les shifts verrouillés 🔒 ne sont pas écrasés par la génération.

### Écran planning

- Tableau employé × jour, pastilles avec horaires & poste
- Navigation semaine précédente / suivante
- Filtre par département
- Détection temps réel des conflits légaux (badge rouge)
- Stats globales : couverture, heures, conflits
- Verrouillage / suppression d'un shift en un clic

### Exports

- **Excel** : 3 feuilles — planning hebdo, récap heures & coût, détail shifts
- **PDF** : planning paysage prêt à imprimer / afficher

### Entités

`Company` → `Site` → `Department` → `Position` (avec `Skill` requis) → `ShiftTemplate` → `Shift`
`Employee` ↔ `Skill`, `Availability`, `TimeOff`, `Shift`
`LaborRule` (configurable, défauts = droit français)

## Moteur de génération (`src/lib/scheduler.ts`)

Heuristique gloutonne :

1. Crée les créneaux à pourvoir à partir des `ShiftTemplate` sur la période
2. Trie par difficulté (slots les plus contraints d'abord)
3. Pour chaque slot : filtre les candidats valides, choisit le meilleur selon
   déficit d'heures → équité week-ends → heures totales
4. Retourne assignments + slots non pourvus + heures par employé

## Arborescence

```
src/
  app/
    planning/           Vue principale (génération 1-clic)
    employees/          CRUD employés
    positions/          Postes + compétences
    templates/          Modèles de shifts
    settings/           Entreprise + règles légales
    api/
      schedule/         GET, generate, clear, publish
      shift/            CRUD shift
      employee/         CRUD employé
      template/         CRUD template
      export/xlsx       Export Excel
      export/pdf        Export PDF
  lib/
    prisma.ts           Singleton Prisma Client
    scheduler.ts        Moteur de génération
    labor-rules.ts      Vérification contraintes légales
    utils.ts            Helpers (dates, heures, …)
prisma/
  schema.prisma         Modèle de données
  seed.ts               Données de démo
```
