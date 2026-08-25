import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { etatAffiche, pointagesDuJour } from "../../../lib/tournoi/presence";
import { ENTRY_STATES, type EntryState } from "../../../lib/tournoi/structure";
import { db } from "../client";
import {
  tournament,
  tournamentEntry,
  tournamentEntryAttendance,
  tournamentEntryMember,
  tournamentMatchSlot,
} from "../schema";

/**
 * Les engagés d'un tournoi, avec leurs membres et de quoi savoir lesquels se suppriment
 * encore (Story 10.5).
 *
 * 🔴 LE SOUS-TOTAL SE CALCULE **DANS LA REQUÊTE**, IL NE SE MAINTIENT PAS À LA MAIN. Leçon
 * payée en 6.13 : un sous-total dérivé se recalcule, sinon il devient faux au premier geste
 * qu'on a oublié de lui signaler.
 *
 * 🔴 ET IL SE CALCULE SUR **TOUTES** LES LIGNES, PAS SUR LA PAGE AFFICHÉE. La liste est bornée
 * (`ENGAGES_MAX`), le décompte ne l'est pas : les dériver de la liste ferait dire « 7 présents »
 * à un écran qui en a tronqué trente — une troncature silencieuse se lit exactement comme
 * « tout va bien ».
 */

/**
 * Borne EXPLICITE, jamais de lecture non bornée (patron `TOURNOIS_MAX`, Story 9.1). 500 est
 * très au-delà d'un tournoi d'association — le plus gros de l'année en compte quelques
 * dizaines — tout en restant borné. « Généreux » n'est pas « non borné ».
 */
export const ENGAGES_MAX = 500;

/** Le décompte par état, toutes les valeurs présentes même à zéro. */
export type DecompteEngages = Record<EntryState, number>;

/**
 * Le tournoi vu par l'écran des engagés : son nom, et **l'effectif qu'il attend**.
 *
 * 🔴 `teamSize` EST LU EN BASE ET NULLE PART AILLEURS. C'est lui qui décide de la règle à
 * laquelle une saisie se soumet (`effectifConforme`) : le recevoir du formulaire laisserait
 * choisir sa propre règle à qui poste directement sur la Server Action.
 *
 * ⚠️ Lecture distincte de `getTournamentById` : ses colonnes (`COLONNES_ADMIN`) servent la
 * fiche d'ÉDITION et ne portent pas `teamSize`. Les y ajouter ferait lire à six écrans une
 * colonne dont un seul a besoin.
 * ⚠️ L'appelant doit avoir validé l'identifiant : un `uuid` malformé remis à une colonne `uuid`
 * fait lever Postgres → une 500 là où la réponse juste est un 404.
 */
export async function getTournoiPourEngages(tournoiId: string) {
  const [ligne] = await db
    .select({
      id: tournament.id,
      name: tournament.name,
      teamSize: tournament.teamSize,
    })
    .from(tournament)
    .where(eq(tournament.id, tournoiId))
    .limit(1);

  return ligne;
}

