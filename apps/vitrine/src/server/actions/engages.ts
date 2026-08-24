"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { engageSaisie } from "../../lib/schemas/engage";
import { ENTRY_STATES, type EntryState } from "../../lib/tournoi/structure";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { getTournoiPourEngages } from "../db/queries/engages";
import {
  tournamentEntry,
  tournamentEntryAttendance,
  tournamentEntryMember,
} from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des ENGAGÉS d'un tournoi — saisie à la main et pointage (Story 10.5).
 *
 * Patron d'`actions/phases.ts` (10.4) : `await requireAdmin()` en PREMIÈRE LIGNE, `identifiant`
 * sur tout `id` reçu, retour discriminé `ResultatAction<T>`.
 *
 * 🔴 CE QUI EST PROPRE À CET ÉCRAN : UN ENGAGÉ QUI A UNE PLACE DE RENCONTRE NE SE SUPPRIME PAS,
 * ET C'EST **LA BASE** QUI LE REFUSE (`ON DELETE RESTRICT`, Story 10.1). On ne double pas ce
 * refus d'une garde applicative qui pourrait en diverger : on TRADUIT le refus.
 */

/**
 * Les `CHECK` de `tournament_entry` et `tournament_entry_member` traduits pour un bénévole.
 * Zod devrait les avoir devancés ; si l'un d'eux tire quand même, c'est un chemin qui le
 * contourne — d'où le `console.error` de chaque appelant.
 */
const CONTRAINTES: Record<string, string> = {
  tournament_entry_display_name_non_blanc: "Donnez un nom lisible à cet engagé.",
  tournament_entry_member_display_name_non_blanc: "Donnez un nom lisible à chaque joueur.",
  tournament_entry_member_position_positive:
    "L'ordre des joueurs est invalide. Rechargez la page.",
};

/** Le pointage n'accepte que les quatre états connus, même par POST direct. */
const etatSaisi = z.enum(ENTRY_STATES);

/**
 * Ajoute un engagé, avec ses membres, en une seule transaction.
 *
 * 🔴 `teamSize` VIENT DE LA BASE, JAMAIS DU FORMULAIRE. Une Server Action est atteignable par
 * un POST direct : accepter un `teamSize` posté reviendrait à laisser choisir sa propre règle
 * d'effectif — c'est-à-dire à rendre `effectifConforme()` décorative au moment exact où on lui
 * donne enfin un consommateur.
 *
 * 🔴 ET L'INSERTION EST TRANSACTIONNELLE. Sans elle, un échec sur le 3ᵉ membre laisserait en
 * base un engagé à l'effectif incomplet — précisément l'état que la 10.1 a refusé de modéliser
 * (« une équipe incomplète n'entre pas »), et que la base ne peut pas interdire seule : la
 * règle porte sur le NOMBRE de lignes d'une autre table.
 */
