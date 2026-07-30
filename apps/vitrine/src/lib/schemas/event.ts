/**
 * Schéma de validation partagé d'un événement (AR-DB4).
 *
 * Vit sous `src/lib/` et non `src/server/` : il sera importé par le formulaire CLIENT du
 * back-office (Story 6.3) autant que par la Server Action qui écrit en base. Un seul
 * schéma des deux côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 IL PORTE LA MÊME INVARIANTE QUE LA CONTRAINTE `event_has_venue` DE LA BASE :
 * un événement doit avoir un lieu identifiable. La base est le garde-fou qui ne peut pas
 * être contourné ; ce schéma est celui qui donne un message utilisable à un bénévole.
 * Les deux sont nécessaires — si l'un des deux change, changer l'autre.
 */
import { z } from "zod";

/** Valeurs de l'enum `event_type`. Doit rester alignée sur `schema.ts`. */
export const EVENT_TYPES = ["thursday", "special"] as const;

const trimmedText = z.string().trim();

/** Champ optionnel : une chaîne vide (formulaire non rempli) vaut `null`, pas `""`. */
const optionalText = trimmedText
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null);

export const eventInputSchema = z
  .object({
    type: z.enum(EVENT_TYPES).default("thursday"),
    title: trimmedText.min(3, "Le titre doit faire au moins 3 caractères.").max(120),
    /** Référence à un bar du roulement. `null` pour un temps fort hors bar. */
    barId: z.uuid("Identifiant de bar invalide.").nullable().default(null),
    /** Lieu libre, quand l'événement ne se tient pas dans un bar du roulement. */
    venueName: optionalText,
    venueAddress: optionalText,
    /**
     * Instant de début. `z.coerce.date()` accepte aussi bien un `Date` (seed, Server
     * Action) qu'une chaîne ISO (`<input type="datetime-local">` sérialisé).
     * ⚠️ Une chaîne SANS fuseau serait interprétée dans le fuseau du process : côté
     * formulaire, sérialiser avec l'offset, ou construire la valeur via
     * `src/lib/date-paris.ts`.
     */
    startsAt: z.coerce.date(),
    games: optionalText,
    description: optionalText,
    recap: optionalText,
    isPublished: z.boolean().default(false),
  })
  .refine((value) => value.barId !== null || value.venueName !== null, {
    // Même règle que le CHECK `event_has_venue` en base.
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
