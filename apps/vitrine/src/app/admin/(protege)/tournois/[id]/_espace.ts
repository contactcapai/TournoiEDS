// ══════════════════════════════════════════════════════════════════════════════════════
// LES ENTRÉES DE L'ESPACE D'UN TOURNOI (Story 10.9, dette R61)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE FICHIER EXISTE PARCE QUE CINQ SURFACES ONT ÉTÉ AJOUTÉES UNE PAR UNE, chacune
// justifiée SEULE (Stories 9.1, 9.3, 10.4, 10.5, 10.8) — et qu'aucune ne connaissait les
// autres. Chaque page portait sa propre barre de liens, écrite à la main : mesuré le
// 2026-08-24, aucune n'atteignait les quatre autres, et **depuis la fiche on ne pouvait
// atteindre ni les engagés ni le jour J** sans repasser par la liste.
//
// La leçon (dette R61) : « est-ce que cette entrée mérite d'être à part ? » est la bonne
// question à l'ajout, mais elle ne remplace pas « combien y en a-t-il, et comment on circule
// entre elles ? ». Une entrée se déclare ICI, une seule fois, et sa suppression emporte son
// lien — même doctrine que `_sections.ts` pour le back-office entier.

/** Une entrée de l'espace d'un tournoi. */
export type EntreeEspaceTournoi = {
  /** Suffixe collé à `/admin/tournois/<id>`. Vide = la fiche elle-même. */
  segment: string;
  /** Libellé affiché. Ce que la personne vient y FAIRE, pas le nom de la table. */
  libelle: string;
  /** Une ligne sous le libellé : à quel moment on s'en sert. */
  moment: string;
};

export const ENTREES_ESPACE_TOURNOI: readonly EntreeEspaceTournoi[] = [
  {
    segment: "",
    libelle: "La fiche",
    moment: "Nom, date, lieu, inscriptions",
  },
  {
    segment: "/phases",
    libelle: "Le déroulé",
    moment: "Poules, tableau, finale",
  },
  {
    segment: "/engages",
    libelle: "Les engagés",
    moment: "Qui joue, et qui est là",
  },
  {
    segment: "/jour-j",
    libelle: "Le jour J",
    moment: "Rencontres et résultats",
  },
  {
    segment: "/apercu",
    libelle: "L’aperçu",
    moment: "Ce que le public verra",
  },
];

/**
 * L'entrée correspondant à un chemin. ⚠️ Le segment vide (« La fiche ») matcherait TOUT en
 * comparaison par préfixe : on compare donc ce qui suit l'identifiant, à l'exact.
 */
export function entreeCourante(cheminComplet: string, tournoiId: string) {
  const base = `/admin/tournois/${tournoiId}`;
  if (!cheminComplet.startsWith(base)) return undefined;
  const reste = cheminComplet.slice(base.length).replace(/\/$/, "");
  return ENTREES_ESPACE_TOURNOI.find((entree) => entree.segment === reste);
}
