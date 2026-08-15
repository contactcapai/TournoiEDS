import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PhasesTournoi } from "@/components/admin/PhasesTournoi/PhasesTournoi";
import { lireAdmin } from "@/server/auth/guard";
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
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, phases] = await Promise.all([
    getTournamentById(id),
    getPhasesForTournament(id),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      <h1 className={styles.titre}>Composer « {tournoi.name} »</h1>
      <p className={styles.chapo}>
        Le déroulé se compose en phases, jouées dans l&rsquo;ordre. Ce que vous saisissez ici
        est un <strong>plan</strong> : le pointage du jour J révèle qui est réellement là, et
        la structure peut encore être refaite à ce moment-là — tant qu&rsquo;aucune rencontre
        n&rsquo;a de résultat.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}`}>
          Retour à la fiche
        </Link>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      <div className={styles.section}>
        <PhasesTournoi tournoiId={tournoi.id} phases={phases} />
      </div>
    </>
  );
}