export async function ajouterEngage(
  tournoiId: string,
  donnees: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  const tournoi = await getTournoiPourEngages(tournoiId);
  if (!tournoi) {
    return { ok: false, error: "Ce tournoi n'existe plus. Rechargez la page." };
  }

  const analyse = engageSaisie(tournoi.teamSize).safeParse({
    displayName: donnees.get("displayName"),
    // `getAll` : le formulaire rend `teamSize` cases portant toutes le même nom.
    membres: donnees.getAll("membre").map((valeur) => String(valeur)),
  });
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Vérifiez la saisie.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const id = await db.transaction(async (tx) => {
      const [ligne] = await tx
        .insert(tournamentEntry)
        .values({
          tournamentId: tournoiId,
          displayName: analyse.data.displayName,
          // `externalId` reste NULL : cet engagé est saisi à la main, il n'a pas de
          // contrepartie chez MATELY. L'index unique est PARTIEL (Story 10.1) précisément
          // pour que plusieurs saisies manuelles coexistent.
        })
        .returning({ id: tournamentEntry.id });

      await tx.insert(tournamentEntryMember).values(
        analyse.data.membres.map((displayName, index) => ({
          entryId: ligne.id,
          // `position` commence à 1 : `tournament_entry_member_position_positive` refuse 0.
          position: index + 1,
          displayName,
        })),
      );

      return ligne.id;
    });

    return { ok: true, data: { id } };
  } catch (erreur) {
    console.error("[ajouterEngage] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Pointe un engagé : `inscrit` → `present` / `absent` / `abandonne`, et retour.
 *
 * ⚠️ AUCUN CHEMIN N'EST INTERDIT, y compris revenir à `inscrit`. Le pointage est une saisie
 * humaine faite dans le bruit d'une salle : se tromper de ligne est banal, et une machine à
 * états qui refuserait la marche arrière obligerait à supprimer puis re-saisir — ce que
 * l'AC 6 interdit justement dès qu'une rencontre existe.
 */
export async function pointerEngage(
  id: string,
  etat: string,
  /**
   * Le jour pointé (2026-08-24). `null` ⇒ on pointe l'état GLOBAL du tournoi, exactement
   * comme avant — c'est le cas d'un tournoi qui tient sur une journée.
   */
  jour: string | null = null,
): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = etatSaisi.safeParse(etat);
  if (!analyse.success) {
    return { ok: false, error: "Ce pointage n'est pas reconnu. Rechargez la page." };
  }

  if (jour !== null) return pointerLaJournee(id, analyse.data, jour);

  try {
    const [ligne] = await db
      .update(tournamentEntry)
      .set({ state: analyse.data, updatedAt: new Date() })
      .where(eq(tournamentEntry.id, id))
      .returning({ id: tournamentEntry.id });

    // 🔴 ON VÉRIFIE L'EFFET, PAS L'ABSENCE D'ERREUR. Un `UPDATE` qui ne touche aucune ligne
    // réussit : sans ce témoin, supprimer un engagé dans un autre onglet ferait afficher un
    // pointage réussi qui n'a rien pointé (piège « un 200 annoncé comme succès », CLAUDE.md §7).
    if (!ligne) return { ok: false, error: "Cet engagé n'existe plus. Rechargez la page." };

    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[pointerEngage] Échec du pointage :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Supprime un engagé — refusé dès qu'il occupe une place de rencontre.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE REFUS APPARTIENT À LA BASE, CETTE FONCTION NE FAIT QUE LE RENDRE LISIBLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `tournament_match_slot.entry_id` est en `ON DELETE RESTRICT` (Story 10.1) : un engagé qui a
 * joué ne se supprime pas, sinon sa place deviendrait silencieusement une exemption et
 * réécrirait l'histoire. Re-tester la condition ici en ferait une **seconde** définition du
 * refus, qui divergerait au premier changement de modèle — et c'est la version applicative,
 * la plus faible, qu'on croirait.
 *
 * 🔴 LE `23503` EST TRADUIT **AVANT** `messageErreurBase`, ET C'EST NÉCESSAIRE. Le traducteur
 * partagé rend, pour ce code, *« L'élément choisi n'existe plus. Rechargez la page et
 * choisissez-en un autre. »* — vrai quand une clé étrangère pointe vers une ligne disparue
 * (son cas d'origine : un bar supprimé dans un autre onglet), et **faux ici**, où c'est
 * l'inverse : la ligne existe, et c'est justement ce qui bloque. Laisser passer ce message
 * enverrait recharger une page qui affiche exactement la même chose.
 */
export async function supprimerEngage(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(tournamentEntry)
      .where(eq(tournamentEntry.id, id))
      .returning({ id: tournamentEntry.id });

    if (!ligne) return { ok: false, error: "Cet engagé a déjà été supprimé." };

    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerEngage] Échec de la suppression :", erreur);

    const code = (erreur as { code?: string }).code;
    if (code === "23503") {
      return {
        ok: false,
        error:
          "Cet engagé figure déjà dans une rencontre : il ne se supprime plus. " +
          "Marquez-le « a abandonné » — ses points et ses manches restent au classement, " +
          "et les parties où ses adversaires l'ont rencontré gardent un sens.",
      };
    }

    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Pointe un engagé POUR UNE JOURNÉE (2026-08-24) — le cas des tournois sur plusieurs
 * week-ends, où l'état global écrasait le pointage de la semaine précédente.
 *
 * 🔴 UN ABANDON RESTE GLOBAL, ET IL EST ÉCRIT SUR L'ENGAGÉ, PAS SUR LA JOURNÉE. Qui arrête
 * n'arrête pas « pour le samedi » : le noter par journée laisserait écrire « abandonné le 12,
 * présent le 19 », c'est-à-dire deux vérités. `presence.ts` fait d'ailleurs primer l'abandon
 * sur tout pointage — les deux moitiés de la règle doivent rester d'accord.
 *
 * ⚠️ `onConflictDoUpdate` et non un `insert` : repointer quelqu'un MET À JOUR sa ligne du
 * jour. Sans ça, l'index unique refuserait le deuxième clic — et corriger un pointage est
 * exactement ce qu'on fait le jour J.
 */
async function pointerLaJournee(
  id: string,
  etat: EntryState,
  jour: string,
): Promise<ResultatAction<undefined>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
    return { ok: false, error: "Cette journée n'est pas valide. Rechargez la page." };
  }

  try {
    // L'abandon ne se range pas dans une journée : il vaut pour la suite du tournoi.
    if (etat === "abandonne" || etat === "inscrit") {
      const [ligne] = await db
        .update(tournamentEntry)
        .set({ state: etat, updatedAt: new Date() })
        .where(eq(tournamentEntry.id, id))
        .returning({ id: tournamentEntry.id });
      if (!ligne) return { ok: false, error: "Cet engagé n'existe plus. Rechargez la page." };
      return { ok: true, data: undefined };
    }

    const [ligne] = await db
      .insert(tournamentEntryAttendance)
      .values({ entryId: id, playedOn: jour, state: etat })
      .onConflictDoUpdate({
        target: [tournamentEntryAttendance.entryId, tournamentEntryAttendance.playedOn],
        set: { state: etat, updatedAt: new Date() },
      })
      .returning({ id: tournamentEntryAttendance.id });

    // Même témoin que le pointage global : on vérifie l'EFFET, pas l'absence d'erreur.
    if (!ligne) return { ok: false, error: "Ce pointage n'a rien enregistré. Rechargez la page." };

    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[pointerLaJournee] Échec du pointage :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}
