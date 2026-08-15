/**
 * Garde de texte VISIBLEMENT vide, partagée par les schémas Zod de la vitrine.
 *
 * 🔴 EXTRAIT DE `partner.ts` PAR LA STORY 4.3, ET C'EST UN ÉCART DÉLIBÉRÉ À LA RÈGLE
 * « compter, pas extraire ».
 *
 * La règle du projet (METHODE.md §5, leçon R9) est d'attendre le TROISIÈME consommateur —
 * c'est ce que la Story 4.2 a fait pour la géométrie de tuile (dette R27, 2 copies
 * comptées et assumées). Ici on extrait au DEUXIÈME, et la raison est la nature de la
 * duplication, pas son nombre : ceci n'est pas de la présentation, c'est une **garde de
 * correction**. Deux copies d'une règle Unicode divergent en silence — quelqu'un qui
 * comblerait demain un trou dans la classe de `partner.ts` n'aurait aucun moyen de savoir
 * que `photo.ts` porte la même règle avec le même trou. Une tuile qui diverge se VOIT au
 * gate visuel ; une classe de caractères invisibles, non. C'est exactement la famille des
 * dettes que `pieges/dette-invisible.md` recense.
 *
 * ⚠️ Ce module ne contient QUE ce qui est réellement partagé. Ne pas y déverser les
 * helpers propres à un schéma : ils portent des défauts et des messages qui appartiennent à
 * leur domaine.
 *
 * 🔴 RECTIFICATION DU 2026-08-06 (Story 6.13) — CETTE PHRASE CITAIT `optionalHttpUrl` COMME
 * CONTRE-EXEMPLE, ET C'EST EXACTEMENT LE MOTIF DE R37, UNE STORY PLUS TARD. Elle a été écrite
 * quand ce helper n'avait **un** consommateur (`partner.link`). La 6.13 lui en donne **cinq de
 * plus** — les cinq URL de `site_setting`, rendues dans le header et le footer des **5 pages**.
 * Le critère qui fait entrer un helper ici n'est pas « est-il générique ? » mais **« sa
 * divergence serait-elle silencieuse ? »**, et celle-ci le serait doublement : sa règle lie
 * littéralement ce dossier à `isExternalUrl()` de `lib/links.ts` (voir `urlHttpOptionnelle`),
 * et un trou comblé d'un seul côté ne se voit ni au lint, ni au typecheck, ni au build.
 * Ce qui appartenait au domaine de `partner`, c'était son **message** : il est devenu un
 * paramètre, exactement comme celui de `texteOptionnel`.
 *
 * 🔴 RECTIFICATION DU 2026-08-05 (Story 6.10) — CETTE PHRASE CITAIT `optionalText`, ET ELLE
 * A EU RAISON EXACTEMENT UNE FOIS. Elle a été écrite quand `texteOptionnel` n'existait qu'à
 * **un** exemplaire. Il y en avait **trois** au 2026-08-04 (`event.ts` 6.3, `partner.ts` 6.5,
 * `workshop.ts` 6.9), **et elles ne disaient pas la même chose** — dette **R37**. Le critère
 * qui fait entrer un helper ici n'est pas « est-il générique ? » mais « **sa divergence
 * serait-elle silencieuse ?** ». Celle-ci l'était : lint, typecheck, build et les quinze
 * instruments étaient verts, et un `git diff` sur des caractères invisibles ne montre rien.
 * `texteOptionnel` vit donc ci-dessous. La phrase est **corrigée à la source plutôt que
 * contournée en silence** (`00 référence/pieges/avertissement-commentaire.md`).
 */

import { z } from "zod";

import { neutraliserInvisibles, visiblementVide } from "../text";

