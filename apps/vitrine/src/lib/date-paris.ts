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
 * ⚠️ UNE SEULE DATE DANS CETTE CASE, jamais une plage — et **le motif a changé le 2026-08-14
 * (Story 9.6)**. Il disait : *« le modèle de la Story 3.1 ne porte qu'un `starts_at` : inventer
 * une fin ici serait afficher une donnée qui n'existe pas »*. **Cette raison est morte** :
 * `event.ends_at` et `tournament.ends_at` existent. La laisser écrite ferait chercher une règle
 * qui n'existe plus (`00 référence/pieges/cadrage-perime.md`, et la leçon R33 ② : une borne
 * annoncée qui n'existe plus est un mensonge aussi coûteux qu'une borne tue).
 *
 * 🔴 LE NOUVEAU MOTIF EST UN ARBITRAGE DE RENDU (A6), PAS UNE ABSENCE DE DONNÉE : la case de
 * gauche d'une ligne de roulement est un **repère de calendrier** compact (`« Jeu. 25/06 »`), et
 * la maquette y écrit « 21-22/11 » pour la Game in Reims. On ne l'y compose pas — **la fin est
 * dite à sa place**, dans l'horaire, par `formatPlageHoraire`, qui **nomme le jour** dès qu'il
 * diffère. L'information n'est donc jamais perdue ; elle est ailleurs, et une seule fois.
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
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'HORAIRE D'UN RENDEZ-VOUS — ET IL DIT LE **JOUR** QUAND LA FIN N'EST PAS LE MÊME
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Story 9.6. `« 14h00 »` sans fin · `« 14h00 → 18h00 »` avec une fin le **même** jour ·
 * `« 14h00 → dim. 22/11 à 02h00 »` quand elle tombe **un autre jour**.
 *
 * 🔴 LE TROISIÈME CAS N'EST PAS UN RAFFINEMENT, C'EST LA CORRECTION D'UNE AFFIRMATION FAUSSE.
 * La Game'in Reims est, dans `schema.ts`, *« **UN** événement portant **DIX** animations à des
 * heures différentes, **sur deux jours** »*. Rendre `« 14h00 → 02h00 »` pour un rendez-vous qui
 * finit **le lendemain** dirait au visiteur que c'est fini le soir même — et **rien ne le
 * verrait** : une ligne qui affiche une heure de plus n'a pas l'air cassée. C'est la famille de
 * la dette **R48** (affirmer un fait qu'on n'a pas), et le seul remède est de **dire le jour**.
 *
 * 🔴 LA COMPARAISON PASSE PAR `parisParts`, **JAMAIS** PAR `getDate()`. Règle de tête de
 * `server/db/schema.ts` : `getDay()`, `getHours()` et `toISOString().slice(0,10)` répondent dans
 * le fuseau du **process** — juste par coïncidence sur un poste à Paris, faux dans le conteneur
 * de production qui tourne en **UTC**. Un rendez-vous du 21 à 23h00 finissant le 22 à 00h30
 * serait alors jugé « même jour » une fois sur deux, selon l'heure d'été.
 *
 * ⚠️ **UNE SEULE DÉFINITION POUR LES QUATRE SURFACES**, et la `densite` est le seul écart : la
 * carte d'accueil, la ligne d'agenda et la carte de `/tournois` sont serrées (`courte`), la fiche
 * a la place d'écrire la date en toutes lettres (`longue`). Ce n'est pas une prop « au cas où » —
 * les deux ont des consommateurs **réels** dès cette story. Quatre compositions à la main
 * divergeraient, et la divergence ne se verrait que sur le cas rare (la fin le lendemain).
 *
 * ⚠️ `fin` est accepté **`null`** pour que les quatre surfaces appellent la même fonction **sans
 * brancher** : une branche répétée quatre fois est une branche qu'on oublie une fois.
 * ⚠️ La flèche est écrite **ici, une seule fois** : c'est un arbitrage de rendu (gate visuel), et
 * il doit se changer en un endroit.
 */
