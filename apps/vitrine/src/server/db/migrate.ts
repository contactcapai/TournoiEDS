// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` : ce module ouvre une connexion
// Postgres avec les identifiants de production. Il ne doit jamais entrer dans un bundle client.
import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Application des migrations Drizzle AU DÉMARRAGE DU SERVEUR (Story 7.4, AC2).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE MODULE EXISTE, ET POURQUOI IL N'A PAS ÉTÉ ÉCRIT PLUS TÔT
 * ══════════════════════════════════════════════════════════════════════════════
 * Le Dockerfile portait depuis la Story 1.8 le commentaire : *« schema.ts est VIDE (aucune
 * table jusqu'à Story 3.1). Décision A : pas de migrate prod ici, câblage programmé différé à
 * Story 3.1 »*. La Story 3.1 a créé les tables mais **n'a jamais câblé le migrate**, et le
 * commentaire a survécu quatre epics devant **11 tables et 14 migrations**.
 *
 * Le manque n'a jamais fait de bruit pour une raison simple : **la vitrine n'a jamais tourné
 * ailleurs qu'en local**, où `pnpm --filter vitrine db:migrate` fait le travail à la main.
 *
 * 🔴 DEUX IMPASSES MESURÉES LE 2026-08-08, qui excluent les solutions évidentes :
 *   1. `drizzle-kit` est en **`devDependencies`** → absent de l'image standalone.
 *   2. Le service `postgres` du compose **ne publie aucun port** vers l'hôte (c'est voulu :
 *      la base n'est pas exposée). `drizzle-kit migrate` n'est donc jouable **ni** depuis
 *      l'image, **ni** depuis le shell du VPS.
 *
 * 🔴 ET UNE TROISIÈME, QUI DICTE LE MÉCANISME — mesurée sur le standalone réel, pas supposée.
 * `apps/vitrine/.next/standalone/node_modules` ne contient que `next`, `react`, `sharp`… :
 * **`drizzle-orm` et `postgres` n'y sont PAS**. Next les *bundle* dans les chunks serveur
 * (`.next/server/chunks/**`, 10 fichiers les référencent). Conséquence : un script de
 * démarrage **autonome** (`node migrate.mjs` avant `server.js`) qui importerait
 * `drizzle-orm/postgres-js/migrator` **échouerait à la résolution** — le paquet n'existe pas
 * sur le disque de l'image.
 * ⇒ Le code de migration doit être **bundlé par Next lui-même**. C'est exactement ce que fait
 * `src/instrumentation.ts`, le point d'entrée officiel « une fois au démarrage du serveur ».
 *
 * ⚠️ Les fichiers `.sql`, eux, sont de la DONNÉE lue à l'exécution : ils ne sont pas bundlés.
 * C'est `outputFileTracingIncludes` (next.config.ts) qui les fait entrer dans le standalone.
 */

/** Nom du dossier des migrations — identique à `out` dans `drizzle.config.ts`. */
const DOSSIER_MIGRATIONS = "drizzle";

/**
 * Le dossier des migrations, résolu par ESSAI D'EXISTENCE et non par un chemin en dur.
 *
 * 🔴 LE RÉPERTOIRE COURANT N'EST PAS LE MÊME DANS LES DEUX CONTEXTES, et s'en remettre à un
 * seul chemin casserait l'un des deux **en silence** :
 *   · `next start` en local        → cwd = `apps/vitrine`  → `drizzle/`
 *   · conteneur (Dockerfile)       → cwd = `/repo`         → `apps/vitrine/drizzle/`
 *
 * ⚠️ On teste la présence de `meta/_journal.json`, pas celle du dossier : un dossier `drizzle`
 * vide ferait rendre « 0 migration appliquée » à `migrate()`, c'est-à-dire un **faux succès**
 * au sens de `00 référence/pieges/faux-succes.md` — le pire résultat possible ici, puisqu'il
 * laisserait démarrer l'application sur une base sans tables.
 */
function trouverDossierMigrations(): string | null {
  const candidats = [
    path.join(process.cwd(), DOSSIER_MIGRATIONS),
    path.join(process.cwd(), "apps", "vitrine", DOSSIER_MIGRATIONS),
  ];
  return candidats.find((d) => existsSync(path.join(d, "meta", "_journal.json"))) ?? null;
}

/**
 * Joue les migrations en attente, puis rend la main.
 *
 * Trois comportements, et chacun est une décision :
 *
 * 1. **`DATABASE_URL` absente ⇒ on SAUTE, bruyamment.** C'est le Garde-fou n°2 de la
 *    Story 1.7 : `next build` et la CI tournent **sans secret**, et les portes visuelles
 *    lancent un serveur bâti sur des environnements incomplets. Lever ici transformerait un
 *    manque de configuration en **serveur qui ne démarre pas**, donc en régression pour tout
 *    le poste de dev. L'application, elle, échoue déjà clairement au premier appel base.
 *
 * 2. **Migration en échec ⇒ le processus SORT en code 1.** Fail-closed, et c'est voulu :
 *    servir des pages sur un schéma faux est pire qu'un service arrêté. Sous Docker
 *    (`restart: unless-stopped`) le conteneur redémarre en boucle — un incident **visible**
 *    dans `docker compose ps`, jamais un site qui rend des 500 au hasard.
 *    ⚠️ On sort explicitement plutôt que de laisser remonter l'exception : Next **n'arrête
 *    pas** le serveur quand `register()` rejette, il journalise et poursuit. Une exception
 *    seule aurait donc produit exactement le faux succès qu'on veut interdire.
 *
 * 3. **Succès ⇒ la connexion de migration est FERMÉE.** Elle est ouverte à `max: 1` (une
 *    migration ne se parallélise pas) et n'a rien à voir avec le pool applicatif de
 *    `client.ts` : la laisser ouverte immobiliserait une connexion pour la vie du conteneur.
 *
 * ⚠️ **Une seule réplique.** Le migrator postgres-js ne pose pas de verrou d'avis : deux
 * conteneurs vitrine démarrant ensemble pourraient jouer la même migration. La stack n'en
 * déclare qu'un (`container_name: eds-vitrine`) ; le jour où elle en déclarerait deux, il
 * faudrait un `pg_advisory_lock` ici.
 */
export async function migrerAuDemarrage(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn(
      "[migrate] DATABASE_URL absente — migrations SAUTÉES. " +
        "Normal en CI, au build et sur un poste sans base ; ANORMAL en production.",
    );
    return;
  }

  const dossier = trouverDossierMigrations();
  if (!dossier) {
    console.error(
      "[migrate] Dossier de migrations INTROUVABLE (meta/_journal.json absent des chemins " +
        "candidats). Démarrer sur une base non migrée servirait des erreurs à chaque page.",
    );
    process.exit(1);
  }

  // Connexion DÉDIÉE et éphémère : `max: 1` (une migration ne se parallélise pas) et
  // `prepare: false` pour la même raison que `client.ts` (compatibilité pooler transaction).
  //
  // ⚠️ `onnotice` MUET, ET CE N'EST PAS DU CONFORT. Le migrator commence par
  // `CREATE SCHEMA IF NOT EXISTS drizzle` + `CREATE TABLE IF NOT EXISTS __drizzle_migrations`,
  // donc Postgres émet deux NOTICE « already exists, skipping » à **chaque** démarrage sur une
  // base déjà migrée — c'est-à-dire à chaque redémarrage du conteneur. postgres.js les
  // journalise en objets multi-lignes qui **ressemblent à des erreurs** (mesuré au 2ᵉ
  // démarrage de la preuve d'idempotence). Un bruit récurrent qui a l'apparence d'une panne
  // est ce qui fait rater la vraie : le seul message qu'on veut voir ici est le nôtre.
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const debut = Date.now();
    await migrate(drizzle(sql), { migrationsFolder: dossier });
    console.log(`[migrate] Migrations à jour (${dossier}) en ${Date.now() - debut} ms.`);
  } catch (erreur) {
    console.error("[migrate] ÉCHEC des migrations — le serveur ne démarrera pas.", erreur);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  }
  await sql.end({ timeout: 5 });
}
