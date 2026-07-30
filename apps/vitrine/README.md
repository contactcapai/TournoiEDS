# `apps/vitrine` — site vitrine Esport des Sacres

Next.js 16 App Router, React 19, TypeScript strict, **CSS Modules** (pas de Tailwind), Drizzle +
PostgreSQL. Déploiement : image Docker `standalone` derrière **Traefik v3** — *pas* Vercel.

Toutes les commandes se lancent **depuis la racine du monorepo**.

## Développer

```bash
pnpm --filter vitrine dev        # http://localhost:3000
pnpm --filter vitrine lint
pnpm --filter vitrine typecheck
pnpm --filter vitrine build      # les pages éditoriales doivent rester ○ (Static)
pnpm lint                        # racine, reproduit la CI — à passer AVANT la PR
```

## Base de données en local

La vitrine lit un **PostgreSQL 17**. En développement, un conteneur dédié le fournit :

```bash
docker compose -f docker/docker-compose.dev.yml up -d     # Postgres seul, port hôte 5434
cp apps/vitrine/.env.example apps/vitrine/.env.local      # puis renseigner DATABASE_URL
pnpm --filter vitrine db:migrate                          # applique les migrations
pnpm --filter vitrine db:seed                             # jeu de données de l'agenda
```

`DATABASE_URL` pour ce conteneur : `postgresql://vitrine:vitrine@localhost:5434/vitrine`

> ⚠️ **Ne pas utiliser `docker/docker-compose.yml` en local** : c'est le compose de
> **production** (Traefik, Let's Encrypt, build des images). Le compose de dev a son **propre
> volume** — `down -v` dessus ne peut pas atteindre `tournoi-pg-data`, qui porte les données réelles.
>
> ⚠️ Le port hôte est **5434** : `5432`, `5433` et `5442` sont pris par d'autres projets du poste, et
> le conteneur `tournoi-pg` (Postgres 16 de l'app tournoi) ne publie aucun port.

### Migrations

```bash
pnpm --filter vitrine db:generate   # après modification de src/server/db/schema.ts
pnpm --filter vitrine db:migrate
```

Les `.sql` générés sont **versionnés** dans `drizzle/`. Toujours **relire le SQL produit** avant de
l'appliquer : c'est là qu'on voit si une contrainte ou un index a bien été pris.

`db:seed` est **idempotent** (identifiants fixes) et **refuse de tourner** avec
`NODE_ENV=production` : ses données sont fictives mais plausibles.

## 🔴 Dates : une seule horloge, `Europe/Paris`

Le conteneur de production tourne en **UTC** ; l'agenda raisonne en heure de **Paris**. Tout passe
par **`src/lib/date-paris.ts`** — jamais `getDay()`, `getHours()` ni `toISOString().slice(0, 10)`,
jamais d'offset `+02:00` en dur. Côté SQL, envelopper avant toute troncature :
`timezone('Europe/Paris', starts_at)`. Une comparaison brute à `now()` reste sûre.

Mesuré : un événement du **vendredi 31/07 à 00h30** Paris est lu « jeudi 30/07 » par un
`starts_at::date` en session UTC. Détail : `00 référence/pieges/date-tz.md`.

## Portes qualité

Pas de framework de test (choix assumé). La porte est `lint` + `typecheck` + `build` + CI, complétée
par :

```bash
pnpm --filter vitrine build && pnpm --filter vitrine start
pnpm --filter vitrine gate      # 3 pages × 7 largeurs : débordement, header sticky, classes fantômes
```

⚠️ Toute **nouvelle page publique** doit être ajoutée à `GATE_PAGES`
(`tools/visual-gate/config.mjs`) : une page absente n'est couverte par aucune porte, en silence.

## Repères

- Conventions, charte et pièges : `CLAUDE.md` (racine du dépôt) et `AGENTS.md` local.
- Planification (PRD, architecture, epics, stories) : dossier projet `14 site esport des sacres`.
- Runbook de production et passation : `README.md` racine, `docs/PASSATION.md`.