export function formatPlageHoraire(
  debut: Date,
  fin: Date | null,
  densite: "courte" | "longue" = "courte",
): string {
  const debutTexte = formatTime(debut);
  if (fin === null) return debutTexte;

  const a = parisParts(debut);
  const b = parisParts(fin);
  const memeJour = a.year === b.year && a.month === b.month && a.day === b.day;

  if (memeJour) return `${debutTexte} → ${formatTime(fin)}`;

  /**
   * 🔴 L'ANNÉE APPARAÎT DÈS QU'ELLE CHANGE, **MÊME EN DENSITÉ COURTE** — trouvé en revue
   * (Edge Case Hunter), et ce dépôt avait déjà écrit pourquoi.
   *
   * `formatRowDate` ne porte **jamais** l'année (« Ven. 01/01 »). Un réveillon — 31/12 à 23h00,
   * fin le 01/01 à 02h00 — rendait donc `« 23h00 → Ven. 01/01 à 2h00 »`, où **rien ne dit que
   * c'est l'année suivante**. C'est mot pour mot l'ambiguïté que `formatLongDate` existe pour
   * éviter côté début, et son commentaire la qualifie déjà : *« Jeu. 02/01 y serait ambigu, et
   * l'ambiguïté ne se verrait qu'en janvier — c'est-à-dire trop tard »*.
   * ⚠️ On ne corrige **pas** `formatRowDate` : sa case de calendrier est compacte par
   * conception, et elle n'a pas ce problème (elle ne rend qu'**une** date, pas une relation
   * entre deux). C'est **ici** que le franchissement d'année existe.
   * ⚠️ Le cas est rare — une nuit par an — et c'est exactement pour ça qu'il ne serait jamais
   * diagnostiqué : une chaîne un peu plus longue une fois l'an vaut mieux qu'une date fausse
   * que personne ne relit.
   */
  const changeDAnnee = a.year !== b.year;
  const jour = densite === "longue" || changeDAnnee ? formatLongDate(fin) : formatRowDate(fin);
  return `${debutTexte} → ${jour} à ${formatTime(fin)}`;
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
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE MÊME PONT POUR UN CHAMP **FACULTATIF** — ET `null` NE PEUT PAS VOULOIR DIRE DEUX CHOSES
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔬 Mesuré (Story 9.6) : `parisWallClockFromInput` rend `null` sur une chaîne **vide** comme
 * sur une saisie **invalide** — la regex `FORMAT_SAISIE` ne matche ni l'une ni l'autre. Pour
 * `starts_at`, qui est obligatoire, l'ambiguïté n'existe pas : les deux cas sont des erreurs, et
 * les actions rendent le même message. **Pour un champ facultatif, elle est un défaut** : la
 * branche « pas renseigné » **effacerait** en silence une valeur déjà en base à la première
 * faute de frappe.
 *
 * 🔴 LE MOTIF EST CELUI, DÉJÀ ÉCRIT, DE `entierOptionnel` (`server/actions/tournois.ts`) :
 * *« On ne transforme **PAS** une saisie illisible en `null` : une faute de frappe **effacerait**
 * alors silencieusement la valeur déjà enregistrée, au lieu d'être signalée. »* Ce n'est donc pas
 * une règle inventée ici — c'est la même, appliquée aux dates.
 *
 * ⚠️ **UNE UNION DISCRIMINÉE ET PAS UN `Date | null`**, pour la même raison que la fonction
 * existe : un type qui ne distingue pas les deux cas laisserait l'appelant les confondre, ce qui
 * est très exactement le défaut. Le compilateur oblige à traiter `"invalide"`.
 *
 * ⚠️ La **validité calendaire** (29 février d'une année non bissextile), les **bornes** et le
 * **relevé de l'heure murale** ne sont pas refaits ici : ils vivent dans
 * `parisWallClockFromInput`, qui reste le seul pont. Cette fonction ne décide que de
 * l'**absence**.
 */
export type SaisieInstantOptionnel =
  | { cas: "absent" }
  | { cas: "invalide" }
  | { cas: "ok"; instant: Date };

export function parisWallClockOptionnelFromInput(valeur: string): SaisieInstantOptionnel {
  // `trim()` d'abord : un champ que le navigateur laisse à `""` et un champ où l'on n'a tapé
  // que des espaces sont la même chose — « pas renseigné ».
  if (valeur.trim().length === 0) return { cas: "absent" };
  const instant = parisWallClockFromInput(valeur);
  return instant === null ? { cas: "invalide" } : { cas: "ok", instant };
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

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LES **DEUX** BORNES D'UN HORAIRE, DIAGNOSTIQUÉES ENSEMBLE — ET C'EST UN CORRECTIF
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Story 9.6, **trouvé en revue (Blind Hunter)**. Les deux Server Actions écrivaient :
 *
 *     const avertissement = diagnostic.cas === "ok" ? lectureFin.avertissement : diagnostic.message;
 *
 * sous un commentaire qui affirmait *« LES DEUX AVERTISSEMENTS, ET LE DÉBUT D'ABORD »*. C'est un
 * ternaire : il n'en rend **jamais deux**, et l'avertissement de la fin était **silencieusement
 * jeté** dès que le début en avait un. Le commentaire décrivait une garde qui n'existait pas —
 * `00 référence/pieges/avertissement-commentaire.md`, et il était **copié à l'identique** dans
 * les deux actions.
 *
 * 🔴 **ET LE DÉFAUT ÉTAIT PLUS LARGE QUE CE QUE LA REVUE A VU** : `EventForm` calcule en plus un
 * avertissement **côté client, en direct**, et il ne regardait que `startsAt`. Une fin saisie
 * dans une heure pathologique n'était donc signalée **ni pendant la frappe, ni à l'envoi**.
 * ⇒ La règle vit désormais **ici**, en un seul endroit, consommée par les trois.
 *
 * ⚠️ **CONCATÉNER LES DEUX MESSAGES BRUTS AURAIT FABRIQUÉ UN SECOND MENSONGE.** Celui de
 * `diagnostiquerHeureMurale` dit *« L'événement sera enregistré à 3h00 »* — vrai pour un début,
 * **faux pour une fin** : c'est la FIN qui sera enregistrée à 3h00. D'où les préfixes, et
 * **seulement quand il y a deux messages** : à un seul, la sortie est **identique au caractère
 * près** à celle d'avant cette story (non-régression du cas courant, qui est le seul atteint en
 * pratique).
 *
 * ⚠️ Une saisie vide ou malformée rend `{ cas: "ok" }` (voir `diagnostiquerHeureMurale`) : une
 * fin absente ne produit donc aucun message, et une fin illisible est l'affaire de
 * `parisWallClockOptionnelFromInput`, pas de celle-ci.
 */
export function avertissementHeuresMurales(
  saisieDebut: string,
  saisieFin: string,
): string | null {
  const debut = diagnostiquerHeureMurale(saisieDebut);
  const fin = diagnostiquerHeureMurale(saisieFin);
  const messageDebut = debut.cas === "ok" ? null : debut.message;
  const messageFin = fin.cas === "ok" ? null : fin.message;

  if (messageDebut === null && messageFin === null) return null;
  if (messageFin === null) return messageDebut;
  if (messageDebut === null) return `Heure de fin — ${messageFin}`;
  // Le début d'abord : c'est lui qui porte le rendez-vous, une fin sans lui n'aurait pas de sens.
  return `Début — ${messageDebut} Heure de fin — ${messageFin}`;
}

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

// ══════════════════════════════════════════════════════════════════════════════════════
// LES JOURS-CALENDRIERS — « quel week-end ? », et non « à quelle seconde ? » (2026-08-24)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE QUI SUIT NE MANIPULE AUCUN INSTANT, ET C'EST TOUTE LA RAISON D'ÊTRE DE CE BLOC.
// `tournament_phase.played_on` est un `date` Postgres lu en `mode: "string"` : « 2026-09-06 »
// entre et sort tel quel, sans jamais devenir un moment. La question posée par une journée de
// tournoi est un QUANTIÈME, pas une heure — et un quantième n'a pas de fuseau.
//
// ⚠️ L'INTERDIT `toISOString().slice(0, 10)` DU HAUT DE CE FICHIER VISE UN AUTRE CAS, et il
// faut savoir lequel pour ne pas croire ce bloc en infraction : il interdit d'extraire un jour
// d'un INSTANT (une horloge, un `starts_at`), parce que le fuseau décide alors du résultat.
// Ici, la `Date` est fabriquée par `Date.UTC` à partir de trois nombres — elle ne vient
// d'aucune horloge, et son quantième UTC est celui qu'on y a mis, partout dans le monde.
//
// ⚠️ Ces deux fonctions vivent ICI et pas dans `schemas/phase.ts` où elles ont été écrites
// d'abord : ce fichier est le SEUL endroit du dépôt qui a le droit de raisonner sur des dates,
// et le laisser contourner par « ce n'est qu'un petit calcul » est précisément comment le
// piège `date-tz.md` se repaie.

/** Décale un jour ISO (« 2026-09-06 ») de N jours, en restant une chaîne. */
export function ajouterJours(jour: string, nombre: number): string {
  const [annee, mois, quantieme] = jour.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, quantieme + nombre)).toISOString().slice(0, 10);
}

