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

import { visiblementVide } from "./texte";

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

const trimmedText = z.string().trim();

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

/** Champ optionnel : une chaîne vide (formulaire non rempli) vaut `null`, pas `""`. */
const optionalText = trimmedText
  .transform((value) => (visiblementVide(value) ? null : value))
  .nullable()
  .default(null);

/**
 * URL de partenaire.
 *
 * 🔴 ABSOLUE ET EN `http(s)`, ET C'EST UNE GARDE D'ACCESSIBILITÉ, PAS UN CAPRICE.
 * Le rendu dérive `target="_blank"` + la mention SR « nouvel onglet » de `isExternalUrl()`
 * (`src/lib/links.ts`), qui ne reconnaît comme sortant qu'un schéma `http(s)`. Une valeur
 * relative (« mately.fr », « /mately ») passerait donc en lien INTERNE : le clic partirait
 * vers une route inexistante de la vitrine, sans que rien ne l'annonce. Le message est
 * écrit pour un bénévole, pas pour un développeur.
 *
 * ⚠️ Volontairement PAS `z.url()` seul : il accepte `mailto:`, `javascript:` et `ftp:`.
 * On veut un site web, et `javascript:` dans un `href` est une injection.
 */
const HTTP_URL_MESSAGE =
  "Adresse du site invalide : elle doit commencer par https:// (ou http://) et être " +
  "complète, par exemple https://exemple.fr — une adresse partielle enverrait le " +
  "visiteur sur une page inexistante du site de l'asso.";

const optionalHttpUrl = trimmedText
  .transform((value) => (visiblementVide(value) ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => {
      if (value === null) return true;
      const parsed = z.url().safeParse(value);
      if (!parsed.success) return false;
      // `z.url()` a validé la forme ; on restreint ici le SCHÉMA.
      if (!/^https?:$/i.test(new URL(value).protocol)) return false;
      // 🔴 ON EXIGE EN PLUS LA FORME LITTÉRALE QUE `isExternalUrl()` SAIT RECONNAÎTRE,
      // et ce n'est pas une redondance — c'est la seule façon que la promesse de ce
      // schéma soit TENUE. Trouvé à la revue : `new URL()` NORMALISE, alors que la
      // valeur stockée est la chaîne BRUTE, et que `links.ts` la teste avec
      // `/^https?:\/\//` — sans le drapeau `i`, et en exigeant le double slash.
      // Trois valeurs passaient donc le schéma puis étaient classées INTERNES :
      //   « HTTPS://exemple.fr »  (casse)
      //   « https:exemple.fr »    (pas de slash)
      //   « https:/exemple.fr »   (un seul slash)
      // Le navigateur, lui, y navigue bien comme à une URL absolue. Résultat : ni
      // `target="_blank"`, ni l'annonce « nouvel onglet » — soit exactement la garde
      // d'accessibilité que ce schéma existe pour rendre possible. Le cas n'est pas
      // atteignable aujourd'hui (`link` vaut `null` pour les 11), il le devient dès
      // que la Story 6.5 écrira dans cette colonne AVEC CE MÊME SCHÉMA.
      // ⚠️ Ne pas « simplifier » en retirant ce test : les deux conditions couvrent des
      // choses différentes, et c'est la seconde qui lie ce fichier à `links.ts`.
      return /^https?:\/\//.test(value);
    },
    { message: HTTP_URL_MESSAGE },
  );

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
    .max(120)
    .refine((value) => !visiblementVide(value), {
      message: "Le nom ne peut pas être composé uniquement de caractères invisibles.",
    }),
  category: z.enum(PARTNER_CATEGORIES),
  /** `null` = pas de logo ⇒ absent du bandeau de la home, documenté sur /partenaires. */
  logo: optionalText,
  description: optionalText,
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
