import { z } from "zod";

import { PHASE_KINDS } from "../tournoi/structure";
import { texteNettoye } from "./texte";

/** Assez pour « Poule A — qualifications du samedi », pas assez pour y écrire un règlement. */
export const NOM_PHASE_MAX = 80;

/**
 * Saisie d'une phase au back-office (Story 10.4).
 *
 * ⚠️ La NATURE n'est pas modifiable après coup, et ce n'est pas une limitation technique :
 * changer la nature d'une phase déjà générée invaliderait ses rencontres. On supprime la
 * phase et on la recrée — ce que le tableau autorise tant qu'aucun résultat n'existe.
 */
export const phaseSaisie = z.object({
  name: texteNettoye
    .min(1, "Donnez un nom à cette phase — c'est ce que les joueurs liront.")
    .max(NOM_PHASE_MAX, `Le nom ne peut pas dépasser ${NOM_PHASE_MAX} caractères.`),
  kind: z.enum(PHASE_KINDS, {
    message: "Choisissez le format de cette phase.",
  }),
});

export type PhaseSaisie = z.infer<typeof phaseSaisie>;

/**
 * Ce qu'un bénévole lit, plutôt que la valeur technique.
 *
 * 🔴 RACCOURCIS EN 10.9, ET LES TROIS ÉCRANS Y GAGNENT. Ils portaient le nom ET son
 * explication collés par un tiret (« Lobbies — plusieurs joueurs par table, au classement »),
 * ce qui donnait des onglets illisibles au jour J et un titre « Générer — Lobbies — plusieurs
 * joueurs… ». Une explication n'est utile qu'au moment du CHOIX : elle vit donc dans
 * `AIDE_NATURE`, et le libellé redevient un nom.
 */
export const LIBELLE_NATURE: Record<(typeof PHASE_KINDS)[number], string> = {
  poule: "Poule",
  bracket: "Tableau",
  lobbies: "Lobbies",
  finale: "Finale",
};

/**
 * La phrase qui aide à CHOISIR, lue une fois — au moment de composer le déroulé.
 *
 * ⚠️ Elle dit ce que la phase FAIT AUX JOUEURS, pas comment le moteur la calcule : la
 * personne qui compose un tournoi pense « chacun rencontre chacun », pas « round-robin ».
 */
export const AIDE_NATURE: Record<(typeof PHASE_KINDS)[number], string> = {
  poule: "Chacun rencontre chacun. On classe aux victoires.",
  bracket: "On s'affronte deux à deux, le perdant sort. Simple ou double élimination.",
  lobbies: "Plusieurs joueurs par table, classés à chaque manche. Le format TFT.",
  finale: "La dernière manche, entre les qualifiés des phases précédentes.",
};

/**
 * Le nom proposé quand on choisit ce format — l'assistance PRÉ-REMPLIT, un humain VALIDE
 * (arbitrage du 2026-08-13). ⚠️ Ce n'est pas un défaut imposé : dès que la personne écrit
 * dans le champ, la proposition cesse de le suivre (même patron que l'adresse dérivée du
 * nom dans `TournoiForm`, et pour la même raison — écraser une saisie est le geste le plus
 * frustrant qu'un formulaire puisse produire).
 */
export const NOM_SUGGERE: Record<(typeof PHASE_KINDS)[number], string> = {
  poule: "Poule A",
  bracket: "Tableau final",
  lobbies: "Lobbies",
  finale: "Finale",
};
