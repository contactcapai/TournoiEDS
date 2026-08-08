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

/* ───────────────────────────────────────────────────────────────────────────────
   FORMATEURS D'AFFICHAGE (Story 3.2)

   Ils vivent ICI et pas dans un `lib/format.ts` : la directive est explicite dans la
   Story 3.1, et elle a une raison. Un second fichier de dates serait une seconde
   source de vérité — or le piège `date-tz.md` naît précisément de la multiplication
   des endroits qui convertissent. Tout ce qui s'AFFICHE passe par ces trois fonctions ;
   aucun composant ne doit appeler `getDate()`, `getHours()` ni `toLocaleString()`.
   (`architecture.md` mentionne un `lib/format.ts` non réconcilié : ne pas le créer.)

   Les valeurs NUMÉRIQUES viennent de `parisParts` — la même fonction que la logique
   métier —, seuls les NOMS (mois, jour de semaine) viennent d'`Intl`. Ce partage est
   la garantie qu'un chiffre affiché ne peut pas diverger d'un chiffre calculé.
   ─────────────────────────────────────────────────────────────────────────────── */

// Instanciés une fois : construire un `Intl.DateTimeFormat` est l'opération coûteuse,
// pas le `format()`. Ces deux objets sont sans état, donc sûrs à partager.
const MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS_TZ, month: "long" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS_TZ, weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS_TZ, weekday: "long" });

/**
 * ⚠️ `Intl` rend les noms français en MINUSCULES — « juin », « jeu. » —, alors que la
 * maquette et les libellés de la story les veulent capitalisés (« Juin », « Jeu. »).
 * Aucune option d'`Intl` ne le fait : la capitalisation est à notre charge.
 * Aucun mois ni jour français ne commence par un caractère hors BMP : `charAt` suffit.
 */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Zéro de tête pour les champs de date à deux chiffres (« 25/06 », « 19h00 »). */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Grande date de la carte du prochain rendez-vous : `{ day: "18", month: "Juin" }`.
 *
 * Le jour est rendu SANS zéro de tête (« 8 » et non « 08 ») : c'est un nombre affiché
 * en 74px, pas un champ de date — l'usage français d'un bloc calendrier. Le mois est
 * en toutes lettres, comme la maquette (`.big-date span`).
 */
export function formatBigDate(instant: Date): { day: string; month: string } {
  // Appelé en premier : c'est lui qui lève un `TypeError` parlant sur une date invalide.
  // `Intl.format` lèverait sinon un `RangeError` à l'endroit du formatage plutôt qu'à
  // celui de la donnée fautive.
  const { day } = parisParts(instant);
  return { day: String(day), month: capitalize(MONTH_LONG.format(instant)) };
}

/**
 * Date compacte d'une ligne de roulement : `"Jeu. 25/06"`.
 *
 * ⚠️ UNE SEULE DATE, jamais une plage. La maquette affiche « 21-22/11 » pour Game in
 * Reims, mais le modèle de la Story 3.1 ne porte qu'un `starts_at` : inventer une fin
 * ici serait afficher une donnée qui n'existe pas. Écart assumé et tracé par la story.
 */
export function formatRowDate(instant: Date): string {
  const { day, month } = parisParts(instant);
  return `${capitalize(WEEKDAY_SHORT.format(instant))} ${pad2(day)}/${pad2(month)}`;
}

/**
 * Date complète, pour les blocs qui ont la place de l'écrire : `"Jeudi 23 juillet 2026"`.
 *
 * Ajouté par la Story 3.3 pour les événements PASSÉS de la page `/agenda`. L'ANNÉE y
 * est obligatoire et ce n'est pas de la verbosité : la liste des passés remonte le
 * temps et franchit donc les changements d'année. « Jeu. 02/01 » y serait ambigu, et
 * l'ambiguïté ne se verrait qu'en janvier — c'est-à-dire trop tard.
 *
 * Le mois reste en minuscules (« 23 juillet ») : en français il n'est capitalisé qu'en
 * tête d'énoncé, ce qu'il n'est pas ici. Seul le jour de semaine, qui ouvre la chaîne,
 * l'est.
 */
export function formatLongDate(instant: Date): string {
  const { day, year } = parisParts(instant);
  return `${capitalize(WEEKDAY_LONG.format(instant))} ${day} ${MONTH_LONG.format(instant)} ${year}`;
}

/**
 * Heure murale de Paris : `"19h00"`, `"9h00"`.
 *
 * Heure NON paddée, minutes paddées — la typographie française écrit « 9h00 » et non
 * « 09h00 ». La maquette écrit « 19h00 » sur la carte mais « 19h » sur les lignes de
 * roulement, pour un même événement de 19:00 : cette incohérence de maquette statique
 * n'est pas transcrite, un seul formateur sert les deux surfaces.
 */
export function formatTime(instant: Date): string {
  const { hour, minute } = parisParts(instant);
  return `${hour}h${pad2(minute)}`;
}

