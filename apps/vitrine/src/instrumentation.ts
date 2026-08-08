/**
 * Point d'entrée « une fois au démarrage du serveur » (Next.js `instrumentation`).
 *
 * Il ne fait qu'une chose, et c'est délibéré : appliquer les migrations Drizzle en attente
 * avant que la première requête ne soit servie (Story 7.4, AC2).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI ICI, ET PAS DANS UN SCRIPT DE DÉMARRAGE À CÔTÉ DE `server.js`
 * ══════════════════════════════════════════════════════════════════════════════
 * Mesuré sur le standalone réel le 2026-08-08 : `.next/standalone/node_modules` ne contient
 * que `next`, `react`, `sharp`… — **ni `drizzle-orm`, ni `postgres`**. Next les *bundle* dans
 * les chunks serveur. Un `node migrate.mjs && node apps/vitrine/server.js` aurait donc échoué
 * à la résolution de `drizzle-orm/postgres-js/migrator` : le paquet n'est pas sur le disque de
 * l'image. Ce fichier-ci, lui, est **bundlé par Next**, donc ses imports le sont aussi.
 * Bénéfice de bord : le `CMD` du Dockerfile reste inchangé.
 *
 * ⚠️ `register()` n'est PAS appelée par `next build` — seulement au démarrage d'un serveur
 * (`next start`, `next dev`, `node server.js`). Le build reste donc sûr sans `DATABASE_URL`,
 * ce qui est le Garde-fou n°2 de la Story 1.7 et ce qui tient la CI sans secret.
 *
 * ⚠️ LE GARDE `NEXT_RUNTIME` N'EST PAS DÉCORATIF. Next appelle `register()` une fois **par
 * runtime**. Sans ce test, la variante Edge tenterait d'importer `postgres` (socket TCP),
 * qui n'y existe pas — un échec dépendant du runtime, donc typiquement invisible en local.
 *
 * ⚠️ L'import est DYNAMIQUE et à l'intérieur de la fonction : un import statique de
 * `./server/db/migrate` chargerait `postgres` dans **tous** les runtimes, y compris celui que
 * le garde ci-dessus vient d'écarter.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrerAuDemarrage } = await import("./server/db/migrate");
  await migrerAuDemarrage();
}
