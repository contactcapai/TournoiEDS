/**
 * Schéma de validation partagé d'un tournoi (Story 9.1, A21/A23 de la note d'architecture).
 *
 * Vit sous `src/lib/` et non `src/server/` : il est importé par le formulaire CLIENT du
 * back-office autant que par la Server Action qui écrit en base. Un seul schéma des deux
 * côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 CE FICHIER EST LA SOURCE DES VALEURS DES DEUX ENUMS `tournament_registration_mode` ET
 * `tournament_registration_state` : `schema.ts` les importe d'ici pour construire ses
 * `pgEnum`. Le sens de la dépendance est celui-là et **pas l'inverse** — importer
 * `schema.ts` depuis un module que le client bundle ferait entrer tout Drizzle dans le
 * navigateur. Patron posé par `event.ts` (3.1), repayé par `partner.ts` (4.1),
 * `solicitation.ts` (5.1) et `workshop.ts` (6.9).
 */
import { z } from "zod";

import { instantAvecFuseau } from "./instant";
import { texteOptionnel, urlHttpOptionnelle, visiblementVide } from "./texte";
// 🔴 `URL_MAX` EST IMPORTÉE, JAMAIS RECOPIÉE. Une URL d'inscription et une URL de réseau
// social sont **le même objet** (une adresse http(s) saisie par un bénévole) : deux bornes
// distinctes divergeraient au premier ajustement, et personne ne saurait laquelle fait foi.
// C'est le seul emprunt de ce fichier — les bornes ci-dessous qui décrivent un objet PROPRE
// au tournoi restent locales, exactement comme `workshop.ts` garde les siennes (voir le bloc
// d'alias obligatoires de `schema.ts`).
import { URL_MAX } from "./site-setting";

