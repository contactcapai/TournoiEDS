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
 * helpers propres à un schéma (`optionalText`, `optionalHttpUrl`…) : ils portent des
 * défauts et des messages qui appartiennent à leur domaine.
 */

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
