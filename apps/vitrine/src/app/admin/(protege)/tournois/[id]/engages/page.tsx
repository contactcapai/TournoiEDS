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
      {/* `<h2>` : le `<h1>` est le NOM du tournoi, porté par le layout de l'espace (10.9). */}
      <h2 className={styles.titre}>Les engagés</h2>
      <p className={styles.chapo}>
        Saisissez ici qui participe, puis <strong>pointez le jour J</strong>. Ce sont les{" "}
        <strong>présents</strong> qui entreront dans le tableau — pas les inscrits.
      </p>

      {/* 🔴 CETTE MENTION DISAIT « le tableau ne se génère pas encore » — VRAI À L'ÉCRITURE
          (10.5), FAUX DEPUIS LE MERGE DE LA 10.8 le jour même, et resté à l'écran neuf jours.
          Une phrase qui décrit ce qui MANQUE devient fausse en silence dès qu'on le livre :
          quand la chose existe, elle doit devenir un LIEN vers elle. */}
      <p className={styles.mention} role="note">
        Une fois le pointage fait, c&rsquo;est au{" "}
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/jour-j`}>
          jour J
        </Link>{" "}
        que les rencontres se génèrent — à partir des <strong>présents</strong>, pas des
        inscrits.
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
