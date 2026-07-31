/**
 * Schéma de validation partagé d'une photo de galerie (AR-DB4, Story 4.3).
 *
 * Vit sous `src/lib/` et non `src/server/` : il sera importé par le formulaire CLIENT du
 * back-office (Story 6.4) autant que par la Server Action qui écrit en base. Un seul
 * schéma des deux côtés, sinon les deux règles divergent au premier changement.
 * Patron posé par `event.ts` (3.1) puis `partner.ts` (4.1).
 *
 * ⚠️ Ce module n'expose AUCUNE liste d'enum : `photo` n'en a pas. Ne pas en inventer une
 * « catégorie de photo » par symétrie avec `partner` — la galerie est un flux unique, et
 * le rattachement à un événement (`eventId`) porte déjà tout le classement dont le projet
 * a besoin aujourd'hui.
 */
import { z } from "zod";

import { visiblementVide } from "./texte";

const trimmedText = z.string().trim();

/**
 * 🔴 NOM DE FICHIER — C'EST LA VALEUR LA PLUS DANGEREUSE DE TOUT LE PROJET.
 *
 * Elle est concaténée à un chemin disque par la route de service (`/medias/[filename]`),
 * donc une valeur mal formée est une **traversée de répertoire** — la lecture d'un fichier
 * arbitraire du conteneur (`.env.prod`, qui porte la chaîne de connexion Postgres). Ce
 * risque n'existait pas avec un stockage tiers : la révision d'architecture du 2026-07-29
 * (sortie de Supabase Storage) le crée, et c'est cette story qui doit le traiter.
 *
 * La règle est donc une LISTE BLANCHE, jamais une liste noire :
 *   ① premier caractère alphanumérique — interdit `.caché`, `-flag`, `..` ;
 *   ② corps limité à `a-z 0-9 . _ -` — donc **ni `/`, ni `\`, ni `%`, ni `:`** ;
 *   ③ extension dans une liste close, en minuscules.
 *
 * 🔴 `.svg` EST ABSENT DE LA LISTE, ET CE N'EST PAS UN CHOIX DE FORMAT.
 * Un SVG servi `inline` depuis notre propre origine exécute son `<script>` dans le
 * contexte du site : c'est du **XSS stocké**, livré par le formulaire de la Story 6.4 à
 * un bénévole qui téléverserait un fichier reçu par mail. Next lui-même refuse
 * d'optimiser les SVG sans le drapeau `dangerouslyAllowSVG` — le nom du drapeau dit tout.
 * Une galerie de photos n'a aucun besoin de vectoriel.
 *
 * ⚠️ Cette règle est répliquée **au niveau de la table** (`CHECK photo_filename_safe`).
 * Les deux sont nécessaires et ne font pas le même travail — doctrine écrite dans
 * `lib/schemas/event.ts` et appliquée par la 4.1 après un finding de revue : « la base
 * est le garde-fou qu'on ne peut pas contourner ; le schéma Zod est celui qui donne un
 * message utilisable à un bénévole ». Un `UPDATE` direct, une restauration de sauvegarde
 * ou une migration de données ne passent par AUCUN schéma Zod.
 */
/**
 * 🔴 SOURCE UNIQUE DES EXTENSIONS AUTORISÉES — même sens de dépendance que
 * `PARTNER_CATEGORIES` → `pgEnum` : `schema.ts` importe cette liste pour construire son
 * `CHECK`, et `server/medias/` pour construire sa table de `Content-Type`. Trois
 * consommateurs, une seule liste. L'inverse (déclarer la liste dans `schema.ts`) ferait
 * entrer Drizzle dans le bundle client via ce module.
 */
export const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

/**
 * ⚠️ CONSTRUITE DEPUIS `EXTENSIONS`, jamais réécrite en littéral : une liste recopiée
 * dans une regex diverge au premier ajout de format, et la divergence se manifesterait
 * par un fichier accepté par Zod puis refusé par le `CHECK` — un message Postgres brut
 * pour un bénévole.
 * ⚠️ `\\.` et non `\.` : dans un littéral de gabarit JS, `\.` s'évalue en `.` (échappement
 * non reconnu), donc le point deviendrait « n'importe quel caractère ». Le même piège
 * vaut côté SQL — voir le `CHECK` de `schema.ts`, qui le documente et le fait éprouver.
 */
const NOM_FICHIER = new RegExp(`^[a-z0-9][a-z0-9._-]*\\.(${EXTENSIONS.join("|")})$`);

const FICHIER_MESSAGE =
  "Nom de fichier invalide : uniquement des lettres minuscules, chiffres, points, " +
  "tirets et tirets bas, et une extension parmi " +
  EXTENSIONS.map((e) => `.${e}`).join(", ") +
  ". Pas de dossier, pas d'accent, pas d'espace, pas de fichier .svg.";

