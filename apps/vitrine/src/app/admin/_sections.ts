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

import { type RoleAdmin, detientRole } from "@/lib/roles";

/** Une entrée de la navigation du back-office. */
export type SectionAdmin = {
  /** Chemin absolu sous `/admin` (ex. `/admin/agenda`). */
  href: string;
  /** Libellé affiché au bénévole. Registre courant, pas de jargon technique. */
  libelle: string;
  /** Une phrase : ce que le bénévole vient y faire. */
  description: string;
  /**
   * 🔴 LE RÔLE QUI OUVRE CETTE SECTION (Story 8.1). Ce champ n'est pas décoratif : c'est
   * LA source dont `server/auth/sections.ts` dérive la table chemin → rôle du proxy. Une
   * section déclarée ici sans rôle ne compile pas ; une section ajoutée sous `/admin` sans
   * entrée ici est refusée par le proxy (fail-closed). Il n'y a donc pas de seconde liste
   * à tenir d'accord avec celle-ci — le piège `garde-sur-une-copie` (forme n°3) est
   * exactement celui-là.
   */
  role: RoleAdmin;
  /**
   * 🔴 LA FAMILLE SE DÉCLARE ICI, JAMAIS DANS LE RENDU (Story 13.2) — même doctrine que le
   * `role` et que le registre lui-même : la suppression d'une section emporte son
   * classement. Un regroupement écrit dans le composant de menu serait une SECONDE liste,
   * fausse au premier ajout et verte pendant tout ce temps.
   *
   * ⚠️ Le découpage n'est pas décoratif, il RECOUPE le code : `publication` est exactement
   * l'ensemble des sections qui portent « Voir le rendu avant de publier » ; `gestion` ce
   * qui se pilote ou se reçoit ; `configuration` ce qui s'applique SANS brouillon.
   */
  famille: FamilleAdmin;
  /**
   * Le dessin qui accompagne le libellé dans la barre latérale (Story 13.2).
   *
   * ⚠️ UNE CLÉ, PAS UN COMPOSANT NI UN CHEMIN SVG. Le registre est importé par le proxy
   * (côté serveur) autant que par le menu (côté client) : y poser du JSX le rendrait
   * inutilisable de l'un des deux côtés. Le dessin vit dans `_menu/IconeSection.tsx`.
   *
   * 🔴 CHAMP OBLIGATOIRE, comme `role` et `famille` : une section neuve ne compile pas tant
   * qu'elle n'a pas choisi. C'est ce qui évite l'entrée sans dessin qui casse l'alignement
   * de toute la colonne — et personne ne relit un alignement.
   */
  icone: IconeSection;
};

/** Les dessins disponibles. Un par section, aucun en réserve. */
export type IconeSection =
  | "agenda"
  | "galerie"
  | "partenaires"
  | "ateliers"
  | "membres"
  | "sollicitations"
  | "reglages"
  | "tournois"
  | "acces";

/** Les familles, dans l'ordre où elles s'affichent. */
export const FAMILLES_ADMIN = ["publication", "gestion", "configuration"] as const;

export type FamilleAdmin = (typeof FAMILLES_ADMIN)[number];

export const LIBELLE_FAMILLE: Record<FamilleAdmin, string> = {
  publication: "Publication",
  gestion: "Gestion",
  configuration: "Configuration",
};

export const SECTIONS_ADMIN: readonly SectionAdmin[] = [
  {
    href: "/admin/agenda",
    libelle: "Agenda",
    description:
      "Les jeudis, les temps forts et les bars du roulement. Voir le rendu avant de publier.",
    role: "admin_site",
    famille: "publication",
    icone: "agenda",
  },
  {
    href: "/admin/galerie",
    libelle: "Galerie",
    description:
      "Les photos de la vie de l'asso : téléverser, décrire, ordonner. Voir le rendu avant de publier.",
    role: "admin_site",
    famille: "publication",
    icone: "galerie",
  },
  {
    href: "/admin/partenaires",
    libelle: "Partenaires",
    description:
      "Sponsors, partenaires, soutiens et participations : logos, ordre, publication. Voir le rendu avant de publier.",
    role: "admin_site",
    famille: "publication",
    icone: "partenaires",
  },
  {
    href: "/admin/ateliers",
    libelle: "Ateliers",
    description:
      "L'offre d'animations : intitulés, familles, ordre, publication. Voir le rendu avant de publier.",
    role: "admin_site",
    famille: "publication",
    icone: "ateliers",
  },
  {
    href: "/admin/membres",
    libelle: "Membres",
    description:
      "L'équipe présentée sur la page « L'asso » : prénom, rôle, portrait, ordre, publication. Voir le rendu avant de publier.",
    role: "admin_site",
    famille: "publication",
    icone: "membres",
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
    role: "admin_site",
    famille: "gestion",
    icone: "sollicitations",
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
    role: "admin_site",
    famille: "configuration",
    icone: "reglages",
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
    // ✅ **LA DETTE EST PAYÉE — STORY 9.3.** Ce bloc disait : *« la phrase reste due — mais
    // pas encore payable […] Ce qui n'existe toujours pas, c'est ce que la phrase promet
    // précisément : une route `apercu/` permettant de voir le rendu AVANT de publier […] ⇒ La
    // route `apercu/` et la phrase arrivent toujours avec la Story 9.3. »*
    // La route existe (`/admin/tournois/[id]/apercu`, le composant public RÉEL), donc la
    // phrase est **payable** et elle est posée — dans le MÊME commit, jamais avant. C'est
    // toute la règle de ce fichier : la phrase n'est due que si la section a un rendu à
    // montrer, et elle n'est écrite que si la porte existe. L'écrire d'avance aurait été
    // « une porte sans pièce », le défaut qui s'est déjà produit DEUX fois ici.
    //
    // ⚠️ Cette description a déjà été RÉÉCRITE une fois (Story 9.2) parce qu'elle annonçait
    // « la page publique qui les affichera arrive juste après » — faux dès que cette page a
    // existé. Une phrase datée qu'on ne relit pas est un cadrage périmé de plus
    // (`00 référence/pieges/cadrage-perime.md`), et celle-ci est lue par les bénévoles.
    description:
      "Les tournois de l'association : jeu, date, inscriptions, lots et podium. " +
      "Voir le rendu avant de publier.",
    role: "admin_tournoi",
    famille: "gestion",
    icone: "tournois",
  },
  {
    href: "/admin/acces",
    libelle: "Accès",
    // Ni « Voir le rendu avant de publier », ni aperçu : cette section ne publie rien sur le
    // site. Ce qu'on y change prend effet à la requête suivante, pour la personne concernée.
    description:
      "Qui peut entrer dans le back-office, et pour quoi faire. " +
      "Un rôle retiré prend effet immédiatement, sans attendre la fin de session.",
    role: "admin_site",
    famille: "configuration",
    icone: "acces",
  },
] as const;

