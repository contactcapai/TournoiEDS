import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PhasesTournoi } from "@/components/admin/PhasesTournoi/PhasesTournoi";
import { exigerRolePage } from "@/server/auth/guard";
import { getPhasesForTournament } from "@/server/db/queries/phases";
import { getTournamentById } from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-page.module.css";

// Composition d'un tournoi (Story 10.4).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION — une garde de `layout` n'arrête pas le rendu de la `page`
// enfant (défaut mesuré en 6.1).
// 🔴 L'identifiant est validé AVANT d'atteindre la base : un `/admin/tournois/pas-un-uuid`
// ferait lever Postgres en 500 là où la réponse juste est un 404.

export const metadata: Metadata = {
  title: "Composer un tournoi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ComposerTournoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_tournoi");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, phases] = await Promise.all([
    getTournamentById(id),
    getPhasesForTournament(id),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      {/* `<h2>` : le `<h1>` est le NOM du tournoi, porté par le layout de l'espace (10.9) —
          « Composer « X » » le répétait à un cran au-dessus. */}
      <h2 className={styles.titre}>Le déroulé</h2>
      <p className={styles.chapo}>
        Le déroulé se compose en phases, jouées dans l&rsquo;ordre. Ce que vous saisissez ici
        est un <strong>plan</strong> : le pointage du jour J révèle qui est réellement là, et
        la structure peut encore être refaite à ce moment-là — tant qu&rsquo;aucune rencontre
        n&rsquo;a de résultat.
      </p>

      <div className={styles.section}>
        <PhasesTournoi tournoiId={tournoi.id} phases={phases} />
      </div>
    </>
  );
}
