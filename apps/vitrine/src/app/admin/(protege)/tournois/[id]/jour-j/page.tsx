import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { JourJ } from "@/components/admin/JourJ/JourJ";
import { LIBELLE_NATURE } from "@/lib/schemas/phase";
import { lireAdmin } from "@/server/auth/guard";
import { getEngagesForTournament, getTournoiPourEngages } from "@/server/db/queries/engages";
import { getPhasesForTournament } from "@/server/db/queries/phases";
import {
  getClassementDuTournoi,
  getPhasePourJeu,
  getPresentsDuTournoi,
  getRencontresDePhase,
  phaseADesResultats,
} from "@/server/db/queries/rencontres";
import styles from "@/styles/admin-page.module.css";
import propre from "./jour-j.module.css";

// Le jour J : générer, jouer, classer (Story 10.8).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION — une garde de `layout` n'arrête pas le rendu de la `page`
// enfant (défaut mesuré en 6.1).
// 🔴 UNE PHASE À LA FOIS, choisie par `?phase=`. Tout afficher ferait un écran de plusieurs
// milliers de pixels sur un TFT à 64 (8 tables de 8 par manche), et le jour J on travaille sur
// UNE manche — celle qui se joue.

export const metadata: Metadata = {
  title: "Le jour J",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function JourJPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phase?: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, phases, engages, presents, classement] = await Promise.all([
    getTournoiPourEngages(id),
    getPhasesForTournament(id),
    getEngagesForTournament(id),
    getPresentsDuTournoi(id),
    getClassementDuTournoi(id),
  ]);
  if (!tournoi) notFound();

  const { phase: phaseDemandee } = await searchParams;
  // ⚠️ L'identifiant de phase vient de l'URL : on le valide, ET on vérifie qu'il appartient à CE
  // tournoi. Sans le second contrôle, `?phase=<uuid d'un autre tournoi>` afficherait les
  // rencontres d'un tournoi voisin sous le titre de celui-ci.
  const choisie =
    phaseDemandee && z.uuid().safeParse(phaseDemandee).success
      ? phases.find((p) => p.id === phaseDemandee)
      : undefined;
  const active = choisie ?? phases[0];

  const [phaseComplete, rencontres, aDesResultats] = active
    ? await Promise.all([
        getPhasePourJeu(active.id),
        getRencontresDePhase(active.id),
        phaseADesResultats(active.id),
      ])
    : [undefined, [], false];

  return (
    <>
      <h1 className={styles.titre}>Le jour J — « {tournoi.name} »</h1>
      <p className={styles.chapo}>
        On génère depuis les <strong>présents</strong>, on saisit les résultats, le classement se
        recalcule. Le pointage vit sur l&rsquo;écran des <strong>engagés</strong> ; le déroulé
        (les phases) se compose ailleurs.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/engages`}>
          Les engagés ({engages.parEtat.present} présents)
        </Link>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/phases`}>
          Le déroulé
        </Link>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      {phases.length === 0 ? (
        /* ⚠️ Un état vide qui dirait « aucune phase » se lirait comme une panne. Celui-ci dit
           quoi faire, et où — doctrine des états vides du projet. */
        <p className={styles.vide}>
          Ce tournoi n&rsquo;a pas encore de <strong>déroulé</strong>. Composez-le d&rsquo;abord :
          une poule, un tableau, des lobbies, une finale. C&rsquo;est le déroulé qui dit quoi
          générer ici.
        </p>
      ) : (
        <>
          {/* Les phases en onglets — des LIENS, donc partageables et utilisables sans
              JavaScript. Le jour J, l'écran est ouvert sur un téléphone qui perd le réseau. */}
          <nav className={propre.onglets} aria-label="Les phases du tournoi">
            {phases.map((phase) => {
              const courante = active?.id === phase.id;
              return (
                <Link
                  key={phase.id}
                  href={`/admin/tournois/${tournoi.id}/jour-j?phase=${phase.id}`}
                  className={courante ? propre.ongletActif : propre.onglet}
                  aria-current={courante ? "page" : undefined}
                >
                  {phase.position}. {phase.name}
                  <span className={propre.ongletNature}>{LIBELLE_NATURE[phase.kind]}</span>
                </Link>
              );
            })}
          </nav>

          <div className={styles.section}>
            {active && phaseComplete ? (
              <JourJ
                phase={{
                  id: phaseComplete.id,
                  name: phaseComplete.name,
                  kind: phaseComplete.kind,
                  settings: (phaseComplete.settings ?? {}) as {
                    tailleDeLobby?: number;
                    doubleElimination?: boolean;
                    allerRetour?: boolean;
                  },
                }}
                rencontres={rencontres}
                presents={presents.length}
                aUnClassement={classement.length > 0}
                aDesResultats={aDesResultats}
              />
            ) : null}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          LE CLASSEMENT — RECALCULÉ, JAMAIS STOCKÉ
          ══════════════════════════════════════════════════════════════════════════════
          🔴 Il porte sur TOUT le tournoi, pas sur la phase affichée : c'est lui qu'on consulte
          pour composer la manche suivante, et c'est lui que « générer depuis le classement »
          consomme. Une colonne `points` deviendrait fausse au premier résultat corrigé (6.13). */}
      <section className={styles.section} aria-labelledby="jour-j-classement">
        <h2 className={styles.sectionTitre} id="jour-j-classement">
          Classement
        </h2>

        {classement.length === 0 ? (
          <p className={styles.vide}>
            Aucun résultat saisi pour l&rsquo;instant — le classement apparaîtra dès la première
            rencontre dépouillée. Il se recalcule à chaque affichage : rien n&rsquo;est figé.
          </p>
        ) : (
          <div className={propre.tableWrap}>
            <table className={propre.table}>
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Engagé</th>
                  <th scope="col">Points</th>
                  <th scope="col">1ᵉʳ</th>
                  <th scope="col">Moitié haute</th>
                  <th scope="col">Manches</th>
                  <th scope="col">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {classement.map((ligne) => (
                  <tr key={ligne.id}>
                    <td>{ligne.rang}</td>
                    <td>
                      {ligne.nom}
                      {/* 🔴 UN ABANDON GARDE SES POINTS ET SON RANG (dette R60) — et l'écran le
                          DIT, sinon on croirait à une erreur de saisie. */}
                      {ligne.abandonne ? (
                        <span className={propre.abandon}> — a abandonné</span>
                      ) : null}
                    </td>
                    <td>{ligne.stats.total}</td>
                    <td>{ligne.stats.premieres}</td>
                    <td>{ligne.stats.moitieHaute}</td>
                    <td>{ligne.stats.manchesJouees}</td>
                    <td>{ligne.stats.moyenne}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.mention} role="note">
          <strong>Départages, dans cet ordre :</strong> points totaux, puis premières places,
          puis places en moitié haute, puis meilleur dernier résultat — et le nom en dernier
          ressort, pour que le classement soit <strong>reproductible</strong>. Les points suivent
          la taille <strong>réelle</strong> de chaque table : un 1ᵉʳ d&rsquo;une table de 6
          marque 6 points, pas 8.
        </p>
      </section>
    </>
  );
}
