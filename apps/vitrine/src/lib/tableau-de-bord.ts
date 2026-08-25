import { ajouterJours, jourLisible } from "./date-paris";
import type { GalerieDuDernierEvenement } from "@/server/db/queries/photos";
import type { TournoiQuiSeJoue } from "@/server/db/queries/tournaments";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUI ATTEND UNE RÉPONSE — LA RÈGLE DU TABLEAU DE BORD (Story 13.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER EST PUR, ET C'EST TOUT SON INTÉRÊT. La page lit la base, ce module décide
 * ce qui se dit. Les deux règles qu'il porte sont **datées**, donc du genre à être fausses
 * **en silence** : un tableau de bord qui annonce « se joue demain » le jour même n'a l'air
 * de rien. C'est exactement le critère qui déclenche un test dans ce dépôt.
 *
 * ⚠️ Il ne connaît PAS la base : ses entrées sont des résultats de lecture déjà faits. C'est
 * ce qui permet de l'éprouver sans Postgres, en quinze lignes par règle.
 */

/**
 * La fenêtre de « ça se joue » : aujourd'hui + 2 jours.
 *
 * ⚠️ DEUX ET PAS SEPT, et la raison n'est pas esthétique : au-delà, ce n'est plus « ce qui
 * attend », c'est l'agenda — et une bande qui annonce en permanence quelque chose cesse
 * d'être lue. Ouvert un jeudi, l'écran voit jusqu'au samedi ; ouvert un vendredi, tout le
 * week-end. C'est le besoin exprimé (« un tournoi qui se joue ce week-end »).
 */
export const FENETRE_JOURS = 2;

/**
 * Au-delà de 30 jours, une galerie restée vide n'est plus une chose qui attend : c'est de
 * l'histoire. ⚠️ Sans cette borne, une association qui ne photographie pas ses jeudis
 * verrait la même alerte pour toujours — et une alerte permanente n'est plus une alerte.
 */
export const GALERIE_JOURS = 30;

/** Une ligne de la bande « ce qui attend ». */
export type Attente = {
  cle: string;
  /**
   * Ce qui se lit. 🔴 TOUJOURS ÉCRIT EN TOUTES LETTRES : la couleur ne porte jamais
   * l'information seule (AA), elle ne fait que la répéter.
   */
  texte: string;
  /** Où l'on va pour s'en occuper. Toujours une page qui existe. */
  href: string;
  /**
   * 🔴 `true` ⇒ corail (`--alert`), et **une seule source y donne droit aujourd'hui** : une
   * sollicitation, où une personne réelle attend une réponse d'un humain. Le reste est à
   * faire sans que personne ne patiente — c'est l'or. La règle du token est « ce qui bloque
   * ou attend une réponse, jamais ce qui est simplement important » : l'élargir au reste le
   * viderait de son sens en une story.
   */
  urgent: boolean;
};

/**
 * Ce que la page a pu lire. 🔴 `null` SIGNIFIE « CE COMPTE N'OUVRE PAS CETTE SECTION », et
 * jamais « il n'y a rien » — les deux cas se distinguent par un niveau d'imbrication.
 * C'est ce qui empêche d'annoncer « 3 sollicitations » à un administrateur de tournoi, qui
 * ne peut pas les ouvrir : ce serait une porte sans pièce, le défaut que `_sections.ts`
 * existe pour empêcher et qui s'est déjà produit deux fois ici.
 */
export type LecturesTableauDeBord = {
  sollicitations: { aTraiter: number } | null;
  agenda: { prochain: { titre: string; jour: string } | null } | null;
  tournois: { quiSeJouent: readonly TournoiQuiSeJoue[] } | null;
  galerie: { dernierEvenement: GalerieDuDernierEvenement } | null;
};

/**
 * « 2026-08-25 » lu depuis « 2026-08-25 » → « aujourd'hui ».
 *
 * 🔴 LA COMPARAISON PORTE SUR DES JOURS, PAS SUR DES INSTANTS. Soustraire deux `Date` pour
 * en tirer un nombre de jours donne 23 h ou 25 h les deux week-ends de bascule d'heure, donc
 * un « demain » qui devient « aujourd'hui » une fois l'an. Ici les deux termes sont déjà des
 * jours de calendrier de Paris, et `ajouterJours` avance sur le calendrier, pas en
 * millisecondes.
 */
export function libelleJournee(jour: string, aujourdHui: string): string {
  if (jour === aujourdHui) return "aujourd'hui";
  if (jour === ajouterJours(aujourdHui, 1)) return "demain";
  return jourLisible(jour);
}

/**
 * La galerie a-t-elle laissé passer le dernier événement ?
 *
 * ⚠️ TROIS CONDITIONS, ET AUCUNE N'EST DE CONFORT : il faut un événement passé (sinon il n'y
 * a rien à raconter), aucune photo rattachée, et qu'il soit récent. La comparaison de deux
 * jours ISO se fait par CHAÎNES — « 2026-02-14 » < « 2026-03-15 » est vrai lexicalement
 * comme chronologiquement, et c'est la seule forme qui ne réintroduise pas de fuseau.
 */
export function galerieEnAttente(
  galerie: GalerieDuDernierEvenement,
  aujourdHui: string,
): boolean {
  if (galerie === null) return false;
  if (galerie.photos > 0) return false;
  return galerie.jour >= ajouterJours(aujourdHui, -GALERIE_JOURS);
}

/**
 * La bande, dans l'ordre où elle se lit.
 *
 * 🔴 L'ORDRE EST FIXE ET ÉCRIT ICI, jamais calculé depuis une « urgence ». Un classement
 * dynamique ferait changer la première ligne d'un jour à l'autre sans que personne sache
 * pourquoi, sur l'écran dont le travail est justement de dire par où commencer.
 * Il suit ce qui coûte le plus cher à oublier : une personne qui attend une réponse, puis
 * un tournoi qui se joue, puis le site qui n'annonce plus rien, puis la galerie.
 */
export function composerAttentes(
  lectures: LecturesTableauDeBord,
  aujourdHui: string,
): Attente[] {
  const attentes: Attente[] = [];

  const aTraiter = lectures.sollicitations?.aTraiter ?? 0;
  if (aTraiter > 0) {
    attentes.push({
      cle: "sollicitations",
      texte:
        aTraiter === 1
          ? "1 sollicitation attend une réponse"
          : `${aTraiter} sollicitations attendent une réponse`,
      href: "/admin/sollicitations",
      urgent: true,
    });
  }

  for (const tournoi of lectures.tournois?.quiSeJouent ?? []) {
    attentes.push({
      cle: `tournoi-${tournoi.id}`,
      texte: `${tournoi.nom} se joue ${libelleJournee(tournoi.journee, aujourdHui)}`,
      // Le jour J, et pas la fiche : c'est l'écran depuis lequel on pointe les présents et
      // on saisit les résultats. Envoyer sur la fiche ferait faire un clic de plus au seul
      // moment où l'on n'en a pas le temps.
      href: `/admin/tournois/${tournoi.id}/jour-j`,
      urgent: false,
    });
  }

  // ⚠️ `agenda !== null` d'abord : un compte qui n'ouvre pas l'agenda ne doit pas lire que
  // le site n'annonce rien — il ne peut pas y remédier.
  if (lectures.agenda !== null && lectures.agenda.prochain === null) {
    attentes.push({
      cle: "agenda-vide",
      texte: "Aucun rendez-vous à venir : le site n'annonce plus rien",
      href: "/admin/agenda",
      urgent: false,
    });
  }

  const galerie = lectures.galerie?.dernierEvenement ?? null;
  if (galerie !== null && galerieEnAttente(galerie, aujourdHui)) {
    attentes.push({
      cle: "galerie-muette",
      texte: `Aucune photo pour « ${galerie.titre} » (${jourLisible(galerie.jour)})`,
      href: "/admin/galerie",
      urgent: false,
    });
  }

  return attentes;
}
