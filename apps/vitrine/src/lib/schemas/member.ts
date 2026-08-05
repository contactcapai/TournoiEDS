/**
 * Schéma de validation partagé d'un membre de l'équipe (FR35, alimente FR9 — Story 6.10).
 *
 * Vit sous `src/lib/` et non `src/server/` : il est importé par le formulaire CLIENT du
 * back-office autant que par la Server Action qui écrit en base. Un seul schéma des deux
 * côtés, sinon les deux règles divergent au premier changement. Patron posé par `event.ts`
 * (3.1), repayé par `partner.ts` (4.1), `solicitation.ts` (5.1) et `workshop.ts` (6.9).
 *
 * 🔴 CE FICHIER EST LA SOURCE DES BORNES : `server/db/schema.ts` les importe pour construire
 * ses `CHECK`. La base et Zod expriment **la même règle** en deux langages, jamais deux
 * littéraux recopiés qui divergeraient au premier ajustement. Le sens de la dépendance est
 * celui-là et **pas l'inverse** — importer `schema.ts` depuis un module que le client bundle
 * ferait entrer tout Drizzle dans le navigateur.
 */
import { z } from "zod";

import { PREFIXE_PORTRAIT } from "../portraits";
import { texteOptionnel, visiblementVide } from "./texte";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CINQ CHAMPS, ET PAS UN DE PLUS — L'ABSENCE EST LE GARDE-FOU
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * FR35 en liste quatre (prénom, rôle, ordre, portrait optionnel) ; l'AC d'`epics.md` y ajoute
 * la publication. **Il n'y a ni nom de famille, ni e-mail, ni téléphone, ni date d'entrée au
 * bureau, ni compteur — et c'est le livrable.**
 *
 *   · **RGPD / NFR5, minimisation** — ce sont des données personnelles publiées sur le web.
 *     On ne collecte que ce que la page rend. Un nom de famille ou un e-mail ne serait rendu
 *     nulle part : il n'aurait aucune raison d'exister en base.
 *   · **FR16** — aucun chiffre de communauté nulle part sur le site. Une table de membres
 *     appelle un compteur (« nous sommes 12 bénévoles ») bien plus fortement qu'une table
 *     d'ateliers. **Aucune colonne d'effectif, et aucune surface publique n'affiche le
 *     nombre de membres**, pas même une longueur de liste rendue à l'écran.
 *   · **ET LA PAGE PUBLIQUE LE DIT DÉJÀ EN LIGNE**, depuis la Story 2.6 : *« Pas de compteur
 *     de membres ni de statistiques d'audience sur ce site. »* Rendre un décompte
 *     contredirait un texte publié, **sur la page même qui le porte**.
 *
 * ⇒ **Ne pas « compléter » ce schéma par symétrie avec `partner` ou `event`.** L'absence est
 * intentionnelle et elle est le sujet.
 *
 * ⚠️ Pas de catégorie `bureau` / `bénévole` non plus : l'équipe est **une liste unique
 * ordonnée**. Séparer les gens en deux classes sur une page dont le propos est justement
 * qu'ils font la même chose serait un contresens éditorial. Le **rôle** dit déjà ce qu'il faut.
 */

/**
 * Le prénom. **Choisi, pas mesuré** — la table est vide, il n'y a rien à mesurer
 * (contrairement à la 6.5, qui avait onze lignes en base avant de borner). 60 laisse la place
 * aux prénoms composés et aux graphies longues sans autoriser une phrase.
 */
export const PRENOM_MAX = 60;

/**
 * Le rôle (« Présidente », « Trésorier », « Bénévole animation »).
 *
 * ⚠️ 80 est **exactement** `TITRE_MAX` d'un événement (`event.ts`) et d'un atelier
 * (`workshop.ts`) : c'est le même objet éditorial — un intitulé court rendu en évidence.
 * S'aligner sur une borne déjà en place est le meilleur argument disponible quand il n'y a
 * rien à mesurer.
 */
export const ROLE_MAX = 80;

/**
 * Le chemin du portrait en base — `/medias/portraits/<uuid>.webp`.
 *
 * ⚠️ Ce n'est PAS la longueur d'un nom de fichier libre : la valeur est **fabriquée par le
 * serveur** (`lib/portraits.ts`), jamais saisie. La borne existe pour que la base puisse
 * refuser une valeur arrivée par un chemin qui contournerait Zod (`UPDATE` direct,
 * restauration de sauvegarde) — même doctrine que `partner.logo`.
 */
export const PORTRAIT_MAX = 200;

const trimmedText = z.string().trim();

/**
 * Un membre de l'équipe présenté sur `/l-asso`.
 *
 * 🔴 `firstName` ET `role` SONT TOUS DEUX OBLIGATOIRES, et ce n'est pas une préférence de
 * saisie : **un prénom nu publié sur le web est une donnée personnelle publiée sans raison**,
 * exactement ce que la minimisation RGPD interdit. C'est le rôle qui justifie la publication.
 *
 * ⚠️ AUCUN CHAMP DE CE SCHÉMA NE CONSOMME `texteOptionnel` POUR DU TEXTE LIBRE. Le seul champ
 * facultatif est `portrait`, qui est un **chemin** et porte sa propre garde de préfixe.
 * L'extraction de R37 faite par cette story l'a donc été **pour les autres schémas, pas pour
 * soi** : elle ne peut pas se cacher derrière un usage local qui la validerait au passage.
 */
