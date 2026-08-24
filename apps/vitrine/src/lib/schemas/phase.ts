import { z } from "zod";

import { ajouterJours } from "../date-paris";
import { PHASE_KINDS, type PhaseKind } from "../tournoi/structure";
import { texteNettoye } from "./texte";

/** Assez pour « Poule A — qualifications du samedi », pas assez pour y écrire un règlement. */
export const NOM_PHASE_MAX = 80;

/**
 * Ce jour existe-t-il vraiment ? Vérification par ALLER-RETOUR : on construit la date, puis on
 * relit ses trois composants.
 *
 * 🔴 `Date.parse()` NE SUFFIT PAS, ET LE PREMIER JET DE CETTE RÈGLE S'EST FAIT PRENDRE.
 * Mesuré le 2026-08-24 : `Date.parse("2026-02-31T12:00:00Z")` est **accepté** — JavaScript
 * normalise silencieusement au 3 mars —, et `"2026-02-29"` aussi, alors que 2026 n'est pas
 * bissextile. Seul `"2026-13-01"` était refusé. La validation laissait donc passer exactement
 * les fautes de frappe qu'elle visait, et Postgres les aurait refusées ensuite par une erreur
 * BRUTE de driver, en anglais, après la saisie.
 */
function jourReel(valeur: string): boolean {
  const [annee, mois, jour] = valeur.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
  );
}

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
  /**
   * Le JOUR où cette phase se joue — « 2026-09-06 », jamais un instant.
   *
   * 🔴 UNE CHAÎNE, ET ELLE LE RESTE DE BOUT EN BOUT. La colonne est un `date` en
   * `mode: "string"` : rien ici ne construit de `Date`, donc aucun fuseau ne peut décaler la
   * journée d'un cran. C'est la parade au piège que `lib/date-paris.ts` documente, obtenue en
   * ne posant jamais le problème.
   * ⚠️ Facultative : un tournoi qui tient sur une journée n'a rien à saisir. Vide ⇒ `null`,
   * jamais la chaîne « ».
   */
  playedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez le jour au format JJ/MM/AAAA.")
    .refine(jourReel, {
      message: "Ce jour n'existe pas — vérifiez le mois et le quantième.",
    })
    .nullable()
    .default(null),
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
  suisse: "Manche suisse",
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
  lobbies: "Plusieurs joueurs par table, classés à chaque manche. Un premier tour.",
  suisse:
    "Comme les lobbies, mais les tables se refont d’après le CLASSEMENT : on rejoue contre son niveau. C’est le format des TFT sur plusieurs week-ends.",
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
  lobbies: "Première manche",
  suisse: "Manche suivante",
  finale: "Finale",
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * L'ASSISTANT — un déroulé TFT complet en une fois (2026-08-24)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 IL EXISTE PARCE QUE LE CAS RÉEL DE BRICE DEMANDAIT 8 À 12 SAISIES À LA MAIN. Un TFT en
 * rondes suisses sur quatre week-ends, c'est quatre journées de deux ou trois manches : dans
 * une liste plate, ça se crée une phase à la fois, en nommant chacune et en n'oubliant aucune
 * date. « Ça semble compliqué » — et c'était exact.
 *
 * ⚠️ L'ASSISTANCE PRÉ-REMPLIT, UN HUMAIN VALIDE (arbitrage du 2026-08-13). Ce qu'elle pose est
 * un déroulé ORDINAIRE : chaque phase se renomme, se déplace et se supprime ensuite comme si
 * elle avait été saisie à la main. Rien ici ne crée d'objet spécial.
 */

/** Au-delà, ce n'est plus un tournoi d'association — et ça borne le nombre d'écritures. */
export const JOURNEES_MAX = 12;
export const MANCHES_PAR_JOURNEE_MAX = 6;
/** Garde-fou de volume : 12 × 6 ferait 72 phases d'un seul clic. */
export const PHASES_POSEES_MAX = 24;

export const derouleTypeSaisi = z
  .object({
    journees: z
      .number({ error: "Le nombre de journées doit être un nombre, en chiffres." })
      .int("Le nombre de journées doit être un nombre entier.")
      .min(1, "Il faut au moins une journée.")
      .max(JOURNEES_MAX, `Pas plus de ${JOURNEES_MAX} journées.`),
    manchesParJournee: z
      .number({ error: "Le nombre de manches doit être un nombre, en chiffres." })
      .int("Le nombre de manches doit être un nombre entier.")
      .min(1, "Il faut au moins une manche par journée.")
      .max(MANCHES_PAR_JOURNEE_MAX, `Pas plus de ${MANCHES_PAR_JOURNEE_MAX} manches par journée.`),
    /** Le jour de la PREMIÈRE journée. Les suivantes tombent de semaine en semaine. */
    premierJour: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Indiquez le jour au format JJ/MM/AAAA.")
      .refine(jourReel, { message: "Ce jour n'existe pas — vérifiez le mois et le quantième." })
      .nullable()
      .default(null),
    /** Une dernière phase `finale`, jouée le jour de la dernière journée. */
    finale: z.boolean().default(false),
  })
  .superRefine((valeurs, ctx) => {
    const total = valeurs.journees * valeurs.manchesParJournee + (valeurs.finale ? 1 : 0);
    if (total > PHASES_POSEES_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["journees"],
        message:
          `Cela ferait ${total} phases d'un coup, et c'est plus que ce qu'un déroulé lisible ` +
          `supporte (${PHASES_POSEES_MAX} au maximum). Réduisez le nombre de journées ou de manches.`,
      });
    }
  });

export type DerouleTypeSaisi = z.infer<typeof derouleTypeSaisi>;

/**
 * Le déroulé que l'assistant POSERAIT, sans rien écrire — c'est lui qui sert à la fois à
 * l'aperçu montré avant de valider et à l'écriture.
 *
 * 🔴 UNE SEULE DÉFINITION POUR LES DEUX, ET C'EST LE POINT. Un aperçu calculé à part de
 * l'écriture finirait par mentir : on validerait ce qu'on a lu, et autre chose serait écrit.
 *
 * ⚠️ LA PREMIÈRE MANCHE EST DES `lobbies`, LES SUIVANTES DU `suisse`. Une manche suisse se
 * compose d'après le classement ; à la toute première, il n'y a pas de classement — les tables
 * partent de l'ordre de saisie. Confondre les deux ne « décale » pas le tournoi, ça le rend
 * non suisse.
 */
export function derouleType(saisie: DerouleTypeSaisi): { name: string; kind: PhaseKind; playedOn: string | null }[] {
  const phases: { name: string; kind: PhaseKind; playedOn: string | null }[] = [];
  const uneSeuleManche = saisie.manchesParJournee === 1;

  for (let journee = 1; journee <= saisie.journees; journee += 1) {
    const jour = saisie.premierJour === null ? null : ajouterJours(saisie.premierJour, (journee - 1) * 7);
    for (let manche = 1; manche <= saisie.manchesParJournee; manche += 1) {
      const premiereDeToutes = journee === 1 && manche === 1;
      phases.push({
        name: uneSeuleManche ? `Journée ${journee}` : `Journée ${journee} — manche ${manche}`,
        kind: premiereDeToutes ? "lobbies" : "suisse",
        playedOn: jour,
      });
    }
  }

  if (saisie.finale) {
    const dernier =
      saisie.premierJour === null ? null : ajouterJours(saisie.premierJour, (saisie.journees - 1) * 7);
    phases.push({ name: "Finale", kind: "finale", playedOn: dernier });
  }

  return phases;
}
