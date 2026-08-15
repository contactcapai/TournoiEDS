import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { EngagesTournoi } from "@/components/admin/EngagesTournoi/EngagesTournoi";
import { lireAdmin } from "@/server/auth/guard";
import { getEngagesForTournament, getTournoiPourEngages } from "@/server/db/queries/engages";
import styles from "@/styles/admin-page.module.css";

// Les engagés d'un tournoi — saisie à la main et pointage (Story 10.5).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION — une garde de `layout` n'arrête pas le rendu de la `page`
// enfant (défaut mesuré en 6.1).
// 🔴 L'identifiant est validé AVANT d'atteindre la base : un `/admin/tournois/pas-un-uuid`
// ferait lever Postgres en 500 là où la réponse juste est un 404.

export const metadata: Metadata = {
  title: "Les engagés d'un tournoi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EngagesTournoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, donnees] = await Promise.all([
    getTournoiPourEngages(id),
    getEngagesForTournament(id),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      <h1 className={styles.titre}>Les engagés de « {tournoi.name} »</h1>
      <p className={styles.chapo}>
        Saisissez ici qui participe, puis <strong>pointez le jour J</strong>. Ce sont les{" "}
        <strong>présents</strong> qui entreront dans le tableau — pas les inscrits.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}`}>
          Retour à la fiche
        </Link>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/phases`}>
          Le déroulé
        </Link>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      {/* ⚠️ DIT ICI PARCE QUE C'EST ICI QU'ON SE POSE LA QUESTION : le tableau ne se génère pas
          encore (Story 10.8). Sans cette phrase, on pointerait tout le monde en cherchant
          ensuite un bouton « Lancer » qui n'existe pas — c'est la règle ① de
          `pieges/integration-tierce.md` : tant qu'un maillon n'est pas livré, son absence
          s'écrit sur l'écran de celui qui la subit. */}
      <p className={styles.mention} role="note">
        <strong>Le tableau ne se génère pas encore.</strong> Cet écran sert à tenir la liste et
        à pointer ; la génération des rencontres arrive dans une prochaine étape et
        consommera le nombre de présents affiché ci-dessous.
      </p>

      <div className={styles.section}>
        <EngagesTournoi
          tournoiId={tournoi.id}
          teamSize={tournoi.teamSize}
          donnees={donnees}
        />
      </div>
    </>
  );
}
