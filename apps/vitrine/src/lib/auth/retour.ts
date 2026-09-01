/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * OÙ L'ON RETOURNE APRÈS S'ÊTRE CONNECTÉ (Story 12.2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CETTE FONCTION REMPLACE UNE GARDE QUI AVAIT ÉTÉ DURCIE APRÈS DEUX REVUES, ET IL FAUT DIRE
 * POURQUOI ON Y TOUCHE. Jusqu'ici, `next` devait matcher `/^\/admin(?:\/|$)/` : seul le
 * back-office était une destination de retour. C'était juste tant que **seul un administrateur**
 * avait une raison de se connecter. La Story 12.2 en donne une à tout le monde — « j'y serai »
 * depuis l'agenda ou la home — et sans lever cette borne, quelqu'un qui se connecte pour
 * annoncer sa venue atterrirait sur `/admin`, c'est-à-dire nulle part pour lui.
 *
 * 🔴 ON NE RELÂCHE PAS LA GARDE, ON LA REND **EXPLICITE**. Le danger visé n'a pas changé d'un
 * mot : un `?next=https://…` ferait de cette page un **redirecteur ouvert**, montage classique
 * d'un hameçonnage depuis une URL de confiance. Une **liste fermée de racines internes** répond
 * au même danger que le préfixe, et se lit d'un coup d'œil — là où une expression régulière
 * demande de raisonner à deux détentes. C'est d'ailleurs le reproche que la revue faisait déjà à
 * la version précédente : *« une garde dont il faut raisonner à deux détentes n'est pas une
 * garde »*.
 *
 * ⚠️ LES QUATRE REFUS SONT CONSERVÉS TELS QUELS, et chacun a coûté une revue :
 *   · `//ailleurs.example` — un chemin qui commence par `//` est une URL **protocol-relative** :
 *     le navigateur y voit un autre domaine ;
 *   · `..` — `/admin/../../ailleurs` satisfait n'importe quel préfixe ;
 *   · `\` — certains navigateurs le traitent comme `/` ;
 *   · tout ce qui ne commence pas par `/` — donc toute URL absolue.
 */

/**
 * Les racines vers lesquelles on accepte de revenir.
 *
 * ⚠️ **UNE RACINE, PAS UN MOTIF** : chaque entrée autorise **elle-même** et **ce qui est
 * dessous**, jamais un préfixe de chaîne. Sans cette distinction, `/tournois` autoriserait
 * `/tournois-pieges`, qui n'est pas la même page — c'est la version chaîne du défaut que
 * `cheminCouvertPar` corrige déjà côté sections (13.2).
 * ⚠️ **AJOUTER UNE RACINE EST UNE DÉCISION DE SÉCURITÉ**, pas une commodité : elle ouvre une
 * destination de retour à quiconque fabrique un lien.
 */
export const RACINES_DE_RETOUR = ["/admin", "/profil", "/agenda", "/tournois"] as const;

/**
 * Là où l'on va quand `next` est absent ou refusé.
 *
 * 🔴 `/profil` DEPUIS LA 12.4, ET CE N'ÉTAIT PLUS TENABLE À `/admin`. Se connecter sans
 * `next` — en cliquant « Créer mon profil » dans le chrome, ou en revenant sur `/connexion`
 * à la main — déposait le visiteur sur le **tableau de bord du back-office**. Un joueur n'y
 * a aucun rôle : il y voit un écran qui n'annonce rien, au bout d'un parcours qui promettait
 * un compte. C'est le mur que la 12.4 corrige, à un autre endroit que la page de connexion.
 *
 * ⚠️ `/profil` est la seule surface que TOUT compte connecté possède, rôle ou non — c'est
 * ce qui en fait un défaut légitime. `/admin` n'en était un que du temps où seuls des
 * administrateurs se connectaient.
 * ⚠️ CE QUE ÇA COÛTE À L'ÉQUIPE, ET C'EST ASSUMÉ : un bénévole qui tape `/connexion` à la
 * main arrive sur son profil, d'où le chrome lui offre « Back-office ». Un clic de plus pour
 * quelques bénévoles, contre un cul-de-sac évité pour tous les joueurs.
 * 🔴 AUCUN TEST N'AURAIT ROUGI EN CHANGEANT CETTE LIGNE : `retour.test.ts` compare à la
 * CONSTANTE, jamais à sa valeur. C'est pour ça que `retour.test.ts` en fige désormais la
 * valeur explicitement — une constante qu'aucun test ne lit littéralement peut changer de
 * sens sans que rien ne le dise.
 */
export const RETOUR_PAR_DEFAUT = "/profil";

export function destinationApresConnexion(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) return RETOUR_PAR_DEFAUT;

  // Refus de forme, avant toute analyse de chemin.
  if (!next.startsWith("/")) return RETOUR_PAR_DEFAUT;
  if (next.startsWith("//")) return RETOUR_PAR_DEFAUT;
  if (next.includes("..") || next.includes("\\")) return RETOUR_PAR_DEFAUT;

  // ⚠️ LA QUERY ET LE FRAGMENT SONT COUPÉS AVANT DE COMPARER, sinon `?`/`#` laisseraient passer
  // ce qui les suit sans que la racine s'en aperçoive.
  const chemin = next.split(/[?#]/)[0] ?? "";

  // L'accueil, et lui seul, en égalité stricte : le prendre comme racine autoriserait TOUT.
  if (chemin === "/") return next;

  const admise = RACINES_DE_RETOUR.some(
    (racine) => chemin === racine || chemin.startsWith(`${racine}/`),
  );
  return admise ? next : RETOUR_PAR_DEFAUT;
}