/**
 * 🔴 CARACTÈRES SANS LARGEUR — `.trim()` NE LES ENLÈVE PAS, ET C'EST UN TROU RÉEL.
 *
 * `String.prototype.trim()` ne retire que les espaces au sens Unicode (`Zs`, plus quelques
 * contrôles). Une chaîne faite d'un seul U+200B (espace de largeur nulle) survit donc au
 * trim avec `length === 1` : elle est traitée comme RENSEIGNÉE alors qu'elle est
 * invisible. Mesuré à la revue de la Story 4.1 — `logo = "<U+200B>"` était accepté et
 * ressortait non-null, donc entrait dans le bandeau de la home et rendait un
 * `<img src="<U+200B>">`, c'est-à-dire une requête vers la page courante.
 *
 * Ces caractères arrivent par copier-coller depuis une page web ou un traitement de
 * texte : le cas est banal dès que des bénévoles saisissent (Stories 6.4, 6.5).
 *
 * ⚠️ ON NE LES RETIRE PAS DE LA VALEUR STOCKÉE, on s'en sert seulement pour décider si
 * elle est VIDE. ZWJ et ZWNJ (U+200C/U+200D) sont porteurs de sens dans plusieurs
 * écritures et dans les séquences d'emoji : les supprimer d'un nom légitime le
 * corromprait. La garde reste donc minimale — elle ne rejette que ce qui n'a AUCUN
 * caractère visible.
 *
 * 🔴 LA CLASSE DE CARACTÈRES A DÉMÉNAGÉ — STORY 6.11, ET LE MOTIF COMPTE.
 * Elle est née ici (Story 6.4/6.5) parce que seule la VALIDATION en avait besoin. La revue de
 * la 6.11 a établi que le **filet du RENDU** (`cleanText`, `lib/text.ts`) devait appliquer
 * exactement la même règle — et l'affirmait déjà en commentaire sans la tenir.
 * Deux consommateurs, donc **une** définition : elle vit désormais dans `lib/text.ts`, qui
 * n'a **aucun import**. L'inverse aurait fait entrer **zod** dans le chemin de rendu de 13
 * composants serveur. Ce fichier la RÉEXPORTE : ses six consommateurs ne changent pas.
 * ⚠️ Ne pas la redéfinir ici « pour éviter un import » — ce serait la 2ᵉ copie d'une règle
 * Unicode, et une divergence entre écriture et rendu serait parfaitement silencieuse.
 */
// Réexport : les six schémas consommateurs continuent d'importer depuis ce module.
export { visiblementVide };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE POINT D'ENTRÉE DE TOUT TEXTE SAISI — UNE SEULE DÉFINITION (Story 7.8, dette R41)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `z.string().trim()` existait en **sept** copies locales nommées `trimmedText` (event,
 * member, partner, photo, solicitation, tournament, workshop). Aucune ne retirait les
 * invisibles COLLÉS à une valeur visible : `"a@b.fr" + U+200B` traversait Zod ET tous les
 * `CHECK` de la base, et se stockait tel quel. Sept copies d'une règle Unicode, c'est la
 * famille R37 — on n'en corrige jamais sept, on en corrige une.
 *
 * ⚠️ `.overwrite()` et non `.transform()` : il applique la normalisation **en préservant le
 * type `ZodString`**, donc les `.max()` et `.refine()` des sept schémas continuent de
 * chaîner sans rien réécrire chez eux.
 *
 * ⚠️ Le second `.trim()` est nécessaire — retirer un invisible peut exposer un espace qui
 * était jusque-là interne.
 */