const filename = trimmedText.refine(
  // 🔴 LE TEST `..` EST REDONDANT AVEC LA REGEX CI-DESSUS, ET IL RESTE.
  // `[a-z0-9._-]*` autorise deux points consécutifs : `a..b.png` passe la forme générale.
  // Il ne peut PAS produire de traversée à lui seul (il n'y a ni `/` ni `\` possible dans
  // le jeu de caractères), mais on ne veut pas que la sécurité de cette valeur dépende
  // d'un raisonnement à deux détentes tenu à jour par quelqu'un d'autre dans six mois.
  (value) => NOM_FICHIER.test(value) && !value.includes(".."),
  { message: FICHIER_MESSAGE },
);

/**
 * 🔴 `alt` EST OBLIGATOIRE, ET C'EST UNE EXTENSION ASSUMÉE D'`epics.md`.
 *
 * L'AC de la story liste « fichier, légende, `event_id`, ordre, `is_published` » — sans
 * `alt`. Mais `EXPERIENCE.md` l.194 (« alt-text obligatoire sur toutes les photos ») et
 * **NFR3** l'exigent, et l'AC2 de cette même story le réexige (« portent un `alt` réel »).
 *
 * ⚠️ LA LÉGENDE N'EST PAS UN ALT, et les confondre livrerait une galerie inutilisable au
 * lecteur d'écran tout en affichant 100/100 à Lighthouse (qui ne voit qu'un `alt` NON
 * VIDE, pas un `alt` PERTINENT) :
 *   caption → « Le stand, plein à craquer »  ... une émotion, un commentaire
 *   alt     → « Le stand d'Esport des Sacres à Game in Reims, une dizaine de
 *               visiteurs autour de deux postes de jeu »  ... une description
 *
 * `notNull` en base ET requis ici : sans colonne dédiée, le back-office de la 6.4
 * n'aurait **aucun endroit** où l'exiger, et la garde retomberait sur chaque appelant du
 * rendu — c'est-à-dire nulle part.
 */
const ALT_MESSAGE =
  "Décrivez ce que montre la photo, pour les personnes qui ne la voient pas " +
  "(ex. « Une dizaine de joueurs attablés devant deux écrans, dans un bar »). " +
  "Ce n'est pas la légende : la légende commente, la description informe.";

/**
 * 🔴 LA LÉGENDE EST BORNÉE, ET LA BORNE EST UNE DETTE PAYÉE (R24).
 *
 * Mesuré en Story 3.3 sur donnée réellement injectée : un texte de 299 caractères sans
 * espace passé en `caption` a fait déborder `/agenda` de **32,89px à 320px de viewport**,
 * débordement **rogné en silence** par `overflow-x: clip` — aucune porte ne l'aurait vu.
 * La 3.3 avait corrigé **chez l'appelant** (libellé borné par construction) pour ne pas
 * élargir le rayon de dégâts à `packages/ui` en cours de story. Cette story-ci fait passer
 * de la **donnée de back-office** dans `caption` : la garde doit donc vivre aux deux
 * endroits, sinon chaque consommateur la repaie.
 *
 * 60 caractères : les quatre légendes de la maquette font 11 à 25 caractères, et une
 * légende manuscrite longue est illisible par nature (`EXPERIENCE.md` É7 parle d'une
 * « légende du CONTEXTE »). La borne laisse le double de la plus longue.
 *
 * ⚠️ Elle ne remplace PAS la garde CSS de la primitive (`overflow-wrap`) : un `UPDATE`
 * direct ne passe par aucun schéma Zod. Les deux existent, et pour des raisons
 * différentes — c'est le patron R26, qui reprochait justement à la 3.3 de n'avoir borné
 * qu'au rendu (« un bénévole peut écrire un texte dont la fin ne sera jamais lue »).
 */
const CAPTION_MAX = 60;

export const photoInputSchema = z.object({
  filename,
  alt: trimmedText
    .min(10, ALT_MESSAGE)
    .max(300)
    .refine((value) => !visiblementVide(value), { message: ALT_MESSAGE }),
  /** Légende manuscrite (Caveat). Facultative : une photo peut parler d'elle-même. */
  caption: trimmedText
    .max(CAPTION_MAX, `La légende ne doit pas dépasser ${CAPTION_MAX} caractères.`)
    .transform((value) => (visiblementVide(value) ? null : value))
    .nullable()
    .default(null),
  /**
   * Événement rattaché, ou `null` pour une photo « de la vie de l'asso » sans occasion
   * précise. Nullable **par conception** : la galerie de la home lit `photo` seule, c'est
   * `/agenda` qui joint dans l'autre sens (voir `queries/photos.ts`).
   */
  eventId: z.uuid().nullable().default(null),
  /**
   * Bornes `int4` explicites : `z.number().int()` accepte 5 000 000 000, que la colonne
   * `integer` refuse — la valeur traverserait la validation puis ferait remonter une
   * erreur BRUTE du driver au bénévole. Défaut de la 4.1, trouvé à sa revue.
   */
  sortOrder: z
    .number()
    .int()
    .min(-2147483648, "Ordre d'affichage hors limites.")
    .max(2147483647, "Ordre d'affichage hors limites.")
    .default(0),
  /** Défaut `false` : rien n'est public par accident (patron `event`, `partner`). */
  isPublished: z.boolean().default(false),
});

export type PhotoInput = z.infer<typeof photoInputSchema>;