/**
 * L'instant en **ISO 8601 portant l'offset RÉEL de Paris** : `"2026-08-13T19:00:00+02:00"`.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 C'EST LA SEULE FORME QUI PART VERS UN SERVICE TIERS (Story 6.7, webhook n8n)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le geste réflexe est `instant.toISOString()`. Il rend `"2026-08-13T17:00:00.000Z"`, qui
 * désigne le **même instant** et n'est donc pas *faux* — mais qui a perdu la seule
 * information dont le destinataire a besoin : **l'heure que les gens liront sur l'affiche**.
 * Un workflow n8n qui compose « rendez-vous à 17h00 » à partir d'un `Z` publierait une
 * annonce fausse de deux heures, sur un réseau social, sans qu'aucune porte de ce dépôt ne
 * puisse le voir. C'est la moitié SORTANTE du piège bidirectionnel décrit juste en dessous.
 *
 * ⚠️ **ET LE PIÈGE EST INVERSÉ CHEZ LE DESTINATAIRE.** `00 référence/pieges/webhook-n8n.md`
 * documente le cas symétrique, payé sur *13 Leguillette* : un `z.string().datetime()` côté
 * n8n **REJETTE** un offset ISO et n'accepte que le `Z`. Les deux erreurs ont la même cause
 * — croire qu'« ISO » désigne une seule forme. Ici la règle du site est écrite, exportée et
 * **gardée** (`publicationPayloadSchema` refuse un `Z`), pour qu'elle ne se renégocie pas
 * silencieusement au premier réglage de nœud.
 *
 * 🔴 L'offset n'est **jamais écrit en dur** : `+02:00` est faux la moitié de l'année (voir
 * la règle de tête de ce fichier). Il est relu auprès d'`Intl` **pour cet instant-là**, par
 * la même fonction que celle qui sert à `parisWallClock`.
 *
 * Secondes toujours à `00` : la saisie n'a pas de secondes (`datetime-local`, Story 6.3), et
 * en produire ferait croire à une précision que la donnée n'a pas.
 */
