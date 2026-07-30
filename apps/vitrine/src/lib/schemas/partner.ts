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

/** Champ optionnel : une chaîne vide (formulaire non rempli) vaut `null`, pas `""`. */
const optionalText = trimmedText
  .transform((value) => (value.length === 0 ? null : value))
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
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => {
      if (value === null) return true;
      const parsed = z.url().safeParse(value);
      if (!parsed.success) return false;
      // `z.url()` a validé la forme ; on restreint ici le SCHÉMA.
      return /^https?:$/i.test(new URL(value).protocol);
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
  name: trimmedText.min(2, "Le nom doit faire au moins 2 caractères.").max(120),
  category: z.enum(PARTNER_CATEGORIES),
  /** `null` = pas de logo ⇒ absent du bandeau de la home, documenté sur /partenaires. */
  logo: optionalText,
  description: optionalText,
  link: optionalHttpUrl,
  sortOrder: z.number().int().default(0),
  /** Défaut `false` : rien n'est public par accident (patron `event`). */
  isPublished: z.boolean().default(false),
});

export type PartnerInput = z.infer<typeof partnerInputSchema>;