export { URL_MAX };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE MODE D'INSCRIPTION N'EST QU'UNE **PORTE D'ENTRÉE** — ARBITRAGE A3
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * *« C'est TOUJOURS notre moteur qui fait tourner le tournoi. MATELY ne fait que
 * l'inscription. »* ⇒ le mode ne change **que la manière dont les inscriptions entrent**.
 * En aval — phases, appariements, scores, classement, overlays, profils — **rien ne voit la
 * différence** (note d'architecture §4).
 *
 * ⚠️ EN FRANÇAIS, ET C'EST UNE MESURE, PAS UN GOÛT. Relevé le 2026-08-13 : sur les quatre
 * enums existants, **trois sont en français** (`partner_category`, `solicitation_type`,
 * `workshop_family`) ; seul `event_type` est en anglais. La convention réelle du projet est
 * **la langue du DOMAINE** — et « interne » / « mately » sont des mots du domaine.
 *
 * ⚠️ `mately` EST UN NOM PROPRE EN MINUSCULES : c'est un identifiant d'enum Postgres, pas un
 * libellé. Les libellés lisibles (« Sur notre site », « Par MATELY ») vivent dans le RENDU.
 *
 * 🔴 CE QUE CETTE STORY NE LIVRE PAS, ET IL FAUT LE SAVOIR AVANT DE CODER LA FICHE (9.3) :
 * le mode `interne` **n'a aucun formulaire d'inscription** — il arrivera aux Epics 10/11.
 * D'ici là, un tournoi en mode `interne` affichera son **état** d'inscriptions et **aucun
 * bouton** ; c'est écrit dans la story plutôt que découvert à la 9.3. Le mode `mately`, lui,
 * est **utile dès le premier jour** : il lui suffit d'une URL externe (A23 ②).
 */
export const REGISTRATION_MODES = ["interne", "mately"] as const;

/** Le type des deux modes, **dérivé de la liste ci-dessus** (patron `WorkshopFamily`). */
export type TournamentRegistrationMode = (typeof REGISTRATION_MODES)[number];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'ÉTAT DES INSCRIPTIONS N'EST **PAS** « À VENIR / PASSÉ » — PIÈGE DÉSAMORCÉ D'EMBLÉE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Note d'architecture §6 ① : *« ne pas confondre deux choses différentes — la **dérivation
 * par dates** sert l'affichage public ; le **cycle de vie** est un état réel. Les mélanger
 * produirait un tournoi "à venir" dont les inscriptions sont closes, ou l'inverse. »*
 *
 * ⇒ Cette colonne dit **uniquement** si l'on peut s'inscrire **maintenant**. « À venir » et
 * « passé » se **dérivent de `starts_at`** (Story 9.2), comme `queries/events.ts` le fait
 * déjà par `gt`/`lte` — patron **mesuré** le 2026-08-13, à reprendre et non à réinventer.
 * ⚠️ Il n'y a donc **aucune colonne `is_past`**, et il ne faut pas en ajouter : un drapeau
 * tenu à la main dérive (ce projet l'a payé sur un sous-total recalculé à la main en 6.13).
 *
 * ⚠️ ORTHOGRAPHE SANS ACCENT (`completes`, `fermees`) : identifiants d'enum Postgres, jamais
 * des libellés — même règle que `evenement` dans `WORKSHOP_FAMILIES`.
 */
export const REGISTRATION_STATES = ["ouvertes", "completes", "fermees"] as const;

/** Le type des trois états, **dérivé de la liste ci-dessus**. */
export type TournamentRegistrationState = (typeof REGISTRATION_STATES)[number];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 BORNES DE LONGUEUR — POSÉES DÈS LA MIGRATION INITIALE, ET C'EST LE POINT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Quatre tables de ce projet ont payé une migration de **RATTRAPAGE** pour des bornes
 * absentes (`0006` sur `event`/`bar`, `0008` sur `photo.alt`, `0009` sur `partner`), toujours
 * pour le même motif : la table était née **avant** son écran de saisie. `workshop` (`0010`)
 * et `member` (`0011`) sont nées **avec** le leur et n'ont rien eu à rattraper. `tournament`
 * naît **avec** le sien : ses `CHECK` de non-blanc **et** de plafond entrent dans la `0014`.
 *
 * 🔴 CES CONSTANTES SONT IMPORTÉES PAR `server/db/schema.ts` POUR CONSTRUIRE SES `CHECK`.
 * La base et Zod expriment **la même règle** en deux langages, jamais deux littéraux recopiés
 * qui divergeraient au premier ajustement.
 *
 * ⚠️ VALEURS **CHOISIES, PAS MESURÉES** — et la différence compte : la table est vide, il n'y
 * a rien à mesurer. Chacune est donc alignée sur une borne **déjà en place ailleurs**, ce qui
 * est le meilleur argument disponible, et l'alignement est écrit pour être vérifiable.
 */

/** Le nom du tournoi (« CS2 2v2 — Game'in Reims »). Aligné sur `event.TITRE_MAX`. */
export const NOM_MAX = 80;

/**
 * Le ou les jeux (« Counter-Strike 2 »). Aligné sur `event.JEUX_MAX` — **même objet
 * éditorial**, et volontairement pas un enum : le dossier GIR 2026 en compte déjà **dix**
 * (CS2, Valorant, LoL, Rocket League, 2XKO, TFT, Speedrunners, Boomerang Fu, VR, Clone Hero),
 * et un enum imposerait une migration à chaque nouveau jeu — c'est-à-dire à chaque tournoi.
 */
export const JEU_MAX = 120;

/**
 * L'identifiant lisible de l'URL (`/tournois/cs2-2v2-gir-2026`). Aligné sur `NOM_MAX`,
 * **puisqu'il en dérive** : une borne plus courte ferait échouer la dérivation d'un nom
 * pourtant valide, à un endroit où le bénévole ne comprendrait pas ce qu'on lui reproche.
 */
export const IDENTIFIANT_MAX = 80;

/** La salle ou l'espace, **en plus** du lieu de l'événement. Aligné sur `event.LIEU_NOM_MAX`. */
export const LIEU_MAX = 120;

/**
 * Le déroulé annoncé, en toutes lettres. Aligné sur `event.DESCRIPTION_MAX` — même objet :
 * un paragraphe présenté au public, pas une ligne.
 */
export const FORMAT_MAX = 600;

/** Les lots. Aligné sur `partner.DESCRIPTION_MAX` / `workshop.RESUME_MAX` : **une ligne**. */
export const LOTS_MAX = 200;

/** Un nom de podium. Aligné sur la borne des noms courts du projet (`BAR_NOM_MAX`, `LIEU_MAX`). */
export const PODIUM_MAX = 120;

/**
 * Durée estimée d'un match, **en minutes**.
 *
 * ⚠️ UN ENTIER ET NON DU TEXTE, contrairement au format : c'est la seule des quatre données
 * d'A23 ③ qui sera **envoyée à MATELY** (Story 11.1 : « date, lieu, capacité, fenêtre ») et
 * qui servira un jour à l'assistance au choix de format (note d'architecture §7 ③, qui a
 * besoin du « temps disponible »). Une chaîne obligerait chacun de ces consommateurs à
 * re-parser du français.
 * Plafond à 600 (dix heures) : au-delà ce n'est plus un match, c'est une erreur de saisie.
 */
export const DUREE_MATCH_MAX = 600;

/**
 * Le nombre de places annoncé.
 *
 * 🔴 CE N'EST **PAS** UN CHIFFRE DE COMMUNAUTÉ, ET LA DISTINCTION DOIT ÊTRE ÉCRITE ICI.
 * **FR16** interdit tout chiffre de communauté sur le site — nombre de membres, audience,
 * « +200 joueurs ». C'est pourquoi `workshop` et `member` n'ont **aucune** colonne d'effectif,
 * et pourquoi `gate:ateliers` ⑩ interdit qu'on leur en ajoute une. Une **capacité de tournoi**
 * est autre chose : c'est une **contrainte d'organisation** que le visiteur doit connaître
 * pour décider de s'inscrire, elle est explicitement demandée par **A23 ①**, et la Story 11.1
 * doit l'envoyer à MATELY. ⚠️ Ne pas « harmoniser » en la supprimant par symétrie avec
 * `workshop` : les deux règles ne parlent pas du même objet.
 * Plafond à 4096 : très au-delà de tout tournoi d'association, et borné.
 */
export const PLACES_MAX = 4096;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'IDENTIFIANT LISIBLE — AUCUN `slug` N'EXISTE DANS CE PROJET, TOUT EST À DÉCIDER ICI
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Mesuré le 2026-08-13 : le mot « slug » n'apparaît dans `schema.ts` et `src/lib/` **que**
 * pour désigner des **noms de fichiers de logos statiques** (`/partenaires/<slug>.webp`).
 * **Aucune table n'a de colonne d'identifiant lisible, aucun utilitaire n'en fabrique.**
 * C'est donc cette story qui tranche, puisque c'est elle qui crée la table (A3).
 *
 * **Décision A3** : identifiant **lisible**, **stocké**, **unique**, **dérivé du nom** à la
 * création, puis **modifiable tant que le tournoi n'est pas publié**. Une URL partagée sur
 * Discord, imprimée sur un flyer ou lue dans une description de stream doit être lisible
 * **et stable** — la figer à la publication est ce qui protège les liens déjà diffusés.
 *
 * ⚠️ LA FIXATION À LA PUBLICATION N'EST **PAS** EXPRIMABLE PAR UN `CHECK` : elle compare la
 * valeur **nouvelle** à la valeur **précédente**, ce qu'une contrainte de ligne ne voit pas.
 * Elle se tient donc **à la frontière d'écriture** (`server/actions/tournois.ts`), l'écran le
 * **dit** au lieu de le subir, et `gate:tournois` la prouve **dans les deux sens** — un
 * brouillon dont l'identifiant change, un publié dont il ne change pas. C'est exactement le
 * traitement prescrit par la note d'architecture §7 ② pour l'invariant « 1..N membres ».
 *
 * 🔴 LE MOTIF EXISTE EN DEUX ÉCRITURES, ET L'ÉCART EST DÉCLARÉ — patron `MOTIF_EMAIL` /
 * `MOTIF_EMAIL_SQL` de `site-setting.ts`. Ce ne sont pas deux copies : ce sont deux
 * expressions de la même règle, l'une en JS et l'autre en ERE POSIX, et `gate:tournois` les
 * confronte **aux mêmes valeurs** pour que la parité soit **mesurée** et non affirmée.
 * ✅ Ici, contrairement à `photo_filename_safe` et à `MOTIF_EMAIL_SQL`, **il n'y a aucun point
 * dans le motif** : le piège d'échappement à deux étages (`\.` qui s'évalue en point nu dans
 * un gabarit JS, mesuré en 6.5 puis en 6.10) **ne s'applique pas**. Ne pas ajouter de point à
 * ce motif sans relire ce paragraphe.
 */
export const MOTIF_IDENTIFIANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Le même motif en **ERE POSIX**, pour le `CHECK` de la base.
 *
 * ⚠️ `String.raw` et apostrophes SQL incluses : la valeur est inlinée par `sql.raw()` dans le
 * DDL versionné. Une interpolation nue deviendrait un **paramètre lié** (`~ $1`), donc une
 * migration **invalide** que ni le typecheck ni le build ne verraient — défaut mesuré à la
 * génération en Story 4.3. Le seul témoin est le `.sql` généré, **qu'il faut donc LIRE**.
 * ⚠️ Pas de groupe non capturant `(?:…)` en ERE POSIX : il n'existe pas. Le groupe est donc
 * capturant, ce qui ne change rien à ce que la contrainte accepte.
 */
export const MOTIF_IDENTIFIANT_SQL = String.raw`'^[a-z0-9]+(-[a-z0-9]+)*$'`;

/**
 * Marques diacritiques combinantes, retirées **après** normalisation NFD.
 *
 * 🔴 ÉCHAPPEMENTS EXPLICITES, JAMAIS LES CARACTÈRES EUX-MÊMES — doctrine de `lib/text.ts` :
 * ces points de code sont invisibles ou quasi invisibles dans un éditeur, et un `git diff` ne
 * montrerait rien d'une modification. Plage U+0300→U+036F (Combining Diacritical Marks).
 */
const DIACRITIQUES = /[̀-ͯ]/g;

/**
 * Dérive l'identifiant lisible d'un nom de tournoi. **Rend `""` s'il n'en reste rien.**
 *
 * « Tournoi CS2 2v2 — Game'in Reims ! » → `tournoi-cs2-2v2-game-in-reims`
 *
 * 🔴 ELLE PEUT LÉGITIMEMENT RENDRE LA CHAÎNE VIDE, ET CE N'EST PAS UN CAS THÉORIQUE À
 * IGNORER : un nom entièrement composé de caractères hors alphabet latin (« 日本語 ») ou de
 * ponctuation ne laisse **aucun** caractère utilisable. L'appelant ne doit donc **jamais**
 * supposer un résultat non vide — le schéma le refuse avec un message qui dit quoi faire, et
 * le formulaire laisse alors saisir l'identifiant à la main. Rendre `"tournoi"` par défaut
 * serait pire : deux tournois se retrouveraient en collision d'unicité sans que personne
 * comprenne pourquoi.
 *
 * ⚠️ LIMITE DÉCLARÉE : NFD ne décompose **pas** les ligatures (`œ`, `æ`) ni `ß`. « Cœur » rend
 * donc `c-ur` et non `coeur`. C'est acceptable parce que la valeur est **modifiable tant que
 * le tournoi n'est pas publié** (A3) : la dérivation est une **proposition**, pas un verdict.
 * Une table de translittération ferait entrer un dictionnaire pour un cas que l'écran corrige
 * en trois secondes.
 */
export function fabriquerIdentifiant(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    // Tout ce qui n'est ni lettre latine ni chiffre devient une césure — apostrophes,
    // tirets cadratins, emoji, caractères sans largeur compris.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const trimmedText = z.string().trim();

/**
 * Un tournoi (A21 : la racine MINIMALE — **sans** phases, **sans** inscriptions, **sans**
 * engagés, **sans** moteur).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CE SCHÉMA N'A PAS EST AUSSI DÉLIBÉRÉ QUE CE QU'IL A — PÉRIMÈTRE A5
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Aucun champ de **phase**, d'**inscrit**, d'**engagé**, de **match** ni de **score**. Ce
 * n'est pas un modèle « à compléter » : c'est la racine, et les Epics 10/11 l'**étendront**
 * au lieu de la remplacer (A21). Mélanger la racine et les phases referait le mécanisme
 * **R2** — une grosse story qui bloque ou évapore ses volets.
 * ⚠️ L'**ABSENCE** de ces colonnes est gardée par `gate:tournois`, pas par ce commentaire.
 *
 * 🔴 ET IL N'Y A **AUCUNE** COLONNE DE DATE DE FIN. Un tournoi porte sa date de DÉBUT (A1),
 * parce que la Game'in Reims est **un** événement portant **dix** animations à des heures
 * différentes : sans date propre on ne peut ni les ordonner, ni dériver « à venir / passés »
 * à l'échelle du tournoi. La date de fin, elle, n'est demandée par aucun critère et se
 * **déduira** des phases quand elles existeront (Story 10.1).
 */
export const tournamentInputSchema = z
  .object({
    /**
     * ⚠️ `.min(2)` COMPTE DES UNITÉS DE CODE, PAS DES CARACTÈRES VISIBLES — leçon payée sur
     * `partner.name` en revue de la 6.5 : un nom fait de deux U+200B mesure 2 et franchit la
     * borne. Le `refine` rétablit le sens de la règle, et il n'est **pas** redondant :
     * `btrim` côté base ne retire pas les caractères de largeur nulle (leçon 6.3), donc Zod
     * est **le seul** des deux à pouvoir fermer ce cas.
     */
    name: trimmedText
      .min(2, "Le nom du tournoi doit faire au moins 2 caractères.")
      .max(NOM_MAX, `Le nom du tournoi ne peut pas dépasser ${NOM_MAX} caractères.`)
      .refine((value) => !visiblementVide(value), {
        message: "Le nom ne peut pas être composé uniquement de caractères invisibles.",
      }),
    /**
     * **Obligatoire** : un tournoi dont on ne sait pas à quoi on joue n'est pas annonçable.
     * C'est une garde de rendu (la fiche l'affiche en tête, A23 ①), pas une préférence.
     */
    game: trimmedText
      .min(2, "Le jeu doit faire au moins 2 caractères.")
      .max(JEU_MAX, `Le jeu ne peut pas dépasser ${JEU_MAX} caractères.`)
      .refine((value) => !visiblementVide(value), {
        message: "Le jeu ne peut pas être composé uniquement de caractères invisibles.",
      }),
    /**
     * L'identifiant de l'URL. Le message nomme **la contrainte ET le remède** : un bénévole
     * à qui l'on dit « format invalide » ne sait pas quoi taper.
     */
    slug: trimmedText
      .min(2, "L'identifiant de l'adresse doit faire au moins 2 caractères.")
      .max(
        IDENTIFIANT_MAX,
        `L'identifiant de l'adresse ne peut pas dépasser ${IDENTIFIANT_MAX} caractères.`,
      )
      .refine((value) => MOTIF_IDENTIFIANT.test(value), {
        message:
          "L'identifiant de l'adresse ne peut contenir que des lettres non accentuées, des " +
          "chiffres et des tirets, par exemple « cs2-2v2-gir-2026 ». Il apparaît dans " +
          "l'adresse de la page du tournoi.",
      }),
    /**
     * 🔴 RATTACHEMENT **OBLIGATOIRE** À UN ÉVÉNEMENT DE L'AGENDA — DÉCISION 1 DU §8.
     * *« Un tournoi peut se faire en ligne mais on créera l'événement dans l'agenda pour l'y
     * rattacher. »* ⇒ **aucune colonne nullable de plus**, donc **aucune occasion de refaire
     * `event_has_venue`** — le `CHECK` qui valait `NULL`, passait, et est resté faux trois
     * epics.
     */
    eventId: z.uuid("Choisissez l'événement d'agenda auquel ce tournoi est rattaché."),
    /**
     * 🔴 LE VISUEL — **UNE PHOTO DE LA GALERIE**, ET FACULTATIF (arbitrage **A2**, question
     * ouverte n°2 tranchée « non obligatoire »).
     *
     * Le raisonnement complet vit dans `server/db/schema.ts` : une **4ᵉ famille de médias**
     * coûterait une route, son schéma, sa garde, et rouvrirait le piège du **404 silencieux**
     * de la Story 6.5. La galerie sait déjà téléverser, décrire et publier.
     * ⚠️ La chaîne vide vaut `null` **avant** la validation de format : un `<select>` dont
     * l'option « aucun visuel » porte `value=""` doit produire « pas de photo », pas
     * « identifiant invalide » — patron `optionalUuid` d'`event.ts`, repris tel quel.
     */
    photoId: trimmedText
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .default(null)
      .refine((value) => value === null || z.uuid().safeParse(value).success, {
        message: "Cette photo n'existe pas. Rechargez la page et choisissez-en une autre.",
      }),
    /**
     * 🔴 LE TOURNOI PORTE SA **PROPRE** DATE DE DÉBUT (A1), en plus de celle de l'événement.
     * Même doctrine que `event.startsAt` : **un seul `timestamptz`**, jamais deux colonnes
     * date + heure (qui rouvriraient le piège de fuseau à chaque lecture), et la valeur se
     * construit avec `parisWallClockFromInput`, **jamais** avec `new Date('…')`.
     * ⚠️ Le refus d'une date sans fuseau est ce qui rend le pont obligatoire — un
     * `<input type="datetime-local">` rend `"2026-11-21T14:00"`, sans fuseau **par
     * spécification**, et c'est exactement la forme refusée ici (piège mesuré en 6.3, et il
     * est **bidirectionnel et invisible en local**).
     *
     * 🔴 `instantAvecFuseau` EST LA **MÊME** GARDE QUE CELLE D'`event.startsAt`, pas une
     * seconde écriture : elle a été extraite vers `./instant.ts` par cette story, au 2ᵉ
     * consommateur, précisément parce que sa divergence serait silencieuse. Ne pas la
     * remplacer ici par un `z.date()` : il accepterait une chaîne convertie en amont dans le
     * fuseau du process, ce que la garde existe pour refuser.
     */
    startsAt: instantAvecFuseau,
    /**
     * La salle ou l'espace, **en plus** du lieu de l'événement. Facultatif : l'événement
     * porte déjà son lieu, et la plupart des tournois n'ont rien à préciser. Absent → la
     * ligne est masquée à l'affichage, jamais rendue vide (NFR8, doctrine UX-DR10).
     */
    venueName: texteOptionnel(LIEU_MAX, "La salle ou l'espace"),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════
     * 🔴 LE FORMAT ANNONCÉ EST **ÉDITORIAL**, ET LES PHASES FERONT FOI — A23 ③
     * ══════════════════════════════════════════════════════════════════════════════════
     *
     * C'est ce qu'on **promet au public** (« deux poules de 4, puis demi-finales et finale »).
     * Le jour où les phases existeront (Story 10.1), il y aura **deux descriptions du même
     * format** — ce texte et la structure réelle — et **personne ne saura laquelle croire**.
     * La note d'architecture tranche **maintenant**, avant que le cas se présente :
     *
     *   · ce texte est **éditorial** — il dit l'intention annoncée ;
     *   · **les phases font foi** dès qu'elles existent ;
     *   · ⇒ la fiche devra alors **DÉRIVER** ce qu'elle affiche, et **jamais lire deux
     *     sources**.
     *
     * ⚠️ Ne pas transformer ce champ en structure ici : A5 ferme le périmètre. Et ne pas le
     * supprimer non plus le jour venu sans avoir lu ce bloc — il reste le seul contenu
     * disponible pour un tournoi annoncé mais pas encore composé.
     */
    formatText: texteOptionnel(FORMAT_MAX, "Le déroulé annoncé"),
    /** Les lots (A23 ③). Une ligne, pas un règlement. Facultatif. */
    prizes: texteOptionnel(LOTS_MAX, "Les lots"),
    /**
     * Durée estimée d'un match, en minutes (A23 ③). Facultative.
     *
     * 🔴 BORNÉE DES DEUX CÔTÉS, et la borne haute n'est pas de la préciosité : `z.number()
     * .int()` accepte 5 000 000 000, que la colonne `integer` (int4) **refuse**. Sans borne,
     * la valeur traverserait la validation puis ferait remonter une erreur BRUTE du driver
     * (« value out of range for type integer ») au bénévole. Trouvé à la revue de la 6.5,
     * repris depuis.
     */
    matchDurationMinutes: z
      // 🔴 `error` SUR LE TYPE DE BASE, ET IL A ÉTÉ AJOUTÉ APRÈS REVUE. Sans lui, une saisie
      // non numérique (`"12abc"`, convertie en `NaN` par `entierOptionnel`) échoue **avant**
      // d'atteindre `.int()`/`.min()`/`.max()` — donc avec le message NATIF de zod,
      // `« Invalid input: expected number, received NaN »`, **en anglais**, remonté tel quel au
      // bénévole. 🔬 Mesuré. C'est le symétrique exact de ce que `_commun.ts` fait pour les
      // erreurs de la base : un écran dont tout le reste soigne ses messages ne doit pas en
      // laisser passer un de bibliothèque.
      .number({ error: "La durée d'un match doit être un nombre de minutes, en chiffres." })
      .int("La durée d'un match doit être un nombre entier de minutes.")
      .min(1, "La durée d'un match doit être d'au moins 1 minute.")
      .max(
        DUREE_MATCH_MAX,
        `La durée d'un match ne peut pas dépasser ${DUREE_MATCH_MAX} minutes.`,
      )
      .nullable()
      .default(null),
    /** Le nombre de places annoncé (A23 ①). Facultatif — voir `PLACES_MAX` pour FR16. */
    capacity: z
      // Même motif que `matchDurationMinutes` ci-dessus — voir son bloc.
      .number({ error: "Le nombre de places doit être un nombre, en chiffres." })
      .int("Le nombre de places doit être un nombre entier.")
      .min(1, "Le nombre de places doit être d'au moins 1.")
      .max(PLACES_MAX, `Le nombre de places ne peut pas dépasser ${PLACES_MAX}.`)
      .nullable()
      .default(null),
    /** Comment on s'inscrit (A23 ②). Voir `REGISTRATION_MODES`. */
    registrationMode: z.enum(REGISTRATION_MODES),
    /**
     * L'adresse d'inscription. **Obligatoire en mode `mately`** — voir le `superRefine`.
     *
     * ⚠️ `urlHttpOptionnelle` et non `z.url()` : elle exige la forme littérale que
     * `isExternalUrl()` sait reconnaître (`^https?://`, sans drapeau `i`, double slash
     * exigé). Trois valeurs passaient `z.url()` puis étaient classées **INTERNES** par le
     * rendu — « HTTPS://… », « https:… », « https:/… » —, donc rendues **sans** nouvel onglet
     * ni annonce pour lecteur d'écran (défaut trouvé à la revue de la 6.5). Ici l'enjeu est
     * plus fort encore : c'est le lien sur lequel un visiteur clique **pour s'inscrire**.
     */
    registrationUrl: urlHttpOptionnelle(URL_MAX, "L'adresse d'inscription"),
    /** Ouvertes / complètes / fermées. Voir `REGISTRATION_STATES`. */
    registrationState: z.enum(REGISTRATION_STATES).default("fermees"),
    /**
     * ══════════════════════════════════════════════════════════════════════════════════
     * 🔴 LE PODIUM EST **UNE** DONNÉE, ÉCRITE TANTÔT À LA MAIN, TANTÔT PAR LE MOTEUR — A23 ①
     * ══════════════════════════════════════════════════════════════════════════════════
     *
     * Le moteur n'existe pas encore : le podium se **saisit** dans la 8ᵉ section. Le jour où
     * il arrivera, **il écrira le même fait, au même endroit**. Règle « un seul propriétaire
     * par fait » (note d'architecture §5) :
     *
     *   🔴 **JAMAIS DEUX COLONNES.** Pas de « podium annoncé » à côté d'un « podium
     *   calculé », pas de `podium_manuel` doublé d'un `podium_moteur`. Deux podiums
     *   finiraient par diverger — et c'est le **résultat d'une compétition**.
     *
     * ⚠️ TROIS COLONNES DE **RANG**, ce n'est pas la même chose que deux colonnes du même
     * fait : elles décrivent trois places distinctes d'un seul et même podium. C'est la
     * décision 4 du §8 appliquée (« colonnes typées avec contraintes pour ce qui est COMMUN à
     * tous les formats ») — un podium est commun à tous les formats, un réglage de format ne
     * l'est pas.
     *
     * 🔴 ET **AUCUN `CHECK` « podium seulement si le tournoi est passé » N'EST TENTÉ** — AC4.
     * La date qui déterminerait « passé » vit sur **cette ligne** (`starts_at`), mais la
     * comparer à `now()` dans un `CHECK` est **interdit par Postgres** : une contrainte doit
     * être IMMUABLE, or une ligne valide aujourd'hui deviendrait invalide demain, et toute
     * restauration de sauvegarde échouerait. La règle est donc tenue **à l'affichage** (la
     * fiche ne montre le podium que pour un tournoi passé) **et par une garde de porte**,
     * et **ce choix est écrit** plutôt que découvert.
     */
    podiumFirst: texteOptionnel(PODIUM_MAX, "La première place"),
    podiumSecond: texteOptionnel(PODIUM_MAX, "La deuxième place"),
    podiumThird: texteOptionnel(PODIUM_MAX, "La troisième place"),
  })
  /**
   * 🔴 LA RÈGLE QUI LIE DEUX CHAMPS — ET SON JUMEAU SQL EST NULL-SAFE (AC3).
   *
   * Un tournoi en mode `mately` **doit** porter une URL d'inscription : sans elle, la fiche
   * afficherait « inscriptions ouvertes » avec **aucun moyen de s'inscrire**, c'est-à-dire le
   * pire des trois états possibles. En mode `interne`, l'URL est **inutile** (le formulaire
   * viendra des Epics 10/11) mais elle n'est pas interdite — la refuser ferait perdre la
   * valeur au premier basculement de mode, sans rien protéger.
   *
   * ⚠️ `path` EST RENSEIGNÉ : sans lui, l'erreur n'a pas de champ et le formulaire ne saurait
   * pas où poser le focus ni où afficher le message (patron `erreursParChamp`).
   */
  .superRefine((valeurs, ctx) => {
    if (valeurs.registrationMode === "mately" && valeurs.registrationUrl === null) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationUrl"],
        message:
          "En mode « inscription par MATELY », l'adresse d'inscription est obligatoire : " +
          "c'est le seul moyen de s'inscrire que la fiche pourra proposer.",
      });
    }
    /**
     * 🔴 UN PODIUM NE SAUTE PAS DE PLACE. Une deuxième place sans première, ou une troisième
     * sans deuxième, est une saisie **incomplète**, pas un podium — et la fiche la rendrait
     * avec un trou. ⚠️ Contrairement à la règle du mode ci-dessus, celle-ci EST exprimable
     * par un `CHECK` (elle ne regarde que la ligne courante), et elle y est **aussi** : la
     * base est le garde-fou qu'on ne peut pas contourner, Zod est celui qui parle au bénévole.
     */
    if (valeurs.podiumSecond !== null && valeurs.podiumFirst === null) {
      ctx.addIssue({
        code: "custom",
        path: ["podiumFirst"],
        message: "Renseignez la première place avant la deuxième.",
      });
    }
    if (valeurs.podiumThird !== null && valeurs.podiumSecond === null) {
      ctx.addIssue({
        code: "custom",
        path: ["podiumSecond"],
        message: "Renseignez la deuxième place avant la troisième.",
      });
    }
    /**
     * 🔴 UNE MÊME ÉQUIPE NE PEUT PAS OCCUPER DEUX PLACES — TROUVÉ EN REVUE, ET C'ÉTAIT UN TROU.
     *
     * 🔬 Mesuré : `podiumFirst = podiumSecond = "Team Alpha"` était **accepté**, par Zod comme
     * par la base. Le `superRefine` ne vérifiait que l'**absence de trou**, et les `CHECK` que
     * le non-vide et la longueur. Un podium n'est pas une liste : c'est un **classement**, et
     * deux places identiques n'en est pas un.
     * ⚠️ La comparaison est faite sur la valeur **déjà `trim`ée** (`texteOptionnel` a tourné
     * avant ce `superRefine`) : `"Alpha"` et `" Alpha "` sont donc bien vus comme identiques.
     * ⚠️ Elle reste **sensible à la casse et aux accents**, et c'est assumé : « ALPHA » et
     * « Alpha » peuvent légitimement désigner deux équipes distinctes, et normaliser ici
     * fabriquerait un refus que personne ne saurait corriger.
     */
    const places = [
      ["podiumFirst", valeurs.podiumFirst],
      ["podiumSecond", valeurs.podiumSecond],
      ["podiumThird", valeurs.podiumThird],
    ] as const;
    for (let i = 1; i < places.length; i++) {
      const [champ, valeur] = places[i];
      if (valeur === null) continue;
      if (places.slice(0, i).some(([, precedente]) => precedente === valeur)) {
        ctx.addIssue({
          code: "custom",
          path: [champ],
          message: `« ${valeur} » occupe déjà une autre place du podium : un classement ne peut pas désigner deux fois le même vainqueur.`,
        });
      }
    }
  });

export type TournamentInput = z.infer<typeof tournamentInputSchema>;
