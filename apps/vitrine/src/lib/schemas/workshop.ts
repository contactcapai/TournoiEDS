/**
 * Schéma de validation partagé d'un atelier (AR-DB4, Story 6.9).
 *
 * Vit sous `src/lib/` et non `src/server/` : il est importé par le formulaire CLIENT du
 * back-office autant que par la Server Action qui écrit en base. Un seul schéma des deux
 * côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 CE FICHIER EST LA SOURCE DES VALEURS DE L'ENUM `workshop_family` : `schema.ts` importe
 * `WORKSHOP_FAMILIES` d'ici pour construire son `pgEnum`. Le sens de la dépendance est
 * celui-là et **pas l'inverse** — importer `schema.ts` depuis un module que le client bundle
 * ferait entrer tout Drizzle dans le navigateur. Patron posé par `event.ts` (3.1), repayé par
 * `partner.ts` (4.1) et `solicitation.ts` (5.1).
 */
import { z } from "zod";

import { texteOptionnel, visiblementVide } from "./texte";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LES TROIS FAMILLES — ELLES NE S'INVENTENT PAS ICI, ELLES SONT DÉJÀ À L'ÉCRAN
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Leur source est `app/(public)/animations/page.tsx` (Story 2.7), qui rend trois `<h3>` et
 * porte l'instruction en toutes lettres : *« Les trois familles ne sont pas un pis-aller :
 * elles deviennent la TAXONOMIE DURABLE (futur enum `workshop_family` de la Story 6.9, et
 * cible de l'état vide du catalogue). Ne pas les renommer à la légère. »*
 *
 * 🔴 EN FRANÇAIS, ET C'EST UNE MESURE, PAS UN GOÛT. Le commentaire de `eventType` dans
 * `schema.ts` affirmait « identifiants techniques en anglais, comme les tables ». Mesuré au
 * cadrage de cette story : **deux enums sur trois sont en français** —
 * `partner_category` (`partenaire`, `soutien`, `participation`) et `solicitation_type`
 * (`animation`, `partenariat`, `autre`) ; seul `event_type` (`thursday`, `special`) est en
 * anglais. La « règle » décrivait un cas particulier. La phrase de `schema.ts` a été
 * rectifiée par cette story plutôt que contournée en silence
 * (`00 référence/pieges/avertissement-commentaire.md`).
 *
 * ⚠️ `evenement` SANS ACCENT : c'est un identifiant d'enum Postgres, pas un libellé. Les
 * libellés publics vivent dans le RENDU (`WorkshopCatalog`, et l'écran d'admin), jamais ici.
 *
 * 🔴 L'ORDRE DE CE TABLEAU N'EST PAS DÉCORATIF. C'est l'ordre de l'enum Postgres, donc celui
 * du `ORDER BY family` des requêtes, donc **celui des trois familles à l'écran**. Il reproduit
 * l'ordre actuel de `/animations`. Le réordonner réordonnerait la page publique **et**
 * exigerait une migration d'enum — ne pas le faire à la légère. Même garde que
 * `PARTNER_CATEGORIES`.
 */
export const WORKSHOP_FAMILIES = ["atelier", "sensibilisation", "evenement"] as const;

/**
 * Le type des trois familles, **dérivé de la liste ci-dessus**.
 *
 * ⚠️ `server/db/schema.ts` le RÉ-EXPORTE plutôt que de le redéfinir depuis son `pgEnum` :
 * les deux seraient provablement identiques, mais deux définitions du même type sont deux
 * endroits où quelqu'un peut en modifier une seule. Le type naît **là où naissent les
 * valeurs**, et il est ainsi importable par le formulaire CLIENT — ce qu'un type venu de
 * `schema.ts` ne serait pas sans faire entrer Drizzle dans le bundle du navigateur.
 */
export type WorkshopFamily = (typeof WORKSHOP_FAMILIES)[number];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 BORNES DE LONGUEUR — POSÉES DÈS LA MIGRATION INITIALE, ET C'EST LE POINT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les trois tables saisies de l'Epic 6 ont chacune payé une migration de **RATTRAPAGE** pour
 * des bornes absentes : `0006` sur `event`/`bar` (9 contraintes, Story 6.3), `0008` sur
 * `photo.alt` (6.4), `0009` sur `partner` (5 contraintes, 6.5). **Trois rattrapages sur trois
 * tables**, toujours pour le même motif : la table était née **avant** son écran de saisie.
 * `workshop` naît **avec** le sien — ses `CHECK` de non-blanc **et** de plafond entrent donc
 * dans la `0010`. Il n'y a aucune raison d'en payer un quatrième.
 *
 * 🔴 CES CONSTANTES SONT IMPORTÉES PAR `server/db/schema.ts` POUR CONSTRUIRE SES `CHECK`.
 * La base et Zod expriment **la même règle** en deux langages, jamais deux littéraux recopiés
 * qui divergeraient au premier ajustement.
 *
 * ⚠️ VALEURS **CHOISIES**, PAS MESURÉES — et la différence compte. La 6.5 avait pu mesurer
 * les 11 lignes existantes avant de borner (`name` 19, `description` 144…) ; ici **la table
 * est vide**, il n'y a rien à mesurer. Les trois valeurs sont donc alignées sur des bornes
 * déjà en place ailleurs, ce qui est le meilleur argument disponible :
 *   · `TITRE_MAX` = 80  — exactement `TITRE_MAX` d'un événement (`event.ts`), lui-même aligné
 *     sur la troncature du rendu depuis la 6.3 ;
 *   · `RESUME_MAX` = 200 — exactement `DESCRIPTION_MAX` d'un partenaire (`partner.ts`) : c'est
 *     le même objet éditorial, **une LIGNE de contexte et pas un paragraphe** ;
 *   · `PUBLIC_MAX` = 120 — la borne des noms courts du projet (`NAME_MAX`, `BAR_NOM_MAX`,
 *     `solicitation.name`).
 */

/** L'intitulé de l'atelier, rendu en gras dans la liste de sa famille sur `/animations`. */
export const TITRE_MAX = 80;

/** Une LIGNE de contexte (« On installe les postes, on encadre les parties »), pas un pavé. */
export const RESUME_MAX = 200;

/** Le public visé (« Collégiens et lycéens », « Tout public à partir de 8 ans »). */
export const PUBLIC_MAX = 120;

const trimmedText = z.string().trim();

/**
 * 🔴 `texteOptionnel` A ÉTÉ EXTRAITE VERS `./texte.ts` PAR LA STORY 6.10 (dette R37 ①).
 *
 * Le bloc qui vivait ici comptait **trois copies** et expliquait pourquoi il ne les extrayait
 * PAS : trancher la sémantique aurait changé le comportement d'une story déjà mergée, depuis
 * une story qui portait par ailleurs un modèle neuf et un rendu public. Le report était routé
 * vers la 6.10, qui l'a payé. **Le compte est passé de 3 à 1**, et cette copie-ci — qui avait
 * déjà pris la forme de `partner.ts` — est **inchangée dans son comportement**.
 */

/**
 * Un atelier du catalogue d'animations (FR34, alimente FR10).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SIX CHAMPS, ET PAS UN DE PLUS — L'ABSENCE EST LE GARDE-FOU
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * FR34 en liste quatre (intitulé, description courte, public visé, famille) ; l'AC d'`epics.md`
 * y ajoute l'ordre et la publication. **Il n'y a ni `tarif`, ni `duree`, ni `effectif`, ni
 * `nombre_de_postes`, et c'est le livrable** : l'AC exige que « rien n'incite à saisir un tarif
 * ni un chiffre de communauté — **le formulaire ne porte aucun champ de ce type** ». C'est un
 * **garde-fou de SCHÉMA**, pas une consigne dans une documentation que personne ne rouvre.
 *
 *   · **FR10** — la page est une offre d'**utilité sociale**, jamais une prestation. Un champ
 *     « tarif » la ferait basculer par sa seule présence, avant même qu'on le remplisse.
 *   · **FR16** — aucun chiffre de communauté nulle part sur le site.
 *
 * ⚠️ ET LA PAGE PUBLIQUE LE DIT DÉJÀ, depuis la Story 2.7 : *« Le format exact — durée, nombre
 * de postes, jeux, âge du public — se définit avec vous. On préfère caler ça ensemble plutôt
 * que de dérouler un catalogue. »* Ajouter ces colonnes contredirait un texte en ligne.
 * ⇒ **Ne pas « compléter » ce schéma par symétrie avec `event`.** L'absence est intentionnelle
 * et elle est le sujet.
 */
export const workshopInputSchema = z.object({
  /**
   * ⚠️ `.min(2)` COMPTE DES UNITÉS DE CODE, PAS DES CARACTÈRES VISIBLES — leçon payée sur
   * `partner.name` en revue de la 6.5 : un intitulé fait de deux U+200B mesure 2 et franchit
   * la borne. Le `refine` ci-dessous rétablit le sens de la règle, et il n'est pas
   * redondant : `btrim` côté base ne retire pas les caractères de largeur nulle (leçon 6.3),
   * donc Zod est **le seul** des deux à pouvoir fermer ce cas.
   */
  title: trimmedText
    .min(2, "L'intitulé doit faire au moins 2 caractères.")
    .max(TITRE_MAX, `L'intitulé ne peut pas dépasser ${TITRE_MAX} caractères.`)
    .refine((value) => !visiblementVide(value), {
      message: "L'intitulé ne peut pas être composé uniquement de caractères invisibles.",
    }),
  /**
   * La famille est **obligatoire** : un atelier sans famille n'a nulle part où se rendre sur
   * `/animations`, dont le catalogue est groupé par famille. C'est une garde de rendu, pas
   * une préférence de saisie.
   */
  family: z.enum(WORKSHOP_FAMILIES),
  /**
   * Facultatifs **par conception**. Un atelier sans description ou sans public visé est
   * parfaitement rendable : la ligne masque proprement ce qui manque (NFR8, doctrine UX-DR10
   * appliquée partout depuis la 3.2). Jamais un libellé vide, jamais un tiret orphelin.
   */
  summary: texteOptionnel(RESUME_MAX, "La description"),
  audience: texteOptionnel(PUBLIC_MAX, "Le public visé"),
  /**
   * 🔴 BORNÉ À LA PLAGE DE `integer` POSTGRES (int4), et ce n'est pas de la préciosité :
   * `z.number().int()` accepte 5 000 000 000, que la colonne `integer` refuse. Sans ces
   * bornes, la valeur traverserait la validation puis ferait remonter une erreur BRUTE du
   * driver (« value out of range for type integer ») au bénévole, dans un écran dont tout le
   * reste soigne ses messages. Trouvé à la revue de la 6.5, repris ici.
   * Pas de `.min(0)` : un rang négatif est un moyen légitime d'épingler une entrée en tête
   * sans renuméroter les autres.
   */
  sortOrder: z
    .number()
    .int()
    .min(-2147483648, "Ordre d'affichage hors limites.")
    .max(2147483647, "Ordre d'affichage hors limites.")
    .default(0),
  /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`, `photo`). */
  isPublished: z.boolean().default(false),
});

export type WorkshopInput = z.infer<typeof workshopInputSchema>;