export function toParisIso(instant: Date): string {
  const { year, month, day, hour, minute } = parisParts(instant);
  const offsetMinutes = parisOffsetMs(instant) / 60_000;
  const signe = offsetMinutes < 0 ? "-" : "+";
  const absolu = Math.abs(offsetMinutes);

  return (
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00` +
    `${signe}${pad2(Math.floor(absolu / 60))}:${pad2(absolu % 60)}`
  );
}

/* ───────────────────────────────────────────────────────────────────────────────
   SAISIE — PONT ENTRE `<input type="datetime-local">` ET L'INSTANT (Story 6.3)

   🔴 CES DEUX FONCTIONS SONT LE SEUL PONT AUTORISÉ, ET LE PIÈGE EST BIDIRECTIONNEL.

   ① À L'ÉCRITURE. Le champ HTML natif rend `"2026-08-06T19:00"` — **sans fuseau, par
      spécification**. C'est exactement la forme que `eventInputSchema` REFUSE (garde
      écrite en Story 3.1 pour cette story) : `new Date("2026-08-06T19:00")` s'interprète
      dans le fuseau du **process**, juste par coïncidence sur un poste à Paris, faux de
      deux heures dans le conteneur de production qui tourne en UTC.

   ② À LA LECTURE, ET C'EST LA MOITIÉ QUE PERSONNE N'ANTICIPE. Pour pré-remplir le champ
      à l'édition, le geste réflexe est `instant.toISOString().slice(0, 16)`. Il affiche
      **l'heure UTC** : un jeudi 19h00 s'ouvrirait à **17:00** en production, et le
      bénévole « corrigerait » une heure qui était juste. Le symptôme n'apparaît JAMAIS
      en local (poste à Paris) et serait imputé à un bug de saisie, pas de fuseau.

   ⚠️ Aucun composant, aucune page, aucune Server Action ne convertit lui-même. Ici, et
   nulle part ailleurs — c'est la règle de tête de ce fichier.
   ─────────────────────────────────────────────────────────────────────────────── */

/** Forme exacte produite par `<input type="datetime-local">` : `AAAA-MM-JJTHH:MM`. */
const FORMAT_SAISIE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Instant correspondant à la valeur d'un `<input type="datetime-local">`, lue comme une
 * **heure murale de Paris**.
 *
 * Rend `null` sur une valeur malformée plutôt que `Invalid Date` : un appelant qui
 * oublierait de tester une date invalide propagerait un `NaN` jusqu'en base, alors qu'un
 * `null` casse à l'endroit du défaut.
 */
export function parisWallClockFromInput(valeur: string): Date | null {
  const match = FORMAT_SAISIE.exec(valeur.trim());
  if (!match) return null;

  const annee = Number(match[1]);
  const mois = Number(match[2]);
  const jour = Number(match[3]);
  const heure = Number(match[4]);
  const minute = Number(match[5]);

  // 🔴 LES BORNES SONT VÉRIFIÉES ICI, PARCE QUE `parisWallClock` NORMALISE EN SILENCE.
  // Trouvé en revue (Edge Case Hunter) et MESURÉ : la regex ci-dessus ne compte que des
  // CHIFFRES, et `Date.UTC` traite tout débordement comme un report de calendrier — c'est
  // d'ailleurs une propriété VOULUE de `parisWallClock` (`nextThursdays` s'en sert pour
  // ajouter des jours sans arithmétique de calendrier), donc on ne la corrige surtout pas
  // là-bas. Sans la garde ci-dessous :
  //   "2026-13-32T25:99" → 2027-02-02 02:39  (accepté, sans la moindre erreur)
  //   "2026-00-15T19:00" → 2025-12-15 19:00  (silencieux : mois 00 = décembre précédent)
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || heure > 23 || minute > 59) return null;

  const instant = parisWallClock(annee, mois, jour, heure, minute);
  if (Number.isNaN(instant.getTime())) return null;

  // 🔴 ET LE CALENDRIER EST RELU, parce que les bornes ne suffisent pas : "2026-02-29"
  // a un mois et un jour parfaitement valides pris séparément, mais cette date N'EXISTE
  // PAS (2026 n'est pas bissextile) — mesuré, elle glissait au 1ᵉʳ mars **sans que
  // `diagnostiquerHeureMurale` ne dise rien**, puisqu'il ne compare qu'heure et minute.
  //
  // ⚠️ ON NE RELIT QUE L'ANNÉE, LE MOIS ET LE JOUR — jamais l'heure. Les deux heures
  // pathologiques du changement d'heure DÉPLACENT légitimement l'heure murale (c'est tout
  // le sujet de R23) et elles ne franchissent jamais minuit : la bascule a lieu à 02h00
  // locales. Relire l'heure ici ferait donc rejeter, comme « date invalide », précisément
  // le cas que le diagnostic doit ANNONCER.
  const relu = parisParts(instant);
  if (relu.year !== annee || relu.month !== mois || relu.day !== jour) return null;

  return instant;
}

/**
 * Valeur de `<input type="datetime-local">` correspondant à un instant, en **heure murale
 * de Paris**.
 *
 * ⚠️ Passe par `parisParts` et JAMAIS par `toISOString()` — voir ② en tête de section.
 */
export function toInputValue(instant: Date): string {
  const { year, month, day, hour, minute } = parisParts(instant);
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

/**
 * Diagnostic d'une heure murale saisie — **dette R23**, relevée à la revue de la Story 3.1
 * et laissée ouverte jusqu'ici parce qu'aucun écran ne permettait encore de saisir une
 * heure libre.
 *
 * 🔴 ON AVERTIT, ON NE CORRIGE PAS. `parisWallClock` n'est pas modifiée : la corriger
 * *« rendrait un instant que personne n'a demandé »* (voir son propre commentaire). Le
 * bénévole voit ce qui sera enregistré, et décide.
 *
 * Les deux cas sont DÉTECTÉS PAR ALLER-RETOUR, jamais par une table de dates de bascule
 * codée en dur — c'est la base de fuseaux du système qui sait quand la bascule a lieu :
 *   - **inexistante** (fin mars) : l'heure relue diffère de l'heure demandée ;
 *   - **ambiguë** (fin octobre) : l'instant d'une heure PLUS TÔT porte la même heure
 *     murale, donc la même heure murale désigne deux instants. `parisWallClock` retient
 *     toujours le **second** (heure d'hiver).
 */
export type DiagnosticHeure =
  | { cas: "ok" }
  | { cas: "inexistante" | "ambigue"; message: string };

const UNE_HEURE_MS = 3_600_000;

export function diagnostiquerHeureMurale(valeur: string): DiagnosticHeure {
  const instant = parisWallClockFromInput(valeur);
  if (instant === null) return { cas: "ok" }; // une valeur malformée est l'affaire de Zod.

  const demande = FORMAT_SAISIE.exec(valeur.trim());
  if (!demande) return { cas: "ok" };

  const relu = parisParts(instant);
  const heureDemandee = `${demande[4]}:${demande[5]}`;
  const heureRelue = `${pad2(relu.hour)}:${pad2(relu.minute)}`;

  if (heureRelue !== heureDemandee) {
    return {
      cas: "inexistante",
      message:
        `Cette heure n'existe pas : le ${formatLongDate(instant)}, l'horloge avance d'une heure ` +
        `dans la nuit. L'événement sera enregistré à ${formatTime(instant)}.`,
    };
  }

  const uneHeureAvant = parisParts(new Date(instant.getTime() - UNE_HEURE_MS));
  if (uneHeureAvant.hour === relu.hour && uneHeureAvant.minute === relu.minute) {
    return {
      cas: "ambigue",
      message:
        `Cette heure existe deux fois le ${formatLongDate(instant)} : l'horloge recule d'une heure ` +
        `dans la nuit. C'est la seconde (heure d'hiver) qui sera enregistrée.`,
    };
  }

  return { cas: "ok" };
}
