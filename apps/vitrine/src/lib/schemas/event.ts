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

/** Champ optionnel : une chaîne vide (formulaire non rempli) vaut `null`, pas `""`. */
const optionalText = trimmedText
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null);

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

/** Une date sérialisée doit porter son fuseau : `…Z` ou `…+02:00`. */
const HAS_EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Instant de début.
 *
 * 🔴 UNE CHAÎNE SANS FUSEAU EST REJETÉE, ET C'EST LE CŒUR DE LA GARDE.
 * `new Date('2026-08-06T19:00')` — le format exact que produit un
 * `<input type="datetime-local">` — s'interprète dans le fuseau du **process**. En
 * développement le poste est à Paris et le résultat tombe juste par coïncidence ; le
 * conteneur de production tourne en UTC et la même saisie glisse de deux heures. C'est
 * le piège `date-tz.md`, et un commentaire d'avertissement ne l'empêche pas : ici il est
 * refusé par le schéma. Construire la valeur avec `src/lib/date-paris.ts`, ou sérialiser
 * avec l'offset.
 */
const NO_TIMEZONE_MESSAGE =
  "Date sans fuseau horaire. Sérialisez l'offset (ex. 2026-08-06T19:00:00+02:00) ou " +
  "construisez la valeur avec parisWallClock() — sans quoi l'heure glisse en production.";

// ⚠️ Volontairement PAS un `z.union([z.date(), z.string()…])` : quand toutes les branches
// d'une union échouent, zod ne remonte que « Invalid input » et le message ci-dessus est
// perdu. Or ici le message EST le garde-fou — il dit quoi faire. Mesuré à la revue.
const startsAtSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "Date invalide." });
      }
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: "custom",
        message: "Date attendue : un objet Date, ou une chaîne ISO avec son fuseau.",
      });
      return;
    }
    const trimmed = value.trim();
    if (!HAS_EXPLICIT_OFFSET.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: NO_TIMEZONE_MESSAGE });
      return;
    }
    if (Number.isNaN(new Date(trimmed).getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide." });
    }
  })
  .transform((value) => (value instanceof Date ? value : new Date(String(value).trim())));

export const eventInputSchema = z
  .object({
    type: z.enum(EVENT_TYPES).default("thursday"),
    title: trimmedText.min(3, "Le titre doit faire au moins 3 caractères.").max(120),
    /** Référence à un bar du roulement. `null` pour un temps fort hors bar. */
    barId: optionalUuid,
    /** Lieu libre, quand l'événement ne se tient pas dans un bar du roulement. */
    venueName: optionalText,
    venueAddress: optionalText,
    startsAt: startsAtSchema,
    games: optionalText,
    description: optionalText,
    recap: optionalText,
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
  name: trimmedText.min(2, "Le nom doit faire au moins 2 caractères.").max(120),
  address: trimmedText.min(5, "Adresse trop courte."),
  district: trimmedText.min(2, "Quartier requis."),
  city: trimmedText.min(2).default("Reims"),
});

export type BarInput = z.infer<typeof barInputSchema>;
