/**
 * Schéma de validation partagé d'un partenaire (AR-DB4, Story 4.1).
 *
 * Vit sous `src/lib/` et non `src/server/` : il sera importé par le formulaire CLIENT du
 * back-office (Story 6.5) autant que par la Server Action qui écrit en base. Un seul
 * schéma des deux côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 CE FICHIER EST LA SOURCE DES VALEURS DE L'ENUM `partner_category` : `schema.ts`
 * importe `PARTNER_CATEGORIES` d'ici pour construire le `pgEnum`. Le sens de la dépendance
 * est celui-là et pas l'inverse — importer `schema.ts` depuis un module que le client
 * bundle ferait entrer tout Drizzle dans le navigateur. Patron posé par `event.ts` (3.1).
 */
import { z } from "zod";

import { LOGO_EXTENSION, PREFIXE_LOGO } from "../logos";
import { texteOptionnel, urlHttpOptionnelle, visiblementVide, texteNettoye } from "./texte";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 BORNES DE LONGUEUR — AJOUTÉES PAR LA STORY 6.5 (migration `0009`), ET LE TROU ÉTAIT RÉEL
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Mesuré au cadrage : cette table ne portait **aucune borne de longueur**, ni en base
 * (3 `CHECK … not_blank`, rien d'autre) ni ici (`name.max(120)` était le seul). C'est
 * l'asymétrie exacte que la migration `0006` a corrigée sur `event`/`bar` (Story 6.3) et la
 * `0008` sur `photo.alt` (Story 6.4) — elle n'avait simplement jamais été appliquée ici.
 *
 * 🔴 ET `description` ÉTAIT LE CAS DANGEREUX DES QUATRE, parce qu'elle est **rendue** :
 * `PartnerWall.module.css` la pose sous la tuile en 13 px, **sans troncature, sans clamp de
 * lignes et sans `overflow-wrap`** (seul `.nom` en porte un). Une description de 3 000
 * caractères saisie de bonne foi étirerait sa colonne du mur et casserait l'alignement de la
 * rangée — sur une page publique, et sans qu'aucune porte ne le dise.
 *
 * 🔴 CES CONSTANTES SONT IMPORTÉES PAR `server/db/schema.ts` POUR CONSTRUIRE SES `CHECK`.
 * La base et Zod expriment donc **la même règle**, jamais deux littéraux recopiés qui
 * divergeraient au premier ajustement (patron posé par `lib/schemas/event.ts` en 6.3).
 *
 * ⚠️ **Mesuré AVANT la migration** sur les 11 lignes existantes : `name` 19, `description`
 * 144, `link` 33, `logo` 37. Aucune ne viole ces bornes — la `0009` ne pouvait pas échouer.
 */

/** Le nom sert d'`alt` au logo dans le bandeau : c'est le seul texte qu'un lecteur d'écran aura. */
export const NAME_MAX = 120;

/**
 * Une LIGNE de contexte (« Présents depuis 2023 »), pas un paragraphe.
 * La plus longue en base fait 144 caractères ; 200 laisse de la marge sans autoriser un pavé
 * qui déferait la grille du mur.
 */
export const DESCRIPTION_MAX = 200;

/** Une URL de site de partenaire. 300 est très au-delà de tout cas réel (le plus long : 33). */
export const LINK_MAX = 300;

/** Un chemin, pas une URL : `/medias/logos/<uuid>.webp` fait 55 caractères. */
export const LOGO_MAX = 200;

/**
 * 🔴 FORME DU CHEMIN DE LOGO — LISTE BLANCHE, JAMAIS LISTE NOIRE.
 *
 * ⚠️ Le commentaire de `logo` dans `schema.ts` disait, depuis la Story 4.1 : *« volontairement
 * PERMISSIF sur la forme … contraindre le format ici obligerait à rouvrir ce fichier au moment
 * où la Story 6.5 écrira dans cette colonne »*. **Nous y sommes**, et c'est le moment prévu :
 * cette colonne cesse d'être remplie par un seed relu par un humain pour devenir la valeur à
 * partir de laquelle un **chemin disque** est construit.
 *
 * Deux préfixes, et deux seulement :
 *   · `/partenaires/…`  — les 4 logos semés, servis en statique depuis `public/` ;
 *   · `/medias/logos/…` — les logos téléversés, sur le volume Docker.
 *
 * Le corps reprend mot pour mot la doctrine de `photo_filename_safe` (Story 4.3) :
 *   ① `^[a-z0-9]` — premier caractère alphanumérique : interdit `.cache`, `-flag`, `..` ;
 *   ② `[a-z0-9._-]*` — corps sans `/`, sans `\`, sans `%`, sans `:` ;
 *   ③ extension **`.webp` et elle seule**, en minuscules — la normalisation de cette story
 *      ré-encode tout en WebP, et les 4 fichiers semés le sont déjà. Une liste plus large
 *      autoriserait une forme que rien ne produit.
 *
 * ⚠️ Le `.includes("..")` est REDONDANT avec ① — il reste parce que la sûreté de cette valeur
 * ne doit pas dépendre d'un raisonnement à deux détentes qu'il faudra retenir dans six mois.
 * Même arbitrage que `photo_filename_safe`, mot pour mot.
 */
const LOGO_MOTIF = new RegExp(
  `^(${PREFIXE_LOGO}|/partenaires/)[a-z0-9][a-z0-9._-]*\\.${LOGO_EXTENSION}$`,
);

const LOGO_MESSAGE =
  "Chemin de logo invalide. Un logo est soit un fichier téléversé depuis cet écran, " +
  "soit l'un des logos livrés avec le site — il ne se saisit pas à la main.";

/**
 * Valeurs de l'enum `partner_category`, **définies ici une seule fois**.
 *
 * 🔴 LES QUATRE LIBELLÉS SONT FACTUELS, PAS COSMÉTIQUES (FR33).
 * `participation` existe parce que Game in Reims est un salon où l'asso tient un stand et
 * France Esport une fédération dont elle est **adhérente** : ranger l'un ou l'autre sous
 * « partenaires » affirmerait une relation qui n'existe pas. `soutien` désigne un appui
 * réel et déjà acquis — ⚠️ jamais une collectivité qu'on **espère** convaincre
 * (`positionnement-refonte-site-v2.md` §6 : la preuve, jamais l'ambition).
 *
 * L'ordre de ce tableau n'est PAS décoratif : c'est celui de l'enum Postgres, donc celui
 * du `ORDER BY category` de la requête de la home (`queries/partners.ts`). Sponsors
 * d'abord, participations en dernier. Réordonner ce tableau change l'ordre du bandeau et
 * exige une migration de l'enum — ne pas le faire à la légère.
 */
export const PARTNER_CATEGORIES = ["sponsor", "partenaire", "soutien", "participation"] as const;

/**
 * Le type des quatre catégories, **dérivé de la liste ci-dessus**.
 *
 * ⚠️ `server/db/schema.ts` le RÉ-EXPORTE plutôt que de le redéfinir depuis son `pgEnum` : les
 * deux seraient provablement identiques (l'enum est construit à partir de cette liste), mais
 * deux définitions du même type sont deux endroits où quelqu'un peut en modifier une seule.
 * Le type naît donc **là où naissent les valeurs**, et il est importable par le formulaire
 * CLIENT du back-office (Story 6.5) — ce qu'un type venu de `schema.ts` ne serait pas sans
 * faire entrer Drizzle dans le bundle du navigateur.
 */
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

const trimmedText = texteNettoye;

/**
 * 🔴 CARACTÈRES SANS LARGEUR — la garde a été EXTRAITE vers `./texte.ts` (Story 4.3).
 *
 * Écart délibéré à la règle « payé deux fois » (METHODE.md §5) : `photo.ts` en est le
 * 2ᵉ consommateur, et ceci est une garde de CORRECTION, pas de présentation. Deux
 * copies d'une règle Unicode divergent en SILENCE — combler demain un trou dans l'une
 * laisserait l'autre ouverte, et un `git diff` sur des caractères invisibles ne montre
 * rien. Le raisonnement complet vit dans `texte.ts`, en un seul exemplaire.
 *
 * Rappel du défaut qui l'a fait naître (revue de la Story 4.1) : `logo = "<U+200B>"`
 * était accepté et ressortait non-null, donc entrait dans le filtre `logo IS NOT NULL`
 * de `queries/partners.ts` et rendait un `<img src="<U+200B>">` dans le bandeau de la
 * home — une requête vers la page courante à la place d'un logo.
 */

/**
 * 🔴 `texteOptionnel` A ÉTÉ EXTRAITE VERS `./texte.ts` PAR LA STORY 6.10 (dette R37 ①).
 *
 * C'est **cette** sémantique qui a été retenue pour les trois consommateurs — borne comptée
 * APRÈS `trim()`, donc exactement comme le compteur de `ChampTexte`. Le comportement de ce
 * fichier est donc **inchangé** ; ce sont `event.ts` et le module partagé qui se sont alignés
 * sur lui. Le raisonnement complet vit dans `./texte.ts`, pas ici : une seule copie du motif,
 * une seule copie de son explication.
 */

/**
 * 🔴 `optionalHttpUrl` A ÉTÉ EXTRAITE VERS `./texte.ts` PAR LA STORY 6.13.
 *
 * Elle s'appelle désormais `urlHttpOptionnelle(max, libelle)` et vit à côté de
 * `texteOptionnel`, dont elle a exactement la forme. Motif : elle passe de **un** à **six**
 * consommateurs (les cinq URL de `site_setting`, rendues dans le header et le footer des 5
 * pages), et sa divergence serait **silencieuse** — sa règle lie ce dossier à `isExternalUrl()`
 * de `lib/links.ts`, et un trou comblé d'un seul côté ne se voit ni au lint, ni au typecheck,
 * ni au build. C'est le motif littéral de la dette **R37**, appliqué **avant** d'en payer le
 * prix cette fois.
 *
 * Le comportement de ce fichier est **inchangé** ; les cinq garanties de l'original sont
 * conservées mot pour mot, y compris l'exigence de la forme littérale `^https?://`. **Seul le
 * message change de tournure** (« L'adresse du site est invalide… » au lieu de « Adresse du
 * site invalide… »), parce que le libellé est devenu un paramètre. Le raisonnement complet vit
 * dans `./texte.ts`, en un seul exemplaire.
 */
const optionalHttpUrl = urlHttpOptionnelle(LINK_MAX, "L'adresse du site");

/**
 * Chemin ou URL du logo.
 *
 * Volontairement PERMISSIF sur la forme : aujourd'hui la valeur est un chemin public
 * (`/partenaires/forgeblast.webp`), demain la route de service des médias posée par la
 * Story 4.3. Contraindre le format ici obligerait à rouvrir ce fichier à ce moment-là.
 * La seule règle est celle qui vaut dans les deux mondes : **jamais la chaîne vide**, qui
 * rendrait un `<img src="">` (requête vers la page courante) au lieu d'omettre la tuile.
 */
export const partnerInputSchema = z.object({
  /**
   * ⚠️ `.min(2)` COMPTE DES UNITÉS DE CODE, PAS DES CARACTÈRES VISIBLES. Un nom fait de
   * deux U+200B mesure 2 et passait donc la borne — alors qu'il sert d'`alt` au logo
   * dans le bandeau, c'est-à-dire du seul texte qu'un lecteur d'écran restituera.
   * Le `refine` ci-dessous rétablit le sens de la règle. Trouvé à la revue.
   */
  name: trimmedText
    .min(2, "Le nom doit faire au moins 2 caractères.")
    .max(NAME_MAX, `Le nom ne peut pas dépasser ${NAME_MAX} caractères.`)
    .refine((value) => !visiblementVide(value), {
      message: "Le nom ne peut pas être composé uniquement de caractères invisibles.",
    }),
  category: z.enum(PARTNER_CATEGORIES),
  /**
   * `null` = pas de logo ⇒ absent du bandeau de la home, documenté sur /partenaires.
   *
   * ⚠️ Cette valeur ne se saisit PAS : elle est produite par le téléversement (Story 6.5),
   * qui écrit un nom généré par le serveur. La liste blanche ci-dessous n'est donc pas là
   * pour guider une frappe — elle est là pour qu'un `UPDATE` direct, une restauration de
   * sauvegarde ou une migration de données ne puissent pas y déposer une valeur à partir de
   * laquelle un chemin disque serait ensuite construit.
   */
  logo: texteOptionnel(LOGO_MAX, "Le chemin du logo").refine(
    (value) => value === null || (LOGO_MOTIF.test(value) && !value.includes("..")),
    { message: LOGO_MESSAGE },
  ),
  description: texteOptionnel(DESCRIPTION_MAX, "La description"),
  link: optionalHttpUrl,
  /**
   * 🔴 BORNÉ À LA PLAGE DE `integer` POSTGRES (int4), et ce n'est pas de la préciosité :
   * `z.number().int()` accepte 5 000 000 000, que la colonne `integer` refuse. Sans ces
   * bornes, la valeur traversait la validation puis faisait remonter une erreur BRUTE du
   * driver (« value out of range for type integer ») — au bénévole du back-office, dans
   * un formulaire dont tout le reste soigne ses messages. Trouvé à la revue.
   * Pas de `.min(0)` : un `sortOrder` négatif est un moyen légitime d'épingler une entrée
   * en tête sans renuméroter les autres.
   */
  sortOrder: z
    .number()
    .int()
    .min(-2147483648, "Ordre d'affichage hors limites.")
    .max(2147483647, "Ordre d'affichage hors limites.")
    .default(0),
  /** Défaut `false` : rien n'est public par accident (patron `event`). */
  isPublished: z.boolean().default(false),
});

export type PartnerInput = z.infer<typeof partnerInputSchema>;