export async function getEngagesForTournament(tournoiId: string, jour: string | null = null) {
  /**
   * 🔴 LE TÉMOIN DE L'AC 6 EST **L'EXISTENCE D'UNE PLACE DE RENCONTRE**, exactement ce que
   * `ON DELETE RESTRICT` regarde (`tournament_match_slot.entry_id`, Story 10.1) — et non
   * « la rencontre a-t-elle un résultat ». Les deux diffèrent : la base refuse dès qu'une
   * place existe, même sur une rencontre pas encore jouée. Compter le résultat afficherait
   * « supprimable » sur une ligne que la base refuse — une garde qui diverge de celle qui
   * tranche vraiment est pire qu'aucune garde.
   */
  const lignes = await db
    .select({
      id: tournamentEntry.id,
      displayName: tournamentEntry.displayName,
      state: tournamentEntry.state,
      externalId: tournamentEntry.externalId,
      placesDeRencontre: sql<number>`count(${tournamentMatchSlot.id})`.mapWith(Number),
    })
    .from(tournamentEntry)
    .leftJoin(tournamentMatchSlot, eq(tournamentMatchSlot.entryId, tournamentEntry.id))
    .where(eq(tournamentEntry.tournamentId, tournoiId))
    .groupBy(tournamentEntry.id)
    .orderBy(asc(tournamentEntry.createdAt), asc(tournamentEntry.id))
    .limit(ENGAGES_MAX);

  /**
   * Le décompte, en SQL, sur la table entière. `filter (where …)` plutôt que quatre requêtes.
   * ⚠️ `mapWith(Number)` sur chaque agrégat : `count()` remonte en `bigint`, donc en CHAÎNE
   * avec postgres.js — une addition JS y ferait « 34 » au lieu de 7.
   */
  const [decompte] = await db
    .select({
      inscrit: sql<number>`count(*) filter (where ${tournamentEntry.state} = 'inscrit')`.mapWith(Number),
      present: sql<number>`count(*) filter (where ${tournamentEntry.state} = 'present')`.mapWith(Number),
      absent: sql<number>`count(*) filter (where ${tournamentEntry.state} = 'absent')`.mapWith(Number),
      abandonne: sql<number>`count(*) filter (where ${tournamentEntry.state} = 'abandonne')`.mapWith(Number),
    })
    .from(tournamentEntry)
    .where(eq(tournamentEntry.tournamentId, tournoiId));

  /**
   * 🔴 QUAND UNE JOURNÉE EST CHOISIE, C'EST ELLE QUI DÉCIDE DE L'ÉTAT AFFICHÉ (2026-08-24) —
   * et le décompte SQL ci-dessus, qui ne connaît que l'état global, doit alors être REFAIT.
   * Le laisser tel quel donnerait un écran où les lignes disent une chose et le total une
   * autre : le genre d'incohérence qu'on met une heure à comprendre le jour J.
   * ⚠️ `jour === null` ⇒ rien ne change : c'est le comportement d'avant, celui des tournois
   * qui tiennent sur une journée.
   */
  const pointages = pointagesDuJour(
    jour === null
      ? []
      : await db
          .select({
            entryId: tournamentEntryAttendance.entryId,
            playedOn: tournamentEntryAttendance.playedOn,
            state: tournamentEntryAttendance.state,
          })
          .from(tournamentEntryAttendance)
          .innerJoin(tournamentEntry, eq(tournamentEntry.id, tournamentEntryAttendance.entryId))
          .where(
            and(
              eq(tournamentEntry.tournamentId, tournoiId),
              eq(tournamentEntryAttendance.playedOn, jour),
            ),
          ),
    jour,
  );

  const parEtat: DecompteEngages =
    jour === null
      ? {
          inscrit: decompte?.inscrit ?? 0,
          present: decompte?.present ?? 0,
          absent: decompte?.absent ?? 0,
          abandonne: decompte?.abandonne ?? 0,
        }
      : lignes.reduce<DecompteEngages>(
          (total, ligne) => {
            total[etatAffiche(ligne.state, pointages.get(ligne.id))] += 1;
            return total;
          },
          { inscrit: 0, present: 0, absent: 0, abandonne: 0 },
        );

  // Une seconde lecture plutôt qu'une jointure : joindre les membres à la requête ci-dessus
  // multiplierait les lignes, et le `count` des places de rencontre avec elles.
  const membres =
    lignes.length === 0
      ? []
      : await db
          .select({
            entryId: tournamentEntryMember.entryId,
            position: tournamentEntryMember.position,
            displayName: tournamentEntryMember.displayName,
          })
          .from(tournamentEntryMember)
          .where(
            inArray(
              tournamentEntryMember.entryId,
              lignes.map((l) => l.id),
            ),
          )
          .orderBy(asc(tournamentEntryMember.entryId), asc(tournamentEntryMember.position));

  const parEngage = new Map<string, { position: number; displayName: string }[]>();
  for (const membre of membres) {
    const liste = parEngage.get(membre.entryId);
    if (liste) liste.push(membre);
    else parEngage.set(membre.entryId, [membre]);
  }

  const total = ENTRY_STATES.reduce((somme, etat) => somme + parEtat[etat], 0);

  return {
    engages: lignes.map((ligne) => ({
      ...ligne,
      /**
       * 🔴 `state` EST CELUI DE LA JOURNÉE CHOISIE, PAS L'ÉTAT GLOBAL. C'est ce champ que les
       * boutons de pointage rendent « actif » : y laisser l'état global montrerait « présent »
       * au 3ᵉ week-end parce que quelqu'un l'était au 1ᵉʳ.
       * ⚠️ `etatAffiche` et non `joueCeJourLa` : « pas encore pointé » (`inscrit`) doit rester
       * distinct d'« absent » — c'est l'information même qu'on cherche en début de journée.
       */
      state: etatAffiche(ligne.state, pointages.get(ligne.id)),
      /**
       * 🔴 L'ÉTAT GLOBAL DU TOURNOI, CONSERVÉ À CÔTÉ (Story 13.1). `state` ci-dessus l'ÉCRASE
       * dès qu'une journée est choisie, et l'écran ne pouvait donc plus montrer que l'un des
       * deux — alors que ce sont précisément DEUX GESTES qu'il faut distinguer sans se
       * tromper : « inscrit au tournoi, drop » d'un côté, « présent ce samedi » de
       * l'autre. Un abandon reste vrai toutes journées confondues ; le pointage, non.
       * ⚠️ Quand aucune journée n'est choisie, les deux valent la même chose — c'est normal,
       * et c'est au rendu de ne pas afficher deux fois la même information.
       */
      stateGlobal: ligne.state,
      membres: parEngage.get(ligne.id) ?? [],
      /** La base refusera la suppression dès qu'une place existe — voir plus haut. */
      supprimable: ligne.placesDeRencontre === 0,
    })),
    parEtat,
    total,
    /** Vrai quand la liste affichée ne montre pas tout — le décompte, lui, reste juste. */
    tronquee: total > lignes.length,
  };
}

export type EngagesDuTournoi = Awaited<ReturnType<typeof getEngagesForTournament>>;
export type EngageListe = EngagesDuTournoi["engages"][number];
