import type { TournamentRegistrationState } from "../schemas/tournament";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA FICHE PROPOSE SUR UN TOURNOI EN MODE `interne` (Story 12.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **CETTE RÈGLE EST UN ORDRE DE CONDITIONS, ET C'EST EXACTEMENT CE QUI A PRODUIT UN DÉFAUT
 * RÉEL EN 9.3** — trouvé en revue, pas par une porte : la première version testait le mode avant
 * l'état, si bien qu'un tournoi affichait « Inscriptions : Fermées » suivi d'une invitation à
 * s'inscrire. Une suite de conditions dans un ternaire de JSX ne se relit pas et ne se teste pas ;
 * ici elle a un nom, une valeur de retour, et des tests qui figent l'ordre.
 *
 * ⚠️ **ELLE NE DÉCIDE DE RIEN CÔTÉ ÉCRITURE** — `actions/inscription.ts` relit toutes ces
 * conditions en base, sous verrou. Celle-ci ne fait que **dire ce qu'on affiche**. Les deux
 * doivent s'accorder, et c'est pourquoi elles sont écrites dans le même ordre à un détail près,
 * commenté sur chacune.
 *
 * ⚠️ **ELLE N'EST APPELÉE QUE SUR UN TOURNOI À VENIR ET EN MODE `interne`** : la section
 * « S'inscrire » n'existe pas sur un tournoi passé (elle y montre le podium), et le mode `mately`
 * a son propre bloc depuis la 9.3. Y ajouter ces deux conditions ferait deux propriétaires pour
 * la même question.
 */

export type EtatInscriptionEnLigne =
  /** La personne est déjà inscrite : on montre sous quel pseudo, et comment se retirer. */
  | { readonly cas: "inscrit" }
  /** Tout est ouvert, mais il faut un compte. Le bouton mène à la connexion. */
  | { readonly cas: "connexion" }
  /** On peut s'inscrire, ici et maintenant. */
  | { readonly cas: "formulaire" }
  /** On ne peut pas, et la phrase dit **pourquoi** — jamais un bouton éteint. */
  | { readonly cas: "indisponible"; readonly raison: string };

export type ConditionsInscription = {
  readonly registrationState: TournamentRegistrationState;
  readonly teamSize: number;
  /** `null` ⇒ aucun nombre de places annoncé, donc rien à borner (jamais « zéro place »). */
  readonly capacity: number | null;
  readonly inscrits: number;
  readonly connecte: boolean;
  readonly dejaInscrit: boolean;
};

export function etatInscriptionEnLigne(
  conditions: ConditionsInscription,
): EtatInscriptionEnLigne {
  /**
   * 🔴 **« DÉJÀ INSCRIT » PASSE AVANT TOUT LE RESTE, ET CE N'EST PAS UN RACCOURCI.** Quelqu'un
   * d'inscrit doit voir son inscription — et pouvoir la retirer — **même** quand les inscriptions
   * ont été refermées entre-temps, ou que le tournoi affiche complet. Tester la disponibilité
   * d'abord ferait disparaître le bouton d'annulation au moment précis où il sert : c'est le
   * motif « une porte d'entrée sans porte de sortie ».
   */
  if (conditions.dejaInscrit) return { cas: "inscrit" };

  if (conditions.registrationState === "completes") {
    return { cas: "indisponible", raison: "Toutes les places annoncées sont prises." };
  }
  if (conditions.registrationState !== "ouvertes") {
    return {
      cas: "indisponible",
      raison: "Les inscriptions ne sont pas encore ouvertes pour ce tournoi.",
    };
  }

  // 🔴 A9 TIENT : les équipes passent par MATELY. Le dire est le livrable — un formulaire absent
  // sans explication se lit comme une panne.
  if (conditions.teamSize > 1) {
    return {
      cas: "indisponible",
      raison:
        "Ce tournoi se joue en équipe : l'inscription se fait auprès de nous, écrivez-nous ou passez sur le Discord.",
    };
  }

  /**
   * 🔴 **LE « COMPLET » SE DÉRIVE DU DÉCOMPTE, ON N'ÉCRIT JAMAIS `registration_state`.** Un
   * drapeau tenu à la main dérive de ce qu'il prétend décrire — leçon payée en 6.13 sur un
   * sous-total recalculé. Les deux sources ne se contredisent pas pour autant : `completes` dit
   * ce que le bénévole a **décidé** (traité plus haut), le décompte dit ce qui **est**.
   * ⚠️ `capacity === null` ne veut pas dire zéro place : il veut dire qu'aucun nombre n'est
   * annoncé, donc qu'il n'y a rien à borner (même famille que `price_text` absent, qui ne veut
   * pas dire « gratuit »).
   */
  if (conditions.capacity !== null && conditions.inscrits >= conditions.capacity) {
    return { cas: "indisponible", raison: "Toutes les places sont prises." };
  }

  /**
   * ⚠️ **LA CONNEXION SE TESTE EN DERNIER, ET L'ORDRE EST LE POINT.** Un anonyme devant un
   * tournoi complet doit lire « toutes les places sont prises », pas se voir proposer de créer un
   * compte pour découvrir ensuite qu'il n'y en a plus. On n'envoie personne se connecter pour
   * rien.
   */
  if (!conditions.connecte) return { cas: "connexion" };

  return { cas: "formulaire" };
}

/**
 * Combien de places restent annoncées — `null` quand aucune capacité n'est saisie.
 *
 * ⚠️ **JAMAIS NÉGATIF** : le bénévole peut saisir à la main au-delà de la capacité (10.5), et
 * c'est légitime — il a la salle sous les yeux. « −3 places » serait un chiffre faux affiché au
 * public ; zéro est vrai dans les deux cas.
 */
export function placesRestantes(capacity: number | null, inscrits: number): number | null {
  if (capacity === null) return null;
  return Math.max(0, capacity - inscrits);
}
