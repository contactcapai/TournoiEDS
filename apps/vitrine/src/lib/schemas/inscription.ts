import { z } from "zod";

import { NOM_MEMBRE_MAX } from "./engage";
import { texteNettoye } from "./texte";

/**
 * Ce qu'un joueur saisit pour s'inscrire depuis le site (Story 12.3).
 *
 * 🔴 **UN SEUL CHAMP, ET CE N'EST PAS UNE VERSION APPAUVRIE DE `engageSaisie`.** Le formulaire du
 * bénévole (10.5) valide un **effectif** : combien de noms pour une équipe de `teamSize`. Ici la
 * question ne se pose pas — A9 tient, les équipes passent par MATELY, et l'action vérifie
 * `team_size = 1` **en base** avant d'écrire. `effectifConforme()` n'aurait donc rien à arbitrer,
 * et l'appeler pour la forme rendrait des messages qui parlent d'équipe à quelqu'un qui n'en a pas.
 *
 * ⚠️ **LES DEUX SURFACES ÉCRIVENT POURTANT LA MÊME CHOSE** — un `tournament_entry` **et** sa ligne
 * `tournament_entry_member` en position 1. Un engagé sans membre serait une structure que la 10.1
 * a refusé de modéliser, et le moteur la rencontrerait sans rien dire.
 *
 * ⚠️ **LA BORNE EST CELLE D'UN MEMBRE (40), PAS CELLE D'UN ENGAGÉ (60)** : ce qu'on saisit ici est
 * un **pseudo de joueur**, pas un nom d'équipe. Elle est importée et non recopiée — deux bornes
 * pour la même colonne divergeraient au premier ajustement (dette R37).
 */
export const inscriptionEnLigne = z.object({
  pseudo: texteNettoye
    .min(1, "Indiquez le pseudo sous lequel vous jouerez — c'est lui qui servira à vous inviter.")
    .max(NOM_MEMBRE_MAX, `Ce pseudo ne peut pas dépasser ${NOM_MEMBRE_MAX} caractères.`),
});

export type InscriptionEnLigne = z.infer<typeof inscriptionEnLigne>;
