/**
 * Horloge de référence unique du site : **Europe/Paris**.
 *
 * 🔴 CE FICHIER EST LE SEUL ENDROIT AUTORISÉ À CONVERTIR UNE HEURE MURALE EN INSTANT.
 * Piège `00 référence/pieges/date-tz.md`, payé au moins cinq fois sur les autres projets
 * CapAI : dès que deux endroits refont leur propre conversion, chacun se trompe à sa façon,
 * et le symptôme (décalage d'un jour, événement « passé » deux heures trop tôt) n'apparaît
 * qu'en production. Le conteneur Next tourne en **UTC** ; un jeudi 19h00 à Reims est un
 * jeudi dans le calendrier de **Paris**. Les deux horloges ne coïncident jamais.
 *
 * Règles qui découlent de ce fichier :
 * - **jamais** d'offset en dur (`+02:00` est faux la moitié de l'année) ;
 * - **jamais** `toISOString().slice(0, 10)` pour une logique métier datée ;
 * - **jamais** `Date.getDay()`/`getHours()` (ils répondent dans le fuseau du process) ;
 * - côté SQL, envelopper avant de tronquer : `timezone('Europe/Paris', starts_at)`.
 *
 * Volontairement sans dépendance : `Intl` fait le travail, et une bibliothèque de dates
 * n'apporterait ici que sa taille.
 */

export const PARIS_TZ = "Europe/Paris";

/** Jeudi, en numérotation ISO (lundi = 1 … dimanche = 7). */
export const THURSDAY = 4;

const ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Décalage réel de Paris **à cet instant précis**, en millisecondes (+1h ou +2h).
 * Lu auprès d'`Intl` plutôt que calculé : c'est la base de données de fuseaux du système
 * qui sait quand la bascule a lieu, pas nous.
 */
function parisOffsetMs(instant: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(label ?? "");
  if (!match) return 0; // « GMT » sans offset = UTC. Paris n'y est jamais, filet de sécurité.

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

/**
 * Instant correspondant à une **heure murale de Paris**.
 * `month` est en base 1 (janvier = 1) — contrairement à `Date`, dont la base 0 est une
 * source d'erreurs à elle seule. Le débordement est normalisé : `day = 35` passe au mois
 * suivant, ce qui permet d'ajouter des jours sans arithmétique de calendrier.
 *
 * 🔴 DEUX PASSAGES, ET C'EST NÉCESSAIRE. Le premier calcule l'offset sur un instant faux
 * d'une à deux heures ; le second le recalcule sur le résultat. Sans ce second tour, les
 * deux jours de bascule (fin mars, fin octobre) tombent une heure à côté.
 *
 * ⚠️ LES DEUX JOURS DE BASCULE ONT CHACUN UNE HEURE PATHOLOGIQUE, et le comportement de
 * cette fonction y est déterministe mais arbitraire — mesuré à la revue de la Story 3.1 :
 *   - **fin mars, 02h00 → 02h59 n'existent pas** (l'horloge saute de 02h00 à 03h00).
 *     `parisWallClock(2026, 3, 29, 2, 30)` rend un instant qui se relit **03h30**. Aucune
 *     erreur n'est levée : la valeur est décalée en avant, en silence.
 *   - **fin octobre, 02h00 → 02h59 existent deux fois.** La fonction retient toujours la
 *     **seconde** occurrence (heure d'hiver, UTC+1).
 * Sans conséquence pour l'agenda tel qu'il est semé (19h00, 10h00). À reprendre quand un
 * bénévole saisira une heure libre — **Story 6.3**, où la parade appartient au formulaire :
 * avertir plutôt que corriger dans le dos de l'utilisateur.
 */
export function parisWallClock(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = new Date(naive - parisOffsetMs(new Date(naive)));
  return new Date(naive - parisOffsetMs(firstPass));
}

/** Date et heure **murales à Paris** d'un instant donné. */
export function parisParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Jour de la semaine ISO : lundi = 1 … dimanche = 7. */
  isoWeekday: number;
} {
  // `Intl` lèverait un `RangeError: Invalid time value` peu parlant, à l'endroit du
  // formatage plutôt qu'à celui de la donnée fautive. Les stories 3.2/3.3 appelleront
  // cette fonction sur des `starts_at` venant de la base : une ligne corrompue par une
  // écriture SQL directe doit se diagnostiquer, pas faire tomber un rendu.
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError("parisParts a reçu une date invalide (NaN).");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    // `h23` explicitement : avec `hour12: false`, minuit se lit « 24 » sur certaines
    // implémentations d'ICU.
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    isoWeekday: ISO_WEEKDAY[get("weekday")] ?? 0,
  };
}

/**
 * Les `count` prochains jeudis à `hour` heure murale de Paris, strictement après `from`.
 *
 * 🔴 LA PROGRESSION SE FAIT EN JOURS DE CALENDRIER, PAS EN MILLISECONDES. Ajouter
 * `7 * 24 * 3600 * 1000` traverserait un changement d'heure en décalant l'horaire d'une
 * heure : le jeudi de fin octobre serait à 18h00 ou 20h00. On rappelle donc
 * `parisWallClock` avec un numéro de jour plus grand.
 */
export function nextThursdays(count: number, options: { from?: Date; hour?: number } = {}): Date[] {
  const from = options.from ?? new Date();
  const hour = options.hour ?? 19;
  const today = parisParts(from);

  let daysAhead = (THURSDAY - today.isoWeekday + 7) % 7;
  // Le jeudi en cours ne compte que s'il n'a pas encore commencé.
  if (daysAhead === 0 && parisWallClock(today.year, today.month, today.day, hour) <= from) {
    daysAhead = 7;
  }

  return Array.from({ length: count }, (_, index) =>
    parisWallClock(today.year, today.month, today.day + daysAhead + index * 7, hour),
  );
}
