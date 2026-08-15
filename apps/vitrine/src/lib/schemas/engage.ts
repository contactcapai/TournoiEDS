import { z } from "zod";

import { effectifConforme } from "../tournoi/structure";
import { texteNettoye, visiblementVide } from "./texte";

/**
 * Saisie d'un ENGAGÉ au back-office (Story 10.5).
 *
 * 🔴 CE MODULE EST LE PREMIER CONSOMMATEUR RÉEL DE `effectifConforme()`. Elle était écrite et
 * testée depuis la Story 10.1 sans qu'aucun chemin du produit ne l'appelle — donc sans qu'aucun
 * engagé ne puisse exister, donc sans que les Stories 10.1 à 10.4 soient atteignables. C'est la
 * raison d'être de cette story, et **la règle est APPELÉE, jamais réécrite** : une seconde
 * définition de l'effectif divergerait en silence de celle que le moteur consulte.
 *
 * ⚠️ L'individuel n'est pas un cas à part : c'est une équipe d'un membre (`teamSize` = 1). Un
 * second chemin de code « joueur seul » divergerait — décision de la 10.1, tenue ici. Seuls les
 * MESSAGES changent (voir `messageEffectif`), parce qu'un bénévole d'un tournoi individuel ne
 * doit jamais lire le mot « équipe ».
 */

/** Assez pour « Les Chevaliers de la Table Ronde », pas assez pour y écrire une phrase. */
export const NOM_ENGAGE_MAX = 60;
/** Un pseudo, pas une biographie. */
export const NOM_MEMBRE_MAX = 40;

/**
 * Ce qu'on lit quand l'effectif ne tombe pas juste — **laquelle des deux erreurs**, et
 * **combien** (AC 3).
 *
 * 🔴 « INCOMPLET » ET « TROP NOMBREUX » NE SE DISENT PAS PAREIL, et un message commun du genre
 * « effectif invalide » obligerait à recompter à la main pour savoir dans quel sens corriger.
 * C'est la même doctrine que `AtelierActions` (6.9) sur « retirer » / « supprimer » : deux
 * situations que tout oppose ne partagent pas un libellé.
 *
 * ⚠️ EN INDIVIDUEL, LE MOT « ÉQUIPE » N'APPARAÎT JAMAIS. `teamSize = 1` est le cas nominal de
 * ce projet (aucun tournoi n'a d'autre valeur à ce jour), et parler d'équipe à quelqu'un qui
 * saisit des joueurs de TFT ferait chercher un champ qui n'existe pas.
 */
export function messageEffectif(nombreDeMembres: number, teamSize: number): string {
  if (teamSize === 1) {
    return nombreDeMembres === 0
      ? "Indiquez le nom du joueur."
      : `Ce tournoi se joue en individuel : un seul nom par engagé. Vous en avez saisi ${nombreDeMembres}.`;
  }

  const ecart = teamSize - nombreDeMembres;
  if (ecart > 0) {
    return (
      `Il manque ${ecart} joueur${ecart > 1 ? "s" : ""} : une équipe de ce tournoi compte ` +
      `exactement ${teamSize} joueurs, vous en avez saisi ${nombreDeMembres}. ` +
      "Une équipe incomplète ne peut pas être enregistrée."
    );
  }

  const trop = -ecart;
  return (
    `Il y a ${trop} joueur${trop > 1 ? "s" : ""} de trop : une équipe de ce tournoi compte ` +
    `exactement ${teamSize} joueurs, vous en avez saisi ${nombreDeMembres}.`
  );
}

/**
 * Un nom de joueur. `texteNettoye` (Story 7.8) et jamais `z.string().trim()` : c'est le point
 * d'entrée unique de tout texte saisi, et c'est lui qui retire les invisibles COLLÉS à une
 * valeur visible (dette R41, sept copies divergentes).
 */
const nomDeMembre = texteNettoye
  .min(1, "Donnez un nom à ce joueur.")
  .max(NOM_MEMBRE_MAX, `Le nom d'un joueur ne peut pas dépasser ${NOM_MEMBRE_MAX} caractères.`);

/**
 * Les noms saisis, **les cases vides écartées avant qu'on ne compte**.
 *
 * 🔴 SANS CE FILTRE, L'EFFECTIF NE PARLERAIT JAMAIS. Le formulaire rend `teamSize` champs : en
 * laisser un vide produirait une erreur « donnez un nom à ce joueur » sur la case, et la règle
 * d'effectif — celle qui dit « il en manque 2 » — ne serait pas atteinte. Or c'est elle qui
 * porte l'AC 3, et c'est elle qui appelle `effectifConforme()`.
 *
 * ⚠️ UNE CASE `visiblementVide` COMPTE COMME ABSENTE, jamais comme une erreur de saisie : un
 * copier-coller qui n'a laissé qu'un U+200B doit se comporter comme une case qu'on n'a pas
 * remplie. Même sémantique que `texteOptionnel` (`schemas/texte.ts`).
 *
 * 🔴 `texteNettoye` PASSE **AVANT** `visiblementVide`, ET L'ORDRE EST UNE GARDE — défaut trouvé
 * par le test de cette story avant toute autre porte. `visiblementVide` ne ROGNE PAS : elle ne
 * retire que les caractères sans largeur (`lib/text.ts`). Une case remplie de trois espaces en
 * ressort donc « non vide », traversait ce filtre, et se faisait refuser par `min(1)` avec
 * « donnez un nom à ce joueur » — un message vrai mais qui ne dit PAS qu'il manque un joueur,
 * c'est-à-dire l'AC 3 manquée. C'est exactement l'ordre que `texteOptionnel` tient déjà.
 */
const membresSaisis = z
  .array(texteNettoye)
  .transform((noms) => noms.filter((nom) => !visiblementVide(nom)))
  .pipe(z.array(nomDeMembre));

/**
 * ⚠️ UNE FABRIQUE, ET PAS UN SCHÉMA CONSTANT : l'effectif attendu est une donnée du TOURNOI.
 * 🔴 Son argument vient de la BASE, jamais du formulaire — un `teamSize` posté par le client
 * laisserait n'importe qui choisir la règle à laquelle il se soumet (voir `actions/engages.ts`).
 */
export const engageSaisie = (teamSize: number) =>
  z.object({
    displayName: texteNettoye
      .min(1, "Donnez un nom à cet engagé — c'est ce qui s'affichera sur le tableau.")
      .max(NOM_ENGAGE_MAX, `Le nom ne peut pas dépasser ${NOM_ENGAGE_MAX} caractères.`),
    membres: membresSaisis.superRefine((membres, ctx) => {
      if (!effectifConforme(membres.length, teamSize)) {
        ctx.addIssue({ code: "custom", message: messageEffectif(membres.length, teamSize) });
      }
    }),
  });

export type EngageSaisie = z.infer<ReturnType<typeof engageSaisie>>;
