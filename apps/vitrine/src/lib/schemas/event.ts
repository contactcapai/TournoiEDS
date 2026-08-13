/**
 * Schéma de validation partagé d'un événement (AR-DB4).
 *
 * Vit sous `src/lib/` et non `src/server/` : il sera importé par le formulaire CLIENT du
 * back-office (Story 6.3) autant que par la Server Action qui écrit en base. Un seul
 * schéma des deux côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 CE FICHIER EST LA SOURCE DES VALEURS DE L'ENUM `event_type` : `schema.ts` importe
 * `EVENT_TYPES` d'ici pour construire le `pgEnum`. Le sens de la dépendance est celui-là
 * et pas l'inverse — importer `schema.ts` depuis un module que le client bundle ferait
 * entrer tout Drizzle dans le navigateur.
 *
 * 🔴 IL PORTE LA MÊME INVARIANTE QUE LA CONTRAINTE `event_has_venue` DE LA BASE :
 * un événement doit avoir un lieu identifiable, et un lieu vide n'est pas un lieu. La
 * base est le garde-fou qu'on ne peut pas contourner ; ce schéma est celui qui donne un
 * message utilisable à un bénévole. Si l'un des deux change, changer l'autre.
 */
import { z } from "zod";

import { instantAvecFuseau } from "./instant";
import { texteOptionnel, visiblementVide } from "./texte";

/**
 * Valeurs de l'enum `event_type`, **définies ici une seule fois**.
 *
 * ⚠️ `thursday` désigne le **format récurrent** — la soirée jeux hebdomadaire — et non une
 * contrainte de calendrier : une soirée peut être décalée (jour férié, salle indisponible)
 * sans cesser d'être « le jeudi » aux yeux du public. Aucune contrainte ne lie donc le
 * type au jour réel de `starts_at`, et c'est délibéré.
 */
export const EVENT_TYPES = ["thursday", "special"] as const;

const trimmedText = z.string().trim();

/**
 * 🔴 UN TEXTE FAIT DE CARACTÈRES INVISIBLES N'EST PAS UN TEXTE — AJOUTÉ APRÈS LA REVUE
 * DE LA STORY 6.3, ET C'ÉTAIT UN TROU RÉEL.
 *
 * `partner.ts` (4.1) et `photo.ts` (4.3) consomment `visiblementVide` depuis
 * `lib/schemas/texte.ts` ; **`event.ts` ne l'a jamais fait**, alors que le commentaire de
 * `event_venue_name_valide` dans `schema.ts` AFFIRMAIT que le cas était « traité côté Zod,
 * au point de saisie, identique à celui de `partner` ». Il ne l'était pas. Mesuré :
 *   `"".trim().length === 3`  ⇒  un titre de trois caractères
 *   invisibles passait `.min(3)`, et un `venueName` invisible n'était **pas** ramené à `null`.
 *
 * ⚠️ Les caractères sont écrits en ÉCHAPPEMENT ci-dessus, jamais en littéral — les coller
 * dans un commentaire rend celui-ci impossible à relire, et `no-irregular-whitespace` les
 * refuse. (Payé à l'écriture de ce bloc, exactement le piège qu'il décrit.)
 *
 * Conséquence la plus grave, et c'est l'invariant central du modèle : `.refine()` voyait un
 * `venueName` « renseigné », et `btrim()` côté base ne retire que l'espace ASCII — donc un
 * événement **sans bar et sans lieu lisible** était créable ET publiable. C'est exactement
 * ce que `event_has_venue` existe pour interdire (NFR8).
 *
 * ⚠️ La valeur n'est jamais NETTOYÉE, seulement jugée vide ou non : ZWJ et ZWNJ portent du
 * sens dans plusieurs écritures et dans les séquences d'emoji (voir `texte.ts`).
 */
const texteVisible = (message: string) =>
  trimmedText.refine((value) => !visiblementVide(value), message);

/**
 * 🔴 BORNES DE SAISIE — dette **R26**, soldée par la Story 6.3.
 *
 * Elles vivent ici, en un seul endroit, parce que **la base les redouble** (`CHECK` de
 * `schema.ts`) et que les deux valeurs doivent rester égales : les faire diverger
 * remonterait au bénévole une erreur brute du driver là où Zod avait un message.
 *
 * 🔴 ET ELLES SONT PLUS STRICTES QUE LES BORNES DE RENDU, PAS L'INVERSE. C'était le
 * défaut mesuré au cadrage de la 6.3 : `title` était borné à **120** ici alors que
 * `/agenda` tronque à **80** à l'affichage — un titre de 100 caractères passait la
 * validation puis se faisait couper, sans que personne ne le sache. Depuis, `TITRE_MAX`
 * et `RECAP_MAX` valent exactement les bornes de troncature de
 * `app/(public)/agenda/page.tsx` (`PAST_TITLE_MAX`, `RECAP_MAX`).
 *
 * ⚠️ Conséquence voulue : `truncate()` au rendu ne se déclenche **plus jamais** sur de la
 * donnée saisie. Il reste en place comme **filet** contre une écriture SQL directe, une
 * restauration de sauvegarde ou une migration de données — jamais retiré.
 * ⚠️ Si l'une de ces valeurs change, changer AUSSI le `CHECK` correspondant **et** la
 * borne de troncature du rendu. Les trois expriment la même règle.
 */