/**
 * Les sections qu'un compte peut réellement atteindre (Story 8.1).
 *
 * 🔴 LE MENU NE MONTRE QUE CE QUI S'OUVRE. Afficher une entrée qui mène à `/admin/refus`
 * serait une porte sans pièce — le défaut précis que ce fichier existe pour empêcher, déjà
 * payé deux fois ici. Le filtre et la garde du proxy lisent le MÊME champ `role` : ils ne
 * peuvent pas diverger.
 *
 * ⚠️ Ce filtre est un CONFORT D'AFFICHAGE, jamais une protection : masquer un lien
 * n'interdit pas d'en taper l'URL. Ce qui protège, c'est le proxy et la garde de chaque page.
 */
export function sectionsPour(roles: readonly RoleAdmin[]): readonly SectionAdmin[] {
  return SECTIONS_ADMIN.filter((section) => detientRole(roles, section.role));
}

/**
 * Un chemin est-il couvert par ce préfixe de section ?
 *
 * 🔴 DÉFINIE ICI ET NON DANS `server/auth/sections.ts`, QUI L'IMPORTE. Deux consommateurs :
 * la garde du proxy (« quel rôle ce chemin exige-t-il ? ») et le menu (« quelle entrée est
 * courante ? »). Deux copies répondraient un jour différemment à la même question — et c'est
 * la porte fermée d'un côté, marquée active de l'autre.
 *
 * ⚠️ `=== ` OU `préfixe + "/"`, jamais un `startsWith` nu : `/admin/agendas` n'est pas
 * `/admin/agenda`, et les confondre marquerait la mauvaise entrée (ou pire, ouvrirait une
 * route inconnue avec le rôle de sa voisine).
 */
export function cheminCouvertPar(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

/**
 * La section à laquelle appartient le chemin courant, ou `null`.
 *
 * ⚠️ La PLUS LONGUE l'emporte — même règle que la garde du proxy : si un jour une section
 * vivait sous une autre, c'est la plus précise qui doit être marquée.
 */
export function sectionCourante(
  chemin: string,
  sections: readonly SectionAdmin[],
): SectionAdmin | null {
  return (
    [...sections]
      .sort((a, b) => b.href.length - a.href.length)
      .find((section) => cheminCouvertPar(chemin, section.href)) ?? null
  );
}

/** Une famille et les sections qu'elle contient réellement. */
export type GroupeAdmin = { famille: FamilleAdmin; sections: SectionAdmin[] };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE GROUPEMENT DOIT SAVOIR DÉGRADER — CONSÉQUENCE DIRECTE DE LA STORY 8.1
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La 13.2 a été cadrée le 2026-08-24, quand le menu montrait ses huit entrées à tout le
 * monde. Depuis la 8.1, il est FILTRÉ PAR RÔLE : un « admin tournoi » ne voit qu'**une**
 * entrée. Trois titres de famille au-dessus d'un seul lien ne rangeraient rien — ils
 * ajouteraient trois lignes de chrome à un menu qui en compte une.
 *
 * Deux règles, et elles se testent :
 *   ① une famille sans aucune section visible ne s'affiche pas ;
 *   ② s'il ne reste qu'UNE famille, on ne titre pas — il n'y a plus rien à distinguer.
 */
export function grouperParFamille(sections: readonly SectionAdmin[]): GroupeAdmin[] {
  return FAMILLES_ADMIN.map((famille) => ({
    famille,
    sections: sections.filter((section) => section.famille === famille),
  })).filter((groupe) => groupe.sections.length > 0);
}

/** Faut-il afficher les titres de famille ? Non quand il n'y a plus rien à distinguer. */
export function famillesUtiles(groupes: readonly GroupeAdmin[]): boolean {
  return groupes.length > 1;
}
