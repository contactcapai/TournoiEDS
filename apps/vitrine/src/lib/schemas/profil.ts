import { z } from "zod";

import { texteNettoye } from "./texte";

/**
 * Le profil d'un joueur (Story 12.1).
 *
 * 🔴 **CINQ CHAMPS, TOUS FACULTATIFS, ET AUCUN N'EST UNE IDENTITÉ D'AUTHENTIFICATION.** Ce que
 * la personne déclare ici sert à la **joindre** et à la **reconnaître en jeu** ; ce qui prouve
 * qui elle est vit dans `account` (Auth.js) et n'est pas modifiable depuis un formulaire.
 *
 * ⚠️ **UN CHAMP VIDÉ DOIT REDEVENIR `null`, JAMAIS UNE CHAÎNE VIDE.** Un `""` en base passerait
 * les `CHECK` (ils ne se prononcent que sur les lignes non nulles), et l'écran afficherait un
 * pseudo vide au lieu de dire « non renseigné ». C'est le même défaut que l'effectif d'équipe
 * qui devait retomber sur 1 plutôt que sur `null` (2026-08-24) — pris dans l'autre sens.
 *
 * ⚠️ `texteNettoye` ET PAS `z.string().trim()` : `btrim` ne retire pas U+200B, et un champ fait
 * uniquement de caractères sans largeur doit compter comme **absent** (dette R41, Story 7.8).
 */

/** Un pseudo, pas une biographie — aligné sur `NOM_MEMBRE_MAX`. */
export const PSEUDO_MAX = 40;
/**
 * Un Riot ID va jusqu'à 16 caractères + `#` + 5 de tag ; les autres plateformes sont plus
 * courtes. On borne large et pareil pour les quatre : la borne est une garde contre le collage
 * d'un paragraphe, pas une validation de format.
 */
export const IDENTIFIANT_JEU_MAX = 64;

/**
 * ⚠️ **AUCUNE VALIDATION DE FORMAT, ET C'EST DÉLIBÉRÉ.** Un `Pseudo#TAG` paraît régulier, mais
 * Riot a changé la forme de ses identifiants une fois déjà, Steam en a trois (vanity URL, ID 64
 * bits, pseudo) et Epic n'en documente aucune. Une expression régulière refuserait un identifiant
 * VALIDE le jour où la plateforme bouge — et le refus tomberait sur la personne, pas sur nous.
 * Le bénévole qui invite en lobby verra tout de suite si l'identifiant est faux ; une regex, non.
 */
const identifiantDeJeu = texteNettoye
  .max(IDENTIFIANT_JEU_MAX, `Cet identifiant ne peut pas dépasser ${IDENTIFIANT_JEU_MAX} caractères.`)
  // 🔴 `""` → `undefined` AVANT le `.optional()` : un champ de formulaire vidé arrive comme une
  // chaîne vide, jamais comme `undefined`. Sans cette conversion, on écrirait `""` en base.
  .transform((valeur) => (valeur.length === 0 ? undefined : valeur))
  .optional();

export const profilSaisi = z.object({
  pseudo: texteNettoye
    .max(PSEUDO_MAX, `Le pseudo ne peut pas dépasser ${PSEUDO_MAX} caractères.`)
    .transform((valeur) => (valeur.length === 0 ? undefined : valeur))
    .optional(),
  discordPseudo: identifiantDeJeu,
  riotId: identifiantDeJeu,
  steamId: identifiantDeJeu,
  epicId: identifiantDeJeu,
});

export type ProfilSaisi = z.infer<typeof profilSaisi>;

/**
 * Les plateformes rendues par l'écran, **dans l'ordre d'affichage**.
 *
 * 🔴 **UNE SEULE LISTE POUR LE FORMULAIRE ET POUR LA LECTURE.** Deux énumérations recopiées
 * finiraient par ne plus s'accorder, et un champ ajouté d'un côté serait saisi sans jamais être
 * relu — c'est la leçon d'`estParTables` (10.10) appliquée à un formulaire.
 * ⚠️ `Record` exhaustif sur les clés du schéma : ajouter un champ sans libellé casse le typecheck.
 */
export const CHAMPS_PROFIL = [
  {
    cle: "pseudo",
    label: "Pseudo sur le site",
    aide: "Le nom sous lequel vous apparaissez ici. À défaut, on utilise celui de votre compte.",
  },
  {
    cle: "discordPseudo",
    label: "Pseudo Discord",
    aide: "Celui sous lequel on vous joint sur le Discord de l'association.",
  },
  {
    cle: "riotId",
    label: "Riot ID",
    aide: "Avec le tag (« Pseudo#EUW ») — c'est lui qui permet de vous inviter en lobby. LoL, Valorant, TFT, 2XKO.",
  },
  { cle: "steamId", label: "Steam", aide: "CS2, Rocket League…" },
  { cle: "epicId", label: "Epic Games", aide: "Fortnite, Rocket League…" },
] as const satisfies readonly { cle: keyof ProfilSaisi; label: string; aide: string }[];