export const memberInputSchema = z.object({
  /**
   * ⚠️ `.min(2)` COMPTE DES UNITÉS DE CODE, PAS DES CARACTÈRES VISIBLES — leçon payée sur
   * `partner.name` en revue de la 6.5 : une valeur faite de deux U+200B mesure 2 et franchit
   * la borne. Le `refine` ci-dessous rétablit le sens de la règle, et il n'est pas redondant :
   * `btrim` côté base ne retire pas les caractères de largeur nulle (leçon 6.3), donc Zod est
   * **le seul** des deux à pouvoir fermer ce cas.
   */
  firstName: trimmedText
    .min(2, "Le prénom doit faire au moins 2 caractères.")
    .max(PRENOM_MAX, `Le prénom ne peut pas dépasser ${PRENOM_MAX} caractères.`)
    .refine((value) => !visiblementVide(value), {
      message: "Le prénom ne peut pas être composé uniquement de caractères invisibles.",
    }),
  role: trimmedText
    .min(2, "Le rôle doit faire au moins 2 caractères.")
    .max(ROLE_MAX, `Le rôle ne peut pas dépasser ${ROLE_MAX} caractères.`)
    .refine((value) => !visiblementVide(value), {
      message: "Le rôle ne peut pas être composé uniquement de caractères invisibles.",
    }),
  /**
   * Le portrait est **facultatif**, et son absence est le cas NOMINAL : une équipe mixte
   * (certains avec photo, d'autres sans) est le cas le plus probable, pas une dégradation.
   * Le rendu pose alors une **silhouette** dans le même cadre (arbitrage de Brice du
   * 2026-08-05) — c'est du RENDU, pas de la donnée : rien n'est inventé ici.
   *
   * 🔴 LA GARDE DE PRÉFIXE EST UNE GARDE DE SÉCURITÉ, PAS DE COSMÉTIQUE, et elle a un
   * précédent mesuré : en 6.5, un `like '/medias/logos/%'` seul acceptait
   * `/medias/logos/axwebp` — **le piège du point**. Il faut donc les DEUX conditions :
   * le préfixe exact, ET l'absence de toute composante de chemin supplémentaire, ET
   * l'extension attendue.
   */
  portrait: texteOptionnel(PORTRAIT_MAX, "Le chemin du portrait").refine(
    (value) => value === null || estCheminPortraitValide(value),
    { message: "Le chemin du portrait n'est pas un média de ce site." },
  ),
  /**
   * 🔴 BORNÉ À LA PLAGE DE `integer` POSTGRES (int4), et ce n'est pas de la préciosité :
   * `z.number().int()` accepte 5 000 000 000, que la colonne `integer` refuse. Sans ces
   * bornes, la valeur traverserait la validation puis ferait remonter une erreur BRUTE du
   * driver (« value out of range for type integer ») au bénévole, dans un écran dont tout le
   * reste soigne ses messages. Trouvé à la revue de la 6.5, repris en 6.9, repris ici.
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

/**
 * Vrai si la valeur est un chemin de portrait servi par ce site.
 *
 * ⚠️ Exporté pour que la **porte** (`gate:membres`) puisse l'exercer LUI-MÊME plutôt qu'une
 * copie de son contrat — une porte qui réimplémente sa règle valide sa propre copie et reste
 * verte le jour où le produit diverge (`00 référence/pieges/garde-nominale.md`).
 */
export function estCheminPortraitValide(valeur: string): boolean {
  return MOTIF_PORTRAIT.test(valeur) && !valeur.includes("..");
}

/**
 * 🔴 LE MOTIF EST **LE MÊME QUE CELUI DU `CHECK` SQL**, ET C'EST UN DÉFAUT RÉEL QUI L'A IMPOSÉ.
 *
 * La première version de `estCheminPortraitValide` n'excluait que `/` et `\`. Elle **acceptait**
 * donc ce que la base **refuse**, alors que l'en-tête de ce fichier affirme que *« la base et Zod
 * expriment la même règle en deux langages »*. MESURÉ en revue (Edge Case Hunter), puis
 * re-mesuré :
 *
 *   Zod ACCEPTE  /medias/portraits/ABC123.webp   →  base : violates member_portrait_valide
 *   Zod ACCEPTE  /medias/portraits/a b.webp      →  base : refusé
 *   Zod ACCEPTE  /medias/portraits/été.webp      →  base : refusé
 *
 * ⚠️ **ET LA GARDE ⑨b DE `gate:membres` NE L'AVAIT PAS VU** : elle éprouvait quatre cas — bien
 * formé, piège du point, sous-dossier, mauvais préfixe — et **aucun en majuscules**. Une porte
 * censée garantir une parité qui ne l'éprouve que sur les cas auxquels on a pensé garantit
 * exactement ces cas-là. Les cas manquants y ont été ajoutés dans le même commit.
 *
 * ⚠️ Le chemin était **inatteignable en pratique** (le formulaire `omit` ce champ, et la valeur
 * vient de `randomUUID()`, toujours en hexadécimal minuscule). Ce n'est pas une raison de le
 * laisser : un contrat documenté FAUX est ce qui se retourne contre le prochain lecteur, et le
 * jour où un appelant parserait sans `omit`, le bénévole recevrait un message brut du driver
 * Postgres au lieu du message soigné.
 *
 * 🔴 Le motif reproduit **caractère pour caractère** celui de `member_portrait_valide`
 * (`schema.ts`), qui est lui-même construit depuis `PREFIXE_PORTRAIT` : premier caractère
 * alphanumérique minuscule, puis `[a-z0-9._-]`, puis l'extension. La garde `..` est écrite à
 * part, exactement comme la base l'écrit à part (`!~ '\.\.'`) — le motif seul l'autoriserait,
 * puisque le point est dans la classe.
 */
const MOTIF_PORTRAIT = new RegExp(`^${PREFIXE_PORTRAIT}[a-z0-9][a-z0-9._-]*\\.webp$`);

export type MemberInput = z.infer<typeof memberInputSchema>;
