import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { JourJ } from "@/components/admin/JourJ/JourJ";
import { PodiumDeduit } from "@/components/admin/PodiumDeduit/PodiumDeduit";
import { LIBELLE_NATURE } from "@/lib/schemas/phase";
import { lireAdmin } from "@/server/auth/guard";
import { getEngagesForTournament, getTournoiPourEngages } from "@/server/db/queries/engages";
import { getPhasesForTournament } from "@/server/db/queries/phases";
import { getTournamentById } from "@/server/db/queries/tournaments";
import {
  aDesResultatsSaisis,
  getClassementDuTournoi,
  getPhasePourJeu,
  getPresentsDuTournoi,
  getRencontresDePhase,
  phaseADesResultats,
  rangsDeLaPhase,
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

  const [tournoi, fiche, phases, engages, presents, classement] = await Promise.all([
    getTournoiPourEngages(id),
    getTournamentById(id),
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

  // 🔴 LE RANG DANS LA PHASE, DÉDUIT DE SA STRUCTURE — c'est lui qui manquait au tournoi réel du
  // 2026-08-15 : un bracket joué au score ne produisait aucun classement, donc l'écran affirmait
  // qu'aucun résultat n'était saisi. `null` pour les phases de tables : là, le classement aux
  // points ci-dessous EST le rang.
  const rangs = phaseComplete ? rangsDeLaPhase(phaseComplete.kind, rencontres) : null;
  const resultatsSaisis = aDesResultatsSaisis(rencontres);

  return (
    <>
      {/* `<h2>` : le `<h1>` est le NOM du tournoi, porté par le layout de l'espace (10.9). */}
      <h2 className={styles.titre}>Le jour J</h2>
      {/* 🔴 LE COMPTE DE PRÉSENTS RESTE, ET IL A CHANGÉ DE PLACE. Il vivait dans le libellé
          d'un lien de la barre de navigation, que le menu de l'espace remplace (R61) — or
          c'est le chiffre qu'on regarde en premier ici : il décide de ce qui se génère. */}
      <p className={styles.chapo}>
        On génère depuis les <strong>présents</strong>, on saisit les résultats, le classement se
        recalcule. Pour l&rsquo;instant,{" "}
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/engages`}>
          <strong>{engages.parEtat.present} présents</strong> au pointage
        </Link>{" "}
        — ce sont eux qui entreront dans le tableau, pas les inscrits.
      </p>

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

          {/* ══════════════════════════════════════════════════════════════════════════════
              LE RANG DANS CETTE PHASE — déduit, jamais saisi
              ══════════════════════════════════════════════════════════════════════════
              🔴 C'est ce qui manquait au tournoi réel du 2026-08-15 : une double élimination
              entièrement jouée au score ne produisait AUCUN classement, et l'écran affirmait
              qu'aucun résultat n'était saisi. Les rangs sont DENSES : quatre joueurs sortis au
              premier tour sont tous 5ᵉ, parce que leur inventer un ordre serait un faux. */}
          {rangs && rangs.lignes.length > 0 ? (
            <section className={styles.section} aria-labelledby="jour-j-rangs">
              <h2 className={styles.sectionTitre} id="jour-j-rangs">
                Rang dans « {active?.name} »
              </h2>
              <div className={propre.tableWrap}>
                <table className={propre.table}>
                  <thead>
                    <tr>
                      <th scope="col">Rang</th>
                      <th scope="col">Engagé</th>
                      <th scope="col">
                        {phaseComplete?.kind === "poule" ? "Victoires" : "Sorti au niveau"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangs.lignes.map((ligne) => (
                      <tr key={ligne.id}>
                        <td>
                          {ligne.rang}
                          {ligne.exAequo > 1 ? (
                            <span className={propre.abandon}>
                              {" "}
                              ex æquo ({ligne.exAequo})
                            </span>
                          ) : null}
                        </td>
                        <td>{ligne.nom}</td>
                        <td>
                          {phaseComplete?.kind === "poule"
                            ? ligne.profondeur
                            : ligne.profondeur === null
                              ? "encore en course"
                              : ligne.profondeur}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.mention} role="note">
                {phaseComplete?.kind === "poule" ? (
                  <>
                    <strong>Classée aux victoires</strong>, puis à la différence de score. Dans une
                    poule personne n&rsquo;est éliminé : chacun rencontre chacun.
                  </>
                ) : (
                  <>
                    <strong>Déduit du tableau</strong>, jamais saisi : votre rang est{" "}
                    <em>jusqu&rsquo;où vous êtes allé</em>. En double élimination, une défaite chez
                    les vainqueurs ne sort pas — elle fait descendre chez les perdants.
                  </>
                )}
              </p>
            </section>
          ) : null}
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
          /* 🔴 CETTE PHRASE A MENTI, ET C'EST LE TOURNOI RÉEL DE BRICE QUI L'A MONTRÉ. Elle disait
             « aucun résultat saisi » sur une double élimination ENTIÈREMENT jouée : le classement
             aux points ne compte que les places portant un **rang**, et un bracket se saisit au
             **score**. Une phrase fausse sur un écran de saisie fait chercher une panne qui
             n'existe pas. Elle distingue donc désormais les deux cas. */
          <p className={styles.vide}>
            {resultatsSaisis ? (
              <>
                <strong>Ce classement-ci ne concerne que les tables</strong> (lobbies, finale) :
                il compte les <strong>places</strong>, pas les scores. Vos résultats sont bien
                enregistrés — c&rsquo;est le <strong>rang dans la phase</strong>, juste au-dessus,
                qui les traduit.
              </>
            ) : (
              <>
                Aucun résultat saisi pour l&rsquo;instant — le classement apparaîtra dès la
                première table dépouillée. Il se recalcule à chaque affichage : rien
                n&rsquo;est figé.
              </>
            )}
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

        {/* 🔴 CE QUI RELIE LE MOTEUR À CE QUE LE SITE PUBLIE. Sans ce bouton, on finit un tournoi
            et on retape le podium à la main sur un autre écran — c'est ce qui est arrivé le
            2026-08-15 : la grande finale avait un vainqueur, le podium était vide. */}
        <div className={styles.barreActions}>
          <PodiumDeduit
            tournoiId={tournoi.id}
            podiumActuel={{
              premier: fiche?.podiumFirst ?? null,
              deuxieme: fiche?.podiumSecond ?? null,
              troisieme: fiche?.podiumThird ?? null,
            }}
          />
        </div>

        {fiche?.podiumFirst ? (
          <p className={styles.mention} role="note">
            <strong>Podium enregistré :</strong> 1ᵉʳ {fiche.podiumFirst}
            {fiche.podiumSecond ? `, 2ᵉ ${fiche.podiumSecond}` : ""}
            {fiche.podiumThird ? `, 3ᵉ ${fiche.podiumThird}` : ""}. Il paraît sur la fiche
            publique du tournoi — la corriger se fait depuis « Modifier ».
          </p>
        ) : null}

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
