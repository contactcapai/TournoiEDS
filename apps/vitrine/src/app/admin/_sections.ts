// ══════════════════════════════════════════════════════════════════════════════════════
// REGISTRE DES SECTIONS DU BACK-OFFICE (Story 6.1)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 UNE SECTION SE DÉCLARE DEPUIS LA STORY QUI LA LIVRE. ON N'EN LISTE JAMAIS UNE D'AVANCE.
//
// Ce fichier existe parce que le même défaut s'est produit DEUX FOIS sur ce projet, et la
// seconde fois par une SUPPRESSION :
//   • 2026-07-29 — le shell annonçait quatre sections, dont « sollicitations », qu'AUCUNE
//     story ne livrait. Corrigé en alignant la liste sur les stories existantes.
//   • 2026-08-02 — la liste comptait huit sections, dont « réalisations (6.12) ». Or la
//     Story 6.12 avait été SUPPRIMÉE le 2026-07-30 (la table `achievement` n'existe plus,
//     ses entrées sont des `partner` de catégorie `participation`). La porte sans pièce
//     était revenue toute seule.
//
// 🔴 LA LEÇON : une liste alignée UNE FOIS se désaligne à la suppression suivante. Aligner
// à la main est un rappel, pas une porte. Le seul montage qui tient est celui-ci — l'ajout
// d'une section reste LOCAL à la story qui la livre, et sa suppression emporte son entrée.
//
// ⚠️ CE TABLEAU EST VOLONTAIREMENT VIDE AU MERGE DE LA STORY 6.1. Le tableau de bord rend
// alors un état vide explicite. C'est la version honnête, et elle ne vit qu'une story : la
// 6.3 (agenda) est la suivante dans l'ordre et déclarera la première entrée.
//
// Pour ajouter une section, depuis SA story : ajouter un objet ci-dessous. Rien d'autre.

/** Une entrée de la navigation du back-office. */
export type SectionAdmin = {
  /** Chemin absolu sous `/admin` (ex. `/admin/agenda`). */
  href: string;
  /** Libellé affiché au bénévole. Registre courant, pas de jargon technique. */
  libelle: string;
  /** Une phrase : ce que le bénévole vient y faire. */
  description: string;
};

export const SECTIONS_ADMIN: readonly SectionAdmin[] = [
  {
    href: "/admin/agenda",
    libelle: "Agenda",
    description:
      "Les jeudis, les temps forts et les bars du roulement. Voir le rendu avant de publier.",
  },
  {
    href: "/admin/galerie",
    libelle: "Galerie",
    description:
      "Les photos de la vie de l'asso : téléverser, décrire, ordonner. Voir le rendu avant de publier.",
  },
  {
    href: "/admin/partenaires",
    libelle: "Partenaires",
    description:
      "Sponsors, partenaires, soutiens et participations : logos, ordre, publication. Voir le rendu avant de publier.",
  },
  {
    href: "/admin/ateliers",
    libelle: "Ateliers",
    description:
      "L'offre d'animations : intitulés, familles, ordre, publication. Voir le rendu avant de publier.",
  },
  // Story 6.10 → { href: "/admin/membres",       libelle: "Membres",       description: "…" }
  // Story 6.11 → { href: "/admin/sollicitations", libelle: "Sollicitations", description: "…" }
  // Story 6.13 → { href: "/admin/reglages",      libelle: "Réglages",      description: "…" }
] as const;
