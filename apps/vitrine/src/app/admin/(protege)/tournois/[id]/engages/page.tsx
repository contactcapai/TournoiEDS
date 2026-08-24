import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { EngagesTournoi } from "@/components/admin/EngagesTournoi/EngagesTournoi";
import { lireAdmin } from "@/server/auth/guard";
import { jourLisible } from "@/lib/date-paris";
import { getEngagesForTournament, getTournoiPourEngages } from "@/server/db/queries/engages";
import { getJourneesDuTournoi } from "@/server/db/queries/phases";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jour?: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const journees = await getJourneesDuTournoi(id);

  /**
   * 🔴 LA JOURNÉE VIENT DE L'URL, ET ELLE EST VÉRIFIÉE CONTRE LES JOURNÉES RÉELLES. Un
   * `?jour=` arbitraire irait sinon lire un pointage qui n'existe pour aucune phase, et
   * l'écran afficherait un état que rien ne joue.
   * ⚠️ Le défaut est `null` = **tout le tournoi**, l'état global : c'est le comportement d'un
   * tournoi d'un seul jour, donc de tous ceux d'avant le 2026-08-24.
   */
  const { jour: jourDemande } = await searchParams;
  const jour = jourDemande !== undefined && journees.includes(jourDemande) ? jourDemande : null;

  const [tournoi, donnees] = await Promise.all([
    getTournoiPourEngages(id),
    getEngagesForTournament(id, jour),
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

      {/* 🔴 LE SÉLECTEUR N'APPARAÎT QUE SI LE TOURNOI A DES JOURNÉES. Un tournoi qui tient sur
          un jour n'a rien à choisir, et lui montrer un choix à une seule option ferait croire
          qu'il en manque. Apparence minimale : les écrans sont en cours de refonte. */}
      {journees.length > 0 ? (
        <div className={styles.barreActions}>
          <Link
            className={styles.lien}
            href={`/admin/tournois/${tournoi.id}/engages`}
            aria-current={jour === null ? "page" : undefined}
          >
            {jour === null ? "▸ " : ""}Tout le tournoi
          </Link>
          {journees.map((journee) => (
            <Link
              key={journee}
              className={styles.lien}
              href={`/admin/tournois/${tournoi.id}/engages?jour=${journee}`}
              aria-current={jour === journee ? "page" : undefined}
            >
              {jour === journee ? "▸ " : ""}
              {jourLisible(journee)}
            </Link>
          ))}
        </div>
      ) : null}

      {jour !== null ? (
        <p className={styles.mention} role="note">
          Vous pointez la journée du <strong>{jourLisible(jour)}</strong>. Ce pointage ne
          concerne <strong>que ce jour</strong> — celui des autres journées reste inchangé, et
          c&rsquo;est lui qui décide de qui entre dans les tables de cette journée.
        </p>
      ) : null}

      <div className={styles.section}>
        <EngagesTournoi
          tournoiId={tournoi.id}
          teamSize={tournoi.teamSize}
          donnees={donnees}
          jour={jour}
        />
      </div>
    </>
  );
}
