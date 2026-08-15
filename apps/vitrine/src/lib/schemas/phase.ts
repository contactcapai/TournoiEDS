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

/** Ce qu'un bénévole lit, plutôt que la valeur technique. */
export const LIBELLE_NATURE: Record<(typeof PHASE_KINDS)[number], string> = {
  poule: "Poule — chacun rencontre chacun",
  bracket: "Tableau à élimination",
  lobbies: "Lobbies — plusieurs joueurs par table, au classement",
  finale: "Finale",
};