export const TITRE_MAX = 80;
export const RECAP_MAX = 240;
export const DESCRIPTION_MAX = 600;
export const JEUX_MAX = 120;
export const LIEU_NOM_MAX = 120;
export const LIEU_ADRESSE_MAX = 200;
export const BAR_NOM_MAX = 120;
export const BAR_ADRESSE_MAX = 200;
export const BAR_QUARTIER_MAX = 120;
export const BAR_VILLE_MAX = 80;

/**
 * 🔴 `texteOptionnel` A ÉTÉ EXTRAITE VERS `./texte.ts` PAR LA STORY 6.10 (dette R37 ①).
 *
 * Cette copie était la PLUS ANCIENNE des trois, et la seule à placer `.max()` **avant** le
 * `.transform()`. Conséquence mesurée : une chaîne de 300 caractères **invisibles** était
 * refusée ici comme « trop longue » alors que `partner.ts` et `workshop.ts` la traitaient
 * comme vide. C'est la version d'`event.ts` qui a changé — voir le bloc de `./texte.ts`,
 * qui explique pourquoi le nouveau comportement est le bon message et non une régression.
 *
 * ⚠️ Ne pas redéclarer une fabrique locale ici : ce fichier a déjà payé, en revue de la 6.3,
 * le trou d'une garde qu'il n'avait pas consommée (`visiblementVide`).
 */

/**
 * Identifiant optionnel. La chaîne vide est traitée comme « non renseigné » **avant** la
 * validation du format : un `<select>` dont l'option « aucun bar » porte `value=""`
 * doit déclencher le message sur le lieu, pas « identifiant invalide » — un bénévole ne
 * saurait pas quoi faire du second.
 */
const optionalUuid = trimmedText
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null)
  .refine((value) => value === null || z.uuid().safeParse(value).success, {
    message: "Identifiant de bar invalide.",
  });

/**
 * Instant de début.
 *
 * 🔴 LA GARDE DE FUSEAU A DÉMÉNAGÉ — STORY 9.1, ET LE MOTIF COMPTE.
 * Elle est née ici (Story 3.1, durcie en 6.3) parce qu'`event` était la seule table à porter
 * une date saisie. La table `tournament` en porte une aussi (arbitrage A1 : le tournoi a sa
 * PROPRE date, la Game'in Reims étant **un** événement portant **dix** animations à des heures
 * différentes). Deux consommateurs, donc **une** définition : elle vit désormais dans
 * `./instant.ts`, **déplacée verbatim**.
 * ⚠️ Ne pas la redéclarer ici « pour éviter un import » — ce serait la 2ᵉ copie d'une règle de
 * fuseau, et sa divergence serait **invisible en local** (le poste est à Paris, le conteneur
 * de production est en UTC). C'est exactement le mécanisme de la dette **R37**, où
 * `texteOptionnel` a vécu en trois exemplaires divergents pendant quatre stories.
 */
const startsAtSchema = instantAvecFuseau;

export const eventInputSchema = z
  .object({
    type: z.enum(EVENT_TYPES).default("thursday"),
    title: texteVisible("Le titre doit contenir des caractères visibles.")
      .min(3, "Le titre doit faire au moins 3 caractères.")
      .max(TITRE_MAX, `Le titre ne doit pas dépasser ${TITRE_MAX} caractères.`),
    /** Référence à un bar du roulement. `null` pour un temps fort hors bar. */
    barId: optionalUuid,
    /** Lieu libre, quand l'événement ne se tient pas dans un bar du roulement. */
    venueName: texteOptionnel(LIEU_NOM_MAX, "Le nom du lieu"),
    venueAddress: texteOptionnel(LIEU_ADRESSE_MAX, "L'adresse du lieu"),
    startsAt: startsAtSchema,
    games: texteOptionnel(JEUX_MAX, "La liste des jeux"),
    description: texteOptionnel(DESCRIPTION_MAX, "La description"),
    recap: texteOptionnel(RECAP_MAX, "Le compte-rendu"),
    isPublished: z.boolean().default(false),
  })
  .refine((value) => value.barId !== null || value.venueName !== null, {
    // Même règle que le CHECK `event_has_venue` en base. `optionalText` ayant déjà ramené
    // `''` à `null`, un lieu vide est bien traité comme absent des deux côtés.
    message: "Indiquez un bar du roulement ou le nom d'un lieu.",
    path: ["venueName"],
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export const barInputSchema = z.object({
  name: texteVisible("Le nom doit contenir des caractères visibles.")
    .min(2, "Le nom doit faire au moins 2 caractères.")
    .max(BAR_NOM_MAX, `Le nom ne doit pas dépasser ${BAR_NOM_MAX} caractères.`),
  address: texteVisible("L'adresse doit contenir des caractères visibles.")
    .min(5, "Adresse trop courte.")
    .max(BAR_ADRESSE_MAX, `L'adresse ne doit pas dépasser ${BAR_ADRESSE_MAX} caractères.`),
  district: texteVisible("Le quartier doit contenir des caractères visibles.")
    .min(2, "Quartier requis.")
    .max(BAR_QUARTIER_MAX, `Le quartier ne doit pas dépasser ${BAR_QUARTIER_MAX} caractères.`),
  city: texteVisible("La ville doit contenir des caractères visibles.")
    .min(2, "Ville requise.")
    .max(BAR_VILLE_MAX, `La ville ne doit pas dépasser ${BAR_VILLE_MAX} caractères.`)
    .default("Reims"),
});

export type BarInput = z.infer<typeof barInputSchema>;
