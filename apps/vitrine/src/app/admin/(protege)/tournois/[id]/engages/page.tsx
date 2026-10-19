import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { BarreJournees } from "@/components/admin/BarreJournees/BarreJournees";
import { EngagesTournoi } from "@/components/admin/EngagesTournoi/EngagesTournoi";
import { exigerRolePage } from "@/server/auth/guard";
import { jourLisible } from "@/lib/date-paris";
import { ReclamationsEngages } from "@/components/admin/ReclamationsEngages/ReclamationsEngages";
import { TitrePage } from "@/components/admin/TitrePage/TitrePage";
import { getEngagesForTournament, getTournoiPourEngages } from "@/server/db/queries/engages";
import { getReclamationsDuTournoi } from "@/server/db/queries/rattachement";
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
  await exigerRolePage("admin_tournoi");

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

  const [tournoi, donnees, reclamations] = await Promise.all([
    getTournoiPourEngages(id),
    getEngagesForTournament(id, jour),
    getReclamationsDuTournoi(id),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      {/* `<h2>` : le `<h1>` est le NOM du tournoi, porté par le layout de l'espace (10.9). */}
      <TitrePage niveau={2}
        info={[
          <>
            Saisissez ici qui participe, puis <strong>pointez le jour J</strong>. Ce sont les{" "}
            <strong>présents</strong> qui entreront dans le tableau — pas les inscrits.
          </>,
          "Une fois le pointage fait, c'est au jour J que les rencontres se génèrent, à partir des présents.",
          ...(journees.length > 0
            ? [
                "Sur un tournoi en plusieurs journées, chaque journée se pointe à part : le pointage d'une journée ne touche pas celui des autres, et c'est lui qui décide de qui entre dans les tables de cette journée.",
              ]
            : []),
        ]}
      >
        Les engagés
      </TitrePage>

      {/* 🔴 LE SÉLECTEUR N'APPARAÎT QUE SI LE TOURNOI A DES JOURNÉES. Un tournoi qui tient sur
          un jour n'a rien à choisir, et lui montrer un choix à une seule option ferait croire
          qu'il en manque. Apparence minimale : les écrans sont en cours de refonte. */}
      {journees.length > 0 ? (
        <BarreJournees
          intitule="La journée pointée"
          entrees={[
            {
              jour: null,
              libelle: "Tout le tournoi",
              href: `/admin/tournois/${tournoi.id}/engages`,
              actif: jour === null,
            },
            ...journees.map((journee) => ({
              jour: journee,
              href: `/admin/tournois/${tournoi.id}/engages?jour=${journee}`,
              actif: jour === journee,
            })),
          ]}
        />
      ) : null}

      {jour !== null ? (
        <p className={styles.chapo}>
          Pointage du <strong>{jourLisible(jour)}</strong>.
        </p>
      ) : null}

      {/* 🔴 AVANT LA LISTE, comme la bande « Ce qui attend » du tableau de bord (13.3) : une
          demande en attente est une chose à FAIRE, et la ranger après le tableau des engagés
          la rendrait invisible un jour de tournoi. ⚠️ Le bloc disparaît de lui-même quand il
          n'y a rien — un emplacement vide se lit comme une panne. */}
      <ReclamationsEngages reclamations={reclamations} />

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
