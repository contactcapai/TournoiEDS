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
 * helpers propres à un schéma (`optionalHttpUrl`…) : ils portent des défauts et des
 * messages qui appartiennent à leur domaine.
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
 * 🔴 ÉCHAPPEMENTS EXPLICITES, JAMAIS LES CARACTÈRES EUX-MÊMES : ils sont INVISIBLES dans
 * un éditeur, donc une classe écrite en littéral serait impossible à relire ou à modifier
 * sans risque — et un `git diff` ne montrerait rien.
 * U+00AD trait d'union conditionnel · U+200B→U+200F espaces de largeur nulle et marques
 * de direction · U+2060→U+2064 jointures invisibles · U+FEFF BOM (déjà retiré par
 * `.trim()`, listé pour que la classe soit complète).
 */
const SANS_LARGEUR = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

/** Vrai si la chaîne ne contient AUCUN caractère visible (après retrait des sans-largeur). */
export const visiblementVide = (value: string) =>
  value.replace(SANS_LARGEUR, "").length === 0;

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
  z
    .string()
    .trim()
    .transform((value) => (visiblementVide(value) ? null : value))
    .nullable()
    .default(null)
    .refine((value) => value === null || value.length <= max, {
      message: `${libelle} ne peut pas dépasser ${max} caractères.`,
    });
