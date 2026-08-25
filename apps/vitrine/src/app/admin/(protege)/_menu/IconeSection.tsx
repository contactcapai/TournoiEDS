import type { IconeSection as CleIcone } from "../../_sections";

/**
 * Les dessins de la barre latérale (Story 13.2).
 *
 * 🔴 DES SVG EN LIGNE, PAS UNE BIBLIOTHÈQUE D'ICÔNES. Le projet n'en a aucune (`ExternalIcon`
 * était la seule du dépôt), et en installer une pour neuf dessins ferait entrer un paquet,
 * ses mises à jour et son poids pour ce que neuf `<path>` font en trente lignes.
 *
 * 🔴 GÉOMÉTRIQUES ET NON ILLUSTRATIFS, à dessein : un trait simple se lit à 18 px et ne
 * vieillit pas. Ce ne sont pas des pictogrammes de marque.
 *
 * ⚠️ `aria-hidden` SUR TOUS : le libellé est écrit juste à côté. Un dessin qui se ferait
 * annoncer doublerait chaque entrée du menu pour un lecteur d'écran — le contraire du
 * service rendu. (Règle a11y du projet : les décoratifs sont `aria-hidden`.)
 * ⚠️ `currentColor` PARTOUT : l'entrée active change de couleur, le dessin suit sans que
 * personne ait à tenir une seconde palette d'accord avec la première.
 */
const CHEMINS: Record<CleIcone, React.ReactNode> = {
  // Calendrier : la grille des jeudis.
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  // Image : un cadre, un horizon, un soleil.
  galerie: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="8.5" cy="9" r="1.5" />
    </>
  ),
  // Deux plaques côte à côte : les logos alignés du bandeau.
  partenaires: (
    <>
      <rect x="2" y="7" width="9" height="10" rx="2" />
      <rect x="13" y="7" width="9" height="10" rx="2" />
    </>
  ),
  // Étincelle : une animation, une intervention.
  ateliers: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
    </>
  ),
  // Deux personnes : l'équipe de la page « L'asso ».
  membres: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7M17.5 14.5A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  // Enveloppe : ce qui arrive du formulaire public.
  sollicitations: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  // Curseurs : ce qu'on règle et qui s'applique tout de suite.
  reglages: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7" cy="17" r="2" />
    </>
  ),
  // Coupe : le tournoi.
  tournois: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5a3 3 0 0 0 3 3M17 5.5h2.5a3 3 0 0 1-3 3" />
      <path d="M12 14v4M8.5 20h7" />
    </>
  ),
  // Clé : qui peut entrer.
  acces: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M17.5 12v3.5M20.5 12v2.5" />
    </>
  ),
};

export function IconeSection({ nom }: { nom: CleIcone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {CHEMINS[nom]}
    </svg>
  );
}
