import type { RendezVous } from "@/server/db/queries/rendez-vous";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN RENDEZ-VOUS PERMET D'AFFIRMER — DÉRIVATIONS PARTAGÉES (Story 9.5)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER N'IMPORTE **QUE DES TYPES** DE LA COUCHE DONNÉES, et c'est ce qui le rend
 * consommable partout : `import type` disparaît à la compilation, donc rien de `server-only`
 * n'entre dans un bundle par ce chemin. Patron `lib/libelles-tournoi.ts`.
 *
 * **Pourquoi ces fonctions existent, et pourquoi elles sont ICI.** La dette **R48** a été
 * mesurée sur staging le 2026-08-14 : le hub de l'accueil affirmait **quatre faits faux** dès
 * qu'un rendez-vous n'était pas un jeudi en bar (« On se voit **jeudi** ? » un mardi,
 * « roulement sur 4 bars rémois » pour un événement **en ligne**, « on reste **tant qu'on
 * veut** » sur un tournoi, « même **sans matériel** » sur un tournoi en ligne). La cause n'est
 * pas un oubli : ces phrases étaient **JUSTES** tant que tout rendez-vous était un jeudi en
 * bar. C'est `pieges/patron-eprouve-une-seule-nature.md` — *le commentaire qui justifie le
 * comportement est vrai N fois sur N*, et il décrit une **corrélation** prise pour une règle.
 * ⇒ Les prédicats vivent donc **en un seul endroit**, nommés, pour qu'un cinquième
 * consommateur n'ait pas à les redécouvrir.
 */

/**
 * Ce rendez-vous est-il un **jeudi jeux** — la soirée hebdomadaire en bar ?
 *
 * 🔴 C'EST LE SEUL PRÉDICAT QUI AUTORISE LA COPIE FIXE DU HUB. Les quatre phrases de R48
 * décrivent **cette** soirée-là : elle n'a pas d'heure de fin annoncée, elle est gratuite, et
 * le matériel est sur place. Aucune des quatre n'est vérifiable pour un temps fort ni pour un
 * tournoi — d'où un prédicat unique plutôt qu'un test de `type` recopié quatre fois.
 *
 * ⚠️ **UN TEMPS FORT (`special`) EN BAR PERD CES LIGNES, ET C'EST ASSUMÉ.** On échange une
 * **absence** contre un risque d'**affirmation fausse**, ce qui est la doctrine du projet
 * (UX-DR10 : masquer plutôt qu'annoncer ce qu'on ne garantit pas). Le modèle ne porte ni prix
 * ni jauge — et il ne doit pas commencer à en porter par ce biais, ce qui rouvrirait la
 * frontière Q6 (la prose éditoriale reste en dur).
 */
export function estJeudiJeux(rendezVous: RendezVous) {
  return rendezVous.nature === "evenement" && rendezVous.evenement.type === "thursday";
}

/**
 * Les tournois que ce rendez-vous met en jeu — **ce qu'il faut pour décider du CTA**.
 * Un rendez-vous « tournoi » en porte exactement un (lui-même) ; un événement porte ceux
 * qu'on lui a rattachés, éventuellement aucun.
 */
function tournoisDuRendezVous(rendezVous: RendezVous) {
  return rendezVous.nature === "tournoi" ? [rendezVous.tournoi] : rendezVous.tournois;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 OÙ MÈNE « J'Y SERAI » — **LA SEULE DÉRIVATION, ET ELLE EST ICI** (arbitrage A4)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le CTA promettait un engagement qu'il ne prenait pas : il renvoyait vers `/agenda`, quel que
 * soit le rendez-vous. Le défaut était **connu et à moitié corrigé** — il a été retiré de
 * `/agenda` à la Story 3.3 (« il n'avait aucune destination ») et **laissé sur l'accueil**,
 * sans qu'aucune dette ne le porte. Arbitrage de Brice, 2026-08-14 :
 *
 *   · **un seul** tournoi ⇒ le CTA désigne **ce** tournoi ;
 *   · **plusieurs** (cas Game'in Reims) ⇒ il renvoie à la liste `/tournois` ;
 *   · **aucun** ⇒ il **disparaît**, plutôt que de promettre une page qui ne dirait rien de
 *     plus que celle qu'on est en train de lire.
 *
 * ⚠️ **UN ENUM `type = "tournoi"` N'AURAIT PAS SU RÉPONDRE À CE « UN SEUL / PLUSIEURS »** —
 * c'est la **relation** qui le dit, et c'est l'argument le plus concret de l'arbitrage A2
 * (aucune valeur d'enum ajoutée, la nature se dérive).
 *
 * ✅ **DETTE R52 SOLDÉE PAR LA STORY 9.3 — LA FICHE EXISTE.** Ce bloc disait : *« La fiche
 * n'existe pas encore. Tant qu'elle n'existe pas, le cas "un seul" renvoie lui aussi vers
 * `/tournois` […] On ne fabrique JAMAIS `/tournois/<slug>` en pariant sur son arrivée — ce
 * serait un lien mort, c'est-à-dire le défaut R2. »* Le pari n'a pas eu lieu, la page est
 * arrivée : le cas « un seul » désigne désormais **ce** tournoi, comme l'arbitrage le
 * demandait depuis le début. Le `slug` était **déjà** remonté par `COLONNES_RENDEZ_VOUS` — la
 * donnée était là, il ne manquait que la page, et c'est ce qui a borné la reprise à une ligne.
 * ⚠️ **LE LIBELLÉ N'EST PAS TOUCHÉ ICI.** « J'y serai » reste « J'y serai » : c'est une
 * formulation **contractuelle** (UX-DR18), et la corriger serait un arbitrage **éditorial**
 * qui appartient au gate de Brice, pas au dev. Ce qui était faux était la **destination**,
 * pas le mot — d'où une fonction qui ne rend qu'un `href`.
 * ⚠️ **AUCUN FILTRE `is_published` N'EST REFAIT ICI, ET C'EST VOULU** : les deux lectures qui
 * alimentent `tournois` (`getUpcomingTournamentsSansEvenement` et `getTournoisParEvenement`)
 * le posent **déjà** en base. Le redoubler ici donnerait une seconde définition de « un
 * tournoi visible », et les deux divergeraient au premier ajustement.
 */
export function destinationDuCta(rendezVous: RendezVous): string | null {
  const tournois = tournoisDuRendezVous(rendezVous);
  if (tournois.length === 0) return null;
  return tournois.length === 1 ? `/tournois/${tournois[0].slug}` : "/tournois";
}
