"use server";

import { eq } from "drizzle-orm";

import { inscriptionEnLigne } from "../../lib/schemas/inscription";
import { exigerConnexionAction } from "../auth/guard";
import { db } from "../db/client";
import {
  compterEngagesDansTransaction,
  retirerMonInscription,
} from "../db/queries/inscription";
import { tournament, tournamentEntry, tournamentEntryMember } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * S'INSCRIRE À UN TOURNOI DEPUIS LE SITE, ET S'EN RETIRER (Story 12.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **`exigerConnexionAction`, PAS UN RÔLE** — patron de `venues.ts` (12.2) : c'est le geste d'un
 * participant, et c'est la deuxième vraie raison d'avoir un compte ici.
 *
 * 🔴 **TOUTES LES CONDITIONS DE LA FICHE SONT RELUES ICI, ET AUCUNE N'EST REDONDANTE.** Une Server
 * Action est un POST atteignable directement : l'écran qui n'affiche le formulaire que sur un
 * tournoi publié, ouvert, individuel et à venir ne **garde** rien du tout. La règle du dépôt est
 * écrite depuis la 12.2 : *« la garde ne peut pas vivre dans l'écran »*.
 *
 * ⚠️ **DEUX ACTIONS, PAS UNE BASCULE** — et c'est l'inverse du choix de `basculerMaVenue`, pour
 * une raison qui tient : s'inscrire **porte une donnée** (le pseudo sous lequel on jouera), s'en
 * retirer non. Une bascule qui prendrait un pseudo pour parfois l'ignorer serait un piège de
 * lecture. Le risque que la bascule évitait — deux onglets qui se trompent d'état — est ici fermé
 * **en base** : l'index unique refuse la seconde inscription, et le `DELETE` porte sa condition
 * dans son `WHERE`.
 */

/** Les `CHECK` que Zod devrait avoir devancés, traduits pour un joueur et non pour un bénévole. */
const CONTRAINTES: Record<string, string> = {
  tournament_entry_display_name_non_blanc: "Ce pseudo n'est pas lisible, reprenez-le.",
  tournament_entry_member_display_name_non_blanc: "Ce pseudo n'est pas lisible, reprenez-le.",
};

/**
 * S'inscrire. Rend le pseudo enregistré, pour que l'écran affiche l'état réel sans relire.
 *
 * 🔴 **LE VERROU EST LE CŒUR DE CETTE FONCTION.** Décider « il reste une place » puis écrire est un
 * *check-then-act* : deux inscriptions simultanées lisent le même décompte et dépassent la
 * capacité **sans erreur, sans trace, et invisiblement en mono-utilisateur** — le motif exact de
 * `pieges/concurrence-lock.md`, dont la parade est de rendre l'opération atomique en base.
 * ⇒ `SELECT … FOR UPDATE` sur la **ligne du tournoi** sérialise les inscriptions concurrentes au
 * même tournoi, et le décompte se lit **dans** la transaction ainsi verrouillée.
 * ⚠️ Verrouiller le tournoi et non les engagés : on protège une **décision** (« reste-t-il une
 * place ? »), pas des lignes existantes — et les lignes à compter n'existent pas encore.
 */
export async function sInscrireAuTournoi(
  tournoiId: string,
  donnees: FormData,
): Promise<ResultatAction<{ pseudo: string }>> {
  const compte = await exigerConnexionAction();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  const analyse = inscriptionEnLigne.safeParse({ pseudo: donnees.get("pseudo") });
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Vérifiez la saisie.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  const { pseudo } = analyse.data;

  try {
    const refus = await db.transaction(async (tx) => {
      const [tournoi] = await tx
        .select({
          id: tournament.id,
          startsAt: tournament.startsAt,
          teamSize: tournament.teamSize,
          capacity: tournament.capacity,
          registrationMode: tournament.registrationMode,
          registrationState: tournament.registrationState,
          isPublished: tournament.isPublished,
        })
        .from(tournament)
        .where(eq(tournament.id, tournoiId))
        .limit(1)
        .for("update");

      // ⚠️ **UN BROUILLON RÉPOND COMME UN TOURNOI INEXISTANT**, jamais « vous n'avez pas le
      // droit » : un refus qui distingue les deux apprend au curieux qu'un tournoi se prépare
      // sous cet identifiant. Patron `/medias/[filename]` (6.4), tenu partout dans ce dépôt.
      if (!tournoi || !tournoi.isPublished) {
        return "Ce tournoi n'existe plus. Rechargez la page.";
      }

      // ⚠️ **MÊME FRONTIÈRE QUE PARTOUT AILLEURS** (`<=`, donc un tournoi pile à `now()` est
      // commencé) : il n'y a qu'une seule définition de « à venir » dans ce dépôt, et une action
      // qui divergerait de la fiche qui l'a proposée serait indiagnosticable.
      if (tournoi.startsAt <= new Date()) {
        return "Ce tournoi a déjà commencé — passez nous voir sur place ou écrivez-nous.";
      }

      /**
       * 🔴 **LE MODE SE TESTE AVANT L'ÉTAT, ET C'EST L'INVERSE DE LA FICHE** — les deux ont
       * raison, parce qu'ils ne répondent pas à la même question. La fiche dit au visiteur *ce
       * qui est* : l'état d'abord, sinon elle propose une porte sous une étiquette qui dit
       * l'inverse (défaut réel, corrigé en revue de la 9.3). Ici on dit *pourquoi ce POST est
       * refusé* : sur un tournoi `mately`, répondre « les inscriptions sont fermées » serait
       * **faux** — elles peuvent être grandes ouvertes, mais ailleurs.
       */
      if (tournoi.registrationMode !== "interne") {
        return "Les inscriptions de ce tournoi ne se prennent pas ici — voyez le bouton sur sa page.";
      }

      if (tournoi.registrationState === "completes") {
        return "Toutes les places annoncées sont prises.";
      }
      if (tournoi.registrationState !== "ouvertes") {
        return "Les inscriptions ne sont pas ouvertes pour le moment.";
      }

      // 🔴 **A9 TIENT : LES ÉQUIPES RESTENT CHEZ MATELY** (arbitrage confirmé le 2026-08-25).
      // Inscrire une équipe demanderait de saisir `teamSize` coéquipiers qui n'ont pas de compte,
      // et de décider qui les représente — un sujet entier, pas une variante de formulaire.
      if (tournoi.teamSize > 1) {
        return "Ce tournoi se joue en équipe : l'inscription se fait auprès de nous.";
      }

      /**
       * 🔴 **LA CAPACITÉ BORNE, ET ELLE NE BORNE QUE SI ELLE EST RENSEIGNÉE.** `capacity` est
       * nullable : `null` veut dire « on n'annonce pas de nombre de places », pas « zéro ». En
       * déduire une limite serait affirmer un fait qu'on n'a pas — même famille que le
       * `price_text` absent, qui ne veut pas dire « gratuit ».
       * ⚠️ **Le bénévole, lui, n'est pas borné** : sa saisie (10.5) ne passe pas par ici. C'est
       * voulu — il a la salle sous les yeux, et c'est lui qui décide d'ajouter une chaise.
       */
      if (tournoi.capacity !== null) {
        const inscrits = await compterEngagesDansTransaction(tx, tournoiId);
        if (inscrits >= tournoi.capacity) {
          return "Toutes les places sont prises.";
        }
      }

      const [ligne] = await tx
        .insert(tournamentEntry)
        .values({
          tournamentId: tournoiId,
          displayName: pseudo,
          userId: compte.utilisateurId,
          // `externalId` reste NULL : cette inscription a été prise ICI. C'est ce que
          // `retirerMonInscription` regarde pour savoir qu'elle peut l'annuler.
        })
        .returning({ id: tournamentEntry.id });

      // ⚠️ **LE MEMBRE EN POSITION 1 N'EST PAS UNE FORMALITÉ** : un engagé sans membre est la
      // structure que la 10.1 a refusé de modéliser, et le moteur la rencontrerait en silence.
      // `position` commence à 1 — `tournament_entry_member_position_positive` refuse 0.
      await tx.insert(tournamentEntryMember).values({
        entryId: ligne.id,
        position: 1,
        displayName: pseudo,
      });

      return null;
    });

    if (refus !== null) return { ok: false, error: refus };
    return { ok: true, data: { pseudo } };
  } catch (erreur) {
    /**
     * 🔴 **LE `23505` EST TRAITÉ ICI ET PAS PAR LE TRADUCTEUR COMMUN**, parce qu'il n'est pas une
     * anomalie : c'est **la garde de course qui fonctionne**. `tournament_entry_compte_unique`
     * tire quand un second onglet, ou un double clic, écrit pendant que le premier écrivait.
     * Le message générique — « cet élément existe déjà, rechargez la page » — parlerait d'un
     * « élément » à quelqu'un qui vient de s'inscrire deux fois.
     */
    const details = erreur as { code?: string };
    if (details.code === "23505") {
      return { ok: false, error: "Vous êtes déjà inscrit à ce tournoi." };
    }

    console.error("[sInscrireAuTournoi] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Annuler sa propre inscription.
 *
 * 🔴 **AUCUNE LECTURE PRÉALABLE DE L'INSCRIPTION** : la condition vit dans le `WHERE` du `DELETE`
 * (`retirerMonInscription`), donc deux onglets ne peuvent pas supprimer deux fois, et personne ne
 * peut retirer la ligne d'un autre. Lire puis supprimer rouvrirait la fenêtre qu'on vient de
 * fermer côté inscription.
 *
 * ⚠️ **LA VRAIE GARDE EST CELLE DE LA BASE, ET ON LA TRADUIT AU LIEU DE LA DOUBLER.** Dès qu'une
 * place de rencontre existe, `ON DELETE RESTRICT` (10.1) refuse — même sur une rencontre pas
 * encore jouée. Une garde applicative qui compterait « la rencontre a-t-elle un résultat »
 * divergerait de celle qui tranche vraiment, et afficherait « annulable » sur une ligne que la
 * base refuse (raisonnement écrit mot pour mot dans `queries/engages.ts`).
 */
export async function meDesinscrireDuTournoi(
  tournoiId: string,
): Promise<ResultatAction<undefined>> {
  const compte = await exigerConnexionAction();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  /**
   * ⚠️ **ON NE RELIT NI LA PUBLICATION NI L'ÉTAT DES INSCRIPTIONS, ET C'EST RAISONNÉ.** Se
   * retirer de sa propre inscription ne divulgue rien et ne remplit aucune place : les refuser
   * sur un tournoi dépublié ou refermé enfermerait quelqu'un dans une liste dont il veut sortir,
   * c'est-à-dire créerait une porte d'entrée sans porte de sortie. La seule limite qui compte est
   * celle de la base — une place déjà tirée.
   */
  try {
    const retirees = await retirerMonInscription(tournoiId, compte.utilisateurId);

    if (retirees === 0) {
      // Deux causes, une seule phrase vraie pour les deux : l'inscription n'existe plus (annulée
      // dans un autre onglet), ou elle ne vient pas d'ici (`external_id` renseigné ⇒ MATELY fait
      // foi jusqu'au pointage, l'annuler chez nous serait réécrit à la re-synchro).
      return {
        ok: false,
        error: "Cette inscription n'a pas été prise sur ce site — écrivez-nous pour l'annuler.",
      };
    }

    return { ok: true, data: undefined };
  } catch (erreur) {
    const details = erreur as { code?: string };
    if (details.code === "23503") {
      return {
        ok: false,
        error:
          "Votre place est déjà placée dans une rencontre : écrivez-nous, un bénévole s'en occupe.",
      };
    }

    console.error("[meDesinscrireDuTournoi] Échec de la suppression :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}