/**
 * « 2026-09-06 » → « samedi 6 septembre ». Sans année : on lit une journée dans un déroulé
 * dont l'année est déjà connue par le tournoi.
 *
 * 🔴 `timeZone: "UTC"` EST OBLIGATOIRE ET NON DÉCORATIF. Sans lui, `toLocaleDateString`
 * répond dans le fuseau de qui exécute : minuit UTC est encore **la veille** partout à
 * l'ouest de Greenwich. Une journée de tournoi s'afficherait au bon jour à Reims et au
 * mauvais ailleurs — un décalage d'un cran que personne ne verrait en local.
 */
export function jourLisible(jour: string): string {
  const [annee, mois, quantieme] = jour.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, quantieme)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Le jour de calendrier **à Paris** d'un instant, en ISO court (« 2026-08-25 »).
 *
 * 🔴 C'EST LE PONT ENTRE LES DEUX FORMES DE DATE DU DÉPÔT, et il n'y en a pas d'autre :
 * `event.starts_at` / `tournament.starts_at` sont des **instants** (`timestamptz`), tandis
 * que `tournament_phase.played_on` est un **jour** (`date`, mode chaîne). Comparer l'un à
 * l'autre demande de choisir une horloge — celle de Reims, jamais celle du serveur.
 *
 * ⚠️ NE JAMAIS ÉCRIRE `instant.toISOString().slice(0, 10)` À LA PLACE. C'est le jour **UTC**,
 * donc la veille pour tout ce qui se passe entre minuit et 02h00 heure d'été : un tournoi
 * du samedi saisi à 00h30 se lirait « vendredi », et le tableau de bord annoncerait qu'il
 * se joue demain le jour même. Le défaut ne se voit ni en test ni à l'œil tant qu'on ne
 * regarde pas l'écran à cette heure-là (`00 référence/pieges/date-tz.md`, § A).
 */
export function jourParis(instant: Date): string {
  const { year, month, day } = parisParts(instant);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * L'instant où commence un jour de Paris — minuit heure murale (« 2026-08-25 » → 22h00 UTC
 * la veille, en été). Sert à **borner une requête** sur une colonne `timestamptz`.
 *
 * 🔴 C'EST LA PARADE AU § B DU PIÈGE `date-tz.md`, et elle est structurelle : on ne demande
 * JAMAIS à Postgres de convertir un `timestamptz` en jour (`::date`, `date_trunc`). Ces
 * opérateurs s'évaluent dans le fuseau de la **session** — `Etc/UTC` en local, autre chose
 * sur le VPS — donc le découpage glisserait d'un jour sans erreur et sans qu'aucun test
 * local ne le voie. On convertit les **bornes** ici, en JS, avec l'horloge de Paris, et la
 * base ne compare plus que des instants entre eux.
 */
export function debutDuJourParis(jour: string): Date {
  const [annee, mois, quantieme] = jour.split("-").map(Number);
  return parisWallClock(annee, mois, quantieme);
}
