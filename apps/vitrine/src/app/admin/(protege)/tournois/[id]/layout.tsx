import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { lireAdmin } from "@/server/auth/guard";
import { getTournoiPourEspace } from "@/server/db/queries/tournaments";
import { MenuTournoi } from "./MenuTournoi";
import styles from "./layout.module.css";

/**
 * Le chrome commun aux cinq surfaces d'un tournoi (Story 10.9, dette R61).
 *
 * 🔴 IL REMPLACE CINQ BARRES DE LIENS ÉCRITES À LA MAIN, dont aucune n'atteignait les quatre
 * autres — voir `_espace.ts`. Le jour J, on faisait des allers-retours engagés ↔ jour J à
 * chaque joueur qui arrive, en repassant par la liste.
 *
 * 🔴 LA GARDE EST ICI **ET** DANS CHAQUE PAGE. Un layout ne suspend pas le rendu de ses
 * enfants (défaut mesuré en 6.1) : celle-ci évite d'afficher le chrome, celles des pages
 * sont ce qui protège la donnée. Ne pas retirer les secondes en croyant celle-ci suffisante.
 *
 * ⚠️ Ce layout porte le `<h1>` — le NOM DU TOURNOI, c'est-à-dire l'objet dont les cinq
 * écrans sont des vues. Les pages titrent donc en `<h2>` : deux `<h1>` empilés diraient que
 * ce sont deux sujets.
 */
export const dynamic = "force-dynamic";

export default async function EspaceTournoiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  // Un identifiant malformé remis à une colonne `uuid` fait lever Postgres — 500 là où la
  // réponse juste est 404. Même garde que dans les pages, et pour la même raison.
  if (!z.uuid().safeParse(id).success) notFound();

  const tournoi = await getTournoiPourEspace(id);
  if (!tournoi) notFound();

  return (
    <div className={styles.espace}>
      <div className={styles.entete}>
        <p className={styles.fil}>
          <Link className={styles.filLien} href="/admin/tournois">
            Tous les tournois
          </Link>
        </p>
        <h1 className={styles.titre}>{tournoi.name}</h1>
        <p className={styles.etat}>
          {tournoi.isPublished ? (
            <>
              <span className={styles.pastillePubliee} aria-hidden="true" />
              En ligne sur le site
            </>
          ) : (
            <>
              <span className={styles.pastilleBrouillon} aria-hidden="true" />
              Brouillon — invisible du public
            </>
          )}
        </p>
      </div>

      <div className={styles.corps}>
        <MenuTournoi tournoiId={tournoi.id} />
        <div className={styles.vue}>{children}</div>
      </div>
    </div>
  );
}
