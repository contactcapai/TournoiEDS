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
  {
    href: "/admin/membres",
    libelle: "Membres",
    description:
      "L'équipe présentée sur la page « L'asso » : prénom, rôle, portrait, ordre, publication. Voir le rendu avant de publier.",
  },
  {
    href: "/admin/sollicitations",
    libelle: "Sollicitations",
    // 🔴 CETTE DESCRIPTION NE FINIT **PAS** PAR « Voir le rendu avant de publier », alors que
    // les CINQ précédentes le font. Ce n'est pas un oubli : une sollicitation ne se publie
    // pas, il n'y a rien à prévisualiser, et cette section n'a donc **aucune route
    // `apercu/`**. Recopier la phrase par mimétisme promettrait une porte sans pièce — le
    // défaut exact que ce fichier existe pour empêcher, et qui s'est produit DEUX fois.
    description:
      "Les demandes reçues par le formulaire : les lire, les marquer traitées, les supprimer quand elles n'ont plus lieu d'être.",
  },
  {
    href: "/admin/reglages",
    libelle: "Réglages",
    // 🔴 NI « Voir le rendu avant de publier » (comme cinq des six précédentes), NI une
    // formulation qui laisserait croire à un brouillon. Cette section est la SEULE sans
    // liste, sans aperçu et **sans étape de publication** : ce qui y est enregistré est en
    // ligne au rechargement suivant, sur toutes les pages. La description dit donc où le
    // résultat se voit — sur le site lui-même — parce que c'est la seule réponse vraie.
    description:
      "Les adresses de vos comptes (Discord, réseaux, HelloAsso) et l'e-mail de contact. " +
      "Elles s'appliquent à tout le site dès l'enregistrement, sans brouillon.",
  },
  {
    href: "/admin/tournois",
    libelle: "Tournois",
    // ══════════════════════════════════════════════════════════════════════════════════
    // 🔴 NI « Voir le rendu avant de publier », NI ROUTE `apercu/` — ET C'EST MESURÉ
    // ══════════════════════════════════════════════════════════════════════════════════
    //
    // La story 9.1 affirmait au cadrage que « CHAQUE description se termine par "Voir le
    // rendu avant de publier." ». **Faux, relevé le 2026-08-13 par lecture de ce fichier :
    // CINQ sur sept.** `sollicitations` et `reglages` ne la portent pas, et le bloc 🔴 de
    // tête dit pourquoi : recopier la phrase par mimétisme **promettrait une porte sans
    // pièce** — le défaut exact que ce fichier existe pour empêcher, et qui s'est produit
    // DEUX fois. La règle réelle est donc CONDITIONNELLE : la phrase n'est due que si la
    // section a un rendu à montrer.
    //
    // 🔴 ET ICI IL N'Y EN A AUCUN, PAR CONSTRUCTION. L'arbitrage A6 ferme le périmètre :
    // cette story n'ajoute **aucune page publique**. `/tournois` (Story 9.2) et
    // `/tournois/<tournoi>` (Story 9.3) n'existent pas encore, donc un tournoi publié
    // aujourd'hui **n'est visible nulle part**. Un aperçu ne pourrait que **préfigurer** un
    // rendu non écrit — c'est-à-dire diverger de lui le jour où il existera, et « mentir
    // exactement au moment où on lui demande de dire la vérité » (commentaire d'en-tête de
    // l'aperçu des ateliers). La route `apercu/` et la phrase arrivent avec la 9.3.
    //
    // ⚠️ Ce fait n'est pas seulement écrit ici : l'écran de liste le DIT au bénévole, parce
    // que « publier » y est un geste dont l'effet est aujourd'hui **invisible** — règle ①
    // de `00 référence/pieges/integration-tierce.md` (un maillon jamais exercé se consigne
    // AVEC son mode de défaillance écrit).
    description:
      "Les tournois de l'association : jeu, date, inscriptions, lots et podium. " +
      "Ils se préparent ici dès maintenant ; la page publique qui les affichera arrive " +
      "juste après.",
  },
] as const;