export const texteNettoye = z.string().trim().overwrite(neutraliserInvisibles).trim();

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CHAMP OPTIONNEL BORNÉ — UNE SEULE DÉFINITION, DEPUIS LA STORY 6.10 (dette R37 ①)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Une chaîne vide (formulaire non rempli) vaut `null`, pas `""`.
 *
 * 🔴 CE QUI EST SOLDÉ ICI, ET POURQUOI ÇA N'A PAS ÉTÉ FAIT PLUS TÔT. Cette fabrique existait
 * en **trois** exemplaires **divergents**, et la divergence était **silencieuse** :
 *
 *   · `event.ts` (6.3) plaçait `.max()` **AVANT** le `.transform()` ;
 *   · `partner.ts` (6.5) et `workshop.ts` (6.9) plaçaient un `.refine()` **APRÈS**.
 *
 * **Conséquence mesurée** : une chaîne de 300 caractères **invisibles** (U+200B) était
 * **REFUSÉE** par la version `event` (trop longue avant d'être jugée vide) et **ACCEPTÉE**
 * par les deux autres (transformée en `null`, et `null` passe le `refine`). Leurs messages
 * différaient aussi (« ne doit pas » / « ne peut pas »).
 *
 * La 6.9 l'a **comptée et délibérément pas extraite** : trancher la sémantique change le
 * comportement d'une story déjà mergée, et elle portait par ailleurs un modèle neuf et un
 * rendu public. La **6.10** est le 4ᵉ passage sur ce patron : elle a deux surfaces à
 * retrofiter et **un seul gate visuel**. C'est là que ça se paie.
 *
 * 🔴 SÉMANTIQUE RETENUE : CELLE DE `partner.ts` — LA BORNE EST COMPTÉE **APRÈS** `trim()`.
 * Le motif est **vérifiable et non esthétique** : c'est exactement ce que compte le compteur
 * de `ChampTexte` (`valeur.trim().length`). Les deux doivent dire la même chose, sinon le
 * compteur crie à tort — et **un compteur qui crie à tort est un compteur qu'on cesse de
 * lire** (défaut trouvé en revue de la 6.3).
 *
 * ⚠️ CHANGEMENT DE COMPORTEMENT ASSUMÉ SUR `event.ts`, ET IL EST VOULU : une chaîne de
 * caractères invisibles y est désormais traitée comme **VIDE** au lieu d'être refusée comme
 * **TROP LONGUE**. Ce n'est pas une régression, c'est le bon message : sur `venueName`, la
 * valeur devient `null` et c'est le `.refine()` du lieu qui parle — « indiquez un bar ou un
 * lieu » — au lieu de « le nom du lieu ne doit pas dépasser 120 caractères », qui n'aide
 * personne à corriger un champ visuellement vide.
 *
 * ⚠️ LA BORNE ENTRE **DANS LA FABRIQUE** et ne peut pas s'ajouter après coup par un `.max()` :
 * le `.transform()` a déjà changé le type en `string | null`, sur lequel `.max()` n'existe
 * pas — et l'y forcer par un `.pipe()` rendrait un message illisible. Le libellé du champ est
 * donc passé en paramètre : un bénévole doit lire « le public visé », pas « string ».
 *
 * ⚠️ `visiblementVide` est traité comme VIDE et **jamais comme une erreur** : un champ
 * facultatif rempli par un copier-coller qui n'a laissé que des caractères invisibles doit se
 * comporter comme un champ qu'on n'a pas rempli.
 *
 * @param max Longueur maximale, comptée **après** `trim()`.
 * @param libelle Le nom du champ **tel qu'un bénévole le lit** (« La description »).
 */
export const texteOptionnel = (max: number, libelle: string) =>
  texteNettoye
    .transform((value) => (visiblementVide(value) ? null : value))
    .nullable()
    .default(null)
    .refine((value) => value === null || value.length <= max, {
      message: `${libelle} ne peut pas dépasser ${max} caractères.`,
    });

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * URL http(s) OPTIONNELLE — UNE SEULE DÉFINITION, DEPUIS LA STORY 6.13
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Née dans `partner.ts` (Story 4.1) sous le nom `optionalHttpUrl`, **privée**, un seul
 * consommateur. La 6.13 lui en donne cinq de plus (`discord_url`, `instagram_url`, `x_url`,
 * `linkedin_url`, `helloasso_url`) — voir la rectification en tête de fichier.
 *
 * 🔴 ABSOLUE ET EN `http(s)`, ET C'EST UNE GARDE D'ACCESSIBILITÉ, PAS UN CAPRICE.
 * Le rendu dérive `target="_blank"` + la mention SR « nouvel onglet » + l'icône `ExternalIcon`
 * de `classerDestination()` / `isExternalUrl()` (`src/lib/links.ts`), qui ne reconnaissent
 * comme sortant qu'un schéma `http(s)`. Une valeur relative (« mately.fr », « /mately »)
 * passerait donc en lien **INTERNE** : le clic partirait vers une route inexistante de la
 * vitrine, **sans que rien ne l'annonce**.
 *
 * ⚠️ Volontairement PAS `z.url()` seul : il accepte `mailto:`, `javascript:` et `ftp:`. On veut
 * un site web, et `javascript:` dans un `href` est une injection.
 *
 * 🔴 ET ON EXIGE **EN PLUS** LA FORME LITTÉRALE QUE `isExternalUrl()` SAIT RECONNAÎTRE.
 * Ce n'est pas une redondance, c'est la seule façon que la promesse ci-dessus soit TENUE —
 * trouvé à la revue de la 6.5 : `new URL()` **NORMALISE**, alors que la valeur stockée est la
 * chaîne BRUTE, et que `links.ts` la teste avec `/^https?:\/\//`, **sans** le drapeau `i` et en
 * exigeant le double slash. Trois valeurs passaient donc le schéma puis étaient classées
 * INTERNES, le navigateur y naviguant pourtant comme à une URL absolue :
 *
 *     « HTTPS://exemple.fr »   (casse)
 *     « https:exemple.fr »     (pas de slash)
 *     « https:/exemple.fr »    (un seul slash)
 *
 * Résultat : ni `target="_blank"`, ni annonce « nouvel onglet ». ⚠️ **Ne pas « simplifier » en
 * retirant ce dernier test** : les deux conditions couvrent des choses différentes, et c'est la
 * seconde qui lie ce module à `links.ts`. En 6.13 le cas n'a plus rien de théorique — le lien
 * est rendu dans le **header et le footer des 5 pages**.
 *
 * ⚠️ Une valeur `visiblementVide` (espaces, U+200B collés par un copier-coller) vaut **`null`**
 * et **jamais une erreur** : un champ facultatif dont le collage n'a laissé que de l'invisible
 * doit se comporter comme un champ qu'on n'a pas rempli — même sémantique que `texteOptionnel`.
 *
 * @param max Longueur maximale, comptée **après** `trim()`.
 * @param libelle Le nom du champ **tel qu'un bénévole le lit** (« L'adresse du Discord »).
 */
export const urlHttpOptionnelle = (max: number, libelle: string) =>
  texteNettoye
    .transform((value) => (visiblementVide(value) ? null : value))
    .nullable()
    .default(null)
    // Borne AVANT la validation de forme : « trop longue » est un diagnostic plus utile que
    // « adresse invalide » sur une URL de 4 000 caractères, qui l'est aussi mais pour une
    // raison qu'on ne lui reproche pas.
    .refine((value) => value === null || value.length <= max, {
      message: `${libelle} ne peut pas dépasser ${max} caractères.`,
    })
    .refine(
      (value) => {
        if (value === null) return true;
        if (!z.url().safeParse(value).success) return false;
        // `z.url()` a validé la FORME ; on restreint ici le SCHÉMA.
        if (!/^https?:$/i.test(new URL(value).protocol)) return false;
        // La forme littérale attendue par `isExternalUrl()` — voir l'en-tête.
        return /^https?:\/\//.test(value);
      },
      {
        message:
          `${libelle} est invalide : elle doit commencer par https:// (ou http://) et être ` +
          `complète, par exemple https://exemple.fr — une adresse partielle enverrait le ` +
          `visiteur sur une page inexistante du site de l'asso.`,
      },
    );
